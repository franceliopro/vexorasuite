import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SitePreviewService } from './site-preview.service';

const SECRET = 'test-only-preview-secret-with-at-least-32-bytes';

const document = {
  version: 3,
  root: {
    id: 'root',
    type: 'section',
    props: {},
    styles: {},
    children: [
      {
        id: 'visible',
        type: 'text',
        props: { tag: 'p', content: 'Conteúdo salvo' },
        styles: {},
        children: [],
      },
      {
        id: 'hidden',
        type: 'text',
        props: { tag: 'p', content: 'Bloco oculto', visible: false },
        styles: {},
        children: [],
      },
      {
        id: 'form_1',
        type: 'form',
        props: { fields: ['nome'] },
        styles: {},
        children: [],
      },
    ],
  },
  meta: { title: 'Rascunho', type: 'static', theme: {} },
};

function setup() {
  const prisma = {
    site: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'site-1',
        name: 'Site de teste',
        slug: 'site-de-teste',
        primaryColor: null,
        accentColor: null,
      }),
    },
    siteDocument: {
      findUnique: jest.fn().mockResolvedValue({ version: 3, document }),
    },
  } as any;
  return { prisma, service: new SitePreviewService(prisma, new JwtService()) };
}

describe('prévia temporária do site', () => {
  const previous = process.env.JWT_ACCESS_SECRET;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = SECRET;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previous;
  });

  it('gera um caminho assinado que renderiza somente o rascunho salvo', async () => {
    const { service, prisma } = setup();
    const created = await service.create('site-1', 'tenant-1');

    expect(created.path).toMatch(/^\/api\/public\/sites\/preview\/[A-Za-z0-9_.-]+$/);
    expect(created.version).toBe(3);
    expect(new Date(created.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const html = await service.render(created.token);
    expect(html).toContain('Prévia temporária');
    expect(html).toContain('rascunho não publicado');
    expect(html).toContain('Conteúdo salvo');
    expect(html).not.toContain('Bloco oculto');
    expect(html).toContain('formulários desativados');
    expect(html).toContain('disabled');
    expect(html).not.toContain('URLSearchParams');
    expect(prisma.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'site-1', tenantId: 'tenant-1' } }),
    );
  });

  it('rejeita link alterado ou expirado sem consultar o banco', async () => {
    const { service, prisma } = setup();
    const created = await service.create('site-1', 'tenant-1');

    await expect(service.render(`${created.token}x`)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.site.findFirst).toHaveBeenCalledTimes(1);
  });
});

import { PresenceService, renderArtworkSvg } from './presence.service';

const req = (role = 'OWNER') => ({ user: { tenantId: '11111111-1111-4111-8111-111111111111', role, sub: 'owner' } }) as any;

function fixture() {
  let root: any = { presence: { externalSites: [], artworks: [] } };
  const tx: any = {
    $queryRaw: jest.fn(),
    tenant: {
      findUniqueOrThrow: jest.fn(async () => ({ integrations: root })),
      update: jest.fn(async ({ data }: any) => { root = data.integrations; }),
    },
  };
  const prisma: any = {
    $transaction: (fn: any) => fn(tx),
    tenant: { findUniqueOrThrow: jest.fn(async () => ({ integrations: root })) },
  };
  const cf: any = {
    isConfigured: jest.fn(() => true),
    getProject: jest.fn(async () => ({})),
    createProject: jest.fn(async () => ({})),
    createDeployment: jest.fn(async () => ({ url: 'https://vexora-presenca.pages.dev/arte-1/index.html' })),
  };
  return { service: new PresenceService(prisma, cf), prisma, cf, root: () => root };
}

describe('presença Véxora — sites externos e artes', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('gera arte original escapando texto e cadastrando somente no tenant atual', async () => {
    const { service, root } = fixture();
    const svg = renderArtworkSvg({ headline: '<script>oi</script>', subtitle: 'Rastreabem', cta: 'Ver mais', colors: { background: '#101317', accent: '#FACC15', text: '#FFFFFF' } });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    const created = await service.createArtwork(req(), { title: 'Arte Rastreabem', headline: 'Rastreie seu veículo', subtitle: 'Rastreabem', cta: 'Consultar' });
    expect(created.artwork.status).toBe('READY');
    expect(root().presence.artworks).toHaveLength(1);
    expect(root().presence.artworks[0]!.createdBy).toBe('owner');
  });

  it('recusa URL que não seja https', async () => {
    const { service } = fixture();
    await expect(service.addExternalSite(req(), { title: 'Site', url: 'http://rastreabem.com.br' })).rejects.toThrow('https');
  });

  it('registra referência externa sem afirmar publicação pela Véxora', async () => {
    const { service, root } = fixture();
    const result = await service.addExternalSite(req(), { title: 'Rastreabem', url: 'https://rastreabem.com.br/', description: 'Site observado no ar' });
    expect(result.externalSites[0]!.title).toBe('Rastreabem');
    expect(root().presence.externalSites[0]!.url).toBe('https://rastreabem.com.br/');
    await expect(service.addExternalSite(req(), { title: 'Repetido', url: 'https://rastreabem.com.br/' })).rejects.toThrow('já está cadastrado');
  });

  it('só confirma a publicação depois de 2xx na URL final', async () => {
    const { service, cf } = fixture();
    await service.createArtwork(req(), { title: 'Arte', headline: 'Rastreie', subtitle: 'Rastreabem', cta: 'Consultar' });
    const id = (await service.list(req())).artworks[0]!.id;
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) } as any);
    const result = await service.publishArtwork(req(), id);
    expect(result).toMatchObject({ status: 'PUBLISHED', verified: true });
    expect(cf.createDeployment).toHaveBeenCalledTimes(1);
    const files = cf.createDeployment.mock.calls[0][1];
    expect(files.map((f: any) => f.path)).toEqual(['index.html', `${id}.svg`, `${id}/index.html`]);
    expect((await service.list(req())).artworks[0]!.status).toBe('PUBLISHED');
  });

  it('mantém rascunho e falha honestamente quando a URL não responde 2xx', async () => {
    const { service } = fixture();
    await service.createArtwork(req(), { title: 'Arte', headline: 'Rastreie', subtitle: '', cta: 'Consultar' });
    const id = (await service.list(req())).artworks[0]!.id;
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) } as any);
    await expect(service.publishArtwork(req(), id)).rejects.toThrow('não respondeu 2xx');
    expect((await service.list(req())).artworks[0]!.status).toBe('FAILED');
  });

  it('bloqueia atendente e instalação sem Cloudflare', async () => {
    const { service, cf } = fixture();
    cf.isConfigured.mockReturnValue(false);
    await expect(service.createArtwork(req('AGENT'), { title: 'Arte', headline: 'x', cta: 'y' })).rejects.toThrow('responsáveis');
    await expect(service.publishArtwork(req(), 'arte-inexistente')).rejects.toThrow('Cloudflare não configurado');
  });
});

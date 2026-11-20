import { buildWizardDraft } from './marketing-wizard';
import { slideSvg } from './assistant-automation.service';

describe('deterministic marketing wizard', () => {
  it('creates a complete draft with four covers and a CTA on every slide', () => {
    const first = buildWizardDraft({ question: 'Campanha para clínica odontológica', format: 'CAROUSEL', company: 'Clínica Exemplo' });
    const second = buildWizardDraft({ question: 'Campanha para clínica odontológica', format: 'CAROUSEL', company: 'Clínica Exemplo' });

    expect(first).toEqual(second);
    expect(first.covers).toHaveLength(4);
    expect(first.covers.map((cover) => cover.theme)).toEqual(['dark', 'dark', 'light', 'light']);
    expect(first.slides).toHaveLength(6);
    expect(first.slides.every((slide) => slide.cta.length > 0)).toBe(true);
    expect(first.slides.at(-1)?.cta).toContain('AGENDAR CONSULTA');
    expect(first.caption).toMatch(/rascunho/i);
    expect(first.caption.length).toBeGreaterThan(80);
  });

  it('sanitizes the request and keeps the format responsive', () => {
    const draft = buildWizardDraft({ question: '<script>alert(1)</script> pizzaria', format: 'POST', company: 'Pizzaria' });
    expect(draft.slides).toHaveLength(1);
    expect(draft.caption).not.toContain('<script>');
    expect(draft.slides.at(-1)?.cta).toContain('RESERVAR SUA MESA');
  });

  it('renders light and dark covers without an image model', () => {
    const draft = buildWizardDraft({ question: 'Aula de design', format: 'CAROUSEL', company: 'Escola' });
    const carousel = { title: draft.title, caption: draft.caption, slides: draft.slides };
    const dark = slideSvg(carousel, 0, '#5865da', 'Escola', [], 'CAROUSEL', { theme: 'dark' });
    const light = slideSvg(carousel, 0, '#5865da', 'Escola', [], 'CAROUSEL', { theme: 'light', slide: draft.covers[2], cta: 'GARANTIR SUA VAGA', label: 'CAPA 3/4' });

    expect(dark).toContain('fill="#191D28"');
    expect(light).toContain('fill="#f5f5f1"');
    expect(light).toContain('CAPA 3/4');
    expect(light).toContain('GARANTIR SUA VAGA');
    expect(light).not.toContain('<script>');
  });
});

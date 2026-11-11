import { blueprintFor, BUSINESS_AREAS } from './blueprint';
describe('Site blueprint',()=>{
  const areas = Object.keys(BUSINESS_AREAS);
  it('generates a home/services/team/contact blueprint for every area',()=>{
    for (const area of areas) {
      const bp = blueprintFor(area, 'Clínica Teste', { primaryColor: '#0E7A5C', accentColor: '#6258DF', whatsapps: [{ label: 'Recepção', handle: '5562999990001' }], socials: [], dynamic: true });
      const slugs = bp.pages.map(p=>p.slug);
      expect(slugs).toContain('inicio');
      expect(slugs).toContain('servicos');
      expect(slugs).toContain('contato');
      expect(bp.pages.every(p=>p.blocks.length>0)).toBe(true);
      expect(bp.meta.headline.length).toBeGreaterThan(5);
    }
  });
  it('emits an imoveis page only for imobiliaria and posts only for blogs/schools',()=>{
    const imob = blueprintFor('imobiliaria', 'Imobiliária Sol', { primaryColor:'#0E7A5C', accentColor:'#6258DF', whatsapps:[{label:'Vendas',handle:'5562999990002'}], socials:[], dynamic:true });
    expect(imob.pages.map(p=>p.slug)).toContain('imoveis');
    const escola = blueprintFor('escola_musica', 'Escola Som', { primaryColor:'#0E7A5C', accentColor:'#6258DF', whatsapps:[{label:'Secretaria',handle:'5562999990003'}], socials:[], dynamic:true });
    expect(escola.pages.map(p=>p.slug)).toContain('noticias');
    const clinica = blueprintFor('clinica_medica', 'Clínica Vida', { primaryColor:'#0E7A5C', accentColor:'#6258DF', whatsapps:[{label:'Recepção',handle:'5562999990004'}], socials:[], dynamic:true });
    expect(clinica.pages.map(p=>p.slug)).not.toContain('noticias');
    expect(clinica.pages.map(p=>p.slug)).not.toContain('imoveis');
  });
});

import { webDesignerAgent, WEB_DESIGNER_AGENT_ID } from './web-designer-agent';
import { productSkills, skillInstructions, tenantSkills } from './product-skills';
describe('Default Web Designer agent', () => {
  it('is named Design Gráfico & Web with the stable id and premium tier', () => {
    const agent = webDesignerAgent();
    expect(agent.id).toBe(WEB_DESIGNER_AGENT_ID);
    expect(agent.name).toBe('Design Gráfico & Web');
    expect(agent.tier).toBe('Inteligente');
    expect(agent.enabled).toBe(true);
    expect(agent.bindings.inboxes).toHaveLength(0);
    expect(agent.llm.provider).toBe('openai');
    expect(agent.llm.tier).toBe('Inteligente');
    expect(agent.allowedActions).toContain('web.design.premium');
    expect(agent.allowedActions).toContain('creative.design.director');
  });
  it('ships an implemented web.design.premium skill with reference research', () => {
    const skill = productSkills.find(s => s.id === 'web.design.premium');
    expect(skill).toBeDefined();
    expect(skill!.status).toBe('implemented');
    expect(skill!.instructions).toContain('behance.net');
    expect(skill!.instructions).toContain('dribbble.com');
    expect(skill!.instructions).toContain('elements.envato.com');
    expect(skill!.instructions).toContain('br.pinterest.com');
    expect(skillInstructions({}, 'web.design.premium').length).toBeGreaterThan(200);
    expect(tenantSkills({}).some(s => s.id === 'web.design.premium')).toBe(true);
  });
});

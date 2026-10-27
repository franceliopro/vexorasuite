/** Published flow contract. Unsupported blocks fail publication, never silently execute as text. */
export type RuntimeStep = {
  id: string; title: string; message: string; options: string[];
  transitions?: Record<string, string>; kind?: string; action?: string; config?: string;
  position?: { x: number; y: number };
};
export type RuntimeFlow = {
  name: string; welcome: string; steps: RuntimeStep[]; channelIds?: string[];
  triggers?: { kind: 'message' | 'dm' | 'keyword'; keyword?: string }[];
};
export const executableKinds = ['text', 'buttons', 'input.text', 'human.handoff', 'assignment', 'tag', 'asaas.payment.lookup', 'agent', 'variable', 'condition'];
export const executableActions = ['human.handoff', 'asaas.payment.lookup'];
export function settings(step: RuntimeStep): Record<string, string> {
  if (!step.config?.trim()) return {};
  const parsed: unknown = JSON.parse(step.config);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some(v => typeof v !== 'string')) throw new Error('Configuração deve ser um objeto JSON com valores de texto');
  return parsed as Record<string, string>;
}
export function validateRuntimeFlow(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Fluxo inválido'];
  const f = value as RuntimeFlow;
  if (typeof f.name !== 'string' || !f.name.trim() || f.name.length > 120 || typeof f.welcome !== 'string' || f.welcome.length > 4000) errors.push('Nome ou saudação inválidos');
  if (!Array.isArray(f.steps) || !f.steps.length || f.steps.length > 100) return [...errors, 'Use entre 1 e 100 blocos'];
  if (!Array.isArray(f.channelIds) || !f.channelIds.length || f.channelIds.length > 30 || f.channelIds.some(id => typeof id !== 'string') || new Set(f.channelIds).size !== f.channelIds.length) errors.push('Selecione canais válidos, sem duplicação');
  if (!Array.isArray(f.triggers) || !f.triggers.length || f.triggers.length > 10 || f.triggers.some(t => !t || !['message','dm','keyword'].includes(t.kind) || (t.kind === 'keyword' && (typeof t.keyword !== 'string' || !t.keyword.trim() || t.keyword.length > 120)))) errors.push('Configure um gatilho válido');
  const ids = new Set<string>();
  for (const s of f.steps) {
    if (!s || typeof s.id !== 'string' || !/^[\w-]{1,80}$/.test(s.id) || ids.has(s.id)) { errors.push('Identificador de bloco inválido ou repetido'); continue; }
    ids.add(s.id);
    if (typeof s.title !== 'string' || s.title.length > 120 || typeof s.message !== 'string' || s.message.length > 4000 || !Array.isArray(s.options) || s.options.length > 30 || s.options.some(o => typeof o !== 'string' || !o.trim() || o.length > 160) || new Set(s.options.filter(o => typeof o === 'string').map(normalize)).size !== s.options.length) errors.push(`${s.id}: texto ou opções inválidos`);
    if (s.kind && !executableKinds.includes(s.kind)) errors.push(`${s.id}: bloco ${s.kind} ainda não executável`);
    if (s.action && !executableActions.includes(s.action)) errors.push(`${s.id}: Skill ${s.action} ainda não executável`);
    if (s.kind && s.action && s.kind !== s.action) errors.push(`${s.id}: tipo e Skill conflitantes`);
    try {
      const config = settings(s);
      if (s.kind === 'input.text' && !/^[a-zA-Z][\w]{0,39}$/.test(config.variable || '')) errors.push(`${s.id}: informe a variável de entrada`);
      if (s.kind === 'assignment' && config.userId) errors.push(`${s.id}: atribuição individual ainda não executável; use departmentKey`);
      if (s.kind === 'text' && s.options.length > 1) errors.push(`${s.id}: use múltipla escolha para mais de uma saída`);
      if (s.kind === 'agent' && !config.agentId) errors.push(`${s.id}: selecione agentId de um agente configurado`);
      if (['variable','condition'].includes(s.kind || '') && (!/^[a-zA-Z][\w]{0,39}$/.test(config.variable || '') || typeof config.value !== 'string')) errors.push(`${s.id}: configure variable e value`);
      if (s.kind === 'condition' && (!s.options.includes('Sim') || !s.options.includes('Não') || s.options.length !== 2)) errors.push(`${s.id}: condição exige saídas Sim e Não`);
      if (s.kind === 'tag' && (!config.name?.trim() || config.name.length > 40 || !/^#[a-f\d]{6}$/i.test(config.color || ''))) errors.push(`${s.id}: configure name e color da etiqueta`);
    } catch { errors.push(`${s.id}: configuração JSON inválida`); }
  }
  for (const s of f.steps) {
    if (!s || !Array.isArray(s.options)) continue;
    if (s.transitions !== undefined && (!s.transitions || typeof s.transitions !== 'object' || Array.isArray(s.transitions))) { errors.push(`${s.id}: conexões inválidas`); continue; }
    for (const [option, target] of Object.entries(s.transitions || {})) if (!s.options.includes(option) || (target !== '__start__' && !ids.has(target))) errors.push(`${s.id}: destino inválido`);
    const type = s.action || s.kind || 'buttons';
    if (!['human.handoff','assignment','asaas.payment.lookup'].includes(type)) {
      if (s.options.some(o => !s.transitions?.[o])) errors.push(`${s.id}: conecte todas as saídas`);
      if (['input.text','tag','variable'].includes(type) && s.options.length !== 1) errors.push(`${s.id}: use exatamente uma saída de continuação`);
    }
  }
  return errors;
}
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
export function selectedOption(step: RuntimeStep, text: string): string | undefined {
  const value = normalize(text);
  if (/^[1-9]\d*$/.test(value)) return step.options[Number(value) - 1];
  return step.options.find(o => normalize(o) === value);
}
export function renderStep(step: RuntimeStep, variables: Record<string, string>): string {
  const message = step.message.replace(/\{\{(\w+)\}\}/g, (_, name: string) => Object.hasOwn(variables,name) && typeof variables[name] === 'string' ? variables[name]! : '');
  return [message, step.options.map((o, i) => `${i + 1}. ${o}`).join('\n')].filter(Boolean).join('\n\n');
}

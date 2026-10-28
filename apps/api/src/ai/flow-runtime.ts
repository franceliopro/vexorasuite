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
export const executableKinds = ['text', 'buttons', 'input.text', 'input.cpf', 'human.handoff', 'assignment', 'department.route', 'tag', 'asaas.payment.lookup', 'agent', 'crm.stage.move', 'crm.finalize', 'variable', 'condition'];
export const executableActions = ['human.handoff', 'asaas.payment.lookup', 'crm.stage.move', 'crm.finalize'];
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
      if (['input.text','input.cpf'].includes(s.kind||'') && !/^[a-zA-Z][\w]{0,39}$/.test(config.variable || '')) errors.push(`${s.id}: informe a variável de entrada`);
      if ((s.action==='crm.stage.move'||s.kind==='crm.stage.move') && (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(config.pipelineId || '') || !/^[-\w]{1,80}$/.test(config.stage || ''))) errors.push(s.id+': selecione pipeline e etapa válidos');
      if ((s.action==='crm.finalize'||s.kind==='crm.finalize') && (!['WON','LOST'].includes(config.outcome||'') || (config.outcome==='LOST'&&!['Preço/Condição','Sem interesse','Sem retorno','Concorrência','Inatividade'].includes(config.reason||'')))) errors.push(s.id+': informe o resultado comercial e um motivo válido quando for perda');
      if (s.kind==='department.route'&&!config.departmentKey) errors.push(s.id+': selecione o departamento de destino');
      if (config.userId && !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(config.userId)) errors.push(`${s.id}: atendente inválido`);
      if (config.targetMode && !['QUEUE','DEPARTMENT','PERSON','PLATFORM'].includes(config.targetMode)) errors.push(`${s.id}: modo de transferência inválido`);
      if (config.targetMode === 'DEPARTMENT' && !config.departmentKey) errors.push(`${s.id}: selecione o time de destino`);
      if (config.targetMode === 'PERSON' && !config.userId) errors.push(`${s.id}: selecione o atendente de destino`);
      if (config.targetMode === 'QUEUE' && (config.departmentKey || config.userId)) errors.push(`${s.id}: fila geral não pode conter time ou atendente`);
      if (config.targetMode === 'DEPARTMENT' && config.userId) errors.push(`${s.id}: use destino Atendente para atribuição individual`);
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
    if (type === 'crm.finalize') {
      if (s.options.length) errors.push(`${s.id}: finalização comercial não precisa de saídas`);
    } else if (!['human.handoff','assignment','department.route','asaas.payment.lookup'].includes(type)) {
      if (s.options.some(o => !s.transitions?.[o])) errors.push(`${s.id}: conecte todas as saídas`);
      if (['input.text','tag','variable','crm.stage.move'].includes(type) && s.options.length !== 1) errors.push(`${s.id}: use exatamente uma saída de continuação`);
    }
  }
  // Detect loops that have no wait for a customer message; they must not flood the channel.
  const autoSteps = f.steps.filter(s => s && (['variable','condition','tag'].includes(s.kind || '') || (s.kind === 'text' && Array.isArray(s.options) && s.options.length === 1)));
  const automatic = new Map(autoSteps.map(s => [s.id,s]));
  const visiting = new Set<string>(), visited = new Set<string>();
  const cycle = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id) || !automatic.has(id)) return false;
    visiting.add(id);
    for (const target of Object.values(automatic.get(id)!.transitions || {})) {
      const next = target === '__start__' ? (f.steps.find(s => s?.id === 'menu')?.id || f.steps[0]?.id || '') : target;
      if (cycle(next)) return true;
    }
    visiting.delete(id); visited.add(id); return false;
  };
  if (autoSteps.some(s => cycle(s.id))) errors.push('Ciclo de execução automática: inclua uma entrada ou escolha do cliente');
  return errors;
}
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
export function selectedOption(step: RuntimeStep, text: string): string | undefined {
  const value = normalize(text);
  if (/^[1-9]\d*$/.test(value)) return step.options[Number(value) - 1];
  return step.options.find(o => normalize(o) === value);
}
export function interpolateVariables(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{([\w .-]+)\}\}/g, (_, name: string) => {
    const direct = variables[name];
    if (typeof direct === 'string') return direct;
    const normalized = name.toLocaleLowerCase('pt-BR').replace(/[\s_-]/g, '');
    const match = Object.entries(variables).find(([key]) => key.toLocaleLowerCase('pt-BR').replace(/[\s_-]/g, '') === normalized);
    return typeof match?.[1] === 'string' ? match[1] : '';
  });
}
export function renderStep(step: RuntimeStep, variables: Record<string, string>): string {
  const message = interpolateVariables(step.message, variables);
  const options = step.options.map((option, i) => `${i + 1}. ${interpolateVariables(option, variables)}`).join('\n');
  return [message, options].filter(Boolean).join('\n\n');
}

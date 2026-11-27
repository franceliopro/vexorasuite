/**
 * WORDPRESS permanece apenas como chave histórica de negação: product-scope bloqueia
 * todas as rotas /api/wordpress e os testes/e2e validam que a negação funciona.
 * Remover a chave faria o bloqueio silencioso e quebraria a política de acesso.
 * EMAIL continua ativo como módulo do canal de e-mail; não é escopo retired.
 */
export const MODULES = [
  "INBOX",
  "CRM",
  "CALENDAR",
  "TASKS",
  "AUTOMATION",
  "MARKETING",
  "SITES",
  "WORDPRESS",
  "EMAIL",
  "FINANCE",
  "CHANNELS",
  "SETTINGS",
  "PLANS",
] as const;
export type ModuleKey = (typeof MODULES)[number];
export const administrative = (role: string) =>
  role === "OWNER" || role === "ADMIN";
export function moduleSelection(value: unknown): ModuleKey[] {
  if (
    !Array.isArray(value) ||
    value.length > MODULES.length ||
    value.some((v) => !MODULES.includes(v as ModuleKey))
  )
    throw Error("Seleção de módulos inválida.");
  return [...new Set(value)] as ModuleKey[];
}
export function effectiveModules(
  role: string,
  individual: readonly string[],
  departments: { modules: string[]; isActive?: boolean }[],
  inherited: readonly string[] = [],
  denied: readonly string[] = [],
): string[] {
  if (administrative(role)) return MODULES.filter(m=>!denied.includes(m));
  const permitted = new Set(
    departments.filter((d) => d.isActive !== false).flatMap((d) => d.modules),
  );
  return [...new Set([...individual,...inherited])].filter(
    (m) => MODULES.includes(m as ModuleKey) && permitted.has(m) && !denied.includes(m),
  );
}
export function routeModules(path: string, method: string): string[] {
  const p = path
    .replace(/^\/api\//, "")
    .replace(/^\//, "")
    .split("?")[0]!;
  // Submissão pública de formulário de site publicado: o visitante não tem sessão.
  // O service valida publicação, bloco, honeypot e limite de taxa antes de gravar.
  if (/^public\/(?:flows|sites)(?:\/|$)/.test(p)) return [];
  // Vitrine pública: o token substitui a sessão e limita o escopo ao catálogo do tenant.
  if (/^public\/storefront(?:\/|$)/.test(p)) return [];
  if (/^(auth\/|profile(?:\/|$))/.test(p)) return [];
  if (/^wordpress(?:\/|$)/.test(p)) return ["WORDPRESS"];
  if (/^department-resources\/context$/.test(p) && method === "GET") return ["INBOX","CRM","CALENDAR","MARKETING","TASKS"];
  if (/^contacts\/(brand-settings|profile-config)/.test(p) && method === "GET")
    return ["INBOX", "CRM", "SETTINGS"];
  if(/^contacts\/[^/]+\/(profile|history)$/.test(p))return ['INBOX','CRM'];
  if (/^contacts(?:\/|$)|^crm(?:\/|$)|^reports(?:\/|$)|^documents(?:\/|$)/.test(p)) return ["CRM"];
  if (/^track(?:\/|$)/.test(p)) return ["INBOX"];
  if (/^conversations(?:\/|$)|^events$|^overview$|^service-protocols/.test(p))
    return ["INBOX"];
  if (/^departments(?:\/|$)/.test(p) && method === "GET")
    return ["INBOX", "CRM", "SETTINGS", "AUTOMATION"];
  // Planos e preços é capacidade da plataforma: cliente só acessa quando liberado por entitlements.
  if (/^billing(?:\/|$)/.test(p)) return ["PLANS"];
  if (/^plans(?:\/|$)/.test(p)) return ["PLANS"];
  if (/^departments(?:\/|$)|^team(?:\/|$)/.test(p)) return ["SETTINGS"];
  if (/^channels(?:\/|$)/.test(p) && method === "GET")
    return ["INBOX", "AUTOMATION", "MARKETING", "CHANNELS"];
  if (/^channels(?:\/|$)/.test(p)) return ["CHANNELS"];
  if (/^integrations\/google\/calendar(?:\/|$)/.test(p)) return ["CALENDAR"];
  // Escola de Música é extensão da Agenda: herda CALENDAR e respeita negativas individuais.
  if (/^music-school(?:\/|$)/.test(p)) return ["CALENDAR"];
  // Gestão escolar completa também herda CALENDAR; negativas individuais continuam prevalecendo.
  if (/^school(?:\/|$)/.test(p)) return ["CALENDAR"];
  if (/^calendar|^google-calendar/.test(p)) return ["CALENDAR"];
  if (/^tasks(?:\/|$)/.test(p)) return ["TASKS"];
  // Geração de imagem por bloco já existia sob MARKETING antes do módulo SITES; manter a
  // alternativa evita quebrar empresas que já usam esse endpoint.
  if (/^sites\/[^/]+\/blocks\/[^/]+\/ai-image$/.test(p)) return ["SITES", "MARKETING"];
  // Criador, editor, domínio e publicação exigem o módulo SITES (igual ao menu da UI).
  if (/^sites(?:\/|$)/.test(p)) return ["SITES"];
  if (/^mail(?:\/|$)/.test(p)) return ["EMAIL"];
  // Compartilhamento da vitrine é leitura permitida a atendentes (INBOX) e administradores.
  if (/^storefront\/share$/.test(p)) return ["INBOX", "SETTINGS"];
  if (/^finance|^asaas|^integrations\/(?:asaas|stripe|infinitepay)(?:\/|$)/.test(p)) return ["FINANCE"];
  if (/^assistant\/automations|^marketing/.test(p)) return ["MARKETING"];
  // Referências e Drive foram realocados para Configurações; MARKETING fica apenas
  // como compatibilidade com sessões antigas.
  if (/^creative-references|^drive-manager/.test(p)) return ["SETTINGS", "MARKETING"];
  if (/^chatbot|^workflows|^assistant/.test(p)) return ["AUTOMATION"];
  if (/^integrations|^communications/.test(p)) return ["CHANNELS"];
  if (/^push/.test(p)) return ["INBOX"];
  return ["SETTINGS"];
}

/** Pattern grants follow current memberships; dropping a department revokes its inherited grants. */
export function patternModules(root:unknown,userId:string,departmentIds:string[]):string[]{
 const data=root&&typeof root==='object'&&!Array.isArray(root)?root as Record<string,unknown>:{};
 const patterns=data.businessPresets&&typeof data.businessPresets==='object'&&!Array.isArray(data.businessPresets)?data.businessPresets as Record<string,unknown>:{};
 const ids=new Set(departmentIds);
 return [...new Set(Object.values(patterns).flatMap(value=>{
   const p=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
   if(p.userId?p.userId!==userId:typeof p.departmentId!=='string'||!ids.has(p.departmentId))return [];
   return Array.isArray(p.modules)?p.modules.filter((m):m is string=>typeof m==='string'&&MODULES.includes(m as ModuleKey)):[];
 }))];
}

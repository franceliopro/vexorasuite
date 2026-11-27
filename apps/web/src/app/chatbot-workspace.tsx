"use client";
import "./chatbot-canvas.css";
import { InstagramCampaigns } from "./instagram-campaigns";
import {acquireBodyScrollLock} from "../lib/body-scroll-lock";
import { PlatformIcon, platformLabel, platformColor } from "./platform-icon";
import { optionText, commitOptions } from "../lib/flow-options";
import { writeTenantCache } from "../lib/tenant-cache";
import { explainStep, flowGuide, guidedKindDefaults, guidedKindOptions, preferredNameFlow, stepIO, type GuidedFlow as Flow, type GuidedStep as Step } from "../lib/guided-flow";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {createPortal} from "react-dom";
import {
  Bot,
  Plus,
  Trash2,
  Play,
  Save,
  GitBranch,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  BookOpen,
  X,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
  Copy,
  ExternalLink,
  Sparkles,
  Video,
  Phone,
  Search,
  Smile,
  Paperclip,
  Camera,
  Mic,
  Undo2,
  Redo2,
  FilePlus2,
  FileDown,
  FileUp,
  PanelLeft,
  Wand2,
  Maximize2,
  Scan,
  Ellipsis,
  Minimize2,
  Type,
  MessageSquare,
  Share2,
} from "lucide-react";

function canvasDirection(key:string,distance:number){
 switch(key){
  case "ArrowLeft":return {x:-distance,y:0};
  case "ArrowRight":return {x:distance,y:0};
  case "ArrowUp":return {x:0,y:-distance};
  case "ArrowDown":return {x:0,y:distance};
  default:return null;
 }
}

const optionTone = (option:string):"variavel"|"condicao"|"texto" => /\{\{\s*[\w]+\s*\}\}/.test(option)?"variavel":/^(sim|n[\u00E3a]o)$/i.test(option.trim())?"condicao":"texto";
const optionColor = (option:string) => optionTone(option)==="variavel"?"#8B5CF6":optionTone(option)==="condicao"?"#F59E0B":"#3B82F6";
const optionIcon = (option:string) => optionTone(option)==="variavel"?"{}":optionTone(option)==="condicao"?"?":"T";
function stepIoCard(step:Step){
  const io=stepIO(step);
  const toneColor=io.kind==="variable"?"#8B5CF6":io.kind==="condition"?"#F59E0B":"#3B82F6";
  const toneIcon=io.kind==="variable"?"{}":io.kind==="condition"?"?":"T";
  return <div className="mt-2 grid gap-1 rounded-token-sm border border-line bg-surface-2 p-2 text-flow-help text-ink" data-flow-io>
    <div className="flex flex-wrap items-center gap-2"><span style={{color:toneColor,fontWeight:800}} aria-hidden="true">{toneIcon}</span><strong>{io.label}</strong></div>
    <div><strong>Entrada:</strong> {io.input}</div>
    <div><strong>Sa&iacute;da:</strong> {io.output}</div>
    <div><strong>Vari&aacute;veis:</strong> {io.writes.length?io.writes.map(key=>"{{"+key+"}}").join(", "):io.reads.length?"L\u00EA "+io.reads.map(key=>"{{"+key+"}}").join(", "):"Nenhuma"}</div>
    <small>{io.note}</small>
  </div>;
}
type Channel = {id:string;name:string;provider:string;platform?:string;status:string};
const flowVariables=[["nome","Nome do cliente"],["novo_nome","Como o cliente prefere ser chamado"],["atendente","Atendente"],["departamento","Departamento"],["empresa","Empresa"],["razao_social","Razão social"],["cnpj","CNPJ"],["endereco_completo","Endereço completo"],["endereco","Endereço"],["telefone","Telefone"],["email","E-mail"],["protocolo","Protocolo do atendimento"],["saudacao","Saudação"],["despedida","Despedida"],["nome_identificado","Nome identificado"],["origem","Origem do contato"],["pipeline","Pipeline do CRM"],["etapa","Etapa do CRM"]] as const;
const integrationResults = {
 canal_atendimento: { label: "Canal de atendimento", values: [["whatsapp","WhatsApp"],["web","Chatbot web"],["instagram","Instagram"],["facebook","Facebook"],["outro","Outro canal"]] },
 agenda_reserva: { label: "Resultado do agendamento", values: [["confirmado","Confirmado"],["ocupado","Ocupado"],["indisponível","Não foi possível confirmar"]] },
 agenda_disponivel: { label: "Horário disponível", values: [["sim","Livre"],["não","Ocupado"],["indisponível","Não foi possível consultar"]] },
 lembrete_criado: { label: "Lembrete criado", values: [["sim","Criado"],["não","Não criado"]] },
 pagamento_status: { label: "Status do pagamento", values: [["PAID","Pago"],["PENDING","Pendente"],["CANCELLED","Cancelado"],["OVERDUE","Vencido"],["não encontrado","Sem cobrança"],["indisponível","Consulta indisponível"]] },
} as const;
const simulatedIntegrations = [
 ["payment.status","pagamento_status"],
 ["calendar.availability","agenda_disponivel"],
 ["calendar.book","agenda_reserva"],
] as const;
type SimulatedIntegration = (typeof simulatedIntegrations)[number][1];
type SimulationResults = Partial<Record<SimulatedIntegration,string>>;
const conditionVariables = [...flowVariables, ...Object.entries(integrationResults).map(([key, result])=>[key,result.label] as const)];
function conditionValueOptions(variable: string): ReadonlyArray<readonly [string,string]> {
 return Object.hasOwn(integrationResults,variable) ? integrationResults[variable as keyof typeof integrationResults].values : [];
}
const simulationContext: Record<string,string> = { nome: "Cliente de teste", novo_nome: "Cliente de teste", atendente: "Atendente de teste", departamento: "Atendimento", empresa: "Véxora Suite", razao_social: "Véxora Suite Tecnologia Ltda.", cnpj: "00.000.000/0001-00", endereco_completo: "Av. Brasil, 1000 · Cuiabá/MT", endereco: "Av. Brasil, 1000 · Cuiabá/MT", telefone: "+55 (65) 99999-9999", email: "cliente@teste.local", protocolo: "AT-2026-TESTE01", saudacao: "Olá!", despedida: "Até logo!" };
function resolveSimulationText(value: string, variables = simulationContext): string { return value.replace(/\{\{\s*([\w .-]+?)\s*\}\}/g, (_, key: string) => variables[key] ?? ""); }
type CatalogOption = { id: string; name: string; kind?: string; priceCents?: number; currency?: string; sku?: string | null; category?: string | null };
type NodeTone = "start" | "message" | "choice" | "input" | "logic" | "ai" | "catalog" | "asaas" | "transfer" | "crm" | "tag" | "end" | "finish" | "default";

const nodeTone = (step: Step): NodeTone => {
  const k = step.kind || step.action || "";
  if (!step.message && (!step.kind && !step.action)) return "default";
  if (step.kind === "input.text" || step.kind === "input.cpf" || step.kind === "input.email" || step.kind === "input.phone") return "input";
  if (step.action === "human.handoff" || step.kind === "human.handoff" || step.kind === "assignment" || step.kind === "department.route") return "transfer";
  if (step.action && step.action.startsWith("asaas.")) return "asaas";
  if (step.kind === "agent") return "ai";
  if (step.kind === "catalog.item" || step.kind === "catalog.list") return "catalog";
  if (step.kind === "condition" || step.kind === "variable") return "logic";
  if (step.kind === "buttons" || step.kind === "quick-reply") return "choice";
  if (step.kind === "tag") return "tag";
  if (step.action && step.action.startsWith("crm.")) return "crm";
  if (step.kind === "finish") return "finish";
  if (step.kind === "start" || step.kind === "trigger") return "start";
  return "message";
};

const nodeSummary = (step: Step, catalog: readonly CatalogOption[] = []): string => {
  const tone = nodeTone(step);
  if (tone === "catalog") {
    if (step.kind === "catalog.list") return "Enviar link do catálogo completo";
    const itemId = step.config?.match(/"itemId"\s*:\s*"([^"]+)"/)?.[1];
    return itemId ? catalog.find(item => item.id === itemId)?.name || "Item do catálogo" : "Selecione um item do catálogo";
  }
  if (tone === "input") return step.kind === "input.cpf" ? "Pedir CPF/CNPJ" : `Guardar resposta em {{${step.kind === "input.text" ? (step as any).config?.match(/"variable"\s*:\s*"([^"]+)"/)?.[1] ?? "variavel" : "resposta"}}}`;
  if (tone === "transfer") return step.kind === "department.route" ? "Encaminhar para setor" : step.kind === "assignment" ? "Atribuir a atendente" : "Transbordo para atendente";
  if (tone === "asaas") return "Cobrança Asaas";
  if (tone === "ai") return `Agente: ${(step.config ? (step.config.match(/"agentId"\s*:\s*"([^"]+)"/)?.[1] ?? "") : "") || "Assistente"}`;
  if (tone === "logic") return "Regras / valores";
  if (tone === "choice") return `${step.options?.length ?? 0} opção(ões)`;
  if (tone === "tag") return "Aplicar etiqueta";
  if (tone === "crm") return "Mover no pipeline";
  if (tone === "finish") return "Finalizar conversa";
  if (tone === "start") return "Gatilho inicial";
  if (step.message) return step.message.slice(0, 105) + (step.message.length > 105 ? "…" : "");
  if (step.options?.length) return `${step.options.length} escolha(s)`;
  return "Sem conteúdo configurado";
};

const palette=[{group:"Mensagens",items:[["text","Enviar mensagem"],["image","Imagem"],["video","Vídeo"],["buttons","Oferecer opções"],["quick-reply","Resposta rápida"]]},{group:"Entradas",items:[["input.text","Fazer pergunta"],["input.number","Número"],["input.cpf","CPF/CNPJ"],["input.email","E-mail"],["input.phone","Telefone"],["input.date","Data"],["input.url","Website"]]},{group:"Inteligência",items:[["agent","Agente de IA"]]},{group:"Catálogo",items:[["catalog.item","Item do catálogo"],["catalog.list","Listar catálogo"]]},{group:"Lógica",items:[["trigger","Gatilho"],["condition","Verificar condição"],["variable","Definir variável"],["redirect","Redirecionamento"],["delay","Espera"]]},{group:"Integrações",items:[["api","API / HTTP"],["webhook","Webhook"],["integration","Integração externa"]]},{group:"Financeiro",items:[["contact.lookup","Identificar cliente pelo telefone"],["asaas.payment.lookup","Consultar cobranças"],["payment.status","Consultar pagamento Stripe ou InfinitePay"],["asaas.payment.pix","PIX"],["asaas.payment.boleto","Boleto"]]},{group:"Agenda e lembretes",items:[["task.reminder","Criar lembrete"],["calendar.availability","Consultar horário na agenda"],["calendar.book","Agendar horário"]]},{group:"Atendimento",items:[["assignment","Direcionar para equipe"],["human.handoff","Transferir atendimento"],["crm.stage.move","Mover contato no pipeline"],["crm.finalize","Registrar ganho ou perda"],["finish","Finalizar conversa"],["tag","Tag / CRM"]]}] as const;
const emptyFlow:Flow={name:"Meu chatbot",welcome:"Olá! Como podemos ajudar?",steps:[],channelIds:[],triggers:[{kind:"message"}]};
const firstActions=[
 ["text","Enviar mensagem"],
 ["input.text","Fazer pergunta"],
 ["buttons","Oferecer opções"],
 ["condition","Verificar condição"],
 ["contact.lookup","Buscar cliente"],
 ["human.handoff","Transferir atendimento"],
] as const;
const starterBlockGroups = [
 { name: "Conversar", actions: firstActions.slice(0, 3) },
 { name: "Decidir", actions: firstActions.slice(3, 4) },
 { name: "Atender", actions: firstActions.slice(4) },
 { name: "Catálogo", actions: [["catalog.list", "Listar catálogo"]] as const },
] as const;
const canvasActionLabels:ReadonlyMap<string,string>=new Map<string,string>([
 ...firstActions,
 ["input.cpf","Pedir CPF ou CNPJ"],
 ["asaas.customer.lookup","Buscar cliente no Asaas"],
 ["asaas.payment.lookup","Consultar cobranças"],
 ["asaas.payment.pix","Mostrar Pix"],
 ["asaas.payment.boleto","Mostrar boleto"],
 ["department.route","Abrir atendimento"],
 ["assignment","Direcionar atendimento"],
 ["agent","Acionar agente de IA"],
  ["catalog.item","Item do catálogo"],
  ["catalog.list","Listar catálogo"],
 ["variable","Guardar informação"],
 ["tag","Adicionar tag"],
 ["crm.stage.move","Mover no funil"],
 ["crm.finalize","Registrar resultado da venda"],
 ["task.reminder","Criar lembrete"],
 ["calendar.availability","Consultar horário na agenda"],
 ["calendar.book","Agendar horário"],
 ["payment.status","Consultar pagamento"],
]);
const executable=new Set(["catalog.item","catalog.list","payment.status","calendar.book","calendar.availability","task.reminder","text","buttons","input.text","input.cpf","agent","condition","variable","asaas.payment.lookup","contact.lookup","assignment","human.handoff","department.route","tag","crm.stage.move","crm.finalize"]);
/* Canvas do fluxo: utilities TW sobre tokens do preset. Os estados são
   hooks data-*, não classes componente; os filetes dos blocos vêm de tokens
   flow-tone-* (dados do editor, não branding). */
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const dangerTextTw = "inline-flex min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-red-600 transition-colors hover:bg-surface hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60";
const canvasWorkspace = "grid min-w-0 grid-cols-1 gap-token";
const canvasWorkspaceFullscreen = "fixed inset-0 z-flow-fullscreen overflow-y-auto bg-surface-page p-3";
const canvasDataStatus = "grid gap-2 text-flow-help text-ink-secondary";
const canvasCommandMenu = "relative z-flow-command my-0 flex flex-wrap items-center gap-1.5";
const canvasCommandButton = "relative inline-flex min-h-flow-command-h min-w-flow-command-h items-center justify-center gap-2 rounded-flow-command border border-line bg-surface-2 px-flow-command-x text-flow-command font-bold text-ink transition-control hover:border-line-strong hover:bg-hover";
const canvasCommandPrimary = "min-h-flow-command-primary-h rounded-flow-command-primary";
const canvasMore = "relative";
const canvasMoreSummary = "flex min-h-flow-command-h items-center gap-1.5 rounded-flow-more border border-line bg-surface px-flow-command-x text-flow-help font-bold text-ink";
const canvasMoreActions = "absolute left-0 top-flow-more-actions z-flow-command-tip grid min-w-flow-more gap-1 rounded-flow-more-actions border border-line bg-surface p-1.5 shadow-token-lg";
const canvasShell = "relative grid w-full min-w-0 grid-cols-flow-shell rounded-xl border border-line bg-surface text-ink ov-laptop:h-auto ov-laptop:grid-cols-1";
const canvasShellHeight = "h-flow-shell";
const canvasShellFocusHeight = "h-flow-shell-fullscreen";
const canvasShellLeft = "grid-cols-flow-shell-left";
const canvasShellRight = "grid-cols-flow-shell-right";
const canvasShellBoth = "grid-cols-flow-shell-both";
const canvasPanel = "relative min-w-0 overflow-auto p-flow-panel";
const canvasPanelCollapsed = "grid place-items-center justify-items-center p-1.5";
const canvasLibrary = "rounded-l-xl border-r border-line bg-surface";
const canvasInspector = "rounded-r-xl border-l border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900";
const canvasPanelHandle = "absolute top-1/2 z-flow-panel-handle grid h-flow-handle w-flow-handle -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-surface text-ink-secondary transition-control hover:border-blue-600 hover:bg-hover hover:text-ink";
const canvasLibraryHandle = "-right-flow-handle-offset";
const canvasInspectorHandle = "-left-flow-handle-offset";
const canvasHandleCollapsed = "static h-flow-handle min-h-flow-handle w-full border-0 bg-transparent";
const canvasPanelTitle = "grid min-w-0 gap-px border-b border-line px-0.5 pb-2.5 pt-0.5";
const canvasPanelTitleStrong = "font-display text-flow-panel-title font-extrabold tracking-flow-tight text-ink";
const canvasPanelTitleSmall = "text-flow-panel-sub font-bold tracking-flow-wide uppercase text-ink-secondary";
const canvasSearch = "flex min-h-control w-full items-center gap-2.5 rounded-token-sm border border-line bg-surface-2 px-3.5 text-body font-medium shadow-token-sm";
const canvasPalette = "grid min-h-0 gap-1.5 overflow-y-auto pr-0.5";
const canvasPaletteGrid = "grid gap-1.5";
const canvasPaletteButton = "flex min-h-flow-command-h w-full items-center gap-2 rounded-flow-symbol border border-line bg-surface px-2.5 text-flow-help font-bold text-ink transition-control hover:border-ink-secondary hover:bg-hover";
const canvasAutoHideButton = "flex min-h-9 w-full items-center justify-center rounded-token-sm border border-line bg-surface text-flow-help font-bold text-ink-secondary";
const canvasStage = "relative isolate flex min-w-0 flex-col overflow-hidden rounded-flow-stage bg-surface ov-laptop:h-flow-stage-mobile";
const canvasStageBar = "flex min-h-flow-stage-bar flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-flow-stage-bar-x py-flow-stage-bar-y text-flow-stage";
const canvasStageBarGroup = "flex flex-wrap items-center gap-1.5";
const canvasStageButton = "inline-flex min-h-7 items-center gap-2 rounded-flow-field-tip border border-line bg-surface-2 px-2.5 text-flow-stage font-bold text-ink-secondary transition-control hover:border-line-strong hover:bg-hover hover:text-ink";
const canvasStageZoom = "min-w-flow-command-h text-center text-flow-zoom font-bold tabular-nums text-ink-secondary";
const canvasScroll = "relative min-h-0 w-full flex-1 touch-none select-none overflow-clip bg-surface-page outline-hidden focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600";
const canvasScrollPanning = "cursor-grabbing";
const canvasGrid = "bg-flow-grid bg-flow-grid-size";
const canvasBoard = "absolute left-0 top-0 h-px w-px overflow-visible";
const canvasWires = "pointer-events-none absolute inset-0 overflow-visible";
const canvasNode = "absolute w-flow-node rounded-flow-node border border-line-strong bg-surface pl-flow-node-edge shadow-flow-node transition-control";
const canvasNodeSelected = "border-blue-600 shadow-flow-node-selected";
const canvasToneEdge: Record<NodeTone,string> = {
  start: "border-l-flow-tone-start",
  message: "border-l-flow-tone-message",
  choice: "border-l-flow-tone-choice",
  input: "border-l-flow-tone-input",
  logic: "border-l-flow-tone-logic",
  ai: "border-l-flow-tone-ai",
  catalog: "border-l-flow-tone-crm",
  asaas: "border-l-flow-tone-asaas",
  transfer: "border-l-flow-tone-transfer",
  crm: "border-l-flow-tone-crm",
  tag: "border-l-flow-tone-tag",
  finish: "border-l-flow-tone-finish",
  end: "border-l-flow-tone-end",
  default: "border-l-flow-tone-default",
};
const canvasNodeHead = "flex w-full items-center gap-2 border-b border-line px-2.5 py-1.5 text-flow-node-title font-bold text-ink";
const canvasNodeSymbol = "grid h-7 w-7 place-items-center rounded-flow-symbol bg-blue-50 text-flow-command text-blue-800";
const canvasNodeGrip = "ml-auto text-flow-command text-ink-secondary opacity-60";
const canvasNodeQuickButton = "inline-flex min-h-6 items-center gap-1 rounded-flow-quick border border-line bg-surface px-2 text-flow-field font-bold text-ink-secondary shadow-token-sm";
const canvasNodeBody = "px-2.5 py-1.5 text-flow-trigger text-ink-secondary";
const canvasInputPort = "absolute -left-flow-port-offset top-1/2 z-flow-quick-actions h-flow-port w-flow-port -translate-y-1/2 rounded-full border-2 border-line-strong bg-surface";
const canvasNodeSummary = "m-0.5 truncate text-flow-node-summary text-ink-secondary";
const canvasOutputs = "grid gap-1 border-t border-line px-2.5 py-2.5";
const canvasOutputButton = "relative flex min-h-6 w-full items-center justify-start gap-2 rounded-flow-output border border-dashed border-line-strong bg-surface-2 px-2.5 pr-flow-port-offset text-left text-flow-output font-bold text-ink transition-control hover:border-blue-600 hover:bg-blue-50";
const canvasOutputConnecting = "border-solid border-blue-600 bg-blue-50 text-blue-800";
const canvasOutputPort = "absolute -right-2 top-1/2 z-flow-quick-actions h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-blue-600 bg-surface";
const canvasNodeTarget = "relative w-full min-h-6 border-0 border-t border-line text-flow-node-target font-extrabold uppercase text-ink-secondary transition-control hover:bg-hover hover:text-ink";
const canvasStartNode = "absolute w-flow-start rounded-flow-node border border-line-strong bg-surface p-2.5 shadow-flow-start";
const canvasTriggerHeading = "flex items-center gap-2 text-ink";
const canvasTriggerPreview = "block truncate text-flow-trigger-sub text-ink-secondary";
const canvasMinimap = "absolute bottom-flow-minimap-bottom right-flow-minimap-right z-flow-minimap h-flow-minimap w-flow-minimap cursor-pointer touch-none overflow-hidden rounded-flow-more-actions border border-line-strong bg-flow-minimap-bg shadow-token-lg backdrop-blur-topbar";
const canvasMinimapSvg = "block h-full w-full";
const canvasMinimapBg = "fill-flow-minimap-bg";
const canvasMinimapNode = "fill-flow-minimap-node opacity-40";
const canvasMinimapTrigger = "fill-blue-600 opacity-75";
const canvasMinimapViewport = "fill-flow-minimap-viewport stroke-blue-600 stroke-flow";
const canvasStageFoot = "flex min-h-10 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-flow-stage-bar-x py-1.5 text-flow-stage text-ink-secondary";
const canvasResizer = "absolute -left-flow-resizer top-0 z-flow-resizer grid h-full w-flow-resizer touch-none cursor-col-resize place-items-center";
const canvasResizerGrip = "h-flow-resizer-grip-h w-flow-resizer-grip rounded-full bg-line-strong transition-all";
const canvasInspectorClose = "absolute right-2.5 top-2.5 z-flow-inspector-close grid h-8 w-8 place-items-center rounded-flow-more border border-transparent bg-transparent text-ink-secondary transition-control hover:bg-surface-3 hover:text-ink";
const canvasInspectorActions = "grid grid-cols-flow-inspector-actions gap-1 border-b border-line px-4 py-2.5";
const canvasInspectorAction = "min-h-8 rounded-full border border-transparent bg-transparent text-flow-command font-bold text-ink-secondary transition-control hover:bg-surface-2 hover:text-ink";
const canvasInspectorActionActive = "border-blue-600 bg-blue-50 text-blue-800";
const canvasInspectorBody = "grid min-h-0 flex-1 auto-rows-start content-start gap-3.5 overflow-y-auto p-4";
const canvasInspectorLabel = "grid gap-1.5 text-flow-command font-bold text-ink-secondary";
const canvasFieldHelp = "my-1 text-flow-help text-ink-secondary";
const aiDialogBackdropTw = "fixed inset-0 z-50 grid animate-dialog-scrim place-items-center bg-overlay p-4 backdrop-blur-sm";
const aiDialogTw = "relative flex z-10 w-full max-w-xl max-h-full flex-col animate-dialog-in overflow-hidden rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg";
const aiDialogHeadingTw = "flex flex-none items-center gap-3 pr-10";
const aiDialogIconTw = "grid size-9 flex-none place-items-center rounded-token-sm bg-blue-50 text-blue-800";
const aiDialogCloseTw = "absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-token-sm border border-line bg-surface-2 text-ink-secondary transition-colors hover:bg-hover hover:text-ink disabled:opacity-50";
const aiDialogBodyTw = "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain";
const aiRequestTw = "grid gap-2 text-body font-bold text-ink";
const aiRequestHeadTw = "flex flex-wrap items-center justify-between gap-3";
const aiDictateTw = "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-2xs font-extrabold text-ink transition-colors hover:border-blue-600 hover:text-blue-800 disabled:opacity-50 aria-pressed:animate-phone-pulse aria-pressed:border-red-600 aria-pressed:bg-red-100 aria-pressed:text-red-600";
const aiExamplesTw = "flex flex-wrap gap-2";
const aiExampleTw = "rounded-full border border-line bg-surface-2 px-3 py-1.5 text-2xs font-semibold text-ink transition-colors hover:border-blue-600 hover:bg-hover disabled:opacity-50";
const aiTextareaTw = "w-full rounded-token-sm border border-line bg-surface-2 px-3 py-2 text-body text-ink placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:opacity-60";
const aiDictateStatusTw = "m-0 text-2xs text-ink-secondary";
const aiErrorTw = "mx-3.5 mt-1 text-2xs leading-tight text-danger";
const aiDialogFooterTw = "flex flex-none justify-end gap-2 border-t border-line pt-3";
const canvasVariablePicker = "flex flex-wrap gap-1 rounded-flow-symbol border border-line bg-surface-2 p-2";
const canvasVariableButton = "min-h-6 rounded-square border border-line bg-surface px-1.5 font-mono text-flow-node-summary font-semibold text-blue-800 transition-control hover:border-blue-600 hover:bg-blue-50";
const canvasGroup = "grid gap-3 rounded-flow-group border border-line bg-surface-2 p-flow-group-pad";
const canvasGroupHeader = "flex items-center gap-2.5 border-b border-dashed border-line-strong pb-2.5";
const canvasGroupIcon = "grid h-8 w-8 shrink-0 place-items-center rounded-flow-group-icon border border-line bg-surface text-blue-800";
const canvasGroupTitle = "block text-flow-group-title font-extrabold uppercase text-ink";
const canvasGroupSub = "mt-1 block text-flow-group-sub text-ink-secondary";
const canvasFieldTip = "relative inline-flex min-h-8 items-center gap-1.5 self-start rounded-flow-field-tip border border-line bg-surface-2 px-3 text-flow-field font-bold text-ink-secondary";
const canvasFieldTipIcon = "relative inline-grid place-items-center align-middle text-ink-secondary";
const canvasRichToolbar = "flex flex-wrap items-center gap-1";

/* Painel do inspetor e teste do fluxo: utilities TW sobre tokens do preset.
   Os estados de aba e de seleção continuam sendo atributos/hooks, não classes
   componente; o botão de excluir preserva a classe usada como seletor e2e. */
const inspectorCardTw = "grid min-w-0 gap-3 rounded-xl border border-gray-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 p-pad";
const inspectorSimulatorCardTw = "grid min-w-0 gap-3 rounded-token-lg border border-line bg-surface-2 p-pad shadow-none";
const inspectorSimulatorHeadingTw = "flex flex-wrap items-start justify-between gap-3";
const inspectorChannelListTw = "grid gap-1.5";
const inspectorChannelItemTw = "flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-2.5 py-2 text-small font-semibold text-ink transition-colors hover:border-line-strong hover:bg-hover";
const inspectorChannelItemActiveTw = "flex items-center gap-2.5 rounded-xl border border-blue-600/45 bg-brand-soft px-2.5 py-2 text-small font-semibold text-ink transition-colors";
const inspectorChannelInputTw = "size-4 min-h-4 flex-none accent-blue-600";
const inspectorChannelGlyphTw = "grid size-9 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface";
const inspectorChannelCopyTw = "grid min-w-0 gap-px text-small font-semibold text-ink";
const inspectorChannelMetaTw = "text-catalog-metric font-normal text-ink-secondary";
const inspectorTransitionTw = "grid gap-2 rounded-token border border-line bg-surface p-3";
const inspectorSimulatorOverlayTw = "fixed inset-0 z-flow-fullscreen grid animate-dialog-scrim place-items-center bg-overlay p-4 backdrop-blur-sm";

/* Configurações da página pública do bot: utilities TW com tokens do preset. */
const publicSettingsTw = "grid gap-2.5 rounded-token border border-line bg-surface-2 p-3";
const publicSettingsTitleTw = "m-0 text-xs font-extrabold tracking-tight text-ink";
const publicNoteTw = "m-0 text-xs leading-relaxed text-ink-secondary";
const publicToggleTw = "inline-flex w-max min-h-9 items-center gap-2.5 rounded-full border border-line bg-surface px-3 text-xs font-bold text-ink";
const publicToggleInputTw = "size-4 min-h-4 flex-none accent-blue-600";
const publicLinkTw = "grid gap-1.5";
const publicLinkCodeTw = "block break-all select-all rounded-xl border border-line bg-surface p-2.5 text-xs text-ink-secondary";
const publicActionsTw = "flex flex-wrap gap-2";
const publicReservedTw = "mt-3.5 grid gap-2.5 rounded-token-lg border border-dashed border-blue-600 bg-blue-50 p-3.5";
const publicReservedHeadTw = "flex flex-wrap items-center justify-between gap-3";
const publicSectionLabelTw = "flex items-center gap-2 pt-0.5 text-2xs font-extrabold uppercase tracking-widest text-ink-secondary after:h-px after:flex-1 after:bg-line";
const publicReservedTagTw = "inline-flex flex-none items-center rounded-full border border-amber-300 bg-warning-soft px-2.5 py-0.5 text-2xs font-extrabold uppercase tracking-widest text-amber-800";
const publicReservedCodeTw = "block break-all rounded-token border border-line bg-surface-2 p-2.5 text-xs text-brand";
const publicReservedFootTw = "flex flex-wrap items-end justify-between gap-3";
const publicReservedFootSmallTw = "flex-1 text-xs leading-relaxed text-ink-secondary";
const publicInlineCodeTw = "rounded-square border border-line bg-surface-2 px-1 py-px text-2xs";
const publicThemeTw = "mt-5 grid gap-2.5 rounded-xl border border-line p-2.5";
const publicThemeLegendTw = "px-1.5 text-xs uppercase tracking-widest font-extrabold text-ink-secondary";
const publicThemeGridTw = "flex flex-wrap gap-2";
const publicThemeRowTw = "flex flex-wrap gap-3";
const publicColorTw = "w-16 min-h-9 flex-none p-0.5";
const publicSwatchCreamTw = "inline-flex min-h-9 min-w-16 flex-none items-center justify-center rounded-xl border-2 border-stone-300 bg-stone-100 text-2xs font-bold text-stone-900 transition-transform hover:-translate-y-px aria-pressed:border-blue-600 aria-pressed:shadow-ring";
const publicSwatchDarkTw = "inline-flex min-h-9 min-w-16 flex-none items-center justify-center rounded-xl border-2 border-zinc-700 bg-zinc-950 text-2xs font-bold text-white transition-transform hover:-translate-y-px aria-pressed:border-blue-600 aria-pressed:shadow-ring";
const publicSwatchWhatsappTw = "inline-flex min-h-9 min-w-16 flex-none items-center justify-center rounded-xl border-2 border-teal-600 bg-linear-to-br from-teal-800 to-stone-100 text-2xs font-bold text-white transition-transform hover:-translate-y-px aria-pressed:border-blue-600 aria-pressed:shadow-ring";
const publicSwatchDefaultTw = "inline-flex min-h-9 min-w-16 flex-none items-center justify-center rounded-xl border-2 border-slate-800 bg-slate-950 text-2xs font-bold text-white transition-transform hover:-translate-y-px aria-pressed:border-blue-600 aria-pressed:shadow-ring";
const publicSwatchSolidTw = "inline-flex min-h-9 min-w-16 flex-none items-center justify-center rounded-xl border-2 border-slate-700 bg-slate-900 text-2xs font-bold text-white transition-transform hover:-translate-y-px aria-pressed:border-blue-600 aria-pressed:shadow-ring";
const publicSwatchGradientTw = "inline-flex min-h-9 min-w-16 flex-none items-center justify-center rounded-xl border-2 border-slate-700 bg-linear-to-br from-blue-700 to-slate-950 text-2xs font-bold text-white transition-transform hover:-translate-y-px aria-pressed:border-blue-600 aria-pressed:shadow-ring";
const publicSwatchImageTw = "inline-flex min-h-9 min-w-16 flex-none items-center justify-center rounded-xl border-2 border-slate-700 bg-linear-to-br from-sky-900 to-slate-950 text-2xs font-bold text-white transition-transform hover:-translate-y-px aria-pressed:border-blue-600 aria-pressed:shadow-ring";
const publicWidgetTw = "grid gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 p-3";
const publicWidgetCodeTw = "block overflow-x-auto whitespace-nowrap rounded-token-sm border border-line bg-slate-950 p-2.5 text-xs leading-relaxed text-slate-200";

/* Biblioteca de fluxos salvos: utilities TW com tokens do preset. */
const flowLibraryTw = "grid min-w-0 gap-3 rounded-token-lg border border-line bg-surface-2 p-pad shadow-none";
const flowLibraryHeadingTw = "flex flex-wrap items-center justify-between gap-3";
const flowLibraryGridTw = "grid gap-3";
const flowLibraryCardTw = "flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-token-lg border border-line bg-surface-2 p-pad shadow-none";
const flowLibraryActionsTw = "flex flex-wrap items-center gap-2";
const flowLibraryEmptyTw = "grid gap-1 text-body text-ink-secondary";
const flowScopeTw = "grid min-w-0 gap-2 rounded-token-lg border border-line bg-surface-2 p-pad shadow-none";

type PhoneSimulatorProps = { channel?: "web" | "whatsapp"; botName: string; welcome: string; preview: string[]; chips: {label:string;onChoose:()=>void}[] | null; onReply?: (text:string) => void; onClose?: () => void; fullscreen?: boolean };

/* Simulador de celular: utilities TW com tokens do preset. O azul de marca vem
   de --primary; as demais cores são dados do mockup do dispositivo. */
const phoneFrame = "relative aspect-phone-frame rounded-phone-frame bg-phone-frame p-phone-frame-pad shadow-phone-frame transition-all duration-300";
const phoneSide = "absolute w-phone-side-w rounded-phone-side bg-phone-side shadow-phone-side";
const phoneVolume = "-left-phone-side right-auto";
const phoneScreen = "relative isolate flex h-full w-full flex-col overflow-hidden rounded-phone-screen bg-phone-screen";
const phoneIsland = "absolute left-1/2 top-phone-island z-phone-island h-phone-island-h w-phone-island -translate-x-1/2 rounded-full bg-black after:absolute after:right-phone-lens-right after:top-1/2 after:h-phone-lens-size after:w-phone-lens-size after:-translate-y-1/2 after:rounded-full after:bg-phone-lens-glow";
const phoneStatusbar = "relative z-phone-status flex items-center justify-between px-phone-status-x pb-phone-status-b pt-phone-status-t text-phone-ink";
const phoneClock = "font-display text-phone-clock font-bold leading-none tracking-phone-clock";
const phoneSignal = "inline-flex items-center gap-phone-signal-gap";
const phoneHeader = "relative z-phone-header flex items-center gap-phone-header-gap bg-phone-chrome px-phone-header-x py-phone-header-y text-phone-ink";
const phoneAvatar = "grid h-phone-avatar w-phone-avatar shrink-0 place-items-center rounded-full bg-phone-avatar text-phone-on-accent shadow-phone-avatar";
const phonePeer = "grid min-w-0";
const phonePeerName = "block max-w-phone-peer-name truncate text-phone-peer font-bold";
const phonePeerSub = "flex items-center gap-phone-peer-gap text-phone-peer-sub font-semibold text-phone-muted";
const phoneDot = "inline-block h-phone-dot w-phone-dot animate-phone-pulse rounded-full bg-phone-accent shadow-phone-online";
const phoneCallIcons = "ml-auto inline-flex items-center gap-phone-call-gap text-phone-icons";
const phoneWallpaper = "relative flex min-h-0 flex-1 flex-col gap-phone-wall-gap overflow-y-auto bg-phone-wallpaper bg-phone-wallpaper-size px-phone-wall-x pb-phone-wall-b pt-phone-wall-t text-phone-ink";
const phoneDayPill = "mb-phone-day-bottom self-center rounded-phone-pill bg-phone-pill px-phone-day-x py-phone-day-y text-phone-day font-semibold tracking-phone-day text-phone-muted shadow-phone-pill";
const phoneBubble = "w-fit max-w-phone-bubble whitespace-pre-wrap break-words rounded-phone-bubble px-phone-bubble-x pb-phone-bubble-b pt-phone-bubble-y text-phone-bubble text-phone-ink shadow-phone-bubble";
const phoneTicks = "float-right relative top-phone-ticks-top ml-phone-ticks-x text-phone-tick tracking-phone-ticks";
const phoneQuickReplies = "mt-phone-quick-top flex flex-col gap-phone-quick-gap";
const phoneChip = "block w-fit max-w-phone-quick rounded-full border border-phone-tick-soft bg-phone-chrome px-phone-chip-x py-phone-chip-y text-left font-display text-phone-chip font-bold text-phone-tick transition-all hover:-translate-y-px hover:border-phone-tick hover:bg-phone-quick-hover";
const phoneComposer = "flex items-center gap-phone-composer-gap bg-phone-chrome px-phone-composer-p pb-phone-composer-b pt-phone-composer-p";
const phoneComposerPill = "flex min-w-0 flex-1 items-center gap-phone-pill-gap rounded-full bg-phone-divider px-phone-pill-x py-phone-pill-y text-phone-muted";
const phoneComposerHint = "min-w-0 flex-1 text-phone-hint leading-none";
const phoneMic = "grid h-phone-mic w-phone-mic shrink-0 place-items-center rounded-full bg-phone-accent text-phone-on-accent shadow-phone-mic";
const phoneHomeIndicator = "absolute bottom-phone-home-bottom left-1/2 z-phone-island h-phone-home-h w-phone-home-w -translate-x-1/2 rounded-full bg-phone-indicator";
const phoneClose = "absolute right-phone-close-right top-phone-close-top z-phone-close grid h-phone-close w-phone-close place-items-center rounded-full border border-phone-close-border bg-phone-close-bg text-phone-ink transition-all hover:scale-105 hover:bg-phone-close-hover";
/** Moldura de celular realista (estilo WhatsApp escuro) para testar o robô como no uso real. */
function PhoneSimulator({ channel="web", botName, welcome, preview, chips, onReply, onClose, fullscreen }: PhoneSimulatorProps) {
  const [reply,setReply]=useState("");
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="grid place-items-center" data-fullscreen={fullscreen ? "true" : undefined}>
      {onClose ? <button type="button" className={phoneClose} onClick={onClose} aria-label="Fechar simulação"><X size={18} aria-hidden="true" /></button> : null}
      <div className={fullscreen ? `${phoneFrame} w-phone-frame-overlay max-h-phone-frame` : `${phoneFrame} w-phone-frame`} aria-label={"Celular com o robô " + botName}>
        <span className={`${phoneSide} ${phoneVolume} h-phone-side-short top-phone-side-up-top`} aria-hidden="true" />
        <span className={`${phoneSide} ${phoneVolume} h-phone-side-long top-phone-side-down-top`} aria-hidden="true" />
        <span className={`${phoneSide} -right-phone-side h-phone-side-long top-phone-power`} aria-hidden="true" />
        <div className={phoneScreen}>
          <div className={phoneIsland} aria-hidden="true" />
          <div className={phoneStatusbar} aria-hidden="true">
            <span className={phoneClock}>{time}</span>
            <span className={phoneSignal}><svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="4.5" y="5" width="3" height="7" rx="1"/><rect x="9" y="2.5" width="3" height="9.5" rx="1"/><rect x="13.5" y="0" width="3" height="12" rx="1"/></svg><svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1.5 4.5a10 10 0 0 1 13 0"/><path d="M4 7.2a6.4 6.4 0 0 1 8 0"/><circle cx="8" cy="10" r="1.15" fill="currentColor" stroke="none"/></svg><svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.6" y="0.6" width="20" height="10.8" rx="3.1" stroke="currentColor" strokeWidth="1.1" opacity=".55"/><rect x="2.2" y="2.2" width="13.5" height="7.6" rx="1.6" fill="currentColor"/><path d="M23.2 4.2v3.6a2.2 2.2 0 0 0 0-3.6z" fill="currentColor" opacity=".55"/></svg></span>
          </div>
          <header className={phoneHeader}>
            <span className={phoneAvatar} aria-hidden="true"><Bot size={18} /></span>
            <span className={phonePeer}><strong className={phonePeerName}>{botName}</strong><small className={phonePeerSub}><i className={phoneDot} />online · via Véxora</small></span>
            <span className={phoneCallIcons} aria-hidden="true"><Video size={17} /><Phone size={15} /><Search size={16} /></span>
          </header>
          <div className={phoneWallpaper} role="log" aria-label="Conversa simulada com o robô">
            <div className={phoneDayPill}>Hoje</div>
            <div className={`${phoneBubble} rounded-tl-phone-tail bg-phone-chrome`}>{welcome}</div>
            {preview.slice(1).map((t, i) => <div key={i} className={i % 2 === 1 ? `${phoneBubble} self-end rounded-tr-phone-tail bg-phone-sent` : `${phoneBubble} rounded-tl-phone-tail bg-phone-chrome`}>{t}{i % 2 === 1 ? <span className={phoneTicks} aria-hidden="true">✓✓</span> : null}</div>)}
            {chips && chips.length && channel==="whatsapp" ? <div className={`${phoneBubble} rounded-tl-phone-tail bg-phone-chrome`} aria-label="Opções numeradas">{chips.map((chip,i)=><div key={i}>{i+1}. {chip.label}</div>)}</div> : null}
            {chips && chips.length && channel==="web" ? <div className={phoneQuickReplies} role="group" aria-label="Opções do robô">{chips.map((chip, i) => <button key={i} type="button" className={phoneChip} onClick={chip.onChoose}>{chip.label}</button>)}</div> : null}
          </div>
          {onReply?<form className={phoneComposer} onSubmit={e=>{e.preventDefault();if(reply.trim()){onReply(reply.trim());setReply("");}}}><input className="flex min-w-0 flex-1 rounded-full bg-phone-divider px-phone-pill-x py-phone-pill-y text-phone-bubble text-phone-ink outline-hidden placeholder:text-phone-muted" aria-label="Resposta do cliente" placeholder="Mensagem" maxLength={500} value={reply} onChange={e=>setReply(e.target.value)}/><button className={phoneMic} type="submit" aria-label="Enviar resposta">➤</button></form>:<div className={phoneComposer} aria-hidden="true">
            <span className={phoneComposerPill}><Smile size={19} /><span className={phoneComposerHint}>Mensagem</span><Paperclip size={18} /><Camera size={18} /></span>
            <span className={phoneMic}><Mic size={17} /></span>
          </div>
          }
          <div className={phoneHomeIndicator} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function VariablePicker({label,variables,onPick}:{label:string;variables:ReadonlyMap<string,string>;onPick:(key:string)=>void}){
 return <label className="grid gap-1 text-flow-help font-semibold">{label}
  <select className="min-w-0 rounded-token-sm border border-line bg-surface px-2 py-1 text-ink" value="" onChange={event=>{if(event.target.value)onPick(event.target.value)}}>
   <option value="">Escolher dado</option>
   {[...variables].map(([key,name])=><option key={key} value={key}>{name}</option>)}
  </select>
 </label>;
}

function insertVariable(input:HTMLInputElement|HTMLTextAreaElement|null,value:string,key:string,limit:number,update:(next:string)=>void){
 const source=input?.value??value;
 const start=input?.selectionStart??source.length;
 const end=input?.selectionEnd??start;
 const token="{{"+key+"}}";
 const next=source.slice(0,start)+token+source.slice(end);
 if(next.length>limit)return;
 update(next);
 input?.focus();
 requestAnimationFrame(()=>input?.setSelectionRange(start+token.length,start+token.length));
}

export function ChatbotWorkspace({tenantId}:{tenantId:string}){
 const [businessFlows,setBusinessFlows]=useState<Record<string,{draft:Flow}>>({}),[libraryId,setLibraryId]=useState("");
 async function refreshLibrary(){const r=await fetch("/api/backend/business-templates",{cache:"no-store"});if(r.ok)setBusinessFlows((await r.json()).flows||{});}
 useEffect(()=>{setBusinessFlows({});setLibraryId("");void refreshLibrary();},[tenantId]);
 const [switchingFlow,setSwitchingFlow]=useState(false);
 async function loadLibrary(id=libraryId){
  const item=businessFlows[id];
  if(!item||switchingFlow||id===libraryId)return;
  setSwitchingFlow(true);
  try{
   const pendingSave=activeSave.current;
   if(pendingSave)await pendingSave;
   const current=flushDraft.current.flow;
   const savedCurrent=businessFlows[libraryId]?.draft;
   if((current.steps.length||savedCurrent)&&JSON.stringify(current)!==JSON.stringify(savedCurrent)){
    const editableId=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(libraryId)?libraryId:"";
    const response=await fetch(editableId?"/api/backend/business-templates/"+encodeURIComponent(editableId):"/api/backend/business-templates/save-flow",{method:editableId?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({draft:current})});
    if(!response.ok)throw Error("Não foi possível guardar o fluxo aberto. Ele continua no editor.");
   }
   if(flushDraft.current.flow!==current)throw Error("O fluxo aberto mudou. Tente trocar novamente.");
   const next=structuredClone(item.draft);
   historyRef.current={past:[],future:[],last:JSON.stringify(next),suppress:false};
   setLibraryId(id);setFlow(next);setSelected("");setEditorOpen(false);
   setSimulationStep(null);setPreview([]);setTestNodes([]);setTestEdges([]);setConnectFrom(null);setConnectOption("");
   setInlineMessage(null);setInlineCondition(null);setInlineTriggerOpen(false);setOptionEditor(null);setBlockMenu(null);
   setNotice("Editando "+next.name+".");
   void refreshLibrary().catch(()=>{});
  }catch(error){setNotice(error instanceof Error?error.message:"Não foi possível trocar de fluxo.");}
  finally{setSwitchingFlow(false);}
 }
 async function deleteLibrary(id:string){let confirmed=false;try{confirmed=window.confirm("Excluir este fluxo salvo? O rascunho atual e o fluxo publicado não serão alterados.")}catch{setNotice("Confirmacao indisponivel neste navegador. Use um navegador comum para excluir.");return}if(!confirmed)return;try{const response=await fetch("/api/backend/business-templates/"+encodeURIComponent(id),{method:"DELETE"});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.message||"Não foi possível excluir o fluxo.");if(libraryId===id)setLibraryId("");await refreshLibrary();setNotice("Fluxo removido da biblioteca.");}catch(e){setNotice(e instanceof Error?e.message:"Falha ao excluir.");}}
 async function storeLibrary(){const suggested=flow.name||"Meu chatbot";let name:string|null=null;try{name=window.prompt("Nome para salvar este fluxo",suggested)}catch{name=suggested}if(!name?.trim())return;const draft={...flow,name:name.trim()};try{const endpoint=libraryId?"/api/backend/business-templates/"+encodeURIComponent(libraryId):"/api/backend/business-templates/save-flow";const r=await fetch(endpoint,{method:libraryId?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({draft})});if(!r.ok)throw Error("Não foi possível guardar o fluxo.");const result=await r.json();if(typeof result.id==="string")setLibraryId(result.id);setFlow(draft);await refreshLibrary();setNotice(libraryId?"Fluxo sobrescrito na biblioteca desta empresa.":"Fluxo salvo na biblioteca desta empresa.");}catch(e){setNotice(e instanceof Error?e.message:"Falha ao guardar.");}}
 const [flow,setFlow]=useState<Flow>(emptyFlow),[selected,setSelected]=useState(""),[preview,setPreview]=useState<string[]>([]),[notice,setNotice]=useState("");
 const flowSerialized = useMemo(() => JSON.stringify(flow), [flow]);
 const historyRef=useRef<{past:Flow[];future:Flow[];last:string;suppress:boolean}>({past:[],future:[],last:"",suppress:false});
 useEffect(()=>{const current=flowSerialized;if(!historyRef.current.last){historyRef.current.last=current;return;}if(historyRef.current.suppress){historyRef.current.suppress=false;historyRef.current.last=current;return;}if(historyRef.current.last!==current){try{historyRef.current.past=[...historyRef.current.past,JSON.parse(historyRef.current.last) as Flow].slice(-10);historyRef.current.future=[];}catch{}historyRef.current.last=current;}},[flowSerialized]);
 function undoFlow(){const h=historyRef.current;if(!h.past.length)return;const previous=h.past[h.past.length-1];h.past=h.past.slice(0,-1);h.future=[...h.future,flow].slice(-10);h.suppress=true;setFlow(previous as Flow);setNotice("Ação desfeita.");}
 function redoFlow(){const h=historyRef.current;if(!h.future.length)return;const next=h.future[h.future.length-1];h.future=h.future.slice(0,-1);h.past=[...h.past,flow].slice(-10);h.suppress=true;setFlow(next as Flow);setNotice("Ação refeita.");}
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(!(event.ctrlKey||event.metaKey)||event.altKey)return;const target=event.target as HTMLElement|null;if(target?.closest("input,textarea,select"))return;if(event.key.toLowerCase()==="z"){event.preventDefault();if(event.shiftKey)redoFlow();else undoFlow();}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[flow]);

 const [visualMode,setVisualMode]=useState(true);
 const [view,setView]=useState({x:0,y:0,zoom:100});
 const {zoom}=view;
 const [simulationChannel,setSimulationChannel]=useState<"web"|"whatsapp">("web");
 const [simulationStep,setSimulationStep]=useState<string|null>(null);
 const [testNodes,setTestNodes]=useState<string[]>([]);
 const [testEdges,setTestEdges]=useState<{from:string;option:string;to:string}[]>([]);
 const [simulationTrace,setSimulationTrace]=useState<{turn:number;nodes:string[];edges:{from:string;option:string;to:string}[]}>({turn:0,nodes:[],edges:[]});
 const [inlineMessage,setInlineMessage]=useState<string|null>(null);
 const [inlineCondition,setInlineCondition]=useState<string|null>(null);
 const [inlineTriggerOpen,setInlineTriggerOpen]=useState(false);
 const [optionEditor,setOptionEditor]=useState<{stepId:string;original:string|null;label:string}|null>(null);
 const [blockMenu,setBlockMenu]=useState<{id:string;x:number;y:number;option?:string}|null>(null);
 const [simulationVariables,setSimulationVariables]=useState(simulationContext);
 const [simulationResults,setSimulationResults]=useState<SimulationResults>({});
 const runningSimulationResults=useRef<SimulationResults>({});
 const [simulatorFullScreen,setSimulatorFullScreen]=useState(false);
 const [connectFrom,setConnectFrom]=useState<string|null>(null);
 const [connectOption,setConnectOption]=useState("");
 const [moveMode,setMoveMode]=useState(true);
 const [studioPanel,setStudioPanel]=useState<"nodes"|"settings"|"test">("settings");
 const [leftCollapsed,setLeftCollapsed]=useState(true);
 useEffect(()=>{
  setLeftCollapsed(!window.matchMedia("(min-width: 1280px)").matches);
 },[]);
 const [rightCollapsed,setRightCollapsed]=useState(false);
 const [autoHidePanels,setAutoHidePanels]=useState(false);
 const [showGrid,setShowGrid]=useState(true);
 const [showWires,setShowWires]=useState(true);
 const [compactNodes,setCompactNodes]=useState(false);
 const [selectedEdge,setSelectedEdge]=useState<{from:string;to:string;option:string}|null>(null);
 const [edgeMenu,setEdgeMenu]=useState<{x:number;y:number;edge:{from:string;to:string;option:string}}|null>(null);
 const [dragWire,setDragWire]=useState<{from:string;option:string;x:number;y:number}|null>(null);
 const dragWireStart=useRef<{pointerId:number;from:string;option:string;clientX:number;clientY:number}|null>(null);
 const dragWireActive=useRef(false);
 const suppressPlusClick=useRef(false);
 const [librarySearch,setLibrarySearch]=useState("");
 const [helpOpen,setHelpOpen]=useState(false),[guideOpen,setGuideOpen]=useState(false);
 const [advancedProperties,setAdvancedProperties]=useState(false);
 const [fullScreen,setFullScreen]=useState(false);
 const [publicPage,setPublicPage]=useState<{loaded:boolean;enabled:boolean;token:string|null;theme:{backgroundKind:string;color:string;color2:string;imageUrl:string;headerTitle:string;headerSubtitle:string;mode:string};busy:boolean;error:string}>({loaded:false,enabled:false,token:null,theme:{backgroundKind:"default",color:"#101317",color2:"#4F46E5",imageUrl:"",headerTitle:"",headerSubtitle:"",mode:"cream"},busy:false,error:""});
 const [aiCreateOpen,setAiCreateOpen]=useState(false),[aiRequest,setAiRequest]=useState(""),[aiCreateBusy,setAiCreateBusy]=useState(false),[aiCreateError,setAiCreateError]=useState(""),[publicPageNotice,setPublicPageNotice]=useState(""),[aiDictating,setAiDictating]=useState(false),[aiDictateStatus,setAiDictateStatus]=useState(""),[botHostInfo,setBotHostInfo]=useState<{botHost:string;note:string}|null>(null);
 /* Comandos em linguagem natural: o modo é inferido pelo backend. */
 const [aiProposal,setAiProposal]=useState<{draft:Flow;warnings:string[]}|null>(null);
 function openFlowAssistant(){

  setAiProposal(null);setAiRequest("");setAiCreateError("");setAiCreateOpen(true);
 }
 function applyAiProposal(){
  if(!aiProposal)return;
  setFlow(aiProposal.draft);setSelected(aiProposal.draft.steps[0]?.id||"");
  setAiCreateOpen(false);setAiProposal(null);
  setNotice("Proposta aplicada ao rascunho. Teste o fluxo antes de publicar.");
 }
 const [customVariables,setCustomVariables]=useState<readonly (readonly [string,string])[]>([]);
 useEffect(()=>{
  const controller=new AbortController();
  const refresh=()=>void fetch("/api/backend/crm/custom-fields",{cache:"no-store",signal:controller.signal})
   .then(async response=>response.ok?await response.json():null)
   .then(data=>{
    if(controller.signal.aborted||!Array.isArray(data))return;
    setCustomVariables(data.flatMap(field=>{
     if(field?.enabled===false||typeof field?.id!=="string"||typeof field?.label!=="string")return [];
     return /^[\w.-]{1,80}$/.test(field.id)?[[field.id,field.label] as const]:[];
    }));
   }).catch(()=>undefined);
  refresh();
  window.addEventListener("focus",refresh);
  return()=>{controller.abort();window.removeEventListener("focus",refresh);};
 },[tenantId]);
 const textVariables=new Map<string,string>([...conditionVariables,["pagamento_link","Link de pagamento"]]);
 for(const [key,label] of customVariables)if(!textVariables.has(key))textVariables.set(key,label);
 for(const step of flow.steps){
  const key=stepConfig(step).variable;
  if(["input.text","input.cpf","variable"].includes(step.kind||"")&&key&&/^[a-zA-Z][\w]{0,39}$/.test(key)&&!textVariables.has(key))textVariables.set(key,key);
 }
 const importInputRef=useRef<HTMLInputElement|null>(null);
const aiRecognition=useRef<{stop:()=>void}|null>(null);
useEffect(()=>()=>{aiRecognition.current?.stop()},[]);
function dictateAiRequest(){
 const Speech=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
 if(!Speech){setAiDictateStatus("Ditado indisponível neste navegador. Use o campo de texto.");return;}
 if(aiRecognition.current){aiRecognition.current.stop();aiRecognition.current=null;setAiDictating(false);setAiDictateStatus("");return;}
 const recognition=new Speech();recognition.lang="pt-BR";recognition.interimResults=false;recognition.continuous=false;
 recognition.onresult=(event:any)=>{const transcript=event.results[0][0].transcript;setAiProposal(null);setAiRequest(current=>current.trim()?current.trim()+" "+transcript:transcript);setAiDictateStatus("Ditado recebido. Revise antes de criar.");};
 recognition.onerror=()=>setAiDictateStatus("Não foi possível receber o ditado. Confira a permissão do microfone.");
 recognition.onend=()=>{aiRecognition.current=null;setAiDictating(false)};
 aiRecognition.current=recognition;recognition.start();setAiDictating(true);setAiDictateStatus("Ouvindo… toque em Ditar para parar.");
}
 async function loadPublicPage(){try{const r=await fetch("/api/backend/chatbot/draft/public-page",{cache:"no-store"});if(!r.ok)throw Error();const data=await r.json();const defaultPage=(data?.pages||[]).find((page:any)=>page.scopeKey===selectedScopeKey)||null;const publication=(data?.publications||[]).find((item:any)=>item.scopeKey===selectedScopeKey);setPublicPage({loaded:true,enabled:!!defaultPage&&!defaultPage.disabled,token:defaultPage?.token??null,theme:defaultPage?.theme??{backgroundKind:"default",color:"#101317",color2:"#4F46E5",imageUrl:"",headerTitle:"",headerSubtitle:"",mode:"cream"},busy:false,error:publication?"":"Publique o fluxo para este destino antes de ativar a página pública."});}catch{setPublicPage(current=>({...current,loaded:true,error:"Não foi possível carregar o status da página pública."}));}}
 async function savePublicPage(next:{enabled?:boolean;theme?:{backgroundKind:string;color:string;color2:string;imageUrl:string;headerTitle:string;headerSubtitle:string;mode:string}}){
  setPublicPage(current=>({...current,busy:true,error:""}));setPublicPageNotice("");
  try{
   const r=await fetch("/api/backend/chatbot/draft/public-page",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({scopeKey:selectedScopeKey,theme:next.theme??publicPage.theme,enabled:next.enabled??publicPage.enabled})});
   const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||"Não foi possível salvar a página pública.");
   setPublicPage(current=>({...current,loaded:true,enabled:!!data.enabled,token:data.token??null,theme:data.theme??current.theme,busy:false,error:""}));
   setPublicPageNotice(data.enabled?"Página pública ativada.":"Página pública desativada.");
  }catch(e){setPublicPage(current=>({...current,busy:false,error:e instanceof Error?e.message:"Não foi possível salvar."}));}
 }

 const publicPageUrl = publicPage.token ? (typeof window !== "undefined" ? window.location.origin : "") + "/p/" + publicPage.token : "";
  const widgetSnippet = publicPage.token ? '<script src="' + (typeof window !== 'undefined' ? window.location.origin : '') + '/api/backend/public/flows/' + publicPage.token + '/widget.js" async></' + 'script>' : '';
 async function createFlowWithAi(){
  const command=aiRequest.trim();if(!command)return;
  setAiCreateBusy(true);setAiCreateError("");
  try{
   const response=await fetch("/api/backend/assistant/engine/flow-command",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({command,proposalOnly:true,baseDraft:flow.steps.length?flow:undefined}),signal:AbortSignal.timeout(120000)});
   const data=await response.json().catch(()=>null);
   if(!response.ok){const message=typeof data?.message==="string"?data.message:"Não foi possível executar o comando.";throw new Error(message);}
   const draft=data?.draft;if(!draft||!Array.isArray(draft.steps))throw new Error("Resposta da IA inválida.");
   const next=draft as Flow;
   setFlow(next);setSelected(next.steps[0]?.id||"");
   setAiProposal({draft:next,warnings:Array.isArray(data.warnings)?data.warnings.filter((warning:unknown)=>typeof warning==="string"):[]});
   setNotice("Comando executado no rascunho. Revise e salve quando estiver pronto.");
  }catch(e){
   const timeout=e instanceof DOMException&&e.name==="TimeoutError";
   setAiCreateError(timeout?"O comando demorou. Tente uma frase mais curta ou execute novamente.":e instanceof Error?e.message:"Falha ao executar o comando.");
  }
  finally{setAiCreateBusy(false);}
 }
 function exportFlow(){try{const blob=new Blob([JSON.stringify({...flow,exportedAt:new Date().toISOString(),source:"vexora-chatbot"},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=(flow.name||"fluxo").replace(/[^\w-]+/g,"-").replace(/-+/g,"-").toLowerCase()+".json";document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);setNotice("Fluxo exportado em JSON.");}catch{setNotice("Não foi possível exportar.");}}
 async function importFlowFile(file:File){try{const text=await file.text();const parsed=JSON.parse(text);const candidate=parsed?.flow&&typeof parsed.flow==="object"?parsed.flow:parsed;const ok=candidate&&typeof candidate==="object"&&Array.isArray(candidate.steps)&&candidate.steps.length<=100&&candidate.steps.every((step:any)=>step&&typeof step.id==="string"&&typeof step.title==="string"&&typeof step.message==="string"&&Array.isArray(step.options));if(!ok){setNotice("Arquivo inválido: não parece ser um fluxo do chatbot.");return;}const stamped={...candidate,name:typeof candidate.name==="string"&&candidate.name.trim()?candidate.name.trim().slice(0,120):"Fluxo importado",channelIds:Array.isArray(candidate.channelIds)?candidate.channelIds:[],triggers:Array.isArray(candidate.triggers)&&candidate.triggers.length?candidate.triggers:[{kind:"message"}]};const withPositions={...stamped,steps:stamped.steps.map((step:Step,index:number)=>({...step,position:{x:80+(index%3)*340,y:100+Math.floor(index/3)*260}}))};setFlow(withPositions as Flow);setSelected(withPositions.steps[0]?.id||"");setSimulationStep(null);setPreview([]);setNotice("Fluxo importado como rascunho. Revise canais e publique.");}catch{setNotice("Não foi possível ler o arquivo. Envie um JSON de fluxo exportado pelo chatbot.");}}

 const [editorOpen,setEditorOpen]=useState(false);
 const [inspectorWidth,setInspectorWidth]=useState(360);
 const inspectorResizeStart=useRef<{pointerX:number;width:number}|null>(null);
 useEffect(()=>{try{const saved=Number(window.localStorage.getItem("vx:inspector-width"));if(Number.isFinite(saved)&&saved>=280&&saved<=520)setInspectorWidth(saved);}catch{/* ignore */}},[]);
 const [showLinks,setShowLinks]=useState(true);
 const [destinations,setDestinations]=useState<{departments:{id:string;key:string;name:string;routingCategory?:string;members:string[]}[];agents:{id:string;name:string}[]}>({departments:[],agents:[]});
 useEffect(()=>{
  let request:AbortController|undefined;
  const refresh=()=>{
   request?.abort();
   const controller=new AbortController();
   request=controller;
   void fetch('/api/backend/chatbot/runtime/destinations',{cache:'no-store',signal:controller.signal})
    .then(response=>{if(!response.ok)throw new Error('Destinos indisponíveis');return response.json()})
    .then(data=>{if(!controller.signal.aborted)setDestinations(data)})
    .catch(()=>{if(!controller.signal.aborted)setNotice('Não foi possível carregar os destinos de transferência.')});
  };
  const refreshWhenVisible=()=>{if(document.visibilityState==='visible')refresh()};
  refresh();
  const interval=window.setInterval(refreshWhenVisible,30000);
  window.addEventListener('focus',refreshWhenVisible);
  window.addEventListener('vexora:team-updated',refresh);
  document.addEventListener('visibilitychange',refreshWhenVisible);
  return()=>{
   request?.abort();
   window.clearInterval(interval);
   window.removeEventListener('focus',refreshWhenVisible);
   window.removeEventListener('vexora:team-updated',refresh);
   document.removeEventListener('visibilitychange',refreshWhenVisible);
  };
 },[]);
 const [crmPipelines,setCrmPipelines]=useState<{id:string;name:string;stages:{id:string;label:string}[]}[]>([]);
 const [crmPipelinesLoading,setCrmPipelinesLoading]=useState(true),[crmPipelinesError,setCrmPipelinesError]=useState("");
 async function loadCrmPipelines(){
  setCrmPipelinesLoading(true);setCrmPipelinesError("");
  try{
   const response=await fetch('/api/backend/crm/pipelines',{cache:'no-store'});
   if(!response.ok)throw new Error("Não foi possível carregar os pipelines do CRM.");
   const data=await response.json();
   setCrmPipelines(Array.isArray(data?.pipelines)?data.pipelines:[]);
  }catch(error){setCrmPipelinesError(error instanceof Error?error.message:"Não foi possível carregar os pipelines do CRM.");}
  finally{setCrmPipelinesLoading(false)}
 }
 useEffect(()=>{void loadCrmPipelines()},[]);
 const [channels,setChannels]=useState<Channel[]>([]);
 const [channelNotice,setChannelNotice]=useState("");
 const [savingRemote,setSavingRemote]=useState(false);
 const [ready,setReady]=useState(false),[loadError,setLoadError]=useState(""),[loadAttempt,setLoadAttempt]=useState(0),[lastSaved,setLastSaved]=useState(""),[savedAt,setSavedAt]=useState("");
 const saveInFlight=useRef(false);
 const activeSave=useRef<Promise<boolean>|null>(null);
 const flushDraft=useRef({ready,flow,lastSaved});flushDraft.current={ready,flow,lastSaved};
 useEffect(()=>()=>{const latest=flushDraft.current;if(!latest.ready||JSON.stringify(latest.flow)===latest.lastSaved)return;writeTenantCache(tenantId,"chatbot-draft-recovery",latest.flow);const body=JSON.stringify({draft:latest.flow});const persist=()=>fetch("/api/backend/chatbot/draft",{method:"PUT",headers:{"content-type":"application/json"},body,keepalive:new TextEncoder().encode(body).length<60000}).catch(()=>{});if(activeSave.current)void activeSave.current.finally(persist);else void persist()},[tenantId]);
 const [aiAgents,setAiAgents]=useState<{id:string;name:string;enabled:boolean}[]>([]);
 const [aiAgentsLoading,setAiAgentsLoading]=useState(true),[aiAgentsError,setAiAgentsError]=useState("");
 async function loadAiAgents(){
  setAiAgentsLoading(true);setAiAgentsError("");
  try{
   const response=await fetch("/api/backend/assistant/config",{cache:"no-store"});
   if(!response.ok)throw new Error("Não foi possível carregar os agentes de IA.");
   const data=await response.json();
   if(!Array.isArray(data?.agents))throw new Error("A resposta dos agentes de IA está indisponível.");
   setAiAgents(data.agents);
  }catch(error){setAiAgentsError(error instanceof Error?error.message:"Não foi possível carregar os agentes de IA.");}
  finally{setAiAgentsLoading(false)}
 }
 useEffect(()=>{void loadAiAgents()},[]);
 const [catalogItems,setCatalogItems]=useState<CatalogOption[]>([]);
 const [catalogItemsLoading,setCatalogItemsLoading]=useState(true),[catalogItemsError,setCatalogItemsError]=useState("");
 async function loadCatalogItems(){
  setCatalogItemsLoading(true);setCatalogItemsError("");
  try{
   const response=await fetch("/api/backend/catalog?limit=200&includeInactive=false",{cache:"no-store"});
   if(!response.ok)throw new Error("Não foi possível carregar o catálogo.");
   const data=await response.json();
   if(!Array.isArray(data?.items))throw new Error("A resposta do catálogo está indisponível.");
   setCatalogItems(data.items);
  }catch(error){setCatalogItemsError(error instanceof Error?error.message:"Não foi possível carregar o catálogo.");}
  finally{setCatalogItemsLoading(false)}
 }
 useEffect(()=>{void loadCatalogItems()},[]);
 const [scopeDepartment,setScopeDepartment]=useState(""),[scopeUser,setScopeUser]=useState("");
 const [runtimeState,setRuntime]=useState<{publications?:{key:string;active:boolean;revision?:string;flowName?:string;draftMatchesPublication?:boolean;flowId?:string}[];active:boolean;defaultActive?:boolean;activeBots?:number;botLimit?:number;revision?:string;draftMatchesPublication?:boolean;executions?:{id:string;createdAt:string;details:{decision?:string;tokensUsed?:number;revision?:string;scopeKey?:string;conversationId?:string;visitedEdges?:{from:string;option:string;to:string}[];visitedSteps?:{id:string;title:string}[];waitingStepId?:string|null}}[]}>({active:false});
 const selectedScopeKey=scopeUser?"user:"+scopeUser+(scopeDepartment?":department:"+scopeDepartment:""):scopeDepartment?"department:"+scopeDepartment:"default";
  useEffect(()=>{void loadPublicPage();},[selectedScopeKey]);
  useEffect(()=>{let cancelled=false;fetch("/api/backend/auth/bot-host",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(!cancelled&&d?.botHost)setBotHostInfo({botHost:String(d.botHost),note:String(d.note||"")})}).catch(()=>{});return()=>{cancelled=true}},[]);
 const runtimeKey=libraryId?"automation:"+libraryId:selectedScopeKey;
 const runtime=runtimeKey==="default"?{...runtimeState,active:runtimeState.defaultActive??runtimeState.active}:runtimeState.publications?.find(p=>p.key===runtimeKey)||{active:false};
 const [runtimeBusy,setRuntimeBusy]=useState(false),[runtimeLoading,setRuntimeLoading]=useState(true),[runtimeError,setRuntimeError]=useState("");
 async function loadRuntime(){
  setRuntimeLoading(true);setRuntimeError("");
  try{
   const response=await fetch("/api/backend/chatbot/runtime",{cache:"no-store"});
   if(!response.ok)throw new Error("Não foi possível carregar o status do runtime.");
   const data=await response.json();
   if(!data||typeof data!=="object")throw new Error("O status do runtime está indisponível.");
   setRuntime(data);
  }catch(error){setRuntimeError(error instanceof Error?error.message:"Não foi possível carregar o status do runtime.");}
  finally{setRuntimeLoading(false)}
 }
 useEffect(()=>{void loadRuntime()},[]);
 const [executionHistoryOpen,setExecutionHistoryOpen]=useState(false);
 const [selectedExecutionId,setSelectedExecutionId]=useState<string|null>(null);
 const [followedConversation,setFollowedConversation]=useState<string|null>(null);
 const [executionRefreshError,setExecutionRefreshError]=useState(false);
 useEffect(()=>{
  if(!executionHistoryOpen)return;
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>;
  let refreshing=false;
  async function refreshExecutions(){
   if(refreshing||controller.signal.aborted)return;
   clearTimeout(timer);
   refreshing=true;
   try{
    const response=await fetch("/api/backend/chatbot/runtime",{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
    if(!response.ok)throw Error("Execuções indisponíveis");
    const data=await response.json();
    if(!Array.isArray(data?.executions))throw Error("Histórico indisponível");
    if(!controller.signal.aborted){
     setRuntime(previous=>({...previous,executions:data.executions,activeBots:data.activeBots,botLimit:data.botLimit,defaultActive:data.defaultActive,revision:data.revision,publications:data.publications,draftMatchesPublication:data.draftMatchesPublication}));
     setExecutionRefreshError(false);
    }
   }catch{
    if(!controller.signal.aborted)setExecutionRefreshError(true);
   }finally{
    refreshing=false;
    if(!controller.signal.aborted)timer=setTimeout(refreshExecutions,5000);
   }
  }
  const source=new EventSource("/api/backend/events");
  source.addEventListener("conversation.updated",refreshExecutions);
  void refreshExecutions();
  return()=>{source.close();controller.abort();clearTimeout(timer)};
 },[executionHistoryOpen]);
 const [publishErrors,setPublishErrors]=useState<string[]>([]);
 useEffect(()=>setPublishErrors([]),[runtimeKey]);
 async function runtimeAction(action:"publish"|"stop",activateSeparately=false){
  setRuntimeBusy(true);
  setPublishErrors([]);
  try{
   let flowId=libraryId;
   if(action==="publish"){
    if(!await save())throw new Error("Não foi possível salvar o fluxo antes de publicar");
    if(flowId||activateSeparately){
     const editable=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(flowId);
     const response=await fetch(editable?"/api/backend/business-templates/"+encodeURIComponent(flowId):"/api/backend/business-templates/save-flow",{method:editable?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({draft:flow})});
     const saved=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(saved.message||"Não foi possível guardar a automação.");
     if(!editable){if(typeof saved.id!=="string")throw Error("Identificador da automação indisponível.");flowId=saved.id;setLibraryId(flowId);}
     await refreshLibrary();
    }
   }
   const response=await fetch("/api/backend/chatbot/runtime/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...(flowId?{flowId}:{}),...(scopeDepartment?{departmentId:scopeDepartment}:{}),...(scopeUser?{userId:scopeUser}:{})})});
   const data=await response.json();
   if(!response.ok){
    const errors=Array.isArray(data.errors)?data.errors.filter((error:unknown):error is string=>typeof error==="string"):[];
    if(action==="publish"&&errors.length){setPublishErrors(errors);setNotice("");return;}
    throw new Error(typeof data.message==="string"?data.message:"Operação recusada");
   }
   const status=await fetch("/api/backend/chatbot/runtime",{cache:"no-store"});if(status.ok)setRuntime(await status.json());setNotice(action==="publish"?"Fluxo publicado para o destino escolhido e os canais selecionados.":"Publicação pausada para este destino.");
  }catch(error){setNotice(error instanceof Error?error.message:"Falha no motor")}finally{setRuntimeBusy(false)}
 }

 const scrollRef=useRef<HTMLDivElement|null>(null);
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const [panning,setPanning]=useState(false);
 const fitAfterArrange=useRef(false);
 const draggedNode=useRef(false);
 const [canvasSize,setCanvasSize]=useState({width:0,height:0});
 const [triggerPosition,setTriggerPosition]=useState({x:75,y:15});
 const drag=useRef<{id:string;pointerX:number;pointerY:number;x:number;y:number}|null>(null);
 const zoomAt=useCallback((change:(zoom:number)=>number,x:number,y:number,dx=0,dy=0)=>{
  setView(current=>{
   const zoom=Math.max(5,Math.min(200,change(current.zoom)));
   const ratio=zoom/current.zoom;
   return {zoom,x:x+dx-(x-current.x)*ratio,y:y+dy-(y-current.y)*ratio};
  });
 },[]);
 const panBy=useCallback((x:number,y:number)=>{
  setView(current=>({...current,x:current.x+x,y:current.y+y}));
 },[]);
 useEffect(()=>{
  const canvas=scrollRef.current;
  if(!canvas)return;
  const resize=new ResizeObserver(()=>setCanvasSize({width:canvas.clientWidth,height:canvas.clientHeight}));
  resize.observe(canvas);
  const wheel=(event:WheelEvent)=>{
   event.preventDefault();
   const unit=event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1;
   const dx=event.deltaX*unit,dy=event.deltaY*unit;
   if(!event.shiftKey){
    const rect=canvas.getBoundingClientRect();
    zoomAt(zoom=>zoom*Math.exp(-dy*.002),event.clientX-rect.left,event.clientY-rect.top);
   }else{
    panBy(-(event.shiftKey&&!dx?dy:dx),event.shiftKey?0:-dy);
   }
  };
  canvas.addEventListener("wheel",wheel,{passive:false});
  return()=>{resize.disconnect();canvas.removeEventListener("wheel",wheel)};
 },[ready,panBy,zoomAt]);
 function zoomBy(amount:number){
  const canvas=scrollRef.current;
  if(canvas)zoomAt(zoom=>Math.round(zoom+amount),canvas.clientWidth/2,canvas.clientHeight/2);
 }
 function moveCanvasPointer(event:React.PointerEvent<HTMLDivElement>){
  const points=pointers.current,previous=points.get(event.pointerId);
  if(!previous)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const next={x:event.clientX-rect.left,y:event.clientY-rect.top};
  points.set(event.pointerId,next);
  const dx=next.x-previous.x,dy=next.y-previous.y;
  const other=[...points.entries()].find(([id])=>id!==event.pointerId)?.[1];
  if(other){
   const distance=Math.hypot(previous.x-other.x,previous.y-other.y);
   const ratio=Math.hypot(next.x-other.x,next.y-other.y)/Math.max(1,distance);
   zoomAt(zoom=>zoom*ratio,(previous.x+other.x)/2,(previous.y+other.y)/2,dx/2,dy/2);
  }else{
   panBy(dx,dy);
  }
 }
 function endCanvasPointer(event:React.PointerEvent<HTMLDivElement>){
  if(pointers.current.delete(event.pointerId)&&!pointers.current.size)setPanning(false);
 }
 const nodeRefs=useRef(new Map<string,HTMLDivElement>());
 const nodeToReveal=useRef<string|null>(null);
 function revealCanvasNode(id:string){
  const node=nodeRefs.current.get(id);
  const canvas=scrollRef.current;
  if(!node||!canvas)return;
  const area=canvas.getBoundingClientRect();
  const block=node.getBoundingClientRect();
  const revealOffset=(start:number,end:number,min:number,max:number)=>{
   if(end-start>max-min)return (min+max-start-end)/2;
   if(start<min)return min-start;
   if(end>max)return max-end;
   return 0;
  };
  const inset=16;
  const dx=revealOffset(block.left,block.right,area.left+inset,area.right-inset);
  const dy=revealOffset(block.top,block.bottom,area.top+inset,area.bottom-inset);
  if(dx||dy)setView(current=>({...current,x:current.x+dx,y:current.y+dy}));
 }
 useLayoutEffect(()=>{
  const id=nodeToReveal.current;
  if(!id)return;
  nodeToReveal.current=null;
  revealCanvasNode(id);
 // The node is available after the block is added to the canvas.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[flow.steps]);
 const setNodeRef=(id:string)=>(el:HTMLDivElement|null)=>{if(el)nodeRefs.current.set(id,el);else nodeRefs.current.delete(id)};
 const [nodeBoxes,setNodeBoxes]=useState<Record<string,{x:number;y:number;w:number;h:number;inputY:number|null;outputY:Record<string,number>}>>({});
 useLayoutEffect(()=>{
  const next:typeof nodeBoxes={};
  nodeRefs.current.forEach((el,id)=>{
   const box={x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight,inputY:null as number|null,outputY:{} as Record<string,number>};
   const input=el.querySelector<HTMLElement>("[data-flow-input-port]");
   if(input)box.inputY=input.offsetTop+input.offsetHeight/2;
   el.querySelectorAll<HTMLElement>("[data-flow-outputs] button").forEach((btn)=>{const option=btn.dataset.option||"";const port=btn.querySelector<HTMLElement>("i");if(port)box.outputY[option]=btn.offsetTop+port.offsetTop+port.offsetHeight/2});
   next[id]=box;
  });
  setNodeBoxes((prev)=>{const nextKeys=Object.keys(next);const prevKeys=Object.keys(prev);if(nextKeys.length===prevKeys.length&&nextKeys.every((key)=>{const a=next[key];const b=prev[key];if(!a||!b)return false;if(Math.abs(a.x-b.x)>.5||Math.abs(a.y-b.y)>.5||Math.abs(a.h-b.h)>.5||Math.abs(a.w-b.w)>.5)return false;if(JSON.stringify(a.outputY)!==JSON.stringify(b.outputY)||a.inputY!==b.inputY)return false;return true}))return prev;return next});
 },[flow.steps,compactNodes]);
 useLayoutEffect(()=>{
  if(ready)fitCanvas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,fullScreen]);
 useLayoutEffect(()=>{
  if(!fitAfterArrange.current)return;
  fitAfterArrange.current=false;
  fitCanvas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[flow.steps]);
 useEffect(()=>{if(!fullScreen)return;const releaseScroll=acquireBodyScrollLock();const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setFullScreen(false)};document.addEventListener("keydown",escape);return()=>{releaseScroll();document.removeEventListener("keydown",escape)}},[fullScreen]);
 function toggleFullScreen(){setFullScreen(value=>!value)}
 function fitCanvas(){
  const canvas=scrollRef.current;
  if(!canvas||!canvas.clientWidth||!canvas.clientHeight)return;
  const bounds=flow.steps.reduce((box,step,index)=>{
   const x=step.position?.x??(index%3)*330+65,y=step.position?.y??Math.floor(index/3)*210+105;
   const node=nodeRefs.current.get(step.id);
   return {minX:Math.min(box.minX,x),minY:Math.min(box.minY,y),maxX:Math.max(box.maxX,x+(node?.offsetWidth??260)),maxY:Math.max(box.maxY,y+(node?.offsetHeight??145))};
  },{minX:triggerPosition.x,minY:triggerPosition.y,maxX:triggerPosition.x+260,maxY:triggerPosition.y+110});
  const {minX,minY}=bounds,width=bounds.maxX-minX,height=bounds.maxY-minY;
  const scale=Math.max(.05,Math.min(1.15,(canvas.clientWidth-64)/width,(canvas.clientHeight-64)/height));
  setView({zoom:scale*100,x:canvas.clientWidth/2-(minX+width/2)*scale,y:canvas.clientHeight/2-(minY+height/2)*scale});
 }

 useEffect(()=>{try{const saved=window.localStorage.getItem("vexora-flow-panels-v1");if(saved){const state=JSON.parse(saved) as {right?:boolean;auto?:boolean};setRightCollapsed(!!state.right);setAutoHidePanels(!!state.auto)}}catch{}},[]);
 useEffect(()=>{try{window.localStorage.setItem("vexora-flow-panels-v1",JSON.stringify({right:rightCollapsed,auto:autoHidePanels}))}catch{}},[rightCollapsed,autoHidePanels]);
 useEffect(()=>{let live=true;setReady(false);setLoadError("");fetch("/api/backend/channels",{cache:"no-store"}).then(r=>r.ok?r.json():[]).then(data=>{if(live)setChannels(Array.isArray(data)?data:[])}).catch(()=>{if(live)setChannelNotice("Não foi possível carregar os canais vinculados.")});fetch("/api/backend/chatbot/draft",{cache:"no-store",signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw Error("Não foi possível recuperar o fluxo salvo. Tente novamente antes de editar.");return r.json()}).then(data=>{if(!live)return;const legacyTemplate=data?.draft?.name==="Fluxo Suporte+Financeiro";const loaded:Flow=!legacyTemplate&&data?.draft&&Array.isArray(data.draft.steps)?{...data.draft,steps:data.draft.steps.map((step:Step)=>({...step,config:step.config&&typeof step.config!=="string"?JSON.stringify(step.config):step.config}))}:structuredClone(emptyFlow);setFlow(loaded);setSelected(loaded.steps[0]?.id||"");setLastSaved(JSON.stringify(loaded));writeTenantCache(tenantId,"chatbot-draft",loaded);setReady(true);setNotice(legacyTemplate?"Rascunho antigo removido. Comece pelo Gatilho.":data?.draft?"":"Comece adicionando um bloco.");}).catch(error=>{if(live)setLoadError(error instanceof Error?error.message:"Falha ao carregar o fluxo")});return()=>{live=false}},[tenantId,loadAttempt]);
 useEffect(()=>{if(!ready||flowSerialized===lastSaved)return;writeTenantCache(tenantId,"chatbot-draft-recovery",flow);let timer:ReturnType<typeof setTimeout>;const attempt=()=>{if(saveInFlight.current){timer=setTimeout(attempt,500);return;}void save(flow,true)};timer=setTimeout(attempt,1500);return()=>clearTimeout(timer)},[flow,flowSerialized,lastSaved,ready]);
 useEffect(()=>{if(!ready||flowSerialized===lastSaved)return;const prevent=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=""};window.addEventListener("beforeunload",prevent);return()=>window.removeEventListener("beforeunload",prevent)},[flow,flowSerialized,lastSaved,ready]);
 const selectedExecution=executionHistoryOpen?runtimeState.executions?.find(execution=>followedConversation?execution.details.conversationId===followedConversation&&Boolean(execution.details.visitedSteps?.length):execution.id===selectedExecutionId):undefined;
 const canHighlightExecution=Boolean(selectedExecution?.details.visitedEdges&&runtime.draftMatchesPublication&&flowSerialized===lastSaved&&selectedExecution.details.revision===runtime.revision&&(selectedExecution.details.scopeKey||"default")===runtimeKey);
 const highlightedNodes=canHighlightExecution?selectedExecution?.details.visitedSteps?.map(step=>step.id)||[]:studioPanel==="test"?testNodes:[];
 const highlightedEdges=canHighlightExecution?selectedExecution?.details.visitedEdges||[]:studioPanel==="test"?testEdges:[];
 const traceNodes=canHighlightExecution?highlightedNodes:studioPanel==="test"&&testNodes.length?simulationTrace.nodes:[];
 const traceEdges=canHighlightExecution?highlightedEdges:studioPanel==="test"&&testNodes.length?simulationTrace.edges:[];
 const executionTraceId=canHighlightExecution?selectedExecution?.id:undefined;
 const [executionTracePhase,setExecutionTracePhase]=useState(0);
 useEffect(()=>{if(executionTraceId)setExecutionTracePhase(phase=>1-phase)},[executionTraceId]);
 const tracePhase=canHighlightExecution?executionTracePhase:simulationTrace.turn%2;
 const waitingNode=canHighlightExecution?selectedExecution?.details.waitingStepId:studioPanel==="test"?simulationStep:null;
 const entryIndex=flow.steps.findIndex(step=>step.id==="menu");
 const firstIndex=Math.max(0,entryIndex);
 const entryStep=flow.steps[firstIndex];
 const entryX=entryStep?.position?.x??(firstIndex%3)*330+65;
 const entryY=entryStep?.position?.y??Math.floor(firstIndex/3)*210+105;
 const graphEdges=flow.steps.flatMap(step=>Object.entries(step.transitions||{}).filter(([option,target])=>step.options.includes(option)&&target!=="__start__"&&flow.steps.some(item=>item.id===target)).map(([option,target])=>({from:step.id,to:target,option}))); const activeEdge=selectedEdge&&graphEdges.some(edge=>edge.from===selectedEdge.from&&edge.option===selectedEdge.option&&edge.to===selectedEdge.to)?selectedEdge:null;
 const connectedNodeIds=activeEdge?new Set([activeEdge.from,activeEdge.to]):null;
 const disconnected=flow.steps.filter(step=>!graphEdges.some(edge=>edge.to===step.id));
 const completion=flow.steps.reduce((n,step)=>n+step.options.filter(option=>step.transitions?.[option]).length,0);
 const missingPaths=flow.steps.flatMap(step=>step.options.filter(option=>!step.transitions?.[option]).map(option=>({step:step.title,option})));
 const current=flow.steps.find(x=>x.id===selected);
 const inlineMessageRef=useRef<HTMLTextAreaElement|null>(null);
 const optionInputRef=useRef<HTMLInputElement|null>(null);
 const messageRef=useRef<HTMLTextAreaElement|null>(null); const welcomeRef=useRef<HTMLTextAreaElement|null>(null);
 function insertMessageMarkup(prefix:string,suffix=prefix){
   if(!current)return;
   const input=messageRef.current;
   const source=input?.value??current.message??"";
   const start=input?.selectionStart??source.length;
   const end=input?.selectionEnd??start;
   const selectedText=source.slice(start,end);
   const next=source.slice(0,start)+prefix+selectedText+suffix+source.slice(end);
   updateStep({message:next});
   requestAnimationFrame(()=>{if(!input)return;input.focus();const cursor=start+prefix.length+selectedText.length+suffix.length;input.setSelectionRange(cursor,cursor);});
 }
 function insertWelcomeVariable(variable:string){const input=welcomeRef.current;const source=input?.value??flow.welcome??"";const start=input?.selectionStart??source.length;const end=input?.selectionEnd??start;const token="{{"+variable+"}}";setFlow(f=>({...f,welcome:source.slice(0,start)+token+source.slice(end)}));requestAnimationFrame(()=>{if(!input)return;input.focus();const cursor=start+token.length;input.setSelectionRange(cursor,cursor);});}
 function stepConfig(step:Step):Record<string,string>{try{const value=JSON.parse(step.config||"{}");return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}catch{return {}}}
 function destinationSummary(step:Step){const c=stepConfig(step);const mode=c.targetMode||(c.userId?"PERSON":c.departmentKey?"DEPARTMENT":"PLATFORM");const department=destinations.departments.find(d=>d.key===c.departmentKey);const person=destinations.agents.find(a=>a.id===c.userId);return mode==="QUEUE"?"Fila geral · sem time ou atendente":mode==="PLATFORM"?"Automático · setor/plataforma; fila geral se indisponível":mode==="PERSON"?(person?.name||"Atendente não selecionado")+(department?" · "+department.name:""):"Time: "+(department?.name||c.departmentKey||"não selecionado");}
 function changeDestination(values:Record<string,string|undefined>){if(!current)return;const c={...stepConfig(current),...values};for(const k of Object.keys(c))if(c[k]===undefined||c[k]==="")delete c[k];const title=values.userId?destinations.agents.find(a=>a.id===values.userId)?.name:values.departmentKey?destinations.departments.find(d=>d.key===values.departmentKey)?.name:values.itemId?catalogItems.find(item=>item.id===values.itemId)?.name:undefined;updateStep({config:JSON.stringify(c),...(title?{title}:{})});}
 function updateCondition(id:string,key:"variable"|"value",value:string){
  setFlow(draft=>({...draft,steps:draft.steps.map(step=>step.id===id?{...step,config:JSON.stringify({...stepConfig(step),[key]:value})}:step)}));
 }
 function updateStep(changes:Partial<Step>){setFlow(f=>({...f,steps:f.steps.map(x=>x.id===selected?{...x,...changes}:x)}));setNotice("")}
 function changeGuidedKind(kind:string){const defaults=guidedKindDefaults(kind);updateStep({...defaults,kind,action:undefined,transitions:current?.transitions});setNotice("Tipo da etapa alterado. Revise os campos abaixo e as conexões.")}
 function saveCanvasOption(step:Step){
  if(!optionEditor||optionEditor.stepId!==step.id)return;
  const {original}=optionEditor;
  const label=optionEditor.label.trim();
  if(!label||label.length>160||(original===null&&step.options.length>=30)||step.options.some(option=>option===label&&option!==original))return;
  if(original!==null&&(!step.options.includes(original)||original===label)){
   setOptionEditor(null);
   return;
  }
  const transitions={...step.transitions};
  if(original!==null&&Object.hasOwn(transitions,original)){
   const target=transitions[original];
   delete transitions[original];
   Object.defineProperty(transitions,label,{value:target,enumerable:true,configurable:true,writable:true});
  }
  const options=original===null?[...step.options,label]:step.options.map(option=>option===original?label:option);
  setFlow(draft=>({...draft,steps:draft.steps.map(item=>item.id===step.id?{...item,options,transitions}:item)}));
  if(connectFrom===step.id&&connectOption===original)setConnectOption(label);
  setOptionEditor(null);
 }
 function removeCanvasOption(step:Step,option:string){
  if(targetFor(step,option)&&!window.confirm("Remover esta opção e sua conexão?"))return;
  setFlow(draft=>({...draft,steps:draft.steps.map(item=>{
   if(item.id!==step.id)return item;
   const transitions={...item.transitions};
   delete transitions[option];
   return {...item,options:item.options.filter(label=>label!==option),transitions};
  })}));
  if(connectFrom===step.id&&connectOption===option){setConnectFrom(null);setConnectOption("");}
  setOptionEditor(null);
 }
 function targetFor(step:Step, option:string):string { const explicit=step.transitions?.[option];if(explicit==="__start__")return "__start__";if(explicit && flow.steps.some(x=>x.id===explicit))return explicit;return ""; }
 function simulationStart(){return flow.steps.find(s=>s.id==="menu")||flow.steps[0];}
 function simulateBlock(step:Step|undefined,variables:Record<string,string>){
  const messages:string[]=[];
  const nodes:string[]=[];
  const edges:{from:string;option:string;to:string}[]=[];
  const find=(id:string|undefined)=>id==="__start__"?simulationStart():flow.steps.find(s=>s.id===id);
  const follow=(source:Step,option:string)=>{
   const destination=find(source.transitions?.[option]);
   if(destination)edges.push({from:source.id,option,to:destination.id});
   return destination;
  };
  for(let i=0;step&&i<10;i++){
   nodes.push(step.id);
   const config=stepConfig(step),kind=step.action||step.kind;
   if(kind==="variable"){
    variables[config.variable||"resposta"]=resolveSimulationText(config.value||"",variables);
    step=follow(step,step.options[0]||"");continue;
   }
   if(kind==="payment.status"){
    variables.pagamento_status=runningSimulationResults.current.pagamento_status||"indisponível";
    variables.pagamento_link="";
    step=follow(step,step.options[0]||"");continue;
   }
   if(kind==="calendar.book"){
    variables.agenda_reserva=runningSimulationResults.current.agenda_reserva||"indisponível";
    step=follow(step,step.options[0]||"");continue;
   }
   if(kind==="calendar.availability"){
    variables.agenda_disponivel=runningSimulationResults.current.agenda_disponivel||"indisponível";
    step=follow(step,step.options[0]||"");continue;
   }
   if(kind==="task.reminder"){
    const minutes=Number(config.minutes);
    const title=resolveSimulationText(config.title||"",variables).trim();
    variables.lembrete_criado=title&&Number.isInteger(minutes)&&minutes>=1&&minutes<=43200?"sim":"não";
    step=follow(step,step.options[0]||"");continue;
   }
   if(kind==="catalog.item"||kind==="catalog.list"){
   const isList=kind==="catalog.list";
   const itemName=catalogItems.find(item=>item.id===config.itemId)?.name||"selecionado";
   if(step.message)messages.push(resolveSimulationText(step.message,variables));
   messages.push((isList?"Link simulado do catálogo completo":"Link simulado do item "+itemName)+": "+(isList?"https://vitrine.exemplo.invalid/catalogo/":"https://vitrine.exemplo.invalid/catalogo/item-simulado/"));
   messages.push("Simulação local com domínio de exemplo .invalid: nenhum link real foi enviado e nenhum site foi publicado. Configure a URL HTTPS da vitrine para o envio real.");
   step=follow(step,step.options[0]||"");continue;
  }
  if(kind==="condition"){step=follow(step,variables[config.variable||""]===config.value?"Sim":"Não");continue;}
   if(kind==="text"&&step.options.length===1){
    if(step.message)messages.push(resolveSimulationText(step.message,variables));
    step=follow(step,step.options[0]!);continue;
   }
   if(kind==="human.handoff"||kind==="assignment"||kind==="department.route"){
    const configured=kind==="department.route"?"":resolveSimulationText(step.message,variables).trim();
    return {nodes,edges,stepId:null,message:[...messages,configured||"Encaminhamento simulado: "+destinationSummary(step)].join("\n")};
   }
   return {nodes,edges,stepId:step.options.length?step.id:null,message:[...messages,resolveSimulationText(step.message||step.title,variables)].join("\n")};
  }
  return {nodes,edges,stepId:null,message:messages.join("\n")||"Fim desta ramificação."};
 }
 const [simulationTriggerText,setSimulationTriggerText]=useState("");
 const [simulationTriggerFeedback,setSimulationTriggerFeedback]=useState("");
 const [simulationTriggerBusy,setSimulationTriggerBusy]=useState(false);
 const keywordOnly=Boolean(flow.triggers?.length&&flow.triggers.every(trigger=>trigger.kind==="keyword"));
 function openSimulation(){
  setStudioPanel("test");setEditorOpen(true);setRightCollapsed(false);
  setSimulationTriggerFeedback("");
  if(keywordOnly){setPreview([]);setSimulationStep(null);setTestNodes([]);setTestEdges([]);}
  else restartSimulation();
 }
 async function testKeywordTrigger(){
  const channelId=flow.channelIds?.[0];
  if(!channelId){setSimulationTriggerFeedback("Selecione um canal de entrada para testar o gatilho.");return;}
  setSimulationTriggerBusy(true);setSimulationTriggerFeedback("");
  setPreview([]);setSimulationStep(null);setTestNodes([]);setTestEdges([]);
  try{
   const response=await fetch("/api/backend/chatbot/engine/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({channelId,eventType:"dm",text:simulationTriggerText,draft:flow}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error("Confira a palavra-chave e a configuração deste rascunho.");
   const result=await response.json();
   if(flushDraft.current.flow!==flow){setSimulationTriggerFeedback("O fluxo mudou. Teste novamente.");return;}
   if(result.matched===true)restartSimulation();
   else setSimulationTriggerFeedback("A mensagem não ativou esta palavra-chave.");
  }catch(error){setSimulationTriggerFeedback(error instanceof Error?error.message:"Não foi possível testar o gatilho.");}
  finally{setSimulationTriggerBusy(false);}
 }
 function restartSimulation(){
  runningSimulationResults.current=simulationResults;
  const variables={...simulationContext,nome_identificado:simulationContext.nome||"",canal_atendimento:simulationChannel};
  const next=simulateBlock(simulationStart(),variables);
  setTestNodes(next.nodes);setTestEdges(next.edges);
  setSimulationTrace(previous=>({turn:previous.turn+1,nodes:next.nodes,edges:next.edges}));
  setSimulationVariables(variables);setPreview([resolveSimulationText(flow.welcome,variables),next.message]);setSimulationStep(next.stepId);
 }
 function chooseSimulation(step:Step,reply:string,button=false){
  const variables={...simulationVariables},kind=step.action||step.kind,config=stepConfig(step);
  const norm=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
  const input=kind==="input.text"||kind==="input.cpf";
  const option=input?step.options[0]:button?reply:/^[1-9]\d*$/.test(reply)?step.options[Number(reply)-1]:step.options.find(o=>norm(resolveSimulationText(o,variables))===norm(reply));
  const shown=button?resolveSimulationText(reply,variables):reply;
  const value=kind==="input.cpf"?reply.replace(/\D/g,""):reply;
  if(!option||(input&&((kind==="input.cpf"&&![11,14].includes(value.length))||(config.validation==="preferred-name"&&!/^[\p{L}][\p{L} .’'-]{0,79}$/u.test(value))))){
   setPreview(p=>[...p,shown,resolveSimulationText(step.message||step.title,variables)]);return;
  }
  if(input){
   variables[config.variable||"resposta"]=value;
   if(config.validation==="preferred-name")variables.nome=value;
  }
  const target=targetFor(step,option);
  const destination=target==="__start__"?simulationStart():flow.steps.find(s=>s.id===target);
  const next=simulateBlock(destination,variables);
  setTestNodes(previous=>[...new Set([...previous,...next.nodes])]);
  const traversedEdges=[...(destination?[{from:step.id,option,to:destination.id}]:[]),...next.edges];
  setTestEdges(previous=>[...previous,...traversedEdges]);
  setSimulationTrace(previous=>({turn:previous.turn+1,nodes:[step.id,...next.nodes],edges:traversedEdges}));
  setSimulationVariables(variables);setPreview(p=>[...p,shown,next.message]);setSimulationStep(next.stepId);
 }
 function replySimulation(reply:string){const step=flow.steps.find(s=>s.id===simulationStep);if(step)chooseSimulation(step,reply);}
 function connectNode(targetId:string,fromId=connectFrom,optionName=connectOption){if(!fromId || !optionName){setSelected(targetId);return;}if(fromId===targetId){setNotice("Selecione outro bloco como destino.");return;}const source=flow.steps.find(x=>x.id===fromId);if(!source || !source.options.includes(optionName)){setConnectFrom(null);return;}setFlow(f=>({...f,steps:f.steps.map(x=>x.id===fromId?{...x,transitions:{...x.transitions,[optionName]:targetId}}:x)}));setSelected(fromId);setConnectFrom(null);setConnectOption("");setNotice("Conexão criada no rascunho. Salve para manter a alteração.");}
 function autoArrange(){
  fitAfterArrange.current=true;
  setFlow(f=>{
   const ids=new Set(f.steps.map(s=>s.id));
   const inbound=new Map(f.steps.map(s=>[s.id,0]));
   const edges=new Map(f.steps.map(s=>[s.id,[] as string[]]));
   for(const step of f.steps)for(const target of Object.values(step.transitions||{})){
    if(ids.has(target)&&target!==step.id){edges.get(step.id)!.push(target);inbound.set(target,(inbound.get(target)||0)+1)}
   }
   const start=f.steps.find(s=>s.id==="menu")?.id||f.steps.find(s=>(inbound.get(s.id)||0)===0)?.id||f.steps[0]?.id;
   const depth=new Map<string,number>();
   const queue=start?[start]:[];
   if(start)depth.set(start,0);
   // Breadth-first placement avoids endless loops for return-to-start connections.
   for(let i=0;i<queue.length;i++){const id=queue[i];if(!id)continue;for(const to of edges.get(id)||[])if(!depth.has(to)){depth.set(to,(depth.get(id)||0)+1);queue.push(to)}}
   for(const step of f.steps)if(!depth.has(step.id)){depth.set(step.id,Math.max(0,...depth.values())+1)}
   const columns=new Map<number,string[]>();
   for(const step of f.steps){const d=depth.get(step.id)!;columns.set(d,[...(columns.get(d)||[]),step.id])}
   const positions=new Map<string,{x:number;y:number}>();
   for(const [d,column] of columns)column.forEach((id,i)=>positions.set(id,{x:65+d*300,y:145+i*220}));
   return {...f,steps:f.steps.map(step=>({...step,position:positions.get(step.id)||step.position}))};
  });
  setNotice("");
 }
 function duplicateStep(id:string){const source=flow.steps.find(step=>step.id===id);if(!source)return;const copyId="etapa-"+Date.now();nodeToReveal.current=copyId;setFlow(f=>({...f,steps:[...f.steps,{...source,id:copyId,title:source.title+" (cópia)",transitions:{},position:{x:(source.position?.x??100)+45,y:(source.position?.y??100)+100}}]}));setSelected(copyId);setStudioPanel("settings");setEditorOpen(true);setNotice("Etapa duplicada sem conexões. Configure os destinos e salve.");}
 function deleteStep(id:string){if(!window.confirm("Excluir esta etapa e remover as conexões que apontam para ela?"))return;setFlow(f=>({...f,steps:f.steps.filter(step=>step.id!==id).map(step=>({...step,transitions:Object.fromEntries(Object.entries(step.transitions||{}).filter(([,target])=>target!==id))}))}));if(selected===id){setSelected("");setEditorOpen(false)}setNotice("Bloco removido do rascunho. Salve para confirmar.");}
 function deleteEdge(edge:{from:string;to:string;option:string}){
  setFlow(draft=>({...draft,steps:draft.steps.map(step=>step.id===edge.from?{...step,transitions:Object.fromEntries(Object.entries(step.transitions||{}).filter(([option,target])=>!(option===edge.option&&target===edge.to)))}:step)}));
  setSelectedEdge(null);
  setNotice("Conex\u00e3o removida do rascunho. Salve para confirmar.");
 }
 const minimapUnits = useMemo(() => {
   const boxes = [
     { x: triggerPosition.x, y: triggerPosition.y, width: 260, height: 110, trigger: true },
     ...flow.steps.map((step, index) => ({
       x: step.position?.x ?? (index % 3) * 330 + 65,
       y: step.position?.y ?? Math.floor(index / 3) * 210 + 105,
       width: nodeBoxes[step.id]?.w ?? 260,
       height: nodeBoxes[step.id]?.h ?? 145,
       trigger: false as const,
     })),
   ];
   const minX = Math.min(...boxes.map((b) => b.x));
   const minY = Math.min(...boxes.map((b) => b.y));
   const maxX = Math.max(...boxes.map((b) => b.x + b.width));
   const maxY = Math.max(...boxes.map((b) => b.y + b.height));
   const padX = Math.max(140, (maxX - minX) * 0.14);
   const padY = Math.max(110, (maxY - minY) * 0.14);
   return { boxes, box: { minX: minX - padX, minY: minY - padY, width: Math.max(360, maxX + padX - (minX - padX)), height: Math.max(240, maxY + padY - (minY - padY)) } };
 }, [flow.steps, triggerPosition, nodeBoxes]);
 const [minimapEnabled, setMinimapEnabled] = useState(() => {
   try { return window.localStorage.getItem("vexora-flow-minimap-v1") === "on"; } catch { return false; }
 });
 useEffect(() => { try { window.localStorage.setItem("vexora-flow-minimap-v1", minimapEnabled ? "on" : "off"); } catch {} }, [minimapEnabled]);
 const minimapRef = useRef<SVGSVGElement | null>(null);
 const scale=zoom/100;
 const viewportWorld={x:-view.x/scale,y:-view.y/scale,width:canvasSize.width/scale,height:canvasSize.height/scale};
 function boardPoint(clientX:number,clientY:number){
   const canvas=scrollRef.current;
   if(!canvas)return {x:0,y:0};
   const rect=canvas.getBoundingClientRect();
   const currentScale=zoom/100;
   return {x:(clientX-rect.left-view.x)/currentScale,y:(clientY-rect.top-view.y)/currentScale};
 }
 function outputPoint(from:string,option:string){
   const index=flow.steps.findIndex(step=>step.id===from);
   const step=flow.steps[index];
   if(!step)return null;
   const box=nodeBoxes[from];
   return {x:(step.position?.x??(index%3)*330+65)+(box?.w??212)+4,y:(step.position?.y??Math.floor(index/3)*210+105)+(box?.outputY[option]??(box?.h??100)/2)};
 }
 function startWireDrag(event:React.PointerEvent<HTMLButtonElement>,from:string,option:string){
   if(!event.isPrimary||event.button!==0)return;
   event.stopPropagation();
   dragWireStart.current={pointerId:event.pointerId,from,option,clientX:event.clientX,clientY:event.clientY};
   dragWireActive.current=false;
   suppressPlusClick.current=false;
   event.currentTarget.setPointerCapture(event.pointerId);
 }
 function moveWireDrag(event:React.PointerEvent<HTMLButtonElement>){
   const start=dragWireStart.current;
   if(!start||start.pointerId!==event.pointerId)return;
   if(!dragWireActive.current&&Math.hypot(event.clientX-start.clientX,event.clientY-start.clientY)<5)return;
   dragWireActive.current=true;
   const point=boardPoint(event.clientX,event.clientY);
   setDragWire({from:start.from,option:start.option,x:point.x,y:point.y});
 }
 function finishWireDrag(event:React.PointerEvent<HTMLButtonElement>){
   const start=dragWireStart.current;
   if(!start||start.pointerId!==event.pointerId)return;
   dragWireStart.current=null;
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
   if(dragWireActive.current){
    suppressPlusClick.current=true;
    const element=document.elementFromPoint(event.clientX,event.clientY);
    const target=element?.closest<HTMLElement>("[data-flow-node-id]")?.dataset.flowNodeId;
    if(target&&target!==start.from)connectNode(target,start.from,start.option);
   }
   dragWireActive.current=false;
   setDragWire(null);
 }
 function cancelWireDrag(){dragWireStart.current=null;dragWireActive.current=false;setDragWire(null)}
 function minimapCenterAt(clientX:number,clientY:number){
  const matrix=minimapRef.current?.getScreenCTM();
  if(!matrix)return;
  const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());
  setView(current=>({...current,x:canvasSize.width/2-point.x*current.zoom/100,y:canvasSize.height/2-point.y*current.zoom/100}));
 }
 function moveNode(id:string,x:number,y:number){setFlow(f=>({...f,steps:f.steps.map(step=>step.id===id?{...step,position:{x,y}}:step)}));}
 function save(snapshot=flow,automatic=false){if(!ready||saveInFlight.current)return Promise.resolve(false);saveInFlight.current=true;setSavingRemote(true);const task=(async()=>{try{const response=await fetch("/api/backend/chatbot/draft",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({draft:snapshot}),signal:AbortSignal.timeout(15000)});if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(typeof error.message==="string"?error.message:"Não foi possível salvar. Sua cópia de recuperação foi mantida neste navegador.")}writeTenantCache(tenantId,"chatbot-draft",snapshot);setLastSaved(JSON.stringify(snapshot));setSavedAt(new Date().toLocaleTimeString("pt-BR"));if(!automatic)setNotice("Fluxo salvo no servidor. Publicar aplica esta versão aos canais.");return true}catch(error){setNotice(error instanceof Error?error.message:"Falha ao salvar o fluxo. Tente novamente.");return false}finally{saveInFlight.current=false;setSavingRemote(false)}})();activeSave.current=task;return task}
 function newFlow(){if(flow.steps.length&&!window.confirm("Substituir o rascunho atual por um fluxo vazio? A versão publicada continuará ativa até uma nova publicação."))return;setFlow({...structuredClone(emptyFlow),welcome:"",askPreferredName:false,triggers:[{kind:"first_message"}]});setLibraryId("");setSelected("");setEditorOpen(false);setPreview([]);setSimulationStep(null);setInlineMessage(null);setInlineCondition(null);setInlineTriggerOpen(false);setOptionEditor(null);setNotice("Escolha o que inicia o fluxo e adicione a primeira ação.")}
 function loadPreferredNameExample(){const example=preferredNameFlow(destinations.departments);setFlow(example);setSelected(example.steps[0]?.id||"");setLibraryId("");setPreview([]);setSimulationStep(null);setInlineMessage(null);setInlineCondition(null);setOptionEditor(null);setStudioPanel("nodes");setEditorOpen(true);setRightCollapsed(false);setGuideOpen(false);setAiCreateOpen(false);setNotice("Exemplo funcional carregado como rascunho. Revise os textos, escolha os canais e salve; publicar continua manual.")}
 function editCanvasNode(id:string){
  setBlockMenu(null);
  if(id==="__trigger__"){setInlineTriggerOpen(true);return;}
  const step=flow.steps.find(item=>item.id===id);
  if(!step)return;
  setSelected(id);setStudioPanel("settings");
  if(step.kind==="condition"){setInlineCondition(id);setEditorOpen(false);return;}
  if(!step.action&&["text","buttons","input.text","input.cpf"].includes(step.kind||"")){setInlineMessage(id);setEditorOpen(false);return;}
  setEditorOpen(true);setRightCollapsed(false);
 }
 const menuStep=blockMenu?flow.steps.find(step=>step.id===blockMenu.id):undefined;
 const freeMenuOutputs=menuStep?.options.filter(option=>!targetFor(menuStep,option))??[];
 function newNodePosition(after?:{id:string;option:string}){
  const sourceIndex=after?flow.steps.findIndex(step=>step.id===after.id):-1;
  const source=flow.steps[sourceIndex];
  const position=source?{
   x:(source.position?.x??(sourceIndex%3)*330+65)+(nodeBoxes[source.id]?.w??260)+80,
   y:(source.position?.y??Math.floor(sourceIndex/3)*210+105)+Math.max(0,source.options.indexOf(after!.option))*160,
  }:flow.steps.length?{x:Math.round(viewportWorld.x+viewportWorld.width/2-130),y:Math.round(viewportWorld.y+viewportWorld.height/2-60)}:{x:triggerPosition.x+300,y:triggerPosition.y};
  while(flow.steps.some(step=>step.position?.x===position.x&&step.position.y===position.y)){
   position.x+=24;
   position.y+=24;
  }
  return position;
 }
 function add(kind="text",title="Nova mensagem",destination?:Record<string,string>,after?:{id:string;option:string},position?:{x:number;y:number},continueTo?:string){if(flow.steps.length>=100){setNotice("Use até 100 blocos por fluxo.");return;}const id="etapa-"+crypto.randomUUID();const action=(["asaas.customer.lookup","asaas.payment.lookup","asaas.payment.pix","asaas.payment.boleto","human.handoff","crm.stage.move","crm.finalize"].includes(kind)?kind:undefined) as Step["action"];const step:Step={id,kind,title,message:destination?"":"",config:destination?JSON.stringify(destination):kind==="catalog.item"?JSON.stringify({itemId:""}):kind==="catalog.list"?undefined:kind==="payment.status"?JSON.stringify({provider:"STRIPE"}):kind==="calendar.book"?JSON.stringify({start:"{{horario}}",minutes:"30",title:"Atendimento"}):kind==="calendar.availability"?JSON.stringify({start:"{{horario}}",minutes:"30"}):kind==="task.reminder"?JSON.stringify({title:"",minutes:"30"}):kind==="tag"?JSON.stringify({name:"Nova tag",color:"#6258df"}):kind==="input.text"?JSON.stringify({variable:"novo_nome"}):["condition","variable"].includes(kind)?JSON.stringify({variable:"novo_nome",value:""}):undefined,options:kind==="buttons"?[]:kind==="condition"?["Sim","Não"]:["assignment","department.route","human.handoff","asaas.payment.lookup","agent","crm.finalize"].includes(kind)?[]:kind==="catalog.list"?["Continuar"]:["Continuar"],...(action?{action}:{}),position:position??newNodePosition(after),...(continueTo?{transitions:{Continuar:continueTo}}:{})};nodeToReveal.current=id;setFlow(f=>({...f,steps:[...f.steps.map(source=>after&&source.id===after.id?{...source,transitions:{...source.transitions,[after.option]:id}}:source),step]}));setSelected(id);setStudioPanel("settings");setEditorOpen(true);setRightCollapsed(false);if(["text","buttons","input.text","input.cpf"].includes(kind)){setEditorOpen(false);setInlineMessage(id);}else if(kind==="condition"){setEditorOpen(false);setInlineCondition(id);}setNotice("Etapa adicionada ao rascunho.");}
 const libraryQuery=librarySearch.trim().toLowerCase();
 const triggerFields=<div className="grid gap-2">
   <label className={canvasInspectorLabel}>Quando…
    <select value={flow.triggers?.[0]?.kind||"message"} onChange={event=>{const kind=event.target.value as "message"|"dm"|"keyword"|"first_message";setFlow(draft=>({...draft,triggers:[{...draft.triggers?.[0],kind},...(draft.triggers?.slice(1)||[])]}))}}>
     <option value="first_message">Iniciar uma conversa</option><option value="message">Receber uma mensagem</option>
     <option value="dm">Receber uma mensagem direta</option>
     <option value="keyword">Receber uma palavra-chave</option>
    </select>
   </label>
   {flow.triggers?.[0]?.kind==="keyword"?<label className={canvasInspectorLabel}>Palavra-chave<input value={flow.triggers[0].keyword||""} onChange={event=>{const keyword=event.target.value;setFlow(draft=>({...draft,triggers:[{kind:"keyword",keyword},...(draft.triggers?.slice(1)||[])]}))}}/></label>:null}
   {channels.length>0?<fieldset className="mt-5 flex flex-wrap gap-2">
    <legend className="mb-1 text-flow-help font-bold text-ink-secondary">Canais de entrada</legend>
    {channels.map(channel=><label key={channel.id} className="inline-flex items-center gap-2 rounded-token-sm border border-line bg-surface-2 px-2 py-1 text-flow-help"><input type="checkbox" checked={flow.channelIds?.includes(channel.id)||false} onChange={event=>{const checked=event.target.checked;setFlow(draft=>({...draft,channelIds:checked?[...new Set([...(draft.channelIds||[]),channel.id])]:(draft.channelIds||[]).filter(id=>id!==channel.id)}))}}/>{channel.name}</label>)}
   </fieldset>:null}
  </div>;
 if(!ready)return <section className={inspectorCardTw} aria-busy={!loadError}><h1>Chatbot</h1><p role="status">{loadError||"Recuperando o fluxo salvo…"}</p>{loadError&&<button type="button" onClick={()=>setLoadAttempt(n=>n+1)}>Tentar novamente</button>}</section>;
 return <section className={`${canvasWorkspace} ${fullScreen?canvasWorkspaceFullscreen:""}`} data-fullscreen={fullScreen?"true":undefined} data-studio-panel={studioPanel} data-editor-open={editorOpen?"true":undefined}><div className={canvasDataStatus} aria-live="polite">{runtimeLoading?<p role="status">Carregando o status do runtime…</p>:runtimeError?<p role="alert">{runtimeError} <button type="button" className={secondaryTw} onClick={()=>void loadRuntime()}>Tentar novamente</button></p>:null}{crmPipelinesLoading?<p role="status">Carregando os pipelines do CRM…</p>:crmPipelinesError?<p role="alert">{crmPipelinesError} <button type="button" className={secondaryTw} onClick={()=>void loadCrmPipelines()}>Tentar novamente</button></p>:null}{aiAgentsLoading?<p role="status">Carregando os agentes de IA…</p>:aiAgentsError?<p role="alert">{aiAgentsError} <button type="button" className={secondaryTw} onClick={()=>void loadAiAgents()}>Tentar novamente</button></p>:null}</div>
 {blockMenu&&createPortal(<div className="fixed inset-0 z-flow-command-tip" onPointerDown={event=>{if(event.target===event.currentTarget)setBlockMenu(null)}} onKeyDown={event=>{if(event.key==="Escape")setBlockMenu(null)}}>
 <div role="dialog" aria-label={blockMenu.option?"Adicionar próximo passo":"Ações do bloco"} className="fixed grid max-h-dvh w-56 overflow-auto gap-1 rounded-xl border border-gray-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 p-1.5 shadow-token-lg" style={{left:Math.max(0,Math.min(blockMenu.x,window.innerWidth-232)),top:Math.max(0,Math.min(blockMenu.y,window.innerHeight-(blockMenu.option?320:Math.min(350,160+freeMenuOutputs.length*44))))}}>
 {blockMenu.option?<><p className="px-2 py-1 text-flow-help font-bold text-ink">Próximo passo</p>{firstActions.map(([kind,label],index)=><button key={kind} autoFocus={index===0} type="button" className={canvasPaletteButton} onClick={()=>{add(kind,label,undefined,{id:blockMenu.id,option:blockMenu.option!});setBlockMenu(null)}}>{label}</button>)}</>:<>
 <button autoFocus type="button" className={canvasPaletteButton} onClick={()=>editCanvasNode(blockMenu.id)}>{blockMenu.id==="__trigger__"?"Editar gatilho":"Editar etapa"}</button>
 {freeMenuOutputs.map(option=><button key={option} type="button" className={canvasPaletteButton} onClick={()=>setBlockMenu({...blockMenu,option})}>{freeMenuOutputs.length===1?"Adicionar próximo passo":`Adicionar após ${option}`}</button>)}
 {menuStep?.options.map(option=>{
  const target=targetFor(menuStep,option);
  return target?<button key={option} type="button" className={canvasPaletteButton} onClick={()=>{
   add("text","Enviar mensagem",undefined,{id:menuStep.id,option},undefined,target);
   setBlockMenu(null);
  }}>{menuStep.options.length===1?"Inserir mensagem no caminho":`Inserir mensagem após ${option}`}</button>:null;
 })}
 {blockMenu.id==="__trigger__"?<button type="button" className={canvasPaletteButton} onClick={()=>{setBlockMenu(null);setStudioPanel("nodes");setEditorOpen(true);setRightCollapsed(false)}}>Mais ajustes do gatilho</button>:null}
 {menuStep?<>
 <button type="button" className={canvasPaletteButton} onClick={()=>{duplicateStep(blockMenu.id);setBlockMenu(null)}}>Duplicar etapa</button>
 <button type="button" className={canvasPaletteButton} onClick={()=>{deleteStep(blockMenu.id);setBlockMenu(null)}}>Excluir etapa</button></>:null}</>}
  </div></div>,document.body)}
  {edgeMenu&&createPortal(<div className="fixed inset-0 z-flow-command-tip" onPointerDown={event=>{if(event.target===event.currentTarget)setEdgeMenu(null)}} onKeyDown={event=>{if(event.key==="Escape")setEdgeMenu(null)}}>
  <div role="dialog" aria-label={"A\u00e7\u00f5es da conex\u00e3o"} className="fixed grid max-h-dvh w-56 overflow-auto gap-1 rounded-xl border border-gray-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 p-1.5 shadow-token-lg" style={{left:Math.max(0,Math.min(edgeMenu.x,window.innerWidth-232)),top:Math.max(0,Math.min(edgeMenu.y,window.innerHeight-112))}}>
  <p className="px-2 py-1 text-flow-help font-bold text-ink">{(flow.steps.find(step=>step.id===edgeMenu.edge.from)?.title||"Bloco")+" \u2192 "+edgeMenu.edge.option+" \u2192 "+(flow.steps.find(step=>step.id===edgeMenu.edge.to)?.title||"Bloco")}</p>
  <button autoFocus type="button" className={canvasPaletteButton} onClick={()=>{setSelectedEdge(edgeMenu.edge);setEdgeMenu(null)}}>{"Destacar conex\u00e3o"}</button>
  <button type="button" className={canvasPaletteButton} onClick={()=>{deleteEdge(edgeMenu.edge);setEdgeMenu(null)}}>{"Excluir conex\u00e3o"}</button>
  </div></div>,document.body)}
  <datalist id="chatbot-condition-variables">{[...textVariables].map(([key,label])=><option key={key} value={key} label={label}/>)}</datalist>
 {publishErrors.length?<div role="alert" className="grid gap-2 rounded-token-sm border border-line bg-surface p-3 text-ink">
  <strong>Corrija estes itens para publicar</strong>
  <ul className="grid gap-1">
   {publishErrors.map((error,index)=>{
    const separator=error.indexOf(":");
    const step=separator>0?flow.steps.find(item=>item.id===error.slice(0,separator)):undefined;
    return <li key={index}>{step?<button type="button" className="text-left underline" onClick={()=>{
     editCanvasNode(step.id);
     requestAnimationFrame(()=>{scrollRef.current?.scrollIntoView({block:"nearest"});revealCanvasNode(step.id);});
    }}>{step.title||"Bloco"} · {error.slice(separator+1).trim()}</button>:error}</li>;
   })}
  </ul>
 </div>:null}
 <div className={canvasCommandMenu} data-flow-command-menu><button type="button" className={canvasCommandButton} onClick={undoFlow} data-tip="Desfazer (Ctrl+Z)" aria-label="Desfazer"><Undo2 size={19}/></button><button type="button" className={canvasCommandButton} onClick={redoFlow} data-tip="Refazer (Ctrl+Shift+Z)" aria-label="Refazer"><Redo2 size={19}/></button><button type="button" className={canvasCommandButton} onClick={openFlowAssistant} data-tip="Criar com IA — descreva e a IA monta o fluxo" aria-label="Criar com IA"><Sparkles size={19}/></button><button type="button" className={canvasCommandButton} onClick={newFlow}><FilePlus2 size={17} aria-hidden="true"/>Novo fluxo</button><details className={canvasMore}>
   <summary className={canvasMoreSummary}><Ellipsis size={19} aria-hidden="true"/> Mais ações</summary>
   <div className={canvasMoreActions} onClick={event=>{if(event.target instanceof Element&&event.target.closest("button"))event.currentTarget.parentElement?.removeAttribute("open")}}>
    <button type="button" className={canvasCommandButton} onClick={()=>importInputRef.current?.click()} aria-label="Importar um fluxo exportado (JSON)"><FileUp size={19}/>Importar JSON</button>
    <button type="button" className={canvasCommandButton} onClick={exportFlow} aria-label="Exportar fluxo em JSON"><FileDown size={19}/>Exportar JSON</button>
    <button type="button" className={canvasCommandButton} aria-expanded={helpOpen} aria-label="Como usar os fluxos" onClick={()=>setHelpOpen(v=>!v)}><HelpCircle size={19}/>Como usar</button><button type="button" className={canvasCommandButton} aria-label="Entenda os blocos do fluxo" onClick={()=>setGuideOpen(true)}><BookOpen size={19}/>Entenda os blocos</button>
   </div>
  </details><input ref={importInputRef} type="file" accept="application/json,.json" style={{display:"none"}} aria-hidden="true" tabIndex={-1} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void importFlowFile(file);e.currentTarget.value="";}}/><button type="button" className={canvasCommandButton} onClick={()=>setLeftCollapsed(v=>!v)} data-tip="Elementos" aria-label="Mostrar ou ocultar blocos" aria-expanded={!leftCollapsed}><PanelLeft size={17} aria-hidden="true"/>Blocos</button><button type="button" className={canvasCommandButton} onClick={openSimulation} data-tip="Testar fluxo" aria-label="Testar o fluxo agora"><Play size={17} aria-hidden="true"/>Testar fluxo</button><button type="button" className={canvasCommandButton} onClick={autoArrange} data-tip="Organizar e enquadrar blocos" aria-label="Organizar os blocos automaticamente"><Wand2 size={19}/></button><button type="button" className={canvasCommandButton} onClick={()=>{setStudioPanel("nodes");setEditorOpen(true);setRightCollapsed(false);requestAnimationFrame(()=>requestAnimationFrame(()=>{document.querySelector("[data-flow-public-page]")?.scrollIntoView({behavior:"smooth",block:"center"})}));}} data-tip="Página pública" aria-label="Página pública do robô"><ExternalLink size={19}/></button><button type="button" className={canvasCommandButton} onClick={()=>void toggleFullScreen()} data-tip={fullScreen?"Sair da tela cheia":"Tela cheia"} aria-label={fullScreen?"Sair da tela cheia":"Tela cheia"}>{fullScreen?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button><button type="button" className={`${canvasCommandButton} ${canvasCommandPrimary}`} onClick={()=>void save()} disabled={savingRemote} data-tip="Salvar — guarda o rascunho (nada vai para o ar)" aria-label="Salvar rascunho"><Save size={17} aria-hidden="true"/>{savingRemote?"Salvando…":"Salvar rascunho"}</button><button type="button" className={primaryTw} disabled={runtimeBusy||savingRemote} onClick={()=>void runtimeAction("publish")} title="Congela o rascunho como revisão imutável e coloca o fluxo no ar">{runtimeBusy?"Aguarde…":libraryId?(runtime.active?"Publicar alterações":"Ativar automação"):"Publicar fluxo"}</button>{!libraryId?<button type="button" className={secondaryTw} disabled={runtimeBusy||savingRemote} onClick={()=>void runtimeAction("publish",true)}>Ativar como automação separada</button>:null}{runtime.active&&<button type="button" disabled={runtimeBusy} onClick={()=>void runtimeAction("stop")}>{libraryId?"Pausar automação":"Pausar motor"}</button>}</div>
 <div className={`${canvasShell} ${fullScreen?canvasShellFocusHeight:canvasShellHeight} ${leftCollapsed&&(rightCollapsed||!editorOpen)?canvasShellBoth:leftCollapsed?canvasShellLeft:rightCollapsed||!editorOpen?canvasShellRight:""}`} data-left-collapsed={leftCollapsed?"true":undefined} data-right-collapsed={rightCollapsed?"true":undefined} data-auto-hide={autoHidePanels?"true":undefined} data-inspector-empty={!editorOpen?"true":undefined} style={{"--inspector-width":inspectorWidth+"px"} as CSSProperties}>
 <aside className={`${canvasPanel} ${canvasLibrary} ${leftCollapsed?canvasPanelCollapsed:""}`}><button type="button" className={`${canvasPanelHandle} ${canvasLibraryHandle} ${leftCollapsed?canvasHandleCollapsed:""}`} data-flow-panel-handle aria-label={leftCollapsed?"Exibir elementos":"Ocultar elementos"} onClick={()=>setLeftCollapsed(v=>!v)}>{leftCollapsed?<ChevronRight size={16} aria-hidden="true"/>:<ChevronLeft size={16} aria-hidden="true"/>}</button><div className={`${canvasPanelTitle} ${leftCollapsed?"hidden":""}`}><strong className={canvasPanelTitleStrong}>Blocos</strong><small className={canvasPanelTitleSmall}>Clique ou arraste para o fluxo</small></div><input className={`${canvasSearch} ${leftCollapsed?"hidden":""}`} aria-label="Buscar bloco" placeholder="Buscar bloco…" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)}/><div className={`${canvasPalette} ${leftCollapsed?"hidden":""}`}>
 {starterBlockGroups.map(group=>{
  const actions=group.actions.filter(([,label])=>!libraryQuery||label.toLowerCase().includes(libraryQuery)||group.name.toLowerCase().includes(libraryQuery));
  if(!actions.length)return null;
  return <section key={group.name} className="grid gap-1.5">
   <h3 className="px-1 text-flow-help font-semibold text-ink-secondary">{group.name}</h3>
   <div className={canvasPaletteGrid}>{actions.map(([kind,label])=><button key={kind} type="button" className={canvasPaletteButton} draggable onDragStart={event=>{event.dataTransfer.effectAllowed="copy";event.dataTransfer.setData("application/x-vexora-chatbot-block",kind)}} onClick={()=>add(kind,label)}><Plus size={12} aria-hidden="true"/>{label}</button>)}</div>
  </section>;
 })}
 <details open={libraryQuery?true:undefined}><summary className="cursor-pointer px-2 py-2 font-bold text-ink">Mais blocos</summary><div className="grid gap-2"><details open={libraryQuery?true:undefined}><summary>Catálogo</summary>{catalogItems.filter(item=>item.name.toLowerCase().includes(libraryQuery)).map(item=><button type="button" className={canvasPaletteButton} key={item.id} onClick={()=>add("catalog.item",item.name,{itemId:item.id})}>{item.name}</button>)}{catalogItemsLoading?<small>Carregando catálogo…</small>:null}{catalogItemsError?<small>{catalogItemsError}</small>:null}</details><details open={libraryQuery?true:undefined}><summary>Departamentos</summary><div className={canvasPaletteGrid}><button type="button" className={canvasPaletteButton} onClick={()=>add("department.route","Departamento",{targetMode:"DEPARTMENT"})}>Departamento</button><button type="button" className={canvasPaletteButton} onClick={()=>add("department.route","Financeiro",{targetMode:"DEPARTMENT",departmentCategory:"FINANCE"})}>Financeiro</button><button type="button" className={canvasPaletteButton} onClick={()=>add("department.route","Suporte",{targetMode:"DEPARTMENT",departmentCategory:"SUPPORT"})}>Suporte</button></div>{destinations.departments.filter(d=>d.name.toLowerCase().includes(libraryQuery)).map(d=><button type="button" className={canvasPaletteButton} key={d.id} onClick={()=>add("department.route",d.name,{targetMode:"DEPARTMENT",departmentKey:d.key})}>{d.name}</button>)}</details><details open={libraryQuery?true:undefined}><summary>Atendentes</summary>{destinations.agents.filter(a=>a.name.toLowerCase().includes(libraryQuery)).map(a=><button type="button" className={canvasPaletteButton} key={a.id} onClick={()=>add("human.handoff",a.name,{targetMode:"PERSON",userId:a.id})}>{a.name}</button>)}</details><details open={libraryQuery?true:undefined}><summary>Agentes de IA</summary>{aiAgents.filter(a=>a.enabled&&a.name.toLowerCase().includes(libraryQuery)).map(a=><button type="button" className={canvasPaletteButton} key={a.id} onClick={()=>add("agent",a.name,{agentId:a.id})}>{a.name}</button>)}</details>{palette.map(category=>{const items=category.items.filter(([kind,label])=>executable.has(kind)&&!firstActions.some(([basic])=>basic===kind)&&(label.toLowerCase().includes(libraryQuery)||category.group.toLowerCase().includes(libraryQuery)));return items.length?<section key={category.group}><h3>{category.group}</h3><div className={canvasPaletteGrid}>{items.map(([kind,label])=><button key={kind} type="button" className={canvasPaletteButton} draggable onDragStart={event=>{event.dataTransfer.effectAllowed="copy";event.dataTransfer.setData("application/x-vexora-chatbot-block",kind)}} onClick={()=>add(kind,label)} title={"Adicionar "+label}><Plus size={12}/>{label}</button>)}</div></section>:null})}</div></details></div><button type="button" className={`${canvasAutoHideButton} ${leftCollapsed?"hidden":""}`} onClick={()=>setAutoHidePanels(v=>!v)}>{autoHidePanels?"Fixar laterais":"Auto-ocultar laterais"}</button></aside>
 <section className={canvasStage} data-grid-visible={showGrid?"true":"false"} aria-label="Editor visual do fluxo">
 {flow.steps.length===0?<section aria-label="Configurar novo fluxo" className="grid gap-4 border-b border-line bg-surface px-4 py-4 text-ink">
  <div className="grid gap-2 rounded-token border border-line bg-surface-2 p-3">
   <strong>Comece por um roteiro pronto</strong>
   <p className={canvasFieldHelp}>O exemplo “nome preferido” cumprimenta a pessoa pelo nome, pergunta a área e encaminha para as equipes. Entra como rascunho; nada é publicado automaticamente.</p>
   <div className="flex flex-wrap gap-2"><button type="button" className={primaryTw} onClick={loadPreferredNameExample}>Carregar exemplo: nome preferido</button><button type="button" className={secondaryTw} onClick={()=>setGuideOpen(true)}>Entender os blocos</button></div>
  </div>
  {triggerFields}
  <div>
   <h3 className="mb-2 text-flow-panel-title font-bold">Então…</h3>
   <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{firstActions.map(([kind,label])=><button key={kind} type="button" className={canvasPaletteButton} onClick={()=>add(kind,label)}><Plus size={14} aria-hidden="true"/>{label}</button>)}</div>
  </div>
 </section>:null}
  <div className={canvasStageBar}>
 <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-ink">
  <label className="flex min-w-0 flex-wrap items-center gap-2 font-semibold">Fluxo aberto
   <select className="min-w-0 max-w-full rounded-token-sm border border-line bg-surface-2 px-2 py-1 text-ink" disabled={switchingFlow} value={libraryId} onChange={event=>void loadLibrary(event.target.value)}>
    {!libraryId?<option value="">Rascunho atual · {flow.name||"Chatbot"}</option>:null}
    {Object.entries(businessFlows).map(([id,item])=><option key={id} value={id}>{item.draft.name||"Fluxo sem nome"}{runtimeState.publications?.some(publication=>publication.flowId===id&&publication.active)?" · Ativo":""}</option>)}
   </select>
  </label>
  {typeof runtimeState.botLimit==="number"?<small className="text-ink-secondary">{runtimeState.activeBots??0} de {runtimeState.botLimit} chatbots ativos</small>:null}
  {switchingFlow?<small role="status" className="text-ink-secondary">Guardando e abrindo o fluxo…</small>:null}
 </div>
   <div className={canvasStageBarGroup} role="group" aria-label="Controles do canvas">
    <button type="button" className={canvasStageButton} onClick={()=>zoomBy(-10)} aria-label="Diminuir zoom" title="Diminuir zoom"><ZoomOut size={17}/></button>
    <span className={canvasStageZoom}>{Math.round(zoom)}%</span>
    <button type="button" className={canvasStageButton} onClick={()=>zoomBy(10)} aria-label="Aumentar zoom" title="Aumentar zoom"><ZoomIn size={17}/></button>
    <button type="button" className={canvasStageButton} onClick={fitCanvas} aria-label="Enquadrar fluxo" title="Enquadrar fluxo"><Scan size={17}/></button>
    <button type="button" className={canvasStageButton} onClick={()=>setMinimapEnabled(v=>!v)} aria-pressed={minimapEnabled} aria-label="Minimapa" title="Minimapa"><MapIcon size={17}/></button>
    <button type="button" className={canvasStageButton} aria-pressed={showGrid} onClick={()=>setShowGrid(v=>!v)}>Grade</button><button type="button" className={canvasStageButton} aria-pressed={showWires} onClick={()=>setShowWires(v=>!v)} aria-label="Mostrar ou ocultar linhas" title="Mostrar ou ocultar linhas">Linhas</button><button type="button" className={canvasStageButton} aria-pressed={compactNodes} onClick={()=>setCompactNodes(v=>!v)} aria-label="Encolher ou ampliar blocos" title="Encolher ou ampliar blocos">Compactos</button>
   </div>
  </div>
  <div className={`${canvasScroll} ${panning?canvasScrollPanning:"cursor-grab"} ${showGrid?canvasGrid:""}`} data-panning={panning?"true":undefined} data-grid-visible={showGrid?"true":"false"} ref={scrollRef} tabIndex={0} role="region"
   onDragOver={event=>{if(event.dataTransfer.types.includes("application/x-vexora-chatbot-block")){event.preventDefault();event.dataTransfer.dropEffect="copy"}}}
   onDrop={event=>{
    const kind=event.dataTransfer.getData("application/x-vexora-chatbot-block");
    if(!executable.has(kind))return;
    const item=palette.flatMap(category=>[...category.items]).find(([id])=>id===kind);
    if(!item)return;
    event.preventDefault();
    const rect=event.currentTarget.getBoundingClientRect();
    add(kind,item[1],undefined,undefined,{x:(event.clientX-rect.left-view.x)/scale,y:(event.clientY-rect.top-view.y)/scale});
   }}
   aria-label="Canvas do fluxo. Use as setas para navegar, Shift para movimentos maiores."
   style={{backgroundPosition:`${view.x}px ${view.y}px`,backgroundSize:`${24*scale}px ${24*scale}px`}}
   onKeyDown={event=>{
    if(event.target!==event.currentTarget)return;
    const distance=event.shiftKey?240:64;
    const direction=canvasDirection(event.key,distance);
    if(!direction)return;
    event.preventDefault();
    panBy(-direction.x,-direction.y);
   }}
   onPointerDown={event=>{
    if(event.button!==0||pointers.current.size>=2||!(event.target instanceof Element)||event.target.closest("[data-flow-node]"))return; setSelected(""); setSelectedEdge(null); setEdgeMenu(null); setCompactNodes(true);
    const rect=event.currentTarget.getBoundingClientRect();
    pointers.current.set(event.pointerId,{x:event.clientX-rect.left,y:event.clientY-rect.top});
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
   }}
   onPointerMove={moveCanvasPointer} onPointerUp={endCanvasPointer}
   onPointerCancel={endCanvasPointer} onLostPointerCapture={endCanvasPointer}>
   <div className={canvasBoard} data-flow-board data-compact-nodes={compactNodes?"true":undefined} data-flow-trace-phase={tracePhase} style={{transform:`translate3d(${view.x}px,${view.y}px,0) scale(${scale})`}}>
 <svg className={`${canvasWires} flow-wires`} style={{display:showWires?undefined:"none"}} width="1" height="1" aria-label="Conexões entre blocos"><defs><linearGradient id="vx-wire-gradient" x1="0" x2="1"><stop offset="0" stopColor="var(--primary)"/><stop offset="1" stopColor="var(--accent2)"/></linearGradient><marker id="vx-wire-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent2)"/></marker></defs>{entryStep?<path data-flow-entry-link d={`M ${triggerPosition.x+(nodeBoxes.__trigger__?.w??212)} ${triggerPosition.y+(nodeBoxes.__trigger__?.h??64)/2} C ${triggerPosition.x+(nodeBoxes.__trigger__?.w??212)+60} ${triggerPosition.y+(nodeBoxes.__trigger__?.h??64)/2}, ${entryX-64} ${entryY+(nodeBoxes[entryStep.id]?.inputY??48)}, ${entryX-4} ${entryY+(nodeBoxes[entryStep.id]?.inputY??48)}`} fill="none" stroke="var(--primary)" strokeWidth="2.2" markerEnd="url(#vx-wire-arrow)"/>:null}{graphEdges.map((edge,i)=>{const from=flow.steps.findIndex(x=>x.id===edge.from),to=flow.steps.findIndex(x=>x.id===edge.to);const source=flow.steps[from],target=flow.steps[to];if(!source||!target)return null;const sBox=nodeBoxes[edge.from],tBox=nodeBoxes[edge.to];const sx=source.position?.x??(from%3)*330+65,sy=source.position?.y??Math.floor(from/3)*210+105;const tx=target.position?.x??(to%3)*330+65,ty=target.position?.y??Math.floor(to/3)*210+105;const x1=sx+(sBox?.w??212)+4,y1=sy+(sBox?.outputY[edge.option]??(sBox?.h??100)/2);const x2=tx-4,y2=ty+(tBox?.inputY??(tBox?.h??100)/2);const bend=Math.max(65,Math.abs(x2-x1)*.5);const d=`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`;const edgeSelected=activeEdge!==null&&activeEdge.from===edge.from&&activeEdge.option===edge.option&&activeEdge.to===edge.to;
const edgeRunning=highlightedEdges.some(used=>used.from===edge.from&&used.option===edge.option&&used.to===edge.to);
const edgeLabel=(source.title||"Bloco")+" \u2192 "+edge.option+" \u2192 "+(target.title||"Bloco");
const traceOrder=traceEdges.findIndex(used=>used.from===edge.from&&used.option===edge.option&&used.to===edge.to);
return <g key={edge.from+"-"+edge.option+"-"+i} data-flow-edge data-edge-selected={edgeSelected?"true":undefined} data-edge-running={edgeRunning?"true":undefined}><path data-flow-trace-edge={traceOrder>=0?traceOrder:undefined} style={traceOrder>=0?{"--flow-trace-delay":(Math.min(traceOrder,12)*160+80)+"ms"} as CSSProperties:undefined} className={`vex-wire-line${edgeRunning?" stroke-accent":""}`} d={d} fill="none" stroke={edgeSelected?"var(--accent2)":"url(#vx-wire-gradient)"} strokeWidth={edgeSelected?3.4:2.2} strokeLinecap="round" markerEnd="url(#vx-wire-arrow)"/><path className="vex-wire-motion" d={d} fill="none" stroke={edgeSelected?"#fff":"var(--accent2)"} strokeWidth={edgeSelected?2.6:1.8} strokeLinecap="round"/><path className="vex-wire-hit" d={d} fill="none" stroke="transparent" strokeWidth="16" role="button" tabIndex={0} aria-label={edgeLabel} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();setSelectedEdge(edge);setEdgeMenu(null);setCompactNodes(false)}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();setEdgeMenu({x:event.clientX,y:event.clientY,edge});setBlockMenu(null)}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelectedEdge(edge);setCompactNodes(false)}else if(event.key==="Delete"){event.preventDefault();deleteEdge(edge)}}}/></g>})}{dragWire?(()=>{const start=outputPoint(dragWire.from,dragWire.option);if(!start)return null;const bend=Math.max(65,Math.abs(dragWire.x-start.x)*.5);return <path data-flow-preview-wire d={`M ${start.x} ${start.y} C ${start.x+bend} ${start.y}, ${dragWire.x-bend} ${dragWire.y}, ${dragWire.x} ${dragWire.y}`} fill="none" stroke="var(--accent2)" strokeWidth={2.6} strokeDasharray="7 6" strokeLinecap="round" markerEnd="url(#vx-wire-arrow)"/>})():null}</svg>
 <div className={`${canvasStartNode} ${canvasToneEdge.start}`} ref={setNodeRef("__trigger__")} data-flow-node data-flow-start-node onContextMenu={event=>{if(event.target instanceof Element&&event.target.closest("input,select,textarea"))return;event.preventDefault();setBlockMenu({id:"__trigger__",x:event.clientX,y:event.clientY})}} style={{left:triggerPosition.x,top:triggerPosition.y}} onPointerDown={e=>{const target=e.target as HTMLElement;if(!e.isPrimary||e.button!==0||target.closest("input,select,textarea,button:not([data-flow-trigger-handle])"))return;drag.current={id:"__trigger__",pointerX:e.clientX,pointerY:e.clientY,x:triggerPosition.x,y:triggerPosition.y};draggedNode.current=false;(target.closest("[data-flow-trigger-handle]")||e.currentTarget).setPointerCapture(e.pointerId)}} onPointerMove={e=>{const d=drag.current;if(d?.id!=="__trigger__")return;if(!draggedNode.current&&Math.hypot(e.clientX-d.pointerX,e.clientY-d.pointerY)<4)return;draggedNode.current=true;setTriggerPosition({x:d.x+(e.clientX-d.pointerX)/(zoom/100),y:d.y+(e.clientY-d.pointerY)/(zoom/100)})}} onPointerUp={e=>{if(drag.current?.id==="__trigger__"){drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}} onLostPointerCapture={()=>{if(drag.current?.id==="__trigger__")drag.current=null}}><button type="button" data-flow-trigger-handle aria-expanded={inlineTriggerOpen&&flow.steps.length>0} className={canvasTriggerHeading} onClick={event=>{if(event.detail&&draggedNode.current)return;setInlineTriggerOpen(open=>!open)}}><Bot size={17} aria-hidden="true"/><strong>Quando…</strong></button><small>{flow.triggers?.[0]?.kind==="keyword"?"Palavra-chave":flow.triggers?.[0]?.kind==="dm"?"Mensagem direta":flow.triggers?.[0]?.kind==="first_message"?"Iniciar uma conversa":"Nova mensagem"}</small>{flow.welcome&&<span className={canvasTriggerPreview}>{flow.welcome.slice(0,75)}{flow.welcome.length>75?"…":""}</span>}{inlineTriggerOpen&&flow.steps.length>0?<div className="mt-2 grid gap-2 border-t border-line pt-2">{triggerFields}<button type="button" className={canvasNodeQuickButton} onClick={()=>{setInlineTriggerOpen(false);setStudioPanel("nodes");setEditorOpen(true);setRightCollapsed(false)}}>Mais ajustes do gatilho</button></div>:null}</div>
 {flow.steps.map((step,i)=><div key={step.id} ref={setNodeRef(step.id)} className={`${canvasNode} ${canvasToneEdge[nodeTone(step)]} ${selected===step.id?canvasNodeSelected:""} ${highlightedNodes.includes(step.id)?"ring-2 ring-accent shadow-flow-node-selected":""}`} data-flow-node data-flow-node-id={step.id} data-selected={selected===step.id?"true":undefined} data-tone={nodeTone(step)} data-edge-connected={connectedNodeIds?.has(step.id)?"true":undefined} onClick={()=>{setCompactNodes(false);setSelectedEdge(null);setEdgeMenu(null)}} onContextMenu={event=>{ setEdgeMenu(null);
  if(event.target instanceof Element&&event.target.closest("textarea,input"))return;
  event.preventDefault();
  setBlockMenu({id:step.id,x:event.clientX,y:event.clientY});
 }} data-flow-trace-node={traceNodes.includes(step.id)?traceNodes.indexOf(step.id):undefined} style={{left:step.position?.x??(i%3)*330+65,top:step.position?.y??Math.floor(i/3)*210+105,"--flow-trace-delay":Math.min(Math.max(0,traceNodes.indexOf(step.id)),12)*160+"ms"} as CSSProperties} onPointerDown={e=>{const t=e.target as HTMLElement;if(!e.isPrimary||e.button!==0||t.closest("button:not([data-flow-node-head]),input,select,textarea,[data-flow-input-port],[data-flow-outputs] i"))return;const x=step.position?.x??(i%3)*330+65,y=step.position?.y??Math.floor(i/3)*210+105;draggedNode.current=false;drag.current={id:step.id,pointerX:e.clientX,pointerY:e.clientY,x,y};(t.closest("[data-flow-node-head]")||e.currentTarget).setPointerCapture(e.pointerId)}} onPointerMove={e=>{const d=drag.current;if(!d||d.id!==step.id)return;if(!draggedNode.current&&Math.hypot(e.clientX-d.pointerX,e.clientY-d.pointerY)<4)return;draggedNode.current=true;moveNode(step.id,d.x+(e.clientX-d.pointerX)/(zoom/100),d.y+(e.clientY-d.pointerY)/(zoom/100))}} onPointerUp={e=>{if(drag.current?.id===step.id){drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}} onLostPointerCapture={()=>{if(drag.current?.id===step.id)drag.current=null}}>
 <button type="button" className={canvasNodeHead} data-flow-node-head aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown" onKeyDown={event=>{
   if(!event.altKey)return;
   const direction=canvasDirection(event.key,16);
   if(!direction)return;
   event.preventDefault();
   moveNode(step.id,(step.position?.x??(i%3)*330+65)+direction.x,(step.position?.y??Math.floor(i/3)*210+105)+direction.y);
  }} onClick={event=>{event.stopPropagation();if(event.detail&&draggedNode.current)return;setCompactNodes(true);editCanvasNode(step.id)}}><span className={canvasNodeSymbol}>{step.action?.startsWith("asaas.")?"◈":step.action==="human.handoff"?"◎":"◆"}</span><span className="grid min-w-0 text-left"><strong>{canvasActionLabels.get(step.action||step.kind||"")||step.title}</strong>{canvasActionLabels.has(step.action||step.kind||"")&&canvasActionLabels.get(step.action||step.kind||"")!==step.title?<small className="truncate font-normal text-ink-secondary">{step.title}</small>:null}</span><span className={canvasNodeGrip}>⠿</span></button>
 <div className="absolute -right-2 -top-2 z-flow-node-actions"><button type="button" className={canvasNodeQuickButton} aria-label={`Ações de ${step.title}`} aria-haspopup="dialog" onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();setBlockMenu({id:step.id,x:rect.left,y:rect.bottom})}}><Ellipsis size={15} aria-hidden="true"/></button></div>
 <div className={canvasNodeBody}><span className={canvasInputPort} data-flow-input-port/>
 {step.kind==="condition"?inlineCondition===step.id?<div className="grid gap-2" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setInlineCondition(null)}}}>
  <label className="grid gap-1 text-ink">Informação<input autoFocus list="chatbot-condition-variables" maxLength={80} className="w-full min-w-0 select-text rounded-token-sm border border-line bg-surface px-2 py-1" value={stepConfig(step).variable||""} onChange={event=>updateCondition(step.id,"variable",event.target.value)}/></label>
  <label className="grid gap-1 text-ink">É igual a{conditionValueOptions(stepConfig(step).variable||"").length ? <select className="w-full min-w-0 rounded-token-sm border border-line bg-surface px-2 py-1" value={stepConfig(step).value||""} onChange={event=>updateCondition(step.id,"value",event.target.value)}>
   <option value="">Escolha um resultado</option>
   {stepConfig(step).value&&!conditionValueOptions(stepConfig(step).variable||"").some(([value])=>value===stepConfig(step).value)?<option value={stepConfig(step).value}>{stepConfig(step).value}</option>:null}
   {conditionValueOptions(stepConfig(step).variable||"").map(([value,label])=><option key={value} value={value}>{label}</option>)}
  </select> : <input maxLength={500} className="w-full min-w-0 select-text rounded-token-sm border border-line bg-surface px-2 py-1" value={stepConfig(step).value||""} onChange={event=>updateCondition(step.id,"value",event.target.value)}/>}</label>
  <button type="button" className={canvasNodeQuickButton} onClick={()=>setInlineCondition(null)}>Concluir</button>
 </div>:<button type="button" className={`${canvasNodeSummary} block w-full text-left hover:underline`} data-flow-node-summary onClick={()=>{setSelected(step.id);setInlineCondition(step.id)}}>{stepConfig(step).variable&&typeof stepConfig(step).value==="string"?`Se ${textVariables.get(stepConfig(step).variable!)||stepConfig(step).variable} é igual a “${conditionValueOptions(stepConfig(step).variable||"").find(([value])=>value===stepConfig(step).value)?.[1]||stepConfig(step).value}”`:"Definir condição"}</button>
 :inlineMessage===step.id?<div className="grid gap-2" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setInlineMessage(null)}} onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setInlineMessage(null)}}}>
  <textarea ref={inlineMessageRef} autoFocus rows={3} maxLength={4000} aria-label={`Mensagem de ${step.title}`} className="w-full select-text rounded-token-sm border border-line bg-surface px-2 py-1 text-ink" value={step.message} onChange={event=>updateStep({message:event.target.value})}/>
  <VariablePicker label="Inserir variável" variables={textVariables} onPick={key=>insertVariable(inlineMessageRef.current,step.message,key,4000,next=>updateStep({message:next}))}/>
  {flow.steps.some(item=>item.kind==="payment.status")&&!step.message.includes("{{pagamento_link}}")?<button type="button" className={canvasNodeQuickButton} disabled={step.message.length>3982} onClick={event=>{
   const editor=event.currentTarget.parentElement?.querySelector("textarea");
   const source=editor?.value??step.message;
   const position=editor?.selectionStart??source.length;
   const end=editor?.selectionEnd??position;
   const link="{{pagamento_link}}";
   const prefix=source.slice(0,position);
   const separator=prefix&&!/\s$/.test(prefix)?" ":"";
   const next=prefix+separator+link+source.slice(end);
   if(next.length>4000)return;
   editor?.focus();
   updateStep({message:next});
   requestAnimationFrame(()=>editor?.setSelectionRange(position+separator.length+link.length,position+separator.length+link.length));
  }}>Inserir link de pagamento</button>:null}
 </div>
 :["text","buttons","input.text","input.cpf"].includes(step.kind||"")&&!step.action?<button type="button" className={`${canvasNodeSummary} block w-full text-left hover:underline`} data-flow-node-summary onClick={()=>{setSelected(step.id);setInlineMessage(step.id)}}>{step.message||"Escrever mensagem"}</button>
 :step.kind==="task.reminder"?<button type="button" className={`${canvasNodeSummary} block w-full text-left hover:underline`} data-flow-node-summary onClick={()=>editCanvasNode(step.id)}>{stepConfig(step).title ? `${stepConfig(step).title} · em ${stepConfig(step).minutes||"?"} min` : "Configurar título e prazo"}</button>
 :<p className={canvasNodeSummary} data-flow-node-summary>{nodeSummary(step,catalogItems)}</p>}
 {waitingNode===step.id?<span className="block font-semibold text-ink">Aguardando resposta</span>:null}</div>
 <div className={canvasOutputs} data-flow-outputs>{step.options.map((option,j)=><div className="flex items-center gap-1" key={j}><button type="button" data-option={option} data-kind={optionTone(option)} style={{borderColor:optionColor(option)}} className={`${canvasOutputButton} ${connectFrom===step.id&&connectOption===option?canvasOutputConnecting:""}`} data-connecting={connectFrom===step.id&&connectOption===option?"true":undefined} onClick={()=>{setConnectFrom(step.id);setConnectOption(option);setSelected(step.id)}} title={`Conectar: ${option}`}><span aria-hidden="true" style={{color:optionColor(option),fontWeight:800}}>{optionIcon(option)}</span><span className="min-w-0 break-words">{option}</span><i className={canvasOutputPort} aria-hidden="true"/></button>{step.kind==="buttons"?<button type="button" className={canvasNodeQuickButton} aria-label={`Editar opção ${option}`} onClick={()=>setOptionEditor({stepId:step.id,original:option,label:option})}>Editar</button>:null}{!targetFor(step,option)?<button type="button" className={canvasNodeQuickButton} data-flow-wire-start title="Adicionar próximo passo (arraste até outro bloco)" aria-label={`Adicionar próximo passo após ${option}`} onPointerDown={event=>startWireDrag(event,step.id,option)} onPointerMove={moveWireDrag} onPointerUp={finishWireDrag} onPointerCancel={cancelWireDrag} onLostPointerCapture={cancelWireDrag} onClick={event=>{if(suppressPlusClick.current){suppressPlusClick.current=false;return}const rect=event.currentTarget.getBoundingClientRect();setBlockMenu({id:step.id,option,x:rect.left,y:rect.bottom})}}>+</button>:null}</div>)}
 {step.kind==="buttons"&&step.options.length<30&&optionEditor?.stepId!==step.id?<button type="button" className={canvasNodeQuickButton} onMouseDown={event=>event.preventDefault()} onClick={()=>setOptionEditor({stepId:step.id,original:null,label:""})}><Plus size={13} aria-hidden="true"/>Adicionar opção</button>:null}
 {optionEditor?.stepId===step.id?<div className="grid gap-1 rounded-token-sm border border-line bg-surface-2 p-2">
 <label className="grid gap-1 text-ink">Texto da opção<input ref={optionInputRef} autoFocus maxLength={160} className="w-full min-w-0 select-text rounded-token-sm border border-line bg-surface px-2 py-1 text-ink" value={optionEditor.label} onChange={event=>setOptionEditor({...optionEditor,label:event.target.value})} onKeyDown={event=>{
  if(event.key==="Enter"){event.preventDefault();saveCanvasOption(step);}
  if(event.key==="Escape"){event.stopPropagation();setOptionEditor(null);}
 }}/></label>
 <VariablePicker label="Inserir variável na opção" variables={textVariables} onPick={key=>insertVariable(optionInputRef.current,optionEditor.label,key,160,next=>setOptionEditor({...optionEditor,label:next}))}/>
 <div className="flex flex-wrap gap-1"><button type="button" className={canvasNodeQuickButton} onClick={()=>saveCanvasOption(step)} disabled={!optionEditor.label.trim()||step.options.some(option=>option!==optionEditor.original&&option===optionEditor.label.trim())}>Aplicar</button><button type="button" className={canvasNodeQuickButton} onClick={()=>setOptionEditor(null)}>Cancelar</button>{optionEditor.original!==null?<button type="button" className={dangerTextTw} onClick={()=>removeCanvasOption(step,optionEditor.original!)}>Remover opção</button>:null}</div>
 </div>:null}</div>
 {connectFrom&&connectOption&&connectFrom!==step.id?<button type="button" className={canvasNodeTarget} onClick={()=>connectNode(step.id)}>Conectar aqui</button>:null}</div>)}
 </div></div>{minimapEnabled ? <div className={canvasMinimap} role="navigation" aria-label="Mapa do fluxo" onPointerDown={event=>{if(!event.isPrimary||event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);minimapCenterAt(event.clientX,event.clientY)}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))minimapCenterAt(event.clientX,event.clientY)}}><svg className={canvasMinimapSvg} ref={minimapRef} viewBox={`${minimapUnits.box.minX} ${minimapUnits.box.minY} ${minimapUnits.box.width} ${minimapUnits.box.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect className={canvasMinimapBg} x={minimapUnits.box.minX} y={minimapUnits.box.minY} width={minimapUnits.box.width} height={minimapUnits.box.height} rx={12}/>{minimapUnits.boxes.map((box,index)=><rect key={index} className={`${canvasMinimapNode} ${box.trigger?canvasMinimapTrigger:""}`} data-trigger={box.trigger?"true":undefined} x={box.x} y={box.y} width={box.width} height={box.height} rx={9}/>)}<rect className={canvasMinimapViewport} x={viewportWorld.x} y={viewportWorld.y} width={viewportWorld.width} height={viewportWorld.height} rx={6}/></svg></div> : null}<div className={canvasStageFoot}>{connectFrom&&connectOption?<span>Conectando <strong>{connectOption}</strong> — clique em “Conectar aqui” no bloco de destino. <button type="button" onClick={()=>{setConnectFrom(null);setConnectOption("")}}>Cancelar</button></span>:<span>Arraste o fundo para navegar. Arraste o + de uma saída até outro bloco para conectar. Use a roda ou o gesto de pinça para dar zoom.</span>}</div></section>
 <aside className={`${canvasPanel} ${canvasInspector} ${rightCollapsed||!editorOpen?canvasPanelCollapsed:""}`}><div className={`${canvasResizer} ${rightCollapsed||!editorOpen?"hidden":""}`} role="separator" aria-orientation="vertical" aria-label="Ajustar largura do painel de propriedades" tabIndex={0} onPointerDown={(event)=>{event.preventDefault();inspectorResizeStart.current={pointerX:event.clientX,width:inspectorWidth};event.currentTarget.setPointerCapture(event.pointerId)}} onPointerMove={(event)=>{const start=inspectorResizeStart.current;if(!start||!(event.buttons&1))return;setInspectorWidth(Math.min(520,Math.max(280,start.width-(event.clientX-start.pointerX))))}} onPointerUp={(event)=>{inspectorResizeStart.current=null;try{window.localStorage.setItem("vx:inspector-width",String(inspectorWidth))}catch{/* ignore */}if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}} onPointerCancel={()=>{inspectorResizeStart.current=null}} onKeyDown={(event)=>{if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();const delta=event.key==="ArrowLeft"?24:-24;setInspectorWidth(v=>{const next=Math.min(520,Math.max(280,v+delta));try{window.localStorage.setItem("vx:inspector-width",String(next))}catch{/* ignore */}return next})}}}><i className={canvasResizerGrip} aria-hidden="true"/></div><button type="button" className={`${canvasInspectorClose} ${rightCollapsed||!editorOpen?"hidden":""}`} onClick={()=>{setEditorOpen(false);setStudioPanel("settings")}} aria-label="Fechar painel"><X size={16} aria-hidden="true" /></button><button type="button" className={`${canvasPanelHandle} ${canvasInspectorHandle} ${rightCollapsed||!editorOpen?canvasHandleCollapsed:""}`} data-flow-panel-handle aria-label={rightCollapsed?"Exibir propriedades":"Ocultar propriedades"} onClick={()=>setRightCollapsed(v=>!v)}>{rightCollapsed?<ChevronLeft size={16} aria-hidden="true"/>:<ChevronRight size={16} aria-hidden="true"/>}</button><div className={`${canvasPanelTitle} ${rightCollapsed||!editorOpen?"hidden":""}`}><strong className={canvasPanelTitleStrong}>{studioPanel==="settings"?"Propriedades da etapa":studioPanel==="test"?"Testar fluxo":"Configurações do fluxo"}</strong><small>{studioPanel==="settings"?current?.title||"Selecione uma etapa":studioPanel==="test"?"Simulação local":"Entrada e canais"}</small></div><div className={`${canvasInspectorActions} ${rightCollapsed||!editorOpen?"hidden":""}`}><button type="button" className={`${canvasInspectorAction} ${studioPanel==="settings"?canvasInspectorActionActive:""}`} onClick={()=>setStudioPanel("settings")} aria-pressed={studioPanel==="settings"}>Editar</button><button type="button" className={`${canvasInspectorAction} ${studioPanel==="test"?canvasInspectorActionActive:""}`} onClick={openSimulation} aria-pressed={studioPanel==="test"}>Teste</button><button type="button" className={`${canvasInspectorAction} ${studioPanel==="nodes"?canvasInspectorActionActive:""}`} onClick={()=>setStudioPanel("nodes")} aria-pressed={studioPanel==="nodes"}>Início</button></div><div className={`${canvasInspectorBody} ${rightCollapsed||!editorOpen?"hidden":""}`}>{studioPanel==="nodes"?<><p className={canvasFieldHelp}>1. Selecione os canais. 2. Escolha o gatilho. 3. Escreva a saudação. 4. Conecte as saídas das etapas no canvas.</p><label className={canvasInspectorLabel}>Nome do fluxo<input value={flow.name||""} maxLength={80} placeholder="Ex.: Triagem de leads (aparece na biblioteca)" onChange={e=>setFlow(f=>({...f,name:e.target.value}))}/></label><label className={canvasInspectorLabel}>Saudação inicial<div className={canvasVariablePicker} role="toolbar" aria-label="Variáveis disponíveis">{[...textVariables].map(([key,label])=><button type="button" className={canvasVariableButton} key={key} onClick={()=>insertWelcomeVariable(key)} title={"Inserir "+label}>{"{{"+key+"}}"}</button>)}</div><textarea ref={welcomeRef} rows={4} value={flow.welcome} onChange={e=>setFlow(f=>({...f,welcome:e.target.value}))}/></label><label className={canvasInspectorLabel}><span><input type="checkbox" checked={flow.askPreferredName!==false} onChange={event=>{const askPreferredName=event.target.checked;setFlow(draft=>({...draft,askPreferredName}))}}/> Perguntar automaticamente como chamar o cliente</span></label><h3>Canais de entrada</h3><div className={inspectorChannelListTw}>{channels.length?channels.map(channel=><label key={channel.id} className={(flow.channelIds||[]).includes(channel.id)?inspectorChannelItemActiveTw:inspectorChannelItemTw}><input type="checkbox" className={inspectorChannelInputTw} checked={(flow.channelIds||[]).includes(channel.id)} onChange={e=>setFlow(f=>({...f,channelIds:e.target.checked?[...(f.channelIds||[]),channel.id]:(f.channelIds||[]).filter(id=>id!==channel.id)}))}/><span className={inspectorChannelGlyphTw} style={{color:platformColor(channel.platform||channel.provider)}}><PlatformIcon platform={channel.platform||channel.provider} size={22}/></span><span className={inspectorChannelCopyTw}><strong>{channel.name}</strong><small className={inspectorChannelMetaTw}>{platformLabel(channel.platform||channel.provider)}</small></span></label>):<small>Conecte canais em Canais e Integrações.</small>}</div><label className={canvasInspectorLabel}>Disparador<select value={flow.triggers?.[0]?.kind||"message"} onChange={e=>setFlow(f=>({...f,triggers:[{kind:e.target.value as "message"|"keyword"|"dm",keyword:f.triggers?.[0]?.keyword}]}))}><option value="first_message">Iniciar uma conversa</option><option value="message">Nova mensagem</option><option value="dm">Mensagem direta</option><option value="keyword">Palavra-chave</option></select></label>{flow.triggers?.[0]?.kind==="keyword"?<label className={canvasInspectorLabel}>Palavra-chave<input value={flow.triggers[0]?.keyword||""} onChange={e=>setFlow(f=>({...f,triggers:[{kind:"keyword",keyword:e.target.value}]}))}/></label>:null}{channelNotice?<small>{channelNotice}</small>:null}<section className={publicSettingsTw} data-flow-public-page aria-label="Página pública de teste"><h3 className={publicSettingsTitleTw}>Robô em tela cheia (página pública)</h3><p className={canvasFieldHelp}>Uma página pública só desta empresa, fora do painel da Véxora: o cliente abre o link e conversa com o robô, com o logo e o nome da empresa no cabeçalho — como uma tela Typebot. Ideal para testar, compartilhar com clientes ou embutir no site. O endereço /p/ que funciona hoje fica abaixo; o endereço bot-*.vexorasuite.com.br fica reservado na Véxora Cloud.</p>{!publicPage.loaded?<p className={publicNoteTw}>Carregando…</p>:<><label className={publicToggleTw}><input type="checkbox" className={publicToggleInputTw} checked={publicPage.enabled} disabled={publicPage.busy} onChange={e=>void savePublicPage({enabled:e.target.checked})}/><span>{publicPage.enabled?"Página pública ativada":"Página pública desativada"}</span></label>{publicPage.error?<p className={publicNoteTw} role="status">{publicPage.error}</p>:null}{publicPageNotice?<p className={publicNoteTw} role="status">{publicPageNotice}</p>:null}{publicPage.enabled&&publicPage.token?<div className={publicLinkTw}><code className={publicLinkCodeTw}>{publicPageUrl}</code><div className={publicActionsTw}><button type="button" className={secondaryTw} onClick={()=>{void navigator.clipboard?.writeText(publicPageUrl);setPublicPageNotice("Link copiado.");}}><Copy size={14} aria-hidden="true"/> Copiar link</button><a className={primaryTw} href={publicPageUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true"/> Abrir página</a></div>{botHostInfo?<div className={publicReservedTw}><div className={publicReservedHeadTw}><span className={publicSectionLabelTw}>ENDEREÇO RESERVADO NA VÉXORA CLOUD</span><span className={publicReservedTagTw}>AGUARDANDO ATIVAÇÃO</span></div><code className={publicReservedCodeTw}>https://{botHostInfo.botHost}</code><div className={publicReservedFootTw}><small className={publicReservedFootSmallTw}>Quando o wildcard <code className={publicInlineCodeTw}>*.vexorasuite.com.br</code> for ativado, este endereço passa a servir a página pública deste robô — os próximos robôs desta empresa usam <code className={publicInlineCodeTw}>bot2-…</code>, <code className={publicInlineCodeTw}>bot3-…</code>; outra empresa com o mesmo nome usa <code className={publicInlineCodeTw}>-2</code>, <code className={publicInlineCodeTw}>-3</code> no fim.</small><button type="button" className={secondaryTw} onClick={()=>{void navigator.clipboard?.writeText("https://"+botHostInfo.botHost);setPublicPageNotice("Endereço reservado copiado.");}}><Copy size={13} aria-hidden="true"/> Copiar</button></div></div>:null}</div>:null}<label className={canvasInspectorLabel}>Título do cabeçalho<input value={publicPage.theme.headerTitle||""} maxLength={60} placeholder="Ex.: Natália · Arquitetura" onChange={e=>void savePublicPage({theme:{...publicPage.theme,headerTitle:e.target.value}})}/></label><label className={canvasInspectorLabel}>Subtítulo do cabeçalho<input value={publicPage.theme.headerSubtitle||""} maxLength={120} placeholder="Ex.: Equipe Ilana Santiago · online" onChange={e=>void savePublicPage({theme:{...publicPage.theme,headerSubtitle:e.target.value}})}/></label><fieldset className={publicThemeTw}><legend className={publicThemeLegendTw}>Tema do bot</legend><div className={publicThemeGridTw}>{[{mode:"cream",label:"Claro"},{mode:"dark",label:"Escuro"},{mode:"whatsapp",label:"WhatsApp"}].map(option=><button key={option.mode} type="button" aria-pressed={(publicPage.theme.mode||"cream")===option.mode} className={(publicPage.theme.mode||"cream")==="cream"?publicSwatchCreamTw:(publicPage.theme.mode||"dark")==="dark"?publicSwatchDarkTw:publicSwatchWhatsappTw} onClick={()=>void savePublicPage({theme:{...publicPage.theme,mode:option.mode}})}>{option.label}</button>)}</div>{publicPage.theme.mode==="whatsapp"?<p className={publicNoteTw}>Tema WhatsApp: fundo bege, header verde e bolhas verde-claro do lado do cliente.</p>:null}</fieldset><fieldset className={publicThemeTw}><legend className={publicThemeLegendTw}>Fundo da página</legend><div className={publicThemeGridTw}>{[{kind:"default",label:"Véxora"},{kind:"solid",label:"Cor"},{kind:"gradient",label:"Gradiente"},{kind:"image",label:"Imagem"}].map(option=><button key={option.kind} type="button" aria-pressed={publicPage.theme.backgroundKind===option.kind} className={option.kind==="default"?publicSwatchDefaultTw:option.kind==="solid"?publicSwatchSolidTw:option.kind==="gradient"?publicSwatchGradientTw:publicSwatchImageTw} onClick={()=>void savePublicPage({theme:{...publicPage.theme,backgroundKind:option.kind}})}>{option.label}</button>)}</div>{publicPage.theme.backgroundKind==="solid"?<label className={canvasInspectorLabel}>Cor do fundo<input type="color" className={publicColorTw} value={publicPage.theme.color} onChange={e=>void savePublicPage({theme:{...publicPage.theme,color:e.target.value}})}/></label>:null}{publicPage.theme.backgroundKind==="gradient"?<div className={publicThemeRowTw}><label className={canvasInspectorLabel}>De<input type="color" className={publicColorTw} value={publicPage.theme.color2} onChange={e=>void savePublicPage({theme:{...publicPage.theme,color2:e.target.value}})}/></label><label className={canvasInspectorLabel}>Para<input type="color" className={publicColorTw} value={publicPage.theme.color} onChange={e=>void savePublicPage({theme:{...publicPage.theme,color:e.target.value}})}/></label></div>:null}{publicPage.theme.backgroundKind==="image"?<label className={canvasInspectorLabel}>Link da imagem (HTTPS)<input value={publicPage.theme.imageUrl} placeholder="https://…" onChange={e=>void savePublicPage({theme:{...publicPage.theme,imageUrl:e.target.value},enabled:publicPage.enabled})}/></label>:null}</fieldset>{publicPage.token ? <div className={publicWidgetTw}><small className={publicSectionLabelTw}>Widget no site — bolinha de chat no canto inferior direito</small><code className={publicWidgetCodeTw}>{widgetSnippet}</code><button type="button" className={secondaryTw} onClick={() => { if (widgetSnippet) { void navigator.clipboard?.writeText(widgetSnippet); setPublicPageNotice("Snippet do widget copiado."); } }}><Copy size={13} aria-hidden="true"/> Copiar snippet</button></div> : null}<small>A página usa o logo e o nome da empresa que estão em Configurações › Identidade visual. Quem acessa não precisa de conta nem vê o painel da Véxora.</small></>}</section><small>Selecione os canais que receberão o fluxo e escolha como ele começa. Salvar não publica nem ativa o atendimento.</small></>:studioPanel==="settings"?<section className={inspectorCardTw}><h2>Editar etapa</h2>{current?<><label className={canvasInspectorLabel}>Nome da etapa <span className={canvasFieldTipIcon} data-tip="Este nome aparece só no editor. Use algo que explique a etapa para você; o cliente não o recebe."><HelpCircle size={13}/></span><input maxLength={120} value={current.title} onChange={e=>updateStep({title:e.target.value})} placeholder="Ex.: Perguntar o nome preferido"/></label><button type="button" className={secondaryTw} aria-expanded={advancedProperties} onClick={()=>setAdvancedProperties(value=>!value)}>{advancedProperties?"Ocultar ajustes específicos":"Ajustes específicos"}</button><section className={canvasGroup}><header className={canvasGroupHeader}><span className={canvasGroupIcon}><Type size={15}/></span><div><strong className={canvasGroupTitle}>Esta etapa</strong><small className={canvasGroupSub}>O que acontece neste ponto do atendimento</small></div></header><div className="grid gap-2 rounded-token border border-line bg-surface p-3"><strong className="text-body font-bold text-ink">O que esta etapa faz</strong><p className={canvasFieldHelp}>{explainStep(current).what}</p><p className={canvasFieldHelp}><strong>Configure:</strong> {explainStep(current).configure}</p><p className={canvasFieldHelp}><strong>O cliente vê:</strong> {explainStep(current).sees}</p>{stepIoCard(current)}<label className={canvasInspectorLabel}>O que esta etapa deve fazer<select value={current.kind||current.action||"text"} onChange={e=>changeGuidedKind(e.target.value)}>{guidedKindOptions.some(([kind])=>kind===(current.kind||current.action))?null:<option value={current.kind||current.action||"text"}>{current.title||"Etapa especial"}</option>}{guidedKindOptions.map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></label></div>{current.kind==="api"||current.kind==="webhook"||current.kind==="finish"?<small>Este elemento está disponível para modelagem do fluxo. Sua execução automática requer implementação e validação no motor do chatbot.</small>:null}{(advancedProperties||current.action||current.kind?.startsWith("asaas.")||current.kind==="human.handoff"||current.kind==="crm.stage.move")?<label className={canvasInspectorLabel}>Ação financeira / transferência<select value={current.action||""} onChange={e=>updateStep({action:e.target.value as Step["action"]||undefined,kind:undefined})}><option value="">Mensagem / escolha</option><option value="asaas.customer.lookup">Asaas · localizar cliente (requer autorização)</option><option value="asaas.payment.lookup">Asaas · consultar cobranças</option><option value="asaas.payment.pix">Asaas · disponibilizar PIX</option><option value="asaas.payment.boleto">Asaas · disponibilizar boleto</option><option value="human.handoff">Transferir para atendente</option><option value="crm.stage.move">CRM · mover contato para etapa</option><option value="crm.finalize">CRM · registrar ganho ou perda</option></select></label>:null}{current.action==="crm.finalize"&&<fieldset className="mt-5"><legend>Resultado comercial</legend><label className={canvasInspectorLabel}>Resultado<select value={stepConfig(current).outcome||""} onChange={e=>changeDestination({outcome:e.target.value,reason:e.target.value==="LOST"?(stepConfig(current).reason||"Sem retorno"):undefined})}><option value="">Selecione</option><option value="WON">Ganho</option><option value="LOST">Perda</option></select></label>{stepConfig(current).outcome==="LOST"&&<label className={canvasInspectorLabel}>Motivo da perda<select value={stepConfig(current).reason||""} onChange={e=>changeDestination({reason:e.target.value})}><option value="">Selecione um motivo</option>{["Preço/Condição","Sem interesse","Sem retorno","Concorrência","Inatividade"].map(reason=><option key={reason}>{reason}</option>)}</select></label>}<small>Registra o resultado comercial e conclui as conversas abertas deste contato. Use apenas após confirmação do cliente.</small></fieldset>}{current.action==="crm.stage.move"&&<fieldset className="mt-5"><legend>Automação do pipeline</legend><label className={canvasInspectorLabel}>Pipeline<select value={stepConfig(current).pipelineId||""} onChange={e=>changeDestination({pipelineId:e.target.value,stage:"new"})}><option value="">Selecione um pipeline</option>{crmPipelines.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className={canvasInspectorLabel}>Etapa<select value={stepConfig(current).stage||"new"} onChange={e=>changeDestination({stage:e.target.value})} disabled={!stepConfig(current).pipelineId}>{(crmPipelines.find(p=>p.id===stepConfig(current).pipelineId)?.stages||[]).map(stage=><option key={stage.id} value={stage.id}>{stage.label||stage.id}</option>)}</select></label><small>Conecte uma opção escolhida pelo cliente a este bloco. Ao executar, o contato muda de etapa e o CRM aberto recebe a atualização ao vivo.</small></fieldset>}{current.action?.startsWith("asaas.")?<small>Consultar cobranças inicia o diálogo seguro do Asaas no WhatsApp, incluindo seleção de cobrança, boleto e PIX. Canais sociais exigem verificação humana. Blocos financeiros individuais ainda não executáveis bloqueiam a publicação.</small>:null}{["human.handoff","assignment","department.route"].includes(current.action||current.kind||"")&&<fieldset className="mt-5"><legend>{current.kind==="department.route"?"Abrir atendimento do departamento":"Destino do atendimento humano"}</legend>{current.kind!=="department.route"&&<label className={canvasInspectorLabel}>Transferir para<select value={stepConfig(current).targetMode||(stepConfig(current).userId?"PERSON":stepConfig(current).departmentKey?"DEPARTMENT":"PLATFORM")} onChange={e=>changeDestination({targetMode:e.target.value,departmentKey:undefined,userId:undefined})}><option value="QUEUE">Fila geral · sem responsável</option><option value="DEPARTMENT">Time específico</option><option value="PERSON">Atendente específico</option><option value="PLATFORM">Automático por setor e plataforma</option></select></label>}{!["QUEUE","PLATFORM"].includes(stepConfig(current).targetMode||(stepConfig(current).userId?"PERSON":stepConfig(current).departmentKey?"DEPARTMENT":"PLATFORM"))&&<label className={canvasInspectorLabel}>Time<select value={stepConfig(current).departmentKey||""} onChange={e=>changeDestination({departmentKey:e.target.value,userId:undefined})}><option value="">Selecione o time</option>{destinations.departments.filter(d=>!stepConfig(current).departmentCategory||d.routingCategory===stepConfig(current).departmentCategory).map(d=><option key={d.id} value={d.key}>{d.name}</option>)}</select></label>}{(stepConfig(current).targetMode==="PERSON"||stepConfig(current).userId)&&<label className={canvasInspectorLabel}>Atendente<select value={stepConfig(current).userId||""} onChange={e=>changeDestination({userId:e.target.value})}><option value="">Selecione o atendente</option>{destinations.agents.filter(a=>!stepConfig(current).departmentKey||destinations.departments.find(d=>d.key===stepConfig(current).departmentKey)?.members.includes(a.id)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}<p role="status"><strong>Destino:</strong> {destinationSummary(current)}</p><small>A publicação valida se o time está ativo e se o atendente ainda pertence à empresa e ao time selecionado.</small></fieldset>}</section><section className={canvasGroup}><header className={canvasGroupHeader}><span className={canvasGroupIcon}><MessageSquare size={15}/></span><div><strong className={canvasGroupTitle}>Conteúdo</strong><small className={canvasGroupSub}>O que o cliente recebe e quando responde</small></div></header>{current.kind!=="finish"&&current.kind!=="condition"&&current.kind!=="variable"?<label className={canvasInspectorLabel}>Mensagem ao cliente <small>Use a barra para formatar o texto. Variáveis são substituídas no atendimento.</small><div className={canvasRichToolbar} role="toolbar" aria-label="Formatação da mensagem"><button type="button" onClick={()=>insertMessageMarkup("*")} title="Negrito"><strong>B</strong></button><button type="button" onClick={()=>insertMessageMarkup("_")} title="Itálico"><em>I</em></button><button type="button" onClick={()=>insertMessageMarkup("<u>","</u>")} title="Sublinhado"><u>U</u></button><button type="button" onClick={()=>insertMessageMarkup("{{nome}}","")} title="Inserir Nome do cliente">nome</button><button type="button" onClick={()=>insertMessageMarkup("{{novo_nome}}","")} title="Inserir Como o cliente prefere ser chamado">novo_nome</button><button type="button" onClick={()=>insertMessageMarkup("{{atendente}}","")} title="Inserir Atendente">atendente</button><button type="button" onClick={()=>insertMessageMarkup("{{departamento}}","")} title="Inserir Departamento">departamento</button><button type="button" onClick={()=>insertMessageMarkup("{{empresa}}","")} title="Inserir Empresa">empresa</button><button type="button" onClick={()=>insertMessageMarkup("{{endereco_completo}}","")} title="Inserir Endereço completo">endereco_completo</button><button type="button" onClick={()=>insertMessageMarkup("{{telefone}}","")} title="Inserir Telefone">telefone</button><button type="button" onClick={()=>insertMessageMarkup("{{email}}","")} title="Inserir E-mail">email</button><button type="button" onClick={()=>insertMessageMarkup("{{protocolo}}","")} title="Inserir Protocolo do atendimento">protocolo</button><button type="button" onClick={()=>insertMessageMarkup("{{saudacao}}","")} title="Inserir Saudação">saudacao</button><button type="button" onClick={()=>insertMessageMarkup("{{despedida}}","")} title="Inserir Despedida">despedida</button><button type="button" onClick={()=>add("image","Imagem")} title="Adicionar bloco de imagem">Imagem</button></div><textarea ref={messageRef} rows={7} maxLength={4000} value={current.message} onChange={e=>updateStep({message:e.target.value})} placeholder="Escreva a mensagem para o cliente..."/></label>:null}{current.kind==="agent"&&<label className={canvasInspectorLabel}>Agente de IA<select value={stepConfig(current).agentId||""} onChange={e=>changeDestination({agentId:e.target.value})}><option value="">Selecione um agente ativo</option>{aiAgents.filter(a=>a.enabled).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}{current.kind==="catalog.item"&&<label className={canvasInspectorLabel}>Item do catálogo<select data-testid="chatbot-catalog-item" value={stepConfig(current).itemId||""} onChange={e=>changeDestination({itemId:e.target.value})} disabled={catalogItemsLoading}><option value="">{catalogItemsLoading?"Carregando catálogo…":"Selecione um item ativo"}</option>{catalogItems.map(item=><option key={item.id} value={item.id}>{item.name}{item.sku?` · ${item.sku}`:""}</option>)}</select><small>{catalogItemsError||"Nome, tipo, SKU, preço e descrição vêm do cadastro; o bot não inventa condições."}</small></label>}{current.kind==="catalog.list"&&<small className={canvasFieldHelp} data-testid="chatbot-catalog-list-help">Envia o link do catálogo completo da vitrine configurada, com o aviso honesto de que a vitrine não confirma pagamento, pedido ou conexão com provedor. Não é necessário escolher item; configure a URL HTTPS da vitrine no Catálogo. Este bloco não publica nada.</small>}{["input.text","input.cpf","variable","condition"].includes(current.kind||"")&&<label className={canvasInspectorLabel}>Nome da variável<input list={"vx-vars-"+current.id} value={stepConfig(current).variable||""} placeholder="novo_nome" onChange={e=>changeDestination({variable:e.target.value})}/><datalist id={"vx-vars-"+current.id}>{[...textVariables].map(([key,label])=><option key={key} value={key}>{label}</option>)}</datalist><small>Escolha uma existente ou digite um nome novo para criar.</small></label>}{["variable","condition"].includes(current.kind||"")&&<label className={canvasInspectorLabel}>{current.kind==="condition"?"Comparar com":"Valor"}<input value={stepConfig(current).value||""} onChange={e=>changeDestination({value:e.target.value})}/></label>}{current.kind==="payment.status"&&<><label className={canvasInspectorLabel}>Provedor<select value={stepConfig(current).provider||""} onChange={e=>changeDestination({provider:e.target.value})}><option value="">Escolha um provedor</option><option value="STRIPE">Stripe</option><option value="INFINITEPAY">InfinitePay</option></select></label>{stepConfig(current).provider?<label className="flex items-center gap-2 text-flow-help text-ink"><input type="checkbox" checked={stepConfig(current).createHostedLink==="true"} onChange={e=>changeDestination({createHostedLink:e.target.checked?"true":undefined})}/>Gerar link se a cobrança ainda não tiver checkout</label>:null}<p className="text-flow-help text-ink-secondary">O status fica em pagamento_status. Se houver um link de uma cobrança pendente, use <code>{"{{pagamento_link}}"}</code> em uma mensagem.</p></>}{(current.kind==="calendar.availability"||current.kind==="calendar.book")&&<>{current.kind==="calendar.book"&&<label className={canvasInspectorLabel}>Título do agendamento<input value={stepConfig(current).title||""} maxLength={180} onChange={e=>changeDestination({title:e.target.value})}/></label>}<label className={canvasInspectorLabel}>Início do horário<input value={stepConfig(current).start||""} maxLength={120} placeholder="{{horario}}" onChange={e=>changeDestination({start:e.target.value})}/></label><label className={canvasInspectorLabel}>Duração em minutos<input type="number" min={1} max={1440} value={stepConfig(current).minutes||""} onChange={e=>changeDestination({minutes:e.target.value})}/></label><p className="text-flow-help text-ink-secondary">Use uma data com fuso horário, como 2026-12-01T14:00:00-04:00. {current.kind==="calendar.book"?"Use Resultado do agendamento em um bloco Se para confirmar a reserva. A simulação não cria eventos.":"Use Horário disponível em um bloco Se."}</p></>}{current.kind==="task.reminder"&&<><label className={canvasInspectorLabel}>Título do lembrete<input value={stepConfig(current).title||""} maxLength={180} onChange={e=>changeDestination({title:e.target.value})}/></label><label className={canvasInspectorLabel}>Prazo em minutos<input type="number" min={1} max={43200} value={stepConfig(current).minutes||""} onChange={e=>changeDestination({minutes:e.target.value})}/></label><label className={canvasInspectorLabel}>Responsável<select value={stepConfig(current).reminderUserId||""} onChange={e=>changeDestination({reminderUserId:e.target.value})}><option value="">Atendente da conversa</option>{destinations.agents.map(agent=><option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label></>}{current.kind==="tag"&&<><label className={canvasInspectorLabel}>Nome da tag<input value={stepConfig(current).name||""} maxLength={40} onChange={e=>changeDestination({name:e.target.value})}/></label><label className={canvasInspectorLabel}>Cor<input type="color" value={stepConfig(current).color||"#6258df"} onChange={e=>changeDestination({color:e.target.value})}/></label></>}</section><section className={canvasGroup}><header className={canvasGroupHeader}><span className={canvasGroupIcon}><Share2 size={15}/></span><div><strong className={canvasGroupTitle}>Conexões de saída</strong><small className={canvasGroupSub}>Opções e para onde cada uma leva</small></div></header><label className={canvasInspectorLabel}>Opções de saída <small>Uma por linha. Cada opção pode apontar para outra etapa.</small><textarea rows={5} value={current.options.join("\n")} onChange={e=>updateStep({options:optionText(e.target.value)})} onBlur={()=>updateStep(commitOptions(current.options,current.transitions))}/></label><div className={inspectorTransitionTw}><strong>Para onde vai cada opção?</strong><small>Defina para qual etapa cada escolha leva. Sem destino, a simulação encerra a ramificação.</small>{current.options.map((option,i)=><label key={i}>{option}<select aria-label={`Destino de ${option}`} value={targetFor(current,option)} onChange={e=>updateStep({transitions:{...current.transitions,[option]:e.target.value}})}><option value="">Sem conexão</option><option value="__start__">Voltar ao início</option>{flow.steps.filter(x=>x.id!==current.id).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>)}</div></section><button type="button" className={secondaryTw + " chatbot-delete-block"} onClick={()=>{if(!window.confirm("Excluir esta etapa e suas conexões?"))return;setFlow(f=>({...f,steps:f.steps.filter(x=>x.id!==selected).map(x=>({...x,transitions:Object.fromEntries(Object.entries(x.transitions||{}).filter(([,target])=>target!==selected))}))}));setSelected(flow.steps.find(x=>x.id!==selected)?.id||"")}}><Trash2 size={15}/> Excluir etapa</button></>:<p>Selecione ou crie uma opção para editar.</p>}</section>: <section className={inspectorSimulatorCardTw}><div className={inspectorSimulatorHeadingTw}><div className="min-w-0"><h2>Teste do fluxo</h2><label className={canvasInspectorLabel}>Simular como<select value={simulationChannel} onChange={event=>setSimulationChannel(event.target.value==="whatsapp"?"whatsapp":"web")}><option value="web">Chatbot web</option><option value="whatsapp">WhatsApp · opções numeradas</option></select></label></div><button type="button" className={secondaryTw} disabled={keywordOnly&&!preview.length} onClick={()=>setSimulatorFullScreen(true)}>Abrir no celular</button></div>{keywordOnly?<div className="grid gap-2"><label className={canvasInspectorLabel}>Mensagem que ativa o teste<input maxLength={4000} value={simulationTriggerText} onChange={event=>setSimulationTriggerText(event.target.value)}/></label><button type="button" className={secondaryTw} disabled={simulationTriggerBusy||!simulationTriggerText.trim()} onClick={()=>void testKeywordTrigger()}>{simulationTriggerBusy?"Testando…":"Testar gatilho"}</button>{simulationTriggerFeedback?<p role="status" className="text-flow-help text-ink-secondary">{simulationTriggerFeedback}</p>:null}</div>:null}{simulatedIntegrations.some(([kind])=>flow.steps.some(step=>step.kind===kind))?<details className="rounded-token-sm border border-line bg-surface px-3 py-2">
 <summary className="cursor-pointer font-semibold">Simular resultados das integrações</summary>
 <div className="mt-2 grid gap-2">
  <p className={canvasFieldHelp}>Escolha os resultados e reinicie o teste para aplicá-los.</p>
  {simulatedIntegrations.filter(([kind])=>flow.steps.some(step=>step.kind===kind)).map(([,key])=><label key={key} className={canvasInspectorLabel}>{integrationResults[key].label}
   <select value={simulationResults[key]||"indisponível"} onChange={event=>{const value=event.target.value;setSimulationResults(previous=>({...previous,[key]:value}));}}>
    {integrationResults[key].values.map(([value,label])=><option key={value} value={value}>{label}</option>)}
   </select>
  </label>)}
 </div>
 </details>:null}<PhoneSimulator channel={simulationChannel} botName={flow.name||"Véxora"} welcome={keywordOnly&&!preview.length?"":preview[0]??resolveSimulationText(flow.welcome)} preview={preview} onReply={simulationStep?replySimulation:undefined} chips={simulationStep?flow.steps.filter(s=>s.id===simulationStep&&s.kind!=="input.text"&&s.kind!=="input.cpf").flatMap(s=>s.options.map(option=>({label:resolveSimulationText(option,simulationVariables),onChoose:()=>chooseSimulation(s,option,true)}))):null}/><button type="button" className={secondaryTw} onClick={openSimulation}><Play size={15}/> Reiniciar teste</button><small>Teste local: nada é enviado para clientes reais.</small>{simulatorFullScreen?createPortal(<div className={inspectorSimulatorOverlayTw} role="dialog" aria-modal="true" aria-label="Simulação do chatbot" onMouseDown={e=>{if(e.target===e.currentTarget)setSimulatorFullScreen(false)}}><PhoneSimulator channel={simulationChannel} botName={flow.name||"Véxora"} welcome={preview[0]??resolveSimulationText(flow.welcome)} preview={preview} onReply={simulationStep?replySimulation:undefined} chips={simulationStep?flow.steps.filter(s=>s.id===simulationStep&&s.kind!=="input.text"&&s.kind!=="input.cpf").flatMap(s=>s.options.map(option=>({label:resolveSimulationText(option,simulationVariables),onChoose:()=>chooseSimulation(s,option,true)}))):null} onClose={()=>setSimulatorFullScreen(false)} fullscreen/></div>, document.body):null}</section>}</div></aside></div>
 <InstagramCampaigns key={tenantId}/>
 <details onToggle={event=>setExecutionHistoryOpen(event.currentTarget.open)} className="rounded-xl border border-gray-200 bg-white p-3 text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50">
  <summary className="cursor-pointer font-bold">Execuções reais</summary>
  <div className="mt-3 grid gap-3">
   <button type="button" className={secondaryTw} onClick={()=>void loadRuntime()} disabled={runtimeLoading}>Atualizar agora</button>
   {executionRefreshError?<p role="status" className="text-flow-help text-ink-secondary">Não foi possível atualizar o histórico. Tentando novamente…</p>:null}
   {runtimeState.executions?.length?<ul className="grid gap-2">{runtimeState.executions.map(execution=><li key={execution.id} className="rounded-token-sm border border-line p-2">
    <time dateTime={execution.createdAt} className="text-flow-help text-ink-secondary">{new Date(execution.createdAt).toLocaleString("pt-BR")}</time>
    {execution.details.visitedEdges&&execution.details.visitedSteps?.length?<button type="button" className={canvasNodeQuickButton} aria-pressed={!followedConversation&&selectedExecutionId===execution.id} onClick={()=>{setFollowedConversation(null);setSelectedExecutionId(previous=>!followedConversation&&previous===execution.id?null:execution.id)}}>Ver no canvas</button>:null}
    {execution.details.conversationId&&execution.details.visitedEdges&&execution.details.visitedSteps?.length&&runtimeState.executions?.find(item=>item.details.conversationId===execution.details.conversationId&&item.details.visitedEdges&&item.details.visitedSteps?.length)?.id===execution.id?<button type="button" className={canvasNodeQuickButton} aria-pressed={followedConversation===execution.details.conversationId} onClick={()=>{const conversationId=execution.details.conversationId!;setSelectedExecutionId(null);setFollowedConversation(previous=>previous===conversationId?null:conversationId)}}>{followedConversation===execution.details.conversationId?"Parar de acompanhar":"Acompanhar conversa"}</button>:null}
    {selectedExecution?.id===execution.id&&!canHighlightExecution?<p className="text-flow-help text-ink-secondary">O canvas precisa mostrar a mesma publicação desta execução.</p>:null}
    {execution.details.visitedSteps?.length?<ol className="mt-1 list-decimal space-y-1 pl-5">{execution.details.visitedSteps.map((step,index)=><li key={index}>{step.title}{index===execution.details.visitedSteps!.length-1&&execution.details.waitingStepId===step.id?<span className="ml-2 text-flow-help text-ink-secondary">Aguardando resposta</span>:null}</li>)}</ol>:<p className="text-flow-help text-ink-secondary">Sem percurso registrado.</p>}
   </li>)}</ul>:<p className="text-flow-help text-ink-secondary">Nenhuma execução disponível.</p>}
  </div>
 </details>
 {aiCreateOpen?<div className={aiDialogBackdropTw} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!aiCreateBusy)setAiCreateOpen(false)}}><section className={aiDialogTw} role="dialog" aria-modal="true" aria-labelledby="chatbot-ai-title"><header className={aiDialogHeadingTw}><span className={aiDialogIconTw}><Sparkles size={20} aria-hidden="true"/></span><div className="min-w-0"><h2 id="chatbot-ai-title" className="truncate text-h3 font-extrabold">Assistente de fluxo</h2><p className="m-0 text-small text-ink-secondary">Escreva em linguagem natural. O Arquiteto de Fluxo executa o comando no rascunho.</p></div><button type="button" className={aiDialogCloseTw} aria-label="Fechar" disabled={aiCreateBusy} onClick={()=>setAiCreateOpen(false)}><X size={18} aria-hidden="true"/></button></header><div className={aiDialogBodyTw}><p className={canvasFieldHelp}>Ex.: “No bloco Menu principal, acrescente a opção 2ª Via Boleto (Rastreabem)”. Para criar do zero, diga “crie um fluxo para …”.</p><div className={aiExamplesTw} aria-label="Exemplos de comando"><button type="button" className={aiExampleTw} disabled={aiCreateBusy} onClick={()=>{setAiRequest("Crie um fluxo com nome preferido, Suporte e Administrativo");setAiProposal(null)}}>Nome preferido</button><button type="button" className={aiExampleTw} disabled={aiCreateBusy} onClick={()=>{setAiRequest("Crie um fluxo que pergunta o CPF e encaminha para o Administrativo");setAiProposal(null)}}>CPF e Administrativo</button><button type="button" className={aiExampleTw} disabled={aiCreateBusy} onClick={()=>{setAiRequest("No bloco Menu principal, acrescente a opção Falar com atendente");setAiProposal(null)}}>Ajustar uma etapa</button></div><div className={aiRequestTw}><div className={aiRequestHeadTw}><label htmlFor="chatbot-ai-request-input" className="font-display text-h6 font-bold text-ink">O que você quer automatizar?</label><button type="button" className={aiDictateTw} onClick={dictateAiRequest} disabled={aiCreateBusy} aria-pressed={aiDictating} title="Ditar o pedido com o microfone"><Mic size={14} aria-hidden="true"/>{aiDictating?"Parar ditado":"Ditar"}</button></div><textarea id="chatbot-ai-request-input" className={aiTextareaTw} rows={5} maxLength={2000} autoFocus value={aiRequest} disabled={aiCreateBusy} onChange={e=>{setAiRequest(e.target.value);setAiProposal(null)}} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();if(!aiCreateBusy&&aiRequest.trim())void createFlowWithAi()}}} placeholder="Ex.: No bloco Menu principal, acrescente a opção 2ª Via Boleto (Rastreabem). (Ctrl+Enter cria)"/>{aiDictateStatus?<p className={aiDictateStatusTw} role="status">{aiDictateStatus}</p>:null}</div>{aiCreateError?<p role="alert" className={aiErrorTw}>{aiCreateError}</p>:null}{aiProposal?<div className="grid gap-2" aria-live="polite"><strong>Proposta · {aiProposal.draft.name}</strong><ol className="grid list-decimal gap-1 pl-5">{aiProposal.draft.steps.map(step=><li key={step.id}>{step.title}{step.message?" · "+step.message:""}</li>)}</ol>{aiProposal.warnings.map(warning=><p key={warning}>{warning}</p>)}</div>:null}</div><footer className={aiDialogFooterTw}><button type="button" className={secondaryTw} disabled={aiCreateBusy} onClick={()=>setAiCreateOpen(false)}>Cancelar</button><button type="button" className={primaryTw} disabled={aiCreateBusy||!aiRequest.trim()} onClick={()=>void createFlowWithAi()}>{aiCreateBusy?"Executando…":"Gerar proposta"}</button>{aiProposal?<button type="button" className={primaryTw} disabled={aiCreateBusy} onClick={applyAiProposal}>Aplicar ao canvas</button>:null}</footer></section></div>:null}<section data-business-flow-library className={flowLibraryTw}><header className={flowLibraryHeadingTw}><div><h2>Fluxos salvos</h2><p>Escolha um fluxo para editar, usar no editor ou excluir.</p></div><button type="button" className={secondaryTw} onClick={()=>void refreshLibrary()}>Atualizar</button></header>{Object.keys(businessFlows).length?<div className={flowLibraryGridTw}>{Object.entries(businessFlows).map(([id,item])=><article className={flowLibraryCardTw} key={id}><div><strong>{item.draft.name||"Fluxo sem nome"}</strong><small>{item.draft.steps.length} bloco(s) · rascunho salvo nesta empresa</small></div><div className={flowLibraryActionsTw}><button type="button" className={primaryTw} onClick={()=>loadLibrary(id)}>Editar no editor</button><button type="button" className={secondaryTw} onClick={()=>loadLibrary(id)}>Usar este fluxo</button><button type="button" className={dangerTextTw} onClick={()=>void deleteLibrary(id)}>Excluir</button></div></article>)}</div>:<div className={flowLibraryEmptyTw}><strong>Nenhum fluxo salvo</strong><span>Monte o fluxo no canvas e guarde uma cópia quando quiser reutilizá-lo.</span></div>}<button type="button" className={secondaryTw} onClick={()=>void storeLibrary()}>Guardar cópia do fluxo atual</button></section><details className={flowScopeTw} open><summary>Onde este fluxo será executado</summary><label>Departamento<select aria-label="Departamento de execução" value={scopeDepartment} onChange={e=>{setScopeDepartment(e.target.value);setScopeUser("");}}><option value="">Entrada geral da empresa</option>{destinations.departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Atendente<select aria-label="Atendente de execução" value={scopeUser} onChange={e=>setScopeUser(e.target.value)}><option value="">Padrão do departamento / entrada</option>{destinations.agents.filter(a=>!scopeDepartment||destinations.departments.find(d=>d.id===scopeDepartment)?.members.includes(a.id)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><p>{scopeUser?"Configuração direta deste atendente neste contexto.":scopeDepartment?"Configuração herdada pelos atendentes deste departamento.":"Fluxo de entrada para conversas sem publicação específica."} Publicar e pausar afetam somente o destino selecionado. O atendimento precisa estar em modo automático para executar.</p></details>{guideOpen?<div className={aiDialogBackdropTw} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setGuideOpen(false)}}><section className={aiDialogTw} role="dialog" aria-modal="true" aria-labelledby="chatbot-guide-title"><header className={aiDialogHeadingTw}><span className={aiDialogIconTw}><BookOpen size={20} aria-hidden="true"/></span><div className="min-w-0"><h2 id="chatbot-guide-title" className="truncate text-h3 font-extrabold">Entenda os blocos</h2><p className="m-0 text-small text-ink-secondary">Cada bloco é uma etapa do atendimento. Você dá o nome; o editor cuida do formato interno.</p></div><button type="button" className={aiDialogCloseTw} aria-label="Fechar" onClick={()=>setGuideOpen(false)}><X size={18} aria-hidden="true"/></button></header><div className={aiDialogBodyTw}><div className="grid gap-2">{flowGuide.map(item=><article key={item.id} className="grid gap-1 rounded-token border border-line bg-surface-2 p-3"><strong className="text-body font-bold text-ink">{item.label}</strong><p className={canvasFieldHelp}>Quando usar: {item.when}</p><p className={canvasFieldHelp}>O que configurar: {item.configure}</p><p className={canvasFieldHelp}>O que o cliente vê: {item.sees}</p></article>)}</div></div><footer className={aiDialogFooterTw}><button type="button" className={secondaryTw} onClick={loadPreferredNameExample}>Ver exemplo funcional</button><button type="button" className={primaryTw} onClick={()=>setGuideOpen(false)}>Entendi</button></footer></section></div>:null}
 </section>;
}










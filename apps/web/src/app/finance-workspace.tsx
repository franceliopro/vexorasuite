"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "../lib/use-modal-dialog";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  History,
  LayoutDashboard,
  Package,
  Pencil,
  Plus,
  Receipt,
  RefreshCcw,
  Repeat2,
  Sparkles,
  Wallet,
  Workflow,
  X,
  Zap,
} from "lucide-react";

const cardTw="min-w-0 rounded-token border border-line bg-surface p-pad shadow-token";
const primaryButton="inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton="inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const subtleButtonTw="inline-flex min-h-control items-center gap-1.5 rounded-token-sm px-2 font-bold text-blue-700 no-underline transition-colors hover:bg-hover";
const panelHeadingTw="flex flex-wrap items-start justify-between gap-3.5";
const fieldTw="grid gap-1.5 text-asaas-label font-bold uppercase tracking-fin-label text-ink-secondary";
const filterBarTw="flex flex-wrap items-end gap-3";
const filterControlTw="min-h-control-h min-w-0 rounded-fin-chip border border-line bg-surface-2 px-2.5 text-small font-semibold text-ink";
const moduleTw="grid min-w-0 gap-token self-start";
const pageHeadingTw="flex flex-wrap items-start justify-between gap-4";
const pageSubtitleTw="m-0 text-body text-ink-secondary";
const tabsTw="flex max-w-full gap-1 overflow-x-auto rounded-fin-pill border border-line bg-surface-2 p-1";
const tabTw="inline-flex min-h-8 shrink-0 items-center gap-2 rounded-fin-pill px-3.5 text-small font-bold text-ink-secondary transition-colors hover:text-ink";
const tabActiveTw="inline-flex min-h-8 shrink-0 items-center gap-2 rounded-fin-pill bg-blue-600 px-3.5 text-small font-bold text-blue-900 shadow-token-sm";
const portfolioCardTw="grid min-w-0 gap-3 self-start rounded-token border border-line bg-surface p-pad shadow-token";
const catalogCardTw="grid min-w-0 gap-3 self-start rounded-token border border-line bg-surface p-pad shadow-token";
const productGridTw="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
const productCardTw="grid min-w-0 gap-0 self-start overflow-hidden rounded-token border border-line bg-surface-2 shadow-token-sm transition-transform hover:-translate-y-0.5 hover:shadow-token";
const productImageFrameTw="grid aspect-square place-items-center overflow-hidden rounded-fin-card bg-surface-3";
const productImageTw="size-full object-cover";
const productPlaceholderTw="grid size-full place-items-center gap-2 text-small text-ink-secondary";
const productBodyTw="grid gap-2 p-pad";
const productBadgeTw="inline-flex w-fit items-center rounded-fin-chip bg-blue-50 px-2 text-2xs font-bold text-blue-700";
const productMetaTw="inline-flex w-fit items-center rounded-fin-chip bg-surface-3 px-2 text-2xs font-bold text-ink-secondary";
const productPriceTw="text-fin-metric font-extrabold tabular-nums text-ink";
const listingCardTw="grid min-w-0 gap-3 self-start rounded-token border border-line bg-surface p-pad shadow-token";
const actionRowTw="flex flex-wrap gap-2.5";
const metaTw="m-0 text-asaas-muted text-ink-secondary";
const tableScrollTw="w-full overflow-x-auto";
const customerDocTw="block text-asaas-muted text-ink-secondary";
const collectionActionTw="inline-flex min-h-7 items-center rounded-fin-pill border border-blue-600/30 bg-blue-50 px-2.5 text-2xs font-extrabold text-blue-800 no-underline disabled:cursor-not-allowed disabled:opacity-45";
const dangerActionTw="inline-flex min-h-7 items-center gap-1 rounded-fin-pill border border-red-600/30 bg-red-50 px-2.5 text-2xs font-extrabold text-red-600 no-underline transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45";
const dangerButtonTw="inline-flex min-h-control items-center gap-2 rounded-token-sm bg-red-600 px-4 text-body font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60";
const paginationTw="flex justify-end gap-2.5";
const paginationButtonTw="min-h-8 rounded-fin-pill border border-line bg-surface-2 px-3.5 text-small font-bold text-ink-secondary disabled:cursor-not-allowed disabled:opacity-45";
const catalogNoteTw="m-0 text-asaas-muted leading-relaxed text-ink-secondary";
const noScrollbarTw="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const overlayTw="fixed inset-0 z-50 grid place-items-center bg-slate-900/80 p-4 backdrop-blur-sm";
const drawerTw="relative z-10 grid max-h-dvh w-full max-w-fin-window gap-4 self-start overflow-y-auto overscroll-contain rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 "+noScrollbarTw;
const productEditFormTw="grid gap-4 sm:grid-cols-2";
const iconButtonTw="grid size-control place-items-center rounded-fin-icon border border-line bg-surface-2 text-ink transition-colors hover:bg-hover";
const drawerLabelTw="grid gap-1.5 text-asaas-label font-bold uppercase tracking-fin-label text-ink-secondary";
const drawerControlTw="min-h-control-h min-w-0 rounded-fin-row border border-line bg-surface-2 px-2.5 text-body text-ink";
const drawerTextareaTw="min-h-fin-textarea w-full resize-y whitespace-pre-wrap rounded-fin-row border border-line bg-surface-2 px-3 py-2.5 text-body leading-relaxed text-ink";
const drawerButtonTw="min-h-control-h justify-self-start rounded-fin-chip border border-blue-600 bg-blue-600 px-4 text-body font-extrabold text-blue-900 transition-colors hover:brightness-105";
const drawerLinkTw="text-small font-bold text-blue-700";
const drawerSmallTw="block border-t border-line pt-2.5 text-asaas-muted leading-relaxed text-ink-secondary";
const headingActionsTw="flex flex-none items-center gap-2";
const toolbarTw="flex flex-wrap items-center gap-3";
const searchTw="flex min-h-control-h items-center gap-2 rounded-fin-chip border border-line bg-surface-2 px-3 text-small";
const searchInputTw="min-w-fin-lookup border-0 bg-transparent text-body text-ink outline-hidden";
const mutedTw="text-ink-secondary";
const statusPositiveTw="inline-flex rounded-fin-pill bg-emerald-100 px-2 py-0.5 text-2xs font-extrabold uppercase tracking-fin-label text-emerald-600";
const statusNegativeTw="inline-flex rounded-fin-pill bg-red-100 px-2 py-0.5 text-2xs font-extrabold uppercase tracking-fin-label text-red-600";
const statusNeutralTw="inline-flex rounded-fin-pill bg-surface-3 px-2 py-0.5 text-2xs font-extrabold uppercase tracking-fin-label text-ink-secondary";
const linkTw="font-bold text-blue-700 no-underline";
const emptyTw="m-0 text-body text-ink-secondary";
const footerTw="flex flex-wrap items-center justify-between gap-3.5 text-asaas-muted text-ink-secondary";
const noticeTw="flex items-center gap-2.5 rounded-fin-chip border border-emerald-600 bg-emerald-100 px-3 py-2.5 text-body font-semibold text-ink";
const executiveTw="grid gap-3.5 self-start";
const heroTw="relative grid grid-cols-fin-hero gap-fin-hero-gap overflow-hidden rounded-fin-hero bg-linear-to-br from-blue-50 via-surface to-surface px-fin-hero-x py-fin-hero-y text-ink shadow-token-lg";
const heroCopyTw="relative z-10 min-w-0";
const heroEyebrowTw="inline-flex items-center gap-2 text-2xs font-extrabold uppercase tracking-fin-eyebrow text-blue-700";
const heroTitleTw="m-3 mb-2 max-w-fin-hero-title-w text-fin-hero-title font-extrabold text-ink";
const heroCopyTextTw="m-0 max-w-fin-hero-copy-w text-body leading-relaxed text-ink-secondary";
const heroChipsTw="mt-4 flex flex-wrap gap-2";
const heroChipTw="inline-flex min-h-fin-chip-h items-center gap-2 rounded-fin-pill border border-blue-600/25 bg-surface/80 px-3 text-2xs font-bold text-ink backdrop-blur-sm transition-transform hover:-translate-y-px";
const heroChipStaticTw="inline-flex min-h-fin-chip-h cursor-default items-center gap-2 rounded-fin-pill border border-blue-600/25 bg-surface/80 px-3 text-2xs font-bold text-ink backdrop-blur-sm";
const heroFigureTw="relative z-10 grid content-center gap-2 rounded-fin-figure border border-blue-600/20 bg-surface/80 p-4 shadow-token-sm";
const heroFigureLabelTw="text-2xs font-extrabold uppercase tracking-fin-wide text-ink-secondary";
const heroFigureValueTw="text-fin-hero-value font-extrabold tabular-nums text-ink";
const heroBarTw="mt-1 flex h-3 overflow-hidden rounded-fin-pill bg-blue-50";
const segPaidTw="block h-full bg-emerald-600";
const segOpenTw="block h-full bg-amber-600";
const segOverdueTw="block h-full bg-red-600";
const heroLegendTw="flex flex-wrap gap-3.5 text-2xs font-semibold text-ink-secondary";
const dotPaidTw="inline-block size-2.5 rounded-fin-pill bg-emerald-600";
const dotOpenTw="inline-block size-2.5 rounded-fin-pill bg-amber-600";
const dotOverdueTw="inline-block size-2.5 rounded-fin-pill bg-red-600";
const periodBarTw="flex flex-wrap items-center gap-3 rounded-fin-figure border border-line bg-surface p-2.5 px-3 shadow-token";
const periodChipsTw="flex flex-wrap gap-1";
const periodChipTw="min-h-8 rounded-fin-chip px-3 text-small font-bold text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink";
const periodChipActiveTw="min-h-8 rounded-fin-chip bg-blue-600 px-3 text-small font-bold text-blue-900 shadow-token-sm";
const periodCustomTw="flex flex-wrap items-center gap-2";
const periodInputTw="min-h-8 rounded-fin-chip border border-line bg-surface-2 px-2.5 text-small text-ink";
const healthNoteTw="flex min-w-0 items-center gap-2.5 rounded-token border border-line bg-surface p-pad text-body text-red-600 shadow-token";
const partialTw="flex items-center gap-2 rounded-fin-row border border-amber-600/30 bg-amber-100 px-3.5 py-2.5 text-small font-semibold text-amber-600";
const metricsTw="grid grid-cols-fin-metrics gap-2.5 ov-laptop:grid-cols-fin-metrics-tablet max-sm:grid-cols-2";
const metricCardBaseTw="relative flex items-center gap-2.5 rounded-fin-figure border border-line bg-surface p-3.5 text-left text-ink shadow-token";
const metricCardTw:Record<string,string>={blue:metricCardBaseTw,green:metricCardBaseTw,amber:metricCardBaseTw,red:metricCardBaseTw,purple:metricCardBaseTw};
const metricInteractiveTw:Record<string,string>={blue:metricCardBaseTw+" w-full transition-transform hover:-translate-y-px",green:metricCardBaseTw+" w-full transition-transform hover:-translate-y-px",amber:metricCardBaseTw+" w-full transition-transform hover:-translate-y-px",red:metricCardBaseTw+" w-full transition-transform hover:-translate-y-px",purple:metricCardBaseTw+" w-full transition-transform hover:-translate-y-px"};
const metricIconTw:Record<string,string>={blue:"grid size-fin-icon flex-none place-items-center rounded-fin-icon bg-blue-50 text-blue-700",green:"grid size-fin-icon flex-none place-items-center rounded-fin-icon bg-emerald-100 text-emerald-600",amber:"grid size-fin-icon flex-none place-items-center rounded-fin-icon bg-amber-100 text-amber-600",red:"grid size-fin-icon flex-none place-items-center rounded-fin-icon bg-red-100 text-red-600",purple:"grid size-fin-icon flex-none place-items-center rounded-fin-icon bg-indigo-100 text-indigo-600"};
const metricBodyTw="grid min-w-0 gap-px";
const metricLabelTw="text-2xs font-extrabold uppercase tracking-fin-wide text-ink-secondary";
const metricValueTw="truncate text-fin-metric font-extrabold tabular-nums text-ink";
const metricHintTw="truncate text-2xs text-ink-secondary";
const metricArrowTw="absolute right-2.5 top-3 text-ink-secondary opacity-70";
const execGridTw="grid grid-cols-fin-grid gap-3";
const panelWideTw="grid min-w-0 content-start gap-0.5 self-start rounded-token border border-line bg-surface p-pad shadow-token col-span-full";
const statusPanelTw="grid min-w-0 content-start gap-0.5 self-start rounded-token border border-line bg-surface p-pad shadow-token";
const billingPanelTw="grid min-w-0 content-start gap-0.5 self-start rounded-token border border-line bg-surface p-pad shadow-token";
const wafflePanelTw="grid min-w-0 content-start gap-0.5 self-start rounded-token border border-line bg-surface p-pad shadow-token";
const intelligencePanelTw="grid min-w-0 content-start gap-0.5 self-start rounded-token border border-line bg-surface p-pad shadow-token";
const emptyPanelTw="rounded-fin-row border border-dashed border-line-strong p-5 text-center text-small text-ink-secondary";
const columnsTw="grid h-fin-columns grid-flow-col items-end content-end gap-4 px-1.5 pb-0.5 pt-3.5";
const columnTw="grid justify-items-center gap-1.5";
const barsTw="flex h-fin-bars items-end gap-1";
const barBilledTw="block w-4 rounded-t-fin-bar bg-blue-600 transition-transform hover:-translate-y-0.5";
const barPaidTw="block w-4 rounded-t-fin-bar bg-emerald-600 transition-transform hover:-translate-y-0.5";
const barOverdueTw="block w-4 rounded-t-fin-bar bg-red-600 transition-transform hover:-translate-y-0.5";
const execLegendTw="mt-2 flex flex-wrap gap-3.5 text-2xs text-ink-secondary";
const donutsTw="mt-1.5 grid grid-cols-fin-donuts gap-2.5 max-sm:grid-cols-1";
const donutCardTw="grid justify-items-center gap-1.5 rounded-fin-row border border-line bg-surface-2 p-3.5 text-center";
const donutTw="grid size-fin-donut place-items-center rounded-fin-pill";
const billingBarsTw="mt-1 grid gap-2";
const billingRowTw="grid grid-cols-fin-billing items-center gap-2.5";
const billingLabelTw="truncate text-small font-bold text-ink-secondary";
const billingTrackTw="h-2.5 overflow-hidden rounded-fin-pill bg-surface-3";
const billingValueTw="grid justify-items-end gap-px";
const waffleTw="grid grid-cols-fin-waffle gap-fin-waffle-gap px-0.5 pt-0.5";
const waffleCellTw="aspect-square rounded-fin-card transition-transform hover:scale-125";
const waffleEmptyTw="aspect-square rounded-fin-card opacity-45 transition-transform hover:scale-125";
const waffleLegendTw="mt-3 grid grid-cols-fin-waffle-legend gap-2";
const waffleLegendDotTw="size-2.5 flex-none rounded-fin-card";
const insightTw="flex items-start gap-2 rounded-fin-row border border-dashed border-amber-600/35 bg-amber-100 px-3 py-2.5 text-small leading-relaxed text-amber-600";
const automationPageTw="grid gap-token self-start";
const automationHeadingTw="flex flex-wrap items-start justify-between gap-4 rounded-token-lg border border-line bg-linear-to-br from-blue-50 to-surface p-5 px-6";
const automationPillTw="inline-flex min-h-7 flex-none items-center rounded-fin-pill border border-amber-600/35 bg-amber-100 px-3 text-2xs font-extrabold uppercase tracking-fin-wide text-amber-600";
const automationGridTw="grid grid-cols-fin-automation items-start gap-token";
const automationCardTw="grid min-w-0 content-start gap-3 self-start rounded-token border border-line bg-surface p-pad shadow-token p-4 px-5";
const autoCheckTw="flex cursor-pointer items-center gap-2.5 rounded-fin-row border border-line bg-surface-2 p-3 text-body font-semibold text-ink transition-colors hover:border-line-strong";
const autoNoteTw="m-0 text-asaas-muted leading-relaxed text-ink-secondary";
const autoStrategyTw="m-0 rounded-fin-row border border-line border-l-4 border-l-blue-600 bg-surface-2 p-3";
const autoWideTw="grid min-w-0 content-start gap-3 self-start rounded-token border border-line bg-surface p-pad shadow-token p-4 px-5 col-span-full";
const templatesHeadingTw="flex items-center justify-between gap-3.5";
const templateCountTw="flex-none rounded-fin-pill bg-blue-50 px-3 py-1.5 text-2xs font-extrabold uppercase tracking-fin-wide text-blue-700";
const templateGridTw="grid grid-cols-fin-templates gap-3";
const templateListTw="grid max-h-fin-template-list content-start gap-1.5 overflow-y-auto";
const templateButtonTw="grid min-w-0 gap-px rounded-fin-row border border-line bg-surface p-2.5 px-3 text-left transition-colors hover:border-line-strong";
const templateActiveTw="grid min-w-0 gap-px rounded-fin-row border border-blue-600/50 bg-blue-50 p-2.5 px-3 text-left shadow-token-sm";
const templateEditorTw="grid min-w-0 content-start gap-2.5";
const previewTw="rounded-fin-preview border border-dashed border-line-strong bg-blue-50/60 p-3.5";
const historyPageTw="grid min-w-0 content-start gap-3 self-start rounded-token border border-line bg-surface p-pad shadow-token p-4 px-5";
const historyStatsTw="grid grid-cols-fin-history-stats gap-2";
const historyTableTw="grid overflow-hidden rounded-fin-card border border-line";
const historyHeadTw="grid grid-cols-fin-history gap-2.5 border-b border-line bg-blue-50 p-2.5 px-3.5 text-2xs font-extrabold uppercase tracking-fin-wide text-ink-secondary";
const historyEmptyTw="p-5 text-center text-small leading-relaxed text-ink-secondary";
const dialogBackdropTw="fixed inset-0 z-50 grid place-items-center bg-slate-900/80 p-4 backdrop-blur-sm";
/* A janela de assinatura sai do fluxo do shell: portal no body evita o empilhamento da topbar. */
const subscriptionBackdropTw="fixed inset-0 z-[1100] grid items-start justify-items-center overflow-y-auto bg-slate-900/80 px-4 pb-6 pt-[calc(var(--top)_+_16px)] backdrop-blur-sm "+noScrollbarTw;
const dialogTw="relative z-10 flex max-h-dvh w-full max-w-fin-window flex-col overflow-hidden rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50";
const dialogHeadingTw="mb-3.5 flex flex-none items-center gap-3 pr-10";
const dialogCloseTw="absolute right-3 top-3 z-10 grid size-control place-items-center rounded-fin-icon border border-line bg-surface-2 text-ink-secondary transition-colors hover:bg-hover hover:text-ink";
const dialogBodyTw="min-h-0 flex-1 overflow-y-auto overscroll-contain "+noScrollbarTw;
const subscriptionFormTw="grid gap-4";
const lookupTw="flex gap-2";
const lookupInputTw="min-w-0 flex-1";
const matchesTw="mt-5 grid max-h-fin-matches gap-2 overflow-auto rounded-fin-row border border-line bg-surface-2 p-3 "+noScrollbarTw;
const customerTw="flex min-w-0 cursor-pointer flex-nowrap items-center gap-2.5 rounded-fin-chip border border-line bg-surface p-2 px-2.5";
const customerSelectedTw="flex min-w-0 cursor-pointer flex-nowrap items-center gap-2.5 rounded-fin-chip border border-blue-600 bg-blue-50 p-2 px-2.5 ring-2 ring-blue-600/20";
const customerInlineTw="flex min-w-0 flex-nowrap items-baseline gap-2 whitespace-nowrap";
const customerInlineNameTw="min-w-0 truncate font-bold text-ink";
const customerInlineContactTw="min-w-0 truncate text-asaas-muted text-ink-secondary";
const newCustomerTw="grid gap-2.5";
const subGridTw="grid grid-cols-2 gap-3 ov-laptop:grid-cols-2 max-sm:grid-cols-1";
const errorTw="m-0 text-body font-semibold text-red-600";
const dialogFooterTw="mt-0 flex flex-none justify-end gap-2.5 border-t border-line pt-3";
const newSubscriptionDialogTw="relative z-[1101] flex max-h-[calc(100dvh_-_var(--top)_-_40px)] min-h-[min(80dvh,820px)] w-full max-w-fin-subscription flex-col overflow-hidden rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50";
const newSubscriptionHeadingTw="mb-4 flex flex-none items-center gap-3 rounded-fin-figure border border-line bg-linear-to-br from-blue-50 to-surface p-3.5 pr-12";
const newSubscriptionTitleTw="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5";
const newSubscriptionIntroTw="m-0 whitespace-nowrap text-asaas-muted text-ink-secondary";
const newSubscriptionBodyTw="min-h-0 flex-1 overflow-y-auto overscroll-contain "+noScrollbarTw;
const newSubscriptionFormTw="grid gap-4 fin-wide:grid-cols-fin-sub-columns";
const newSubscriptionPanelTw="grid min-w-0 content-start gap-4 self-start rounded-fin-figure border border-line bg-surface-2 p-4";
const newSubscriptionSectionTitleTw="m-0 flex items-center gap-2 whitespace-nowrap text-body font-extrabold text-ink";
const newSubscriptionFooterTw="mt-0 flex flex-none justify-end gap-2.5 border-t border-line pt-3 fin-wide:col-span-2";

const currency = (n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateBR = (value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split("-").reverse().join("/") : value;
/** Abre Configurações → Catálogo lembrando de onde o usuário veio, para o Voltar ser contextual. */
function openCatalogSettings(origin:"finance-products"|"finance-products:new"|"finance-subscriptions"="finance-products"){if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("vexora:open-catalog",{detail:origin}));}
/** Imagens do catálogo são privadas: só renderizamos URLs HTTP(S) ou locais da própria API. */
const catalogImageUrl=(value:unknown):string=>typeof value==="string"&&(/^https?:\/\//i.test(value.trim())||value.trim().startsWith("/api/"))?value.trim():"";
const statusBR:Record<string,string>={PENDING:"Pendente",OVERDUE:"Vencido",RECEIVED:"Recebido",CONFIRMED:"Confirmado",RECEIVED_IN_CASH:"Recebido em dinheiro",REFUNDED:"Estornado",CANCELLED:"Cancelado",CHARGEBACK_REQUESTED:"Contestação solicitada",CHARGEBACK_DISPUTE:"Em contestação"};

type PortfolioItem = { id:string;customerId:string;customerName?:string|null;customerDocument?:string|null;description:string|null;value:number;dueDate:string;status:string;billingType:string|null;subscriptionId:string|null;invoiceUrl?:string|null };
type Portfolio = {source:string;environment:string;items:PortfolioItem[];hasMore:boolean;offset:number;totalCount:number|null};
function PortfolioView({initialStatus=""}:{initialStatus?:string}={}){
 const [status,setStatus]=useState(initialStatus);useEffect(()=>{setStatus(initialStatus);setOffset(0)},[initialStatus]);
 const [dueFrom,setDueFrom]=useState("");
 const [dueTo,setDueTo]=useState("");
 const [offset,setOffset]=useState(0);
 const [data,setData]=useState<Portfolio|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<PortfolioItem|null>(null);
 const [template,setTemplate]=useState("friendly");
 const drawerRef=useRef<HTMLElement|null>(null);
 useModalDialog(!!selected,drawerRef,()=>setSelected(null));
 const [copied,setCopied]=useState(false);
 const [groupBy,setGroupBy]=useState("none");
 useEffect(()=>{let active=true;setLoading(true);setError("");
  const q=new URLSearchParams({offset:String(offset),limit:"50"});
  if(status)q.set("status",status);if(dueFrom)q.set("dueFrom",dueFrom);if(dueTo)q.set("dueTo",dueTo);
  fetch("/api/backend/finance/portfolio?"+q.toString(),{cache:"no-store"}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.message||"Falha ao consultar Asaas");return body as Portfolio}).then(v=>{if(active)setData(v)}).catch(e=>{if(active){setError(String(e.message||e));setData(null)}}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[status,dueFrom,dueTo,offset,refresh]);
 return <section className={portfolioCardTw}>
  <header><h2>Carteira Asaas</h2><p>Cobranças consultadas diretamente no Asaas. Os resultados não são uma conciliação histórica.</p></header>
  <div className={filterBarTw}><label>Agrupar <select value={groupBy} onChange={e=>setGroupBy(e.target.value)}><option value="none">Sem agrupamento</option><option value="customer">Cliente</option><option value="service">Serviço</option><option value="date">Vencimento</option><option value="value">Valor</option></select></label>
   <label>Situação <select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0)}}><option value="">Todas</option>{["PENDING","OVERDUE","RECEIVED","CONFIRMED","RECEIVED_IN_CASH","REFUNDED","CANCELLED","CHARGEBACK_REQUESTED","CHARGEBACK_DISPUTE"].map(s=><option key={s} value={s}>{({PENDING:"A vencer / pendente",OVERDUE:"Vencido",RECEIVED:"Recebido",CONFIRMED:"Confirmado",RECEIVED_IN_CASH:"Recebido em dinheiro",REFUNDED:"Estornado",CANCELLED:"Cancelado",CHARGEBACK_REQUESTED:"Contestação solicitada",CHARGEBACK_DISPUTE:"Em contestação"} as Record<string,string>)[s]}</option>)}</select></label>
   <label>Vencimento de <input type="date" value={dueFrom} onChange={e=>{setDueFrom(e.target.value);setOffset(0)}}/></label>
   <label>Até <input type="date" value={dueTo} min={dueFrom||undefined} onChange={e=>{setDueTo(e.target.value);setOffset(0)}}/></label>
   <button type="button" className={secondaryButton} onClick={()=>setRefresh(n=>n+1)}>Atualizar</button>
  </div>
  {data?.items.length?<div className={actionRowTw}><button type="button" className={secondaryButton} onClick={()=>{const headers=["Cliente","Documento","Serviço / referência","Vencimento","Situação","Valor"];const lines=data.items.map(p=>[p.customerName||"",p.customerDocument||"",p.description||"Sem referência",dateBR(p.dueDate),statusBR[p.status]||p.status,p.value.toFixed(2).replace(".",",")]);const csv="\uFEFF"+[headers,...lines].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="cobrancas-filtro-pagina.csv";link.click();URL.revokeObjectURL(url)}}>Exportar CSV (página atual)</button><button type="button" className={secondaryButton} onClick={async()=>{const summary="Resumo de cobranças — página atual\n"+data.items.map(p=>(p.customerName||"Cliente não identificado")+" | "+dateBR(p.dueDate)+" | "+currency(p.value)+" | "+(statusBR[p.status]||p.status)).join("\n");try{await navigator.clipboard.writeText(summary);window.alert("Resumo copiado. Confira os dados e encaminhe ao responsável por um canal autorizado.")}catch{window.alert("Não foi possível copiar o resumo.")}}}>Copiar resumo para responsável</button></div>:null}
  {error?<p role="alert">{error}</p>:loading?<p role="status">Consultando cobranças…</p>:data&&<>
   <p className={metaTw}>Fonte: Asaas · Ambiente: {data.environment} · Página {Math.floor(data.offset/50)+1}{data.totalCount!==null?" · Total informado: "+data.totalCount:""}</p>
   <div className={tableScrollTw}><table><thead><tr><th>Cliente</th><th>Serviço / referência</th><th>Vencimento</th><th>Situação</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{[...data.items].sort((a,b)=>groupBy==="customer"?(a.customerName||"").localeCompare(b.customerName||""):groupBy==="service"?(a.description||"").localeCompare(b.description||""):groupBy==="date"?a.dueDate.localeCompare(b.dueDate):groupBy==="value"?a.value-b.value:0).map(p=><tr key={p.id}><td><strong>{p.customerName||"Cliente não identificado"}</strong>{p.customerDocument?<small className={customerDocTw}>{p.customerDocument}</small>:null}</td><td>{p.description||"Sem referência"}</td><td>{dateBR(p.dueDate)}</td><td>{statusBR[p.status]||p.status}</td><td>{currency(p.value)}</td><td>{["PENDING","OVERDUE"].includes(p.status)?<button className={collectionActionTw} type="button" disabled={!p.customerName} title={!p.customerName?"Cliente não identificado no Asaas":undefined} onClick={()=>{setSelected(p);setCopied(false)}}>Enviar cobrança</button>:null}{p.invoiceUrl?<a className={collectionActionTw} href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">Fatura</a>:null}</td></tr>)}</tbody></table>{!data.items.length?<p>Nenhuma cobrança encontrada.</p>:null}</div>
   <div className={paginationTw}><button type="button" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Anterior</button><button type="button" disabled={!data.hasMore} onClick={()=>setOffset(n=>n+50)}>Próxima</button></div>
  </>}
 {selected&&<div className={overlayTw} role="presentation" onClick={()=>setSelected(null)}><aside ref={drawerRef} tabIndex={-1} className={drawerTw} role="dialog" aria-modal="true" aria-label="Preparar cobrança" onClick={e=>e.stopPropagation()}>
  <header className={dialogHeadingTw}><h2 className="m-0 text-body font-extrabold text-ink">Enviar cobrança existente</h2><button type="button" className={dialogCloseTw} aria-label="Fechar" onClick={()=>setSelected(null)}><X size={18} aria-hidden="true" /></button></header>
  <p className={metaTw}><strong>Cliente: {selected.customerName||"Não identificado"}</strong></p><p className={metaTw}><strong>{currency(selected.value)}</strong> · Vencimento {dateBR(selected.dueDate)} · {statusBR[selected.status]||selected.status}</p>
  <label className={drawerLabelTw}>Modelo de mensagem<select className={drawerControlTw} value={template} onChange={e=>{setTemplate(e.target.value);setCopied(false)}}><option value="friendly">Lembrete cordial</option><option value="due">Aviso de vencimento</option><option value="late">Cobrança após vencimento</option></select></label>
  <p className={catalogNoteTw}>Mensagem preparada com os dados reais desta cobrança. Confira o destinatário antes de enviar.</p>
  <textarea className={drawerTextareaTw} readOnly rows={7} value={(template==="late"?"Olá! Identificamos uma cobrança pendente com vencimento em ":template==="due"?"Olá! Sua cobrança tem vencimento em ":"Olá! Segue um lembrete sobre sua cobrança com vencimento em ")+dateBR(selected.dueDate)+", no valor de "+currency(selected.value)+"."+(selected.invoiceUrl?" Acesse a fatura: "+selected.invoiceUrl:" Entre em contato com nosso financeiro para obter os dados de pagamento.")+" Se já realizou o pagamento, desconsidere esta mensagem."}/>
  <button type="button" className={drawerButtonTw} onClick={async()=>{const message=(drawerRef.current?.querySelector("textarea") as HTMLTextAreaElement|null)?.value||"";try{await navigator.clipboard.writeText(message);setCopied(true)}catch{setCopied(false)}}}>{copied?"Mensagem copiada":"Copiar mensagem"}</button>
  {selected.invoiceUrl?<a className={drawerLinkTw} href={selected.invoiceUrl} target="_blank" rel="noopener noreferrer">Abrir fatura no Asaas</a>:null}
  <small className={drawerSmallTw}>Não enviada automaticamente. O envio integrado e seu histórico dependem da conexão do canal e de auditoria.</small>
 </aside></div>}
 </section>;
}

type CatalogData={source:string;environment:string;products:{id:string;name:string;description:string;value:number;status:string;billingType:string|null}[];subscriptions:{id:string;customerId:string;description:string;value:number;cycle:string;status:string}[];hasMoreProducts:boolean;hasMoreSubscriptions:boolean;offset:number;limit:number};
function CatalogView({mode}:{mode:"catalog"|"subscriptions"}){
 const [data,setData]=useState<CatalogData|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false),[offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError("");fetch("/api/backend/finance/catalog?offset="+offset+"&limit=50",{cache:"no-store"}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.message||"Não foi possível consultar o catálogo.");return body as CatalogData}).then(d=>{if(active)setData(d)}).catch(e=>{if(active){setData(null);setError(e.message)}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[offset,refresh]);
 const isCatalog=mode==="catalog",items=isCatalog?data?.products:data?.subscriptions,hasMore=isCatalog?data?.hasMoreProducts:data?.hasMoreSubscriptions;
 return <section className={catalogCardTw}><header><div><h2>{isCatalog?"Produtos e serviços":"Assinaturas"}</h2><p>Dados consultados diretamente no Asaas · {data?.environment||"ambiente não confirmado"}</p></div><button className={secondaryButton} type="button" onClick={()=>setRefresh(n=>n+1)}><RefreshCcw size={15}/> Sincronizar agora</button></header>

 {loading?<p role="status">Consultando Asaas…</p>:error?<p role="alert">{error}</p>:data?<><div className={tableScrollTw}><table><thead><tr>{isCatalog?<><th>Produto ou serviço</th><th>Valor</th><th>Tipo</th><th>Clientes vinculados*</th><th>Receita recorrente estimada*</th><th>Situação</th></>:<><th>Descrição</th><th>Valor</th><th>Periodicidade</th><th>Situação</th></>}</tr></thead><tbody>{isCatalog?data.products.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small className={customerDocTw}>{p.description}</small></td><td>{currency(p.value)}</td><td>{p.billingType||"Produto / serviço"}</td><td>{(()=>{const related=data.subscriptions.filter(s=>s.status==="ACTIVE"&&s.description?.trim().toLowerCase()===p.name.trim().toLowerCase());return related.length?new Set(related.map(s=>s.customerId)).size:"—"})()}</td><td>{(()=>{const related=data.subscriptions.filter(s=>s.status==="ACTIVE"&&s.description?.trim().toLowerCase()===p.name.trim().toLowerCase());return related.length?currency(related.reduce((sum,s)=>sum+s.value,0)):"—"})()}</td><td>{p.status}</td></tr>):data.subscriptions.map(s=><tr key={s.id}><td>{s.description||"Assinatura"}</td><td>{currency(s.value)}</td><td>{s.cycle}</td><td>{s.status}</td></tr>)}</tbody></table></div>{isCatalog?<p className={catalogNoteTw}>* Vínculos estimados apenas por correspondência exata entre nome do produto e descrição das assinaturas ativas retornadas nesta página do Asaas. Não representa todos os clientes nem receita mensal consolidada; periodicidades podem variar. Sem correspondência, exibimos —, nunca zero fictício.</p>:null}{!items?.length?<p>Nenhum registro retornado pelo Asaas.</p>:null}<div className={paginationTw}><button disabled={!offset} onClick={()=>setOffset(v=>Math.max(0,v-50))}>Anterior</button><button disabled={!hasMore} onClick={()=>setOffset(v=>v+50)}>Próxima</button></div></>:null}
 </section>;
}

type CatalogProduct={id:string;name:string;description:string;priceCents:number;currency:string;imageUrl:string|null;kind:string;category:string|null};
type ProductEdit={id:string;name:string;description:string;price:string;imageUrl:string;category:string};
function CatalogProductsView(){
  const [items,setItems]=useState<CatalogProduct[]|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [editing,setEditing]=useState<ProductEdit|null>(null);
  const [saving,setSaving]=useState(false);
  const [formError,setFormError]=useState("");
  const [notice,setNotice]=useState("");
  const editorRef=useRef<HTMLElement|null>(null);
  useModalDialog(!!editing,editorRef,()=>setEditing(null));
  /** A vitrine mostra todos os itens ativos da empresa, qualquer que seja a categoria. */
  useEffect(()=>{let live=true;setLoading(true);setError("");fetch("/api/backend/catalog?limit=200",{cache:"no-store"}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.message||"Não foi possível consultar o catálogo.");return body as {items?:CatalogProduct[]}}).then(body=>{if(live)setItems(Array.isArray(body.items)?body.items:[])}).catch(e=>{if(live){setItems(null);setError(e instanceof Error?e.message:"Falha ao consultar o catálogo.")}}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[refresh]);

  function startEdit(item:CatalogProduct){
    setEditing({id:item.id,name:item.name,description:item.description||"",price:(item.priceCents/100).toFixed(2).replace(".",","),imageUrl:item.imageUrl||"",category:item.category||"ASAAS"});
    setFormError("");setNotice("");
  }
  async function saveEdit(){
    if(!editing)return;
    const name=editing.name.trim();
    const price=Number(editing.price.trim().replace(",","."));
    if(name.length<2){setFormError("Informe um nome com pelo menos 2 caracteres.");return;}
    if(!Number.isFinite(price)||price<0){setFormError("Informe um preço válido.");return;}
    setSaving(true);setFormError("");setNotice("");
    try{
      const response=await fetch("/api/backend/catalog/"+encodeURIComponent(editing.id),{method:"PUT",headers:{"content-type":"application/json"},cache:"no-store",body:JSON.stringify({name,description:editing.description.trim(),priceCents:Math.round(price*100),imageUrl:catalogImageUrl(editing.imageUrl)||null,category:editing.category.trim()||"ASAAS"})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(body.message||"Falha ao salvar o produto.");
      setEditing(null);setNotice("Produto atualizado.");setRefresh(n=>n+1);
    }catch(e){setFormError(e instanceof Error?e.message:"Falha ao salvar o produto.")}finally{setSaving(false)}
  }

  return <section className={catalogCardTw} aria-labelledby="finance-products-title">
   <div className={panelHeadingTw}><div><h2 id="finance-products-title">Produtos</h2><p className={metaTw}>Produtos da empresa. Use Editar em cada card para alterar nome, descrição, preço e imagem.</p></div><div className={headingActionsTw}><button type="button" className={subtleButtonTw} title="Cadastrar um novo produto" onClick={() => openCatalogSettings("finance-products:new")}><Plus size={15} aria-hidden="true"/> Novo produto</button><button type="button" className={iconButtonTw} aria-label="Atualizar produtos" title="Atualizar" onClick={()=>setRefresh(n=>n+1)}><RefreshCcw size={15}/></button></div></div>
   {notice?<p role="status" className={noticeTw}>{notice}</p>:null}
   {error?<p role="alert">{error}</p>:loading?<p role="status">Consultando catálogo…</p>:items&&items.length?<div className={productGridTw}>{items.map(item=>{const image=catalogImageUrl(item.imageUrl);return <article className={productCardTw} key={item.id}>
     <div className={productImageFrameTw}>{image?<img className={productImageTw} src={image} alt={item.name} loading="lazy"/>:<div className={productPlaceholderTw} role="img" aria-label="Imagem não informada"><Package size={26} aria-hidden="true"/><span>Sem imagem</span></div>}</div>
     <div className={productBodyTw}><div className="flex flex-wrap items-center gap-1.5"><span className={productBadgeTw} data-kind={item.kind}>{item.kind==="PRODUCT"?"Produto digital":"Serviço"}</span>{item.category?<span className={productMetaTw}>{item.category}</span>:null}</div><h3 className="m-0 text-body font-extrabold text-ink">{item.name}</h3>
     <p className={catalogNoteTw}>{item.description||"Sem descrição cadastrada."}</p>
     <strong className={productPriceTw}>{(item.priceCents/100).toLocaleString("pt-BR",{style:"currency",currency:item.currency||"BRL"})}</strong>
     <button type="button" className={subtleButtonTw} aria-label={"Editar "+item.name} onClick={()=>startEdit(item)}><Pencil size={15} aria-hidden="true"/> Editar</button></div>
    </article>})}</div>:<div className={emptyPanelTw}><p className={emptyTw}>Nenhum produto cadastrado nesta empresa.</p><button type="button" className={subtleButtonTw} onClick={() => openCatalogSettings("finance-products:new")}><Plus size={15} aria-hidden="true"/> Novo produto</button></div>}
   <p className={catalogNoteTw}>Imagem e descrição ficam na Véxora. Nada aqui é enviado para WhatsApp, e-mail ou outros canais externos.</p>
   {editing?<div className={overlayTw} onMouseDown={event=>{if(event.target===event.currentTarget)setEditing(null)}}>
    <section ref={editorRef} className={drawerTw} role="dialog" aria-modal="true" aria-labelledby="finance-product-edit-title" tabIndex={-1}>
     <header className={dialogHeadingTw}><div><h2 id="finance-product-edit-title" className="m-0 text-body font-extrabold text-ink">Editar produto</h2><p className={metaTw}>Altere os dados e salve para atualizar a vitrine.</p></div><button type="button" className={dialogCloseTw} aria-label="Fechar" onClick={()=>setEditing(null)}><X size={18} aria-hidden="true"/></button></header>
     {formError?<p role="alert" className={errorTw}>{formError}</p>:null}
     <div className={dialogBodyTw}><div className={productEditFormTw}>
      <label className={drawerLabelTw}>Nome<input className={drawerControlTw} maxLength={160} value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})}/></label>
      <label className={drawerLabelTw+" sm:col-span-2"}>Descrição<textarea className={drawerTextareaTw} value={editing.description} onChange={event=>setEditing({...editing,description:event.target.value})}/></label>
      <label className={drawerLabelTw}>Preço<input className={drawerControlTw} inputMode="decimal" value={editing.price} onChange={event=>setEditing({...editing,price:event.target.value})}/></label>
      <label className={drawerLabelTw}>URL da imagem (opcional)<input className={drawerControlTw} value={editing.imageUrl} onChange={event=>setEditing({...editing,imageUrl:event.target.value})}/></label>
      <label className={drawerLabelTw}>Categoria<input className={drawerControlTw} maxLength={80} value={editing.category} onChange={event=>setEditing({...editing,category:event.target.value})}/></label>
     </div></div>
     <footer className={dialogFooterTw}><button type="button" className={secondaryButton} onClick={()=>setEditing(null)}>Cancelar</button><button type="button" className={drawerButtonTw} disabled={saving} onClick={()=>void saveEdit()}>{saving?"Salvando…":"Salvar"}</button></footer>
    </section>
   </div>:null}
  </section>;
}

type FinanceListing={source:string;environment:string;kind:string;offset:number;limit:number;hasMore:boolean;totalCount:number|null;items:{id:string;customerId:string;customerName:string;description:string;value:number;cycle:string|null;status:string;billingType:string|null;dueDate:string|null;invoiceUrl:string|null}[]};
function FinanceAsaasListing({kind}:{kind:"subscriptions"|"detached"}){
 const [data,setData]=useState<FinanceListing|null>(null),[offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0),[search,setSearch]=useState(""),[status,setStatus]=useState(""),[cycle,setCycle]=useState(""),[filters,setFilters]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{setOffset(0);setSearch("");setStatus("");setCycle("")},[kind]);
 useEffect(()=>{let active=true;setLoading(true);setError("");fetch("/api/backend/finance/listings?"+new URLSearchParams({kind,offset:String(offset),limit:"50"}),{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.message||"Falha na sincronização com o Asaas");return result as FinanceListing}).then(result=>{if(active)setData(result)}).catch(e=>{if(active){setError(e.message);setData(null)}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[kind,offset,refresh]);
 const shown=(data?.items||[]).filter(x=>(!search||[x.customerName,x.description,x.id].some(v=>v.toLowerCase().includes(search.toLowerCase())))&&(!status||x.status===status)&&(!cycle||x.cycle===cycle));
 const cycleName=(v:string|null)=>({MONTHLY:"Mensal",WEEKLY:"Semanal",BIWEEKLY:"Quinzenal",QUARTERLY:"Trimestral",SEMIANNUALLY:"Semestral",YEARLY:"Anual"} as Record<string,string>)[v||""]||v||"Avulsa";
 const paymentName=(v:string|null)=>({BOLETO:"Boleto bancário",PIX:"Pix",CREDIT_CARD:"Cartão de crédito",UNDEFINED:"A definir"} as Record<string,string>)[v||""]||v||"Não informado";
 const [newSubscriptionOpen,setNewSubscriptionOpen]=useState(false),[createdNotice,setCreatedNotice]=useState(""),[deleteTarget,setDeleteTarget]=useState<DeleteTarget|null>(null);
  const title=kind==="subscriptions"?"Assinaturas":"Cobranças avulsas";
 return <section className={listingCardTw}><div className={panelHeadingTw}><div><h2>{title}</h2><p>Sincronização direta · {data?.environment||"Asaas"}</p></div><div className={headingActionsTw}>{kind==="subscriptions"?<button type="button" className={primaryButton} onClick={()=>{setCreatedNotice("");setNewSubscriptionOpen(true)}}><Plus size={15} aria-hidden="true"/> Nova assinatura</button>:null}<button type="button" className={secondaryButton} onClick={()=>setRefresh(v=>v+1)}><RefreshCcw size={15}/> Sincronizar</button></div></div>
 <div className={toolbarTw}><label className={searchTw}><span>Buscar</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome do cliente ou descrição"/></label><button type="button" className={secondaryButton} aria-expanded={filters} onClick={()=>setFilters(v=>!v)}>Filtros {filters?"−":"+"}</button><small>Busca e filtros na página atual</small></div>
 {filters?<div className={filterBarTw}><label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todas</option>{["ACTIVE","INACTIVE","EXPIRED","PENDING","OVERDUE","RECEIVED","CONFIRMED"].map(s=><option key={s} value={s}>{statusBR[s]||s}</option>)}</select></label>{kind==="subscriptions"?<label>Periodicidade<select value={cycle} onChange={e=>setCycle(e.target.value)}><option value="">Todas</option>{["MONTHLY","WEEKLY","BIWEEKLY","QUARTERLY","SEMIANNUALLY","YEARLY"].map(s=><option key={s} value={s}>{cycleName(s)}</option>)}</select></label>:null}<button type="button" className={secondaryButton} onClick={()=>{setStatus("");setCycle("");setSearch("")}}>Limpar filtros</button></div>:null}
 {loading?<p role="status">Consultando dados reais do Asaas…</p>:error?<p role="alert">{error}</p>:<><div className={tableScrollTw}><table><thead><tr><th>Cliente</th><th>Valor</th><th>Descrição</th><th>Forma de pagamento</th>{kind==="detached"?<th>Vencimento</th>:null}<th>Situação</th><th>Ações</th></tr></thead><tbody>{shown.map(x=><tr key={x.id}><td><strong>{x.customerName}</strong></td><td><strong>{currency(x.value)}</strong>{kind==="subscriptions"?<small>/ {cycleName(x.cycle)}</small>:null}</td><td>{x.description||<span className={mutedTw}>Não informada</span>}</td><td>{paymentName(x.billingType)}</td>{kind==="detached"?<td>{x.dueDate?dateBR(x.dueDate):"—"}</td>:null}<td><span data-status-tone={x.status==="ACTIVE"||x.status==="RECEIVED"?"positive":x.status==="OVERDUE"?"negative":"neutral"} className={x.status==="ACTIVE"||x.status==="RECEIVED"?statusPositiveTw:x.status==="OVERDUE"?statusNegativeTw:statusNeutralTw}>{statusBR[x.status]||({ACTIVE:"Ativa",INACTIVE:"Inativa",EXPIRED:"Expirada"} as Record<string,string>)[x.status]||x.status}</span></td><td>{x.invoiceUrl?<a href={x.invoiceUrl} target="_blank" rel="noopener noreferrer" className={linkTw}>Fatura</a>:<span className={mutedTw}>—</span>}{kind==="subscriptions"?<div className={actionRowTw}>{x.customerId?<button type="button" className={dangerActionTw} onClick={()=>setDeleteTarget({kind:"CUSTOMER",id:x.customerId,label:x.customerName||"Cliente"})}>Excluir cliente</button>:null}<button type="button" className={dangerActionTw} onClick={()=>setDeleteTarget({kind:"SUBSCRIPTION",id:x.id,label:x.description||"Assinatura"})}>Excluir assinatura</button></div>:null}</td></tr>)}</tbody></table></div>{!shown.length?<p className={emptyTw}>Nenhum registro encontrado nesta página.</p>:null}<div className={footerTw}><span>{shown.length} registros exibidos · página {Math.floor(offset/50)+1}{data?.totalCount!==null?" · "+data?.totalCount+" registros informados pelo Asaas":""}</span><div><button type="button" className={secondaryButton} disabled={!offset} onClick={()=>setOffset(v=>Math.max(0,v-50))}>Anterior</button><button type="button" className={secondaryButton} disabled={!data?.hasMore} onClick={()=>setOffset(v=>v+50)}>Próxima</button></div></div>{kind==="detached"?<p className={catalogNoteTw}>Somente cobranças sem assinatura vinculada. O resultado é paginado conforme o retorno do Asaas.</p>:null}{createdNotice?<p role="status" className={noticeTw}>{createdNotice}<button type="button" aria-label="Fechar" onClick={()=>setCreatedNotice("")}><X size={14} aria-hidden="true"/></button></p>:null}{newSubscriptionOpen?<NewSubscriptionModal onClose={()=>setNewSubscriptionOpen(false)} onCreated={(message)=>{setNewSubscriptionOpen(false);setCreatedNotice(message);setRefresh(v=>v+1)}}/>:null}{deleteTarget?<ConfirmDeleteDialog target={deleteTarget} onClose={()=>setDeleteTarget(null)} onDeleted={(message)=>{setDeleteTarget(null);setCreatedNotice(message);setRefresh(v=>v+1)}}/>:null}</>}
 </section>;
}

const wafflePalette=["#1D4ED8","#7DD3FC","#FB7185","#FBBF24","#F472B6","#64748B"];
function WaffleChart({rows}:{rows:{status:string;count:number;amount:number}[]}){
  const total=rows.reduce((sum,item)=>sum+item.count,0);
  if(!total)return null;
  const exact=rows.map(row=>(row.count/total)*100);
  const cells=exact.map(value=>Math.floor(value));
  const remainder=100-cells.reduce((sum,value)=>sum+value,0);
  const order=rows.map((_,index)=>index).sort((a,b)=>((exact[b]??0)%1)-((exact[a]??0)%1));
  for(let step=0;step<remainder;step++){const target=order[step%order.length];if(target===undefined)break;cells[target]=(cells[target]??0)+1;}
  const slots=rows.flatMap((_,index)=>Array.from({length:cells[index]??0},()=>index)).slice(0,100);
  return <div className={waffleTw} role="img" aria-label="Distribuição das cobranças por situação">{Array.from({length:100},(_,index)=>{const slot=slots[index];if(slot===undefined)return <span key={index} className={waffleEmptyTw}/>;return <span key={index} style={{background:wafflePalette[slot%wafflePalette.length]}} title={statusBR[rows[slot]?.status??""]||rows[slot]?.status}/>;})}</div>;
}
type Executive={source:string;environment:string;partial:boolean;from:string;to:string;months:number;totals:{billed:number;paid:number;open:number;overdue:number;count:number;overdueCount:number;customers:number};collectionRate:number|null;series:{month:string;billed:number;paid:number;open:number;overdue:number}[];byStatus:{status:string;count:number;amount:number}[];byBillingType:{type:string;count:number;amount:number}[]};
function ExecutiveOverview({onOpenCharges}:{onOpenCharges:(status:string)=>void}){
 const [months,setMonths]=useState(6),[rangeMode,setRangeMode]=useState<"preset"|"all"|"custom">("preset"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[appliedRange,setAppliedRange]=useState<{from:string;to:string}|null>(null),[rangeError,setRangeError]=useState(""),[data,setData]=useState<Executive|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError("");fetch("/api/backend/finance/executive?"+new URLSearchParams(rangeMode==="all"?{months:String(months),all:"true"}:rangeMode==="custom"&&appliedRange?{months:String(months),from:appliedRange.from,to:appliedRange.to}:{months:String(months)}),{cache:"no-store"}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.message||"Falha na consulta ao Asaas.");return v as Executive}).then(v=>{if(live)setData(v)}).catch(e=>{if(live){setData(null);setError(e.message)}}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[months,rangeMode,appliedRange,refresh]);
 const max=Math.max(1,...(data?.series||[]).map(s=>s.billed));
 const totalBilling=(data?.byBillingType||[]).reduce((a,b)=>a+b.amount,0);
 const billed=data?.totals.billed||0;
 const paidShare=billed>0?Math.round((data?.totals.paid||0)/billed*100):0;
 const overdueShare=billed>0?Math.round((data?.totals.overdue||0)/billed*100):0;
 const openShare=Math.max(0,100-paidShare-overdueShare);
 const billingName=(v:string)=>(({BOLETO:"Boleto bancário",PIX:"Pix",CREDIT_CARD:"Cartão de crédito",UNDEFINED:"A definir"} as Record<string,string>)[v]||v);
 const billingPalette:[string,string][]=[["#1D4ED8","#164E8A"],["#FBBF24","#D97706"],["#FBBF24","#D97706"],["#F472B6","#BE185D"],["#38BDF8","#0369A1"],["#FB7185","#E11D48"]];
 const insight=data?(data.totals.overdue>0?"Atenção: "+currency(data.totals.overdue)+" em "+data.totals.overdueCount+" cobranças vencidas — priorize a régua de cobrança antes de oferecer novos prazos.":"Nenhuma cobrança vencida no período — carteira em dia."):"";
 return <div className={executiveTw}>
  <section className={heroTw} aria-label="Resumo executivo financeiro">
   <div className={heroCopyTw}>
    <span className={heroEyebrowTw}><Sparkles size={13} aria-hidden="true"/> Raio-X financeiro{data?" · "+data.environment:""}</span>
    <h2>O caixa decide o ritmo do negócio.</h2>
    <p>{data?"Vencimentos de "+dateBR(data.from)+" a "+dateBR(data.to)+". Cada valor abaixo veio do Asaas — nada é estimado sem base.":"Sincronizando indicadores em tempo real com o Asaas…"}</p>
    <div className={heroChipsTw}>
     <button type="button" className={heroChipTw} onClick={()=>onOpenCharges("OVERDUE")}><AlertTriangle size={13} aria-hidden="true"/>{data?data.totals.overdueCount+" cobranças vencidas":"Vencidas"}<ArrowRight size={13} aria-hidden="true"/></button>
     <button type="button" className={heroChipTw} onClick={()=>onOpenCharges("PENDING")}><Clock3 size={13} aria-hidden="true"/>{data?data.totals.count+" cobranças no período":"Em aberto"}<ArrowRight size={13} aria-hidden="true"/></button>
     <span className={heroChipStaticTw}><Banknote size={13} aria-hidden="true"/>{data&&data.collectionRate!==null?data.collectionRate+"% de recebimento":"Recebimento —"}</span>
    </div>
   </div>
   <div className={heroFigureTw}>
    <span>Total faturado</span>
    <strong>{data?currency(data.totals.billed):"—"}</strong>
    <div className={heroBarTw} role="img" aria-label="Composição do faturado: pago, em aberto e vencido"><i className={segPaidTw} style={{width:paidShare+"%"}}/><i className={segOpenTw} style={{width:openShare+"%"}}/><i className={segOverdueTw} style={{width:overdueShare+"%"}}/></div>
    <div className={heroLegendTw}><span><i className={dotPaidTw}/>Pago · {paidShare}%</span><span><i className={dotOpenTw}/>Em aberto · {openShare}%</span><span><i className={dotOverdueTw}/>Vencido · {overdueShare}%</span></div>
   </div>
  </section>

  <div className={periodBarTw}>
   <div className={periodChipsTw} role="group" aria-label="Período do dashboard">{[1,3,6,12].map(n=><button type="button" key={n} aria-pressed={rangeMode==="preset"&&months===n} className={rangeMode==="preset"&&months===n?periodChipActiveTw:periodChipTw} onClick={()=>{setMonths(n);setRangeMode("preset")}}>{n===1?"Mês atual":n+" meses"}</button>)}<button type="button" aria-pressed={rangeMode==="all"} className={rangeMode==="all"?periodChipActiveTw:periodChipTw} onClick={()=>setRangeMode("all")}>Tudo</button><button type="button" aria-pressed={rangeMode==="custom"} className={rangeMode==="custom"?periodChipActiveTw:periodChipTw} onClick={()=>{if(!from){const d=new Date();setFrom(new Date(Date.UTC(d.getFullYear(),d.getMonth(),1)).toISOString().slice(0,10));setTo(d.toISOString().slice(0,10));}setRangeMode("custom");setAppliedRange(null);setRangeError("")}}>Personalizado</button></div>
   {rangeMode==="custom"?<div className={periodCustomTw}><label>De<input type="date" value={from} max={to||undefined} onChange={e=>{setFrom(e.target.value);setRangeError("")}}/></label><label>Até<input type="date" value={to} min={from||undefined} onChange={e=>{setTo(e.target.value);setRangeError("")}}/></label><button type="button" className={primaryButton} onClick={()=>{if(!from||!to||from>to){setRangeError("Informe um intervalo válido.");return;}setAppliedRange({from,to});setRangeError("");setRefresh(n=>n+1)}}>Aplicar período</button>{rangeError?<small role="alert">{rangeError}</small>:null}</div>:null}
   <button type="button" className={secondaryButton} onClick={()=>{if(rangeMode==="custom"&&(!appliedRange||from!==appliedRange.from||to!==appliedRange.to)){if(!from||!to||from>to){setRangeError("Informe um intervalo válido.");return;}setAppliedRange({from,to})}setRefresh(n=>n+1)}}><RefreshCcw size={15} aria-hidden="true"/> Atualizar</button>
  </div>

  {loading?<p role="status">Sincronizando indicadores com o Asaas…</p>:error?<div className={healthNoteTw} role="alert"><AlertCircle size={18}/>{error}</div>:data?<>
   {data.partial?<p role="alert" className={partialTw}><AlertTriangle size={15} aria-hidden="true"/> Consulta parcial: limite de 5.000 cobranças atingido. Indicadores não representam toda a carteira.</p>:null}
   <div className={metricsTw}>{[{id:"billed",icon:Banknote,label:"Faturado",value:currency(data.totals.billed),hint:"Vencimentos do período",tone:"blue",href:null},{id:"paid",icon:CheckCircle2,label:"Pago",value:currency(data.totals.paid),hint:"Confirmado no Asaas",tone:"green",href:null},{id:"open",icon:Clock3,label:"Em aberto",value:currency(data.totals.open),hint:"Aguardando recebimento",tone:"amber",href:"PENDING"},{id:"overdue",icon:AlertTriangle,label:"Vencido",value:currency(data.totals.overdue),hint:data.totals.overdueCount+" cobranças · ver Cobranças",tone:"red",href:"OVERDUE"},{id:"inadimplencia",icon:Activity,label:"Inadimplência",value:data.totals.billed?(data.totals.overdue/data.totals.billed*100).toFixed(1)+"%":"—",hint:"Vencido sobre faturado",tone:"purple",href:null}].map(item=>{const Icon=item.icon;const inner=<><span className={metricIconTw[item.tone]??metricIconTw.blue}><Icon size={18} aria-hidden="true"/></span><span className={metricBodyTw}><small className={metricLabelTw}>{item.label}</small><strong className={metricValueTw}>{item.value}</strong><em className={metricHintTw}>{item.hint}</em></span>{item.href?<ArrowRight size={15} aria-hidden="true" className={metricArrowTw}/>:null}</>;return item.href?<button type="button" key={item.id} data-tone={item.tone} className={metricInteractiveTw[item.tone]??metricInteractiveTw.blue} onClick={()=>onOpenCharges(item.href as string)}>{inner}</button>:<article data-tone={item.tone} className={metricCardTw[item.tone]??metricCardTw.blue} key={item.id}>{inner}</article>})}</div>

   <div className={execGridTw}>
    <section className={panelWideTw}><h2>Competências em perspectiva</h2><p>Por vencimento · faturado, recebido e vencido</p>{data.totals.count===0?<div className={emptyPanelTw}>Nenhuma cobrança com vencimento no período selecionado. Experimente ampliar as datas ou selecionar Todo o período.</div>:<div className={columnsTw}>{data.series.map(s=><div className={columnTw} key={s.month}><div className={barsTw}><i className={barBilledTw} style={{height:s.billed>0?Math.max(3,s.billed/max*100):0+"%"}} title={"Faturado "+currency(s.billed)}/><i className={barPaidTw} style={{height:s.paid>0?Math.max(3,s.paid/max*100):0+"%"}} title={"Pago "+currency(s.paid)}/><i className={barOverdueTw} style={{height:s.overdue>0?Math.max(3,s.overdue/max*100):0+"%"}} title={"Vencido "+currency(s.overdue)}/></div><small>{s.month.length===4?s.month:s.month.slice(5)+"/"+s.month.slice(2,4)}</small></div>)}</div>}<div className={execLegendTw}><span><i className={dotPaidTw}/>Faturado</span><span><i className={dotOpenTw}/>Pago</span><span><i className={dotOverdueTw}/>Vencido</span></div></section>

    <section className={statusPanelTw}><h2>Saldo por situação</h2><p>Cada anel mostra a participação sobre o faturado.</p>{data.totals.billed<=0?<div className={emptyPanelTw}>Sem valores para comparar neste período.</div>:<div className={donutsTw}>{[{label:"Faturado",value:data.totals.billed,color:"#1D4ED8"},{label:"Pago",value:data.totals.paid,color:"#FBBF24"},{label:"Vencido",value:data.totals.overdue,color:"#FB7185"}].map(item=>{const percentage=Math.min(100,Math.max(0,item.value/Math.max(1,data.totals.billed)*100));return <article className={donutCardTw} key={item.label}><div className={donutTw} style={{background:"conic-gradient("+item.color+" "+percentage+"%,var(--s2) 0)"}}><span>{percentage.toFixed(0)}<small>%</small></span></div><strong>{item.label}</strong><b>{currency(item.value)}</b></article>})}</div>}</section>

    <section className={billingPanelTw}><h2>Meios de pagamento</h2><p>Participação dos valores faturados por forma de pagamento</p>{data.byBillingType.length===0?<div className={emptyPanelTw}>Nenhuma cobrança com meio de pagamento identificado neste período.</div>:<div className={billingBarsTw}>{[...data.byBillingType].sort((a,b)=>b.amount-a.amount).map((item,index)=>{const share=totalBilling>0?item.amount/totalBilling*100:0;const palette=billingPalette[index%billingPalette.length]??["#1D4ED8","#164E8A"];return <div className={billingRowTw} key={item.type}><span className={billingLabelTw}>{billingName(item.type)}</span><div className={billingTrackTw}><i style={{width:Math.max(3,share)+"%",background:"linear-gradient(90deg,"+palette[0]+","+palette[1]+")"}}/></div><span className={billingValueTw}><strong>{share.toFixed(0)}%</strong><small>{item.count}x · {currency(item.amount)}</small></span></div>})}</div>}</section>

    <section className={wafflePanelTw}><h2>Distribuição da carteira</h2><p>Cada quadrado representa uma fatia das cobranças do período, por situação</p>{data.totals.count>0?<><WaffleChart rows={data.byStatus.slice(0,6)}/><div className={waffleLegendTw}>{data.byStatus.slice(0,6).map((s,i)=><span key={s.status}><i style={{background:wafflePalette[i%wafflePalette.length]}}/><b>{statusBR[s.status]||s.status}</b>{s.count} · {currency(s.amount)}</span>)}</div></>:<div className={emptyPanelTw}>Nenhuma cobrança no período.</div>}</section>

    <section className={intelligencePanelTw}><h2>Inteligência financeira</h2><p>Alertas da carteira no período</p><dl><div><dt>Cobranças vencidas</dt><dd>{data.totals.overdueCount}</dd></div><div><dt>Clientes com cobranças</dt><dd>{data.totals.customers}</dd></div><div><dt>Taxa de recebimento</dt><dd>{data.collectionRate===null?"—":data.collectionRate+"%"}</dd></div></dl><p className={insightTw}><Sparkles size={13} aria-hidden="true"/>{insight}</p><small>Indicadores calculados pelas cobranças do Asaas com vencimento no período selecionado.</small></section>
   </div>
  </>:null}
 </div>;
}

const FINANCE_MESSAGE_PRESETS=[
 {name:"Lembrete de vencimento",category:"Cobrança",body:"Olá, {{nome}}! Sua cobrança de {{valor}} vence em {{vencimento}}. Consulte sua fatura: {{fatura}}."},
 {name:"Vencimento hoje",category:"Cobrança",body:"Olá, {{nome}}! Sua cobrança de {{valor}} vence hoje. Segue a fatura: {{fatura}}."},
 {name:"Primeiro aviso de atraso",category:"Cobrança",body:"Olá, {{nome}}! Identificamos uma cobrança vencida em {{vencimento}}. Podemos ajudar? {{fatura}}"},
 {name:"Segundo aviso de atraso",category:"Cobrança",body:"Olá, {{nome}}! Sua cobrança de {{valor}} continua em aberto. Para regularizar, acesse: {{fatura}}."},
 {name:"Último lembrete amigável",category:"Cobrança",body:"Olá, {{nome}}! Estamos à disposição para ajudar com sua cobrança pendente. Confira: {{fatura}}."},
 {name:"Pagamento confirmado",category:"Cobrança",body:"Olá, {{nome}}! Recebemos seu pagamento. Agradecemos pela confiança!"},
 {name:"Aniversário",category:"Relacionamento",body:"Feliz aniversário, {{nome}}! Desejamos saúde, alegria e muitas conquistas. Equipe {{empresa}}."},
 {name:"Aniversário de parceria",category:"Relacionamento",body:"{{nome}}, hoje celebramos mais um ano da nossa parceria. Obrigado por confiar na {{empresa}}!"},
 {name:"Boas-vindas",category:"Relacionamento",body:"Olá, {{nome}}! Seja bem-vindo(a) à {{empresa}}. Estamos felizes em ter você conosco."},
 {name:"Agradecimento",category:"Relacionamento",body:"Olá, {{nome}}! Obrigado pela confiança em nossa equipe. Conte sempre com a {{empresa}}."}
];
function FinanceAutomationWorkspace(){
 const [selected,setSelected]=useState(0),[draft,setDraft]=useState(FINANCE_MESSAGE_PRESETS[0]!.body),[dueDays,setDueDays]=useState("-5,-3,0,3"),[days,setDays]=useState("1,5,15"),[time,setTime]=useState("09:00"),[zone,setZone]=useState("America/Sao_Paulo"),[enabled,setEnabled]=useState(false),[channel,setChannel]=useState(""),[drive,setDrive]=useState(false);
 return <section className={automationPageTw}><header className={automationHeadingTw}><div><h2>Automação financeira</h2><p>Configure mensagens, periodicidade e canal. A ativação de envios exige um executor validado.</p></div><span className={automationPillTw}>Configuração preliminar · não envia mensagens</span></header><div className={automationGridTw}><section className={automationCardTw}><h3>Rotina e horários</h3><label className={autoCheckTw}><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Preparar avisos automáticos</label><label>Fuso horário<select value={zone} onChange={e=>setZone(e.target.value)}><option value="America/Sao_Paulo">Brasília / São Paulo</option><option value="America/Cuiaba">Cuiabá</option><option value="America/Manaus">Manaus</option></select></label><label>Horário de execução<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label>Dias para conciliação mensal<input value={days} onChange={e=>setDays(e.target.value)} placeholder="1, 5, 15"/></label><label>Avisos em relação ao vencimento<input value={dueDays} onChange={e=>setDueDays(e.target.value)} placeholder="-5, -3, 0, 3"/></label><p className={autoNoteTw}>Valores negativos representam dias antes do vencimento. Configuração visual ainda não ativa no servidor.</p></section><section className={automationCardTw}><h3>Canal e estratégia</h3><label>Canal para envios<select value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Selecione um canal após vinculação</option><option value="whatsapp" disabled>WhatsApp · depende de canal e permissões</option></select></label><label>Modelo de comunicação<select value={drive?"drive":"text"} onChange={e=>setDrive(e.target.value==="drive")}><option value="text">Mensagem de texto</option><option value="drive">Modelo no Google Drive · integração pendente</option></select></label><div className={autoStrategyTw}><strong>Regras de segurança</strong><p>Antes de enviar: verificar pagamento atualizado no Asaas, consentimento, canal autorizado, janela do WhatsApp e evitar duplicidades.</p></div><div className={autoStrategyTw}><strong>Integração entre módulos</strong><p>As mensagens deverão utilizar contatos do CRM, cobranças do Asaas, canais do Atendimento e registros auditáveis no Histórico.</p></div></section><section className={autoWideTw}><div className={templatesHeadingTw}><div><h3>Biblioteca de mensagens</h3><p>10 sugestões editáveis, prontas para personalizar</p></div><span>10 modelos</span></div><div className={templateGridTw}><div className={templateListTw}>{FINANCE_MESSAGE_PRESETS.map((item,i)=><button type="button" key={item.name} aria-pressed={selected===i} className={selected===i?templateActiveTw:templateButtonTw} onClick={()=>{setSelected(i);setDraft(item.body)}}><strong>{item.name}</strong><small>{item.category}</small></button>)}</div><div className={templateEditorTw}><label>Mensagem — {FINANCE_MESSAGE_PRESETS[selected]!.name}<textarea rows={5} value={draft} onChange={e=>setDraft(e.target.value)}/></label><p className={autoNoteTw}>Variáveis: {"{{nome}}"}, {"{{valor}}"}, {"{{vencimento}}"}, {"{{fatura}}"}, {"{{empresa}}"}.</p><div className={previewTw}><strong>Prévia do texto</strong><p>{draft||"Digite sua mensagem para visualizar."}</p></div><p className={autoNoteTw}>Os modelos são exemplos locais. Ainda não são salvos no banco, no Google Drive ou enviados automaticamente.</p></div></div></section></div></section>;
}
function FinanceHistoryWorkspace(){
 return <section className={historyPageTw}><header className={automationHeadingTw}><div><h2>Histórico de avisos</h2><p>Acompanhamento de tentativas, entregas, falhas e alterações das automações financeiras.</p></div><span className={automationPillTw}>Aguardando integração com eventos reais</span></header><div className={historyStatsTw}>{["Enviados","Entregues","Falhas","Pendentes"].map(label=><div key={label}><small>{label}</small><strong>—</strong></div>)}</div><div className={historyTableTw}><div className={historyHeadTw}><span>Data e hora</span><span>Cliente</span><span>Evento</span><span>Status</span><span>Detalhes</span></div><div className={historyEmptyTw}>Ainda não há um registro de execução auditável conectado a esta tela. Nenhuma entrega ou falha será simulada.</div></div><p className={autoNoteTw}>A integração deverá registrar eventos de cobrança, confirmação do provedor, recebimento e leitura quando disponíveis, erros, tentativas e reprocessamentos seguros.</p></section>;
}

type DeleteTarget={kind:"SUBSCRIPTION"|"CUSTOMER";id:string;label:string};
function ConfirmDeleteDialog({target,onClose,onDeleted}:{target:DeleteTarget;onClose:()=>void;onDeleted:(message:string)=>void}){
  const [phrase,setPhrase]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const dialogRef=useRef<HTMLDivElement|null>(null);
  useModalDialog(true,dialogRef,()=>{if(!busy)onClose()});
  const isSubscription=target.kind==="SUBSCRIPTION";
  const effect=isSubscription
    ? "Ao confirmar, o Asaas removerá a recorrência e as cobranças pendentes ou vencidas. Pagamentos já confirmados permanecem."
    : "Ao confirmar, o Asaas removerá o cliente, assinaturas e cobranças pendentes ou vencidas. Os contatos locais vinculados serão marcados como excluídos. Pagamentos já confirmados permanecem.";
  async function confirm(){
    if(phrase.trim().toUpperCase()!=="EXCLUIR")return;
    setBusy(true);setError("");
    const path=isSubscription?"/api/backend/finance/subscriptions/":"/api/backend/finance/customers/";
    try{
      const r=await fetch(path+encodeURIComponent(target.id),{method:"DELETE",cache:"no-store"});
      const body=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(body.message||"O servidor não confirmou a exclusão.");
      onDeleted((isSubscription?"Assinatura":"Cliente")+" excluído(a) no Asaas após confirmação do servidor: "+target.label+" · auditoria registrada.");
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível confirmar a exclusão.")}
    finally{setBusy(false)}
  }
  return <div className={dialogBackdropTw} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose()}}><div ref={dialogRef} tabIndex={-1} className={dialogTw} role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title"><header className={dialogHeadingTw}><div><h2 id="confirm-delete-title">Confirmar exclusão</h2><p>{isSubscription?"Assinatura":"Cliente"}: {target.label}</p></div><button type="button" className={dialogCloseTw} aria-label="Fechar" disabled={busy} onClick={onClose}><X size={18} aria-hidden="true"/></button></header><div className={dialogBodyTw}>
   <div className={subscriptionFormTw}>
    <p className={errorTw}>Atenção: {effect}</p>
    <p className={catalogNoteTw}>A intenção é registrada na auditoria com o usuário responsável. Nenhuma exclusão é considerada concluída antes da resposta de sucesso do servidor; se falhar, nada é afirmado como feito.</p>
    <label className={fieldTw}><span>Para confirmar, digite EXCLUIR</span><input value={phrase} onChange={event=>setPhrase(event.target.value)} autoComplete="off" disabled={busy} maxLength={20}/></label>
    {error?<p role="alert" className={errorTw}>{error}</p>:null}
    <div className={dialogFooterTw}><button type="button" className={secondaryButton} disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className={dangerButtonTw} disabled={busy||phrase.trim().toUpperCase()!=="EXCLUIR"} onClick={()=>void confirm()}>{busy?"Excluindo…":"Confirmar exclusão"}</button></div>
   </div>
  </div></div></div>;
}

type ServiceCatalogItem={id:string;name:string;value:number;description?:string;imageUrl?:string|null};
type LookupMatch={id:string;name:string;email:string|null;phone:string|null};
function NewSubscriptionModal({contactId,onClose,onCreated}:{contactId?:string;onClose:()=>void;onCreated:(message:string)=>void}){
  const [document,setDocument]=useState("");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [catalogItemId,setCatalogItemId]=useState("");
  const [cycle,setCycle]=useState("MONTHLY");
  const [billingType,setBillingType]=useState("BOLETO");
  const [nextDueDate,setNextDueDate]=useState(()=>{const d=new Date();d.setDate(d.getDate()+30);return d.toISOString().slice(0,10)});
  const [endDate,setEndDate]=useState("");
  const [catalog,setCatalog]=useState<ServiceCatalogItem[]>([]);
  const [lookupBusy,setLookupBusy]=useState(false);
  const [matches,setMatches]=useState<LookupMatch[]|null>(null);
  const [createNew,setCreateNew]=useState(false);
  const [customerId,setCustomerId]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const dialogRef=useRef<HTMLDivElement|null>(null);
  useModalDialog(true,dialogRef,()=>{if(!busy)onClose()});
  useEffect(()=>{let live=true;fetch("/api/backend/finance/services",{cache:"no-store"}).then(r=>r.json()).then(v=>{if(live&&Array.isArray(v.services))setCatalog(v.services)}).catch(()=>{});return()=>{live=false}},[]);
  const documentDigits=document.replace(/\D+/g,"");
  const documentValid=/^(\d{11}|\d{14})$/.test(documentDigits);
  async function lookup(){if(!documentValid){setError("CPF ou CNPJ inválido.");return;}setLookupBusy(true);setError("");setMatches(null);setCreateNew(false);setCustomerId("");try{const r=await fetch("/api/backend/finance/customer-lookup?document="+encodeURIComponent(documentDigits),{cache:"no-store"});const body=await r.json();if(!r.ok)throw Error(body.message||"Falha ao consultar o Asaas.");const found:LookupMatch[]=Array.isArray(body.customers)?body.customers:[];setMatches(found);if(found.length===1)setCustomerId(found[0]!.id);else if(!found.length)setCreateNew(true);}catch(e){setError(e instanceof Error?e.message:"Não foi possível consultar o Asaas.");setMatches([]);}finally{setLookupBusy(false)}}
  const selectedCustomer=matches?.find(item=>item.id===customerId)||null;
  const selectedItem=catalog.find(item=>item.id===catalogItemId)||null;
  const canCreate=Boolean(selectedItem&&documentValid&&(selectedCustomer||customerId||(createNew&&name.trim().length>2)));
  async function submit(){
    if(!canCreate){setError("Selecione um produto/serviço do catálogo e informe um cliente válido.");return;}
    if(endDate&&endDate<nextDueDate){setError("A data final não pode ser anterior à primeira cobrança.");return;}
    setBusy(true);setError("");
    try{
      // Nome e preço vêm do CatalogItem no servidor; o navegador envia só a referência e as datas.
      const body:Record<string,unknown>={catalogItemId:selectedItem!.id,cycle,billingType,nextDueDate};
      if(endDate)body.endDate=endDate;
      if(selectedCustomer||customerId)body.customerId=selectedCustomer?.id||customerId;
      else if(createNew){body.document=documentDigits;body.customerName=name.trim();if(email.trim())body.customerEmail=email.trim();if(phone.trim())body.customerPhone=phone.replace(/\D+/g,"")}
      if(contactId)body.contactId=contactId;
      const r=await fetch("/api/backend/finance/subscriptions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const result=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(result.message||"Não foi possível criar a assinatura.");
      onCreated("Assinatura criada: "+selectedItem!.name+" · "+currency(selectedItem!.value)+" · primeira cobrança em "+result.subscription.nextDueDate+(result.subscription.endDate?" · término em "+dateBR(result.subscription.endDate):""));
    }catch(e){setError(e instanceof Error?e.message:"Falha ao criar a assinatura.");setBusy(false)}
  }
  return createPortal(<div className={subscriptionBackdropTw} role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!busy)onClose()}}>
   <div ref={dialogRef} tabIndex={-1} className={newSubscriptionDialogTw} role="dialog" aria-modal="true" aria-labelledby="new-sub-title">
    <header className={newSubscriptionHeadingTw}>
     <div className={newSubscriptionTitleTw}>
      <h2 id="new-sub-title">Nova assinatura</h2>
      <p className={newSubscriptionIntroTw}>Nome e valor vêm do catálogo da empresa.</p>
     </div>
     <button type="button" className={dialogCloseTw} aria-label="Fechar" disabled={busy} onClick={onClose}><X size={18} aria-hidden="true"/></button>
    </header>
    <div className={newSubscriptionBodyTw}>
     <form className={newSubscriptionFormTw} onSubmit={(event)=>{event.preventDefault();void submit()}}>
      <section className={newSubscriptionPanelTw}>
       <h3 className={newSubscriptionSectionTitleTw}>Cliente</h3>
       <label className={fieldTw}><span>CPF/CNPJ do cliente *</span><div className={lookupTw}><input inputMode="numeric" autoComplete="off" data-testid="new-subscription-document" value={document} onChange={e=>{setDocument(e.target.value);setMatches(null);setCreateNew(false);setCustomerId("")}} placeholder="Somente números"/><button type="button" className={secondaryButton} disabled={!documentValid||lookupBusy} onClick={()=>void lookup()}>{lookupBusy?"Consultando…":"Buscar cliente"}</button></div></label>
       {matches!==null?(matches.length?<fieldset className={matchesTw}><legend>Selecione o cadastro no Asaas</legend>{matches.map(item=><label key={item.id} data-selected={customerId===item.id?"true":"false"} className={customerId===item.id?customerSelectedTw:customerTw}><input type="radio" name="sub-customer" checked={customerId===item.id} onChange={()=>setCustomerId(item.id)}/><span className={customerInlineTw}><strong className={customerInlineNameTw}>{item.name}</strong><small className={customerInlineContactTw}>{[item.email,item.phone].filter(Boolean).join(" · ")||"Sem contato"}</small></span></label>)}</fieldset>:<fieldset className={matchesTw}><legend>Novo cadastro no Asaas</legend><div className={newCustomerTw}><label className={fieldTw}><span>Nome do cliente *</span><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nome completo ou razão social"/></label><label className={fieldTw}><span>E-mail (opcional)</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="cliente@empresa.com"/></label><label className={fieldTw}><span>Telefone (opcional)</span><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(00) 00000-0000"/></label></div></fieldset>):null}
      </section>
      <section className={newSubscriptionPanelTw}>
       <h3 className={newSubscriptionSectionTitleTw}>Produto/serviço</h3>
       <label className={fieldTw}><span>Produto/serviço do catálogo *</span><select required data-testid="new-subscription-service" value={catalogItemId} onChange={e=>setCatalogItemId(e.target.value)}><option value="">Selecione um produto/serviço</option>{catalog.map(item=><option key={item.id} value={item.id}>{item.name} · {currency(item.value)}</option>)}<option value="__create__">Criar produto/serviço…</option></select></label>
       {catalogItemId==="__create__"?<p className={partialTw}>Cadastre o novo produto/serviço em Configurações / Catálogo; depois volte aqui para selecioná-lo. <button type="button" className={linkTw} onClick={()=>openCatalogSettings("finance-subscriptions")}>Abrir Configurações / Catálogo</button></p>:null}
       {catalog.length===0&&catalogItemId!=="__create__"?<p className={catalogNoteTw}>Nenhum produto/serviço ativo no catálogo. <button type="button" className={linkTw} onClick={()=>openCatalogSettings("finance-subscriptions")}>Criar em Configurações / Catálogo</button></p>:null}
       <div className={subGridTw}>
        <label className={fieldTw}><span>Valor</span><input readOnly data-testid="new-subscription-value" value={selectedItem?currency(selectedItem.value):"—"}/></label>
        <label className={fieldTw}><span>Periodicidade</span><select value={cycle} onChange={e=>setCycle(e.target.value)}><option value="WEEKLY">Semanal</option><option value="BIWEEKLY">Quinzenal</option><option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option><option value="SEMIANNUALLY">Semestral</option><option value="YEARLY">Anual</option></select></label>
        <label className={fieldTw}><span>Forma de pagamento</span><select value={billingType} onChange={e=>setBillingType(e.target.value)}><option value="BOLETO">Boleto bancário</option><option value="PIX">Pix</option><option value="CREDIT_CARD">Cartão de crédito</option><option value="UNDEFINED">A definir</option></select></label>
        <label className={fieldTw}><span>Primeira cobrança</span><input type="date" value={nextDueDate} onChange={e=>setNextDueDate(e.target.value)}/></label>
        <label className={fieldTw}><span>Data final (opcional)</span><input type="date" value={endDate} min={nextDueDate||undefined} onChange={e=>setEndDate(e.target.value)}/></label>
       </div>
      </section>
      {error?<p role="alert" className={errorTw+" fin-wide:col-span-2"}>{error}</p>:null}
      <div className={newSubscriptionFooterTw}><button type="button" className={secondaryButton} disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className={primaryButton} disabled={busy||!canCreate}>{busy?"Criando…":"Criar assinatura"}</button></div>
     </form>
    </div>
   </div>
  </div>,document.body);
}
const FINANCE_TABS=[{id:"overview",label:"Visão geral",icon:LayoutDashboard},{id:"products",label:"Produtos",icon:Package},{id:"charges",label:"Cobranças",icon:Receipt},{id:"subscriptions",label:"Assinaturas",icon:Repeat2},{id:"detached",label:"Avulsas",icon:Zap},{id:"automation",label:"Automação",icon:Workflow},{id:"history",label:"Histórico de avisos",icon:History}] as const;
export type FinanceTab="overview"|"products"|"charges"|"subscriptions"|"detached"|"automation"|"history";
export function FinanceWorkspace({initialTab="products"}:{initialTab?:FinanceTab}={}){
 const [tab,setTab]=useState<FinanceTab>(initialTab);
  useEffect(()=>setTab(initialTab),[initialTab]);
 const [portfolioStatus,setPortfolioStatus]=useState("");
 return <section className={moduleTw}>
  <header className={pageHeadingTw}><div><h1>Financeiro</h1><p className={pageSubtitleTw}>Indicadores e cobranças reais integrados ao Asaas. Nada é estimado sem base.</p></div></header>
  <nav className={tabsTw} aria-label="Áreas do Financeiro">{FINANCE_TABS.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} aria-selected={tab===item.id} className={tab===item.id?tabActiveTw:tabTw} aria-current={tab===item.id?"page":undefined} onClick={()=>setTab(item.id)}><Icon size={15} aria-hidden="true"/>{item.label}</button>})}</nav>
  {tab==="overview"?<ExecutiveOverview onOpenCharges={(status)=>{setPortfolioStatus(status);setTab("charges")}}/>:null}
  {tab==="products"?<CatalogProductsView/>:null}
   {tab==="charges"?<PortfolioView initialStatus={portfolioStatus}/>:null}
  {tab==="subscriptions"||tab==="detached"?<FinanceAsaasListing kind={tab}/>:null}
  {tab==="automation"?<FinanceAutomationWorkspace/>:null}
  {tab==="history"?<FinanceHistoryWorkspace/>:null}
 </section>;
}

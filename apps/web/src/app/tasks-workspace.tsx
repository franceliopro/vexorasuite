"use client";
import { formatDateTimeBR } from "../lib/date-format";
import type { TaskStatusFilter } from "../lib/task-status";
import { useModalDialog } from "../lib/use-modal-dialog";
import {useCallback,useEffect,useRef, useState} from "react";
import {CheckCircle2,ClipboardCheck,Plus,RefreshCw,CalendarClock,X,Bell,Pencil,Trash2} from "lucide-react";
type Step={id:string;label:string;done:boolean};
type Task={id:string;title:string;description:string;status:string;priority:string;complexity:number;dueAt:string|null;completedAt:string|null;steps:Step[];assignee?:{name:string}|null;progress?:number};
type Metrics={total:number;completed:number;completedToday:number;overdue:number;weightedCompleted:number};
type ReminderSettings={enabled:boolean;minutesBefore:number[];sound:boolean;push:boolean;mutedWeekdays:number[];maxPerDay:number};

/** Utilities reaproveitadas desta tela — o padrão TW continua sendo a única fonte. */
const primaryButton="inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton="inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-4 text-body font-bold text-slate-950 transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const iconButton="inline-grid h-control w-control flex-none place-items-center rounded-token-sm border border-gray-200 bg-zinc-100 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50";
const fieldLabel="grid gap-1.5 text-2xs font-extrabold uppercase tracking-wide text-slate-600";
const fieldControl="min-h-10 w-full rounded-token-sm border border-gray-300 bg-zinc-50 px-2.5 py-2 text-body normal-case tracking-normal text-slate-950";
const priorityTone={LOW:"bg-zinc-300 text-slate-600",NORMAL:"bg-blue-50 text-blue-800",HIGH:"bg-amber-100 text-amber-700",URGENT:"bg-red-100 text-red-600"} as const;
const workspaceTabsTw="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-gray-200 bg-zinc-200 p-1";
const workspaceTabTw="min-h-9 shrink-0 rounded-full px-4 text-small font-bold transition-colors";
const workspaceTabClass=(active:boolean)=>workspaceTabTw+" "+(active?"bg-blue-600 text-blue-900 shadow-token-sm":"text-slate-600 hover:bg-zinc-300");
const statusGridTw="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-4";
const statusCardTw="grid min-w-0 content-start gap-1.5 rounded-token border px-4 py-3 text-left shadow-token-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const statusToneTw:Record<string,string>={overdue:"border-red-600/40 bg-red-100 text-red-600",today:"border-emerald-600/40 bg-emerald-100 text-emerald-600",completed:"border-emerald-600/40 bg-emerald-50 text-emerald-700",total:"border-blue-600/40 bg-blue-50 text-blue-800"};
const statusCardClass=(kind:string)=>`${statusCardTw} ${statusToneTw[kind]??statusToneTw.total}`;
const statusTitleTw="flex min-w-0 items-center gap-2 text-small font-extrabold uppercase tracking-wide";
const statusValueTw="text-h2 font-heading tabular-nums";
const statusHintTw="text-2xs leading-snug";
const metaGridTw="grid grid-cols-1 gap-x-3.5 gap-y-1.5 text-small tabular-nums text-slate-600 sm:grid-cols-3";
const metaItemTw="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-ellipsis";
const remindersGridTw="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-tasks-reminders";
const reminderColumnTw="grid min-w-0 content-start gap-1.5";
const chipRowTw="flex min-w-0 flex-wrap gap-1.5";
const chipTw="inline-flex min-h-8 items-center rounded-full border px-3.5 text-2xs font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const chipClass=(active:boolean)=>chipTw+" "+(active?"border-blue-600 bg-blue-600 text-blue-900":"border-gray-300 bg-zinc-200 text-slate-600 hover:bg-zinc-300");
const maxLabelTw="text-2xs font-extrabold uppercase tracking-wide text-slate-600 whitespace-nowrap";
const maxInputTw="w-full min-w-0 max-w-20 rounded-token-sm border border-gray-200 bg-zinc-200 px-2.5 py-1.5 text-body text-slate-950";

function overdueTag(t:Task){
  const due=t.dueAt?new Date(t.dueAt):null;
  if(!due||t.status==="DONE")return null;
  if(due.getTime()<Date.now())return <span className="inline-flex min-h-5 flex-none items-center rounded-full border border-red-600/40 bg-red-100 px-2.5 text-2xs font-extrabold uppercase tracking-wide text-red-600">Atrasada</span>;
  if(due.toDateString()===new Date().toDateString())return <span className="inline-flex min-h-5 flex-none items-center rounded-full border border-amber-600/45 bg-amber-100 px-2.5 text-2xs font-extrabold uppercase tracking-wide text-amber-700">Vence hoje</span>;
  return null;
}
const MINUTE_PRESETS=[5,15,30,60,120,1440];
async function api<T>(path:string,init?:RequestInit):Promise<T>{const r=await fetch("/api/backend/tasks"+path,{...init,cache:"no-store"});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(Array.isArray(data.message)?data.message.join(", "):data.message||"Falha ao acessar tarefas.");return data as T;}
export function TasksWorkspace(){const [editId,setEditId]=useState<string|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]),[metrics,setMetrics]=useState<Metrics|null>(null),[filter,setFilter]=useState<TaskStatusFilter>("active"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[form,setForm]=useState(false),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[priority,setPriority]=useState("NORMAL"),[complexity,setComplexity]=useState(1),[due,setDue]=useState(""),[steps,setSteps]=useState(""),[role,setRole]=useState(""),[reminders,setReminders]=useState<ReminderSettings|null>(null),[remindersLoading,setRemindersLoading]=useState(true),[remindersSaving,setRemindersSaving]=useState(false),[remindersNotice,setRemindersNotice]=useState("");
  const [workspaceTab,setWorkspaceTab]=useState<"Tarefas"|"Lembretes">("Tarefas");
  const canConfigureReminders=["OWNER","ADMIN","MANAGER"].includes(role.toUpperCase());
  useEffect(()=>{let live=true;void Promise.all([fetch("/api/backend/auth/me",{cache:"no-store"}).then(r=>r.json()).catch(()=>null),fetch("/api/backend/reminders/settings",{cache:"no-store"}).then(r=>r.json()).catch(()=>null)]).then(([me,rs])=>{if(!live)return;setRole(typeof me?.role==="string"?me.role:"");setReminders(rs?{enabled:rs.enabled!==false,minutesBefore:Array.isArray(rs.minutesBefore)?rs.minutesBefore:[15,60],sound:rs.sound!==false,push:rs.push!==false,mutedWeekdays:Array.isArray(rs.mutedWeekdays)?rs.mutedWeekdays:[],maxPerDay:typeof rs.maxPerDay==="number"?rs.maxPerDay:15}:{enabled:true,minutesBefore:[15,60],sound:true,push:true,mutedWeekdays:[],maxPerDay:15});}).finally(()=>{if(live)setRemindersLoading(false)});return()=>{live=false};},[]);
  const saveReminders=async(patch:Partial<ReminderSettings>)=>{if(!reminders)return;setRemindersSaving(true);setRemindersNotice("");try{const next={...reminders,...patch};const r=await fetch("/api/backend/reminders/settings",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(next)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.message||"Não foi possível salvar.");setReminders(next);setRemindersNotice("Lembretes salvos para a empresa.");}catch(e){setRemindersNotice(e instanceof Error?e.message:"Não foi possível salvar.");}finally{setRemindersSaving(false);}};
  const modalRef=useRef<HTMLElement|null>(null);
  useModalDialog(form,modalRef,()=>{if(!busy)setForm(false)});
  const load=useCallback(async()=>{setBusy(true);try{const [items,stats]=await Promise.all([api<Task[]>("?status="+filter+"&scope=internal"),api<Metrics>("/metrics")]);setTasks(items);setMetrics(stats);setError("");}catch(e){setError(e instanceof Error?e.message:"Erro ao carregar.");}finally{setBusy(false);}},[filter]);useEffect(()=>{void load();},[load]);
  async function saveTask(){if(!title.trim())return setError("Informe o título da tarefa.");setBusy(true);try{await api(editId?"/"+editId:"",{method:editId?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title,description,priority,complexity,dueAt:due?new Date(due).toISOString():null,steps:steps.split("\n").map(x=>x.trim()).filter(Boolean)})});setForm(false);setEditId(null);setTitle("");setDescription("");setSteps("");setDue("");setPriority("NORMAL");setComplexity(1);await load();}catch(e){setError(e instanceof Error?e.message:"Erro ao salvar tarefa.");}finally{setBusy(false);}}
  function openNew(){setEditId(null);setTitle("");setDescription("");setPriority("NORMAL");setComplexity(1);setDue("");setSteps("");setForm(true)}
  function openEdit(task:Task){setEditId(task.id);setTitle(task.title||"");setDescription(task.description||"");setPriority(task.priority||"NORMAL");setComplexity(task.complexity||1);setDue(task.dueAt?new Date(new Date(task.dueAt).getTime()-new Date(task.dueAt).getTimezoneOffset()*60000).toISOString().slice(0,16):"");setSteps(task.steps.map(s=>s.label).join(String.fromCharCode(10)));setForm(true)}
  async function removeTask(task:Task){if(!window.confirm('Excluir a tarefa "'+task.title+'"?'))return;setBusy(true);try{await api("/"+task.id,{method:"DELETE"});await load();}catch(e){setError(e instanceof Error?e.message:"Falha ao excluir tarefa.");}finally{setBusy(false);}}
  async function toggle(task:Task,step:Step){setBusy(true);try{await api("/"+task.id+"/steps/"+step.id,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({done:!step.done})});await load();}catch(e){setError(e instanceof Error?e.message:"Falha ao marcar etapa.");}finally{setBusy(false);}}
  async function finish(task:Task){setBusy(true);try{await api("/"+task.id+"/complete",{method:"POST"});await load();}catch(e){setError(e instanceof Error?e.message:"Falha ao finalizar.");}finally{setBusy(false);}}
  return <section data-testid="tasks-workspace" className="grid content-start gap-token">
    <header className="flex flex-wrap items-center justify-between gap-3.5">
      <div><h1 className="text-h1 font-heading text-slate-950">Tarefas</h1><p className="mt-0.5 text-small text-slate-600">Checklists, prazos e acompanhamento do trabalho interno da empresa.</p></div>
      <button className={primaryButton} type="button" onClick={openNew}><Plus size={16}/> Nova tarefa</button>
    </header>
    <nav className={workspaceTabsTw} role="tablist" aria-label="Áreas de Tarefas">
      <button id="tasks-tab-tarefas" type="button" role="tab" aria-controls="tasks-tabpanel" aria-selected={workspaceTab==="Tarefas"} className={workspaceTabClass(workspaceTab==="Tarefas")} onClick={()=>setWorkspaceTab("Tarefas")}>Tarefas</button>
      {canConfigureReminders?<button id="tasks-tab-lembretes" type="button" role="tab" aria-controls="reminders-tabpanel" aria-selected={workspaceTab==="Lembretes"} className={workspaceTabClass(workspaceTab==="Lembretes")} onClick={()=>setWorkspaceTab("Lembretes")}>Lembretes</button>:null}
    </nav>
    <div id="tasks-tabpanel" role="tabpanel" aria-labelledby="tasks-tab-tarefas" hidden={workspaceTab!=="Tarefas"} className={workspaceTab==="Tarefas"?"grid content-start gap-token":"hidden"}>
      {metrics?<div className={statusGridTw} aria-label="Resumo e filtros das tarefas" role="group">
        <button type="button" aria-pressed={filter==="overdue"} className={statusCardClass("overdue")} onClick={()=>setFilter("overdue")}><span className={statusTitleTw}><CalendarClock size={16} aria-hidden="true"/> Atrasadas</span><strong className={statusValueTw}>{metrics.overdue}</strong><span className={statusHintTw}>Prazo vencido: ajuste a data ou conclua hoje.</span></button>
        <button type="button" aria-label="Concluídas Hoje" aria-pressed={filter==="doneToday"} className={statusCardClass("today")} onClick={()=>setFilter("doneToday")}><span className={statusTitleTw}><CheckCircle2 size={16} aria-hidden="true"/> Concluídas hoje</span><strong className={statusValueTw}>{metrics.completedToday}</strong><span className={statusHintTw}>Finalizadas desde a meia-noite de hoje.</span></button>
        <button type="button" aria-pressed={filter==="done"} className={statusCardClass("completed")} onClick={()=>setFilter("done")}><span className={statusTitleTw}><CheckCircle2 size={16} aria-hidden="true"/> Concluídas</span><strong className={statusValueTw}>{metrics.completed}</strong><span className={statusHintTw}>Todas as tarefas finalizadas, de qualquer data.</span></button>
        <button type="button" aria-pressed={filter==="all"} className={statusCardClass("total")} onClick={()=>setFilter("all")}><span className={statusTitleTw}><ClipboardCheck size={16} aria-hidden="true"/> Todas</span><strong className={statusValueTw}>{metrics.total}</strong><span className={statusHintTw}>Tarefas internas visíveis para você.</span></button>
      </div>:null}
      {metrics&&metrics.overdue>0?<div className="flex items-center gap-2.5 rounded-token border border-red-600/40 bg-red-100 px-3.5 py-3 text-small font-bold text-red-600" role="alert"><CalendarClock size={15} aria-hidden="true"/> Você tem {metrics.overdue} tarefa(s) atrasada(s). Ajuste o prazo ou conclua-as hoje.</div>:null}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-gray-200 bg-zinc-200 p-1">
          <button aria-pressed={filter==="active"} className={"min-h-8 rounded-full px-3.5 text-small font-bold transition-colors " + (filter==="active" ? "bg-blue-600 text-blue-900 shadow-token-sm" : "text-slate-600 hover:bg-zinc-300")} onClick={()=>setFilter("active")}>Em andamento</button>
          <button aria-pressed={filter==="done"} className={"min-h-8 rounded-full px-3.5 text-small font-bold transition-colors " + (filter==="done" ? "bg-blue-600 text-blue-900 shadow-token-sm" : "text-slate-600 hover:bg-zinc-300")} onClick={()=>setFilter("done")}>Concluídas</button>
        </div>
        <button className={secondaryButton} type="button" onClick={()=>void load()} title="Atualizar"><RefreshCw size={16}/></button>
      </div>
      {error?<p role="alert" className="flex items-center gap-2 rounded-xl border border-red-600/30 bg-red-100 px-3.5 py-3 text-small font-semibold text-red-600">{error}</p>:null}
      <div className="grid gap-2.5">{tasks.map(t=><article className="grid gap-2.5 rounded-token border border-gray-200 bg-zinc-100 p-4 shadow-token transition-colors hover:border-gray-300" key={t.id}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><strong className="text-h3 font-extrabold tracking-tight text-slate-950 break-words">{t.title}</strong><p className="mt-0.5 line-clamp-2 text-small leading-relaxed text-slate-600">{t.description}</p></div>
          <div className="flex flex-none items-center gap-2">
            <span className={"inline-flex min-h-5 items-center rounded-full px-2.5 text-2xs font-extrabold uppercase tracking-wide " + (priorityTone[t.priority as keyof typeof priorityTone] ?? priorityTone.NORMAL)}>{({LOW:"Baixa",NORMAL:"Normal",HIGH:"Alta",URGENT:"Urgente"} as Record<string,string>)[t.priority]||t.priority}</span>
            {overdueTag(t)}
          </div>
        </div>
        <div className={metaGridTw}>
          <span className={metaItemTw}>Complexidade {t.complexity}/5</span>
          {t.assignee?<span className={metaItemTw} title={t.assignee.name}>Responsável: <span className="truncate">{t.assignee.name}</span></span>:null}
          {t.dueAt?<span className={metaItemTw}><CalendarClock size={13} className="shrink-0" aria-hidden="true"/><span className="truncate">{formatDateTimeBR(t.dueAt)}</span></span>:null}
        </div>
        {t.steps.length?<div className="grid gap-1.5">{t.steps.map(s=><label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-zinc-200 px-2.5 py-2 text-small text-slate-950 hover:bg-blue-50"><input type="checkbox" className="h-4 w-4 flex-none accent-blue-600" disabled={busy||t.status==="DONE"} checked={s.done} onChange={()=>void toggle(t,s)}/><span className="min-w-0 truncate">{s.label}</span></label>)}</div>:null}
        <footer className="flex items-center justify-between gap-2.5 border-t border-dashed border-gray-200 pt-2.5">
          {(()=>{const done=t.steps.filter(s=>s.done).length;const pct=typeof t.progress==="number"&&t.steps.length?t.progress:(t.steps.length?Math.round(done/t.steps.length*100):(t.status==="DONE"?100:0));return <div className="grid min-w-0 flex-1 gap-1.5"><small className="text-2xs tabular-nums text-slate-600">{done}/{t.steps.length} etapas · {pct}%</small><div className="h-1.5 overflow-hidden rounded-full border border-gray-200 bg-zinc-300" aria-hidden="true"><span className="block h-full rounded-full bg-linear-to-r from-blue-600 to-blue-50 transition-all duration-bar" style={{width:pct+"%"}}/></div></div>})()}
          <div className="flex flex-none items-center gap-2">
            <button type="button" className={iconButton + " text-slate-600 hover:text-blue-800"} title="Editar tarefa" aria-label="Editar tarefa" onClick={()=>openEdit(t)} disabled={busy}><Pencil size={15}/></button>
            <button type="button" className={iconButton + " text-red-600 hover:bg-red-100"} title="Excluir tarefa" aria-label="Excluir tarefa" onClick={()=>void removeTask(t)} disabled={busy}><Trash2 size={15}/></button>
            {t.status==="DONE"?<span className="inline-flex items-center gap-1.5 text-small font-extrabold text-blue-800"><CheckCircle2 size={16}/> Finalizada</span>:<button type="button" className={primaryButton} disabled={busy||t.steps.some(s=>!s.done)} onClick={()=>void finish(t)}><CheckCircle2 size={15}/> Finalizar tarefa</button>}
          </div>
        </footer>
      </article>)}{!tasks.length?<div className="grid justify-items-center gap-2.5 rounded-token border border-gray-200 bg-zinc-100 p-10 text-slate-600"><ClipboardCheck size={30}/><p>{filter==="active"||filter==="overdue"?"Nenhuma tarefa pendente.":filter==="done"||filter==="doneToday"?"Nenhuma tarefa finalizada.":"Nenhuma tarefa encontrada."}</p></div>:null}</div>
    </div>
    {canConfigureReminders&&reminders?<div id="reminders-tabpanel" role="tabpanel" aria-labelledby="tasks-tab-lembretes" hidden={workspaceTab!=="Lembretes"} className={workspaceTab==="Lembretes"?"grid content-start gap-token":"hidden"}>
      <section className="grid gap-3 rounded-token border border-gray-200 bg-zinc-100 p-4 shadow-token-sm" aria-label="Lembretes de tarefas e compromissos">
        <header className="flex items-center gap-2.5 text-blue-600">
          <Bell size={16} aria-hidden="true"/>
          <div><h2 className="text-h3 font-extrabold text-slate-950">Lembretes</h2><p className="mt-0.5 text-small text-slate-600">Tarefas e compromissos prestes a vencer aparecem como um aviso grande na tela do atendente — com som, se ativado.</p></div>
        </header>
        <div className={remindersGridTw}>
          <div className={reminderColumnTw}>
            <label className="inline-flex items-center gap-2 text-small text-slate-950"><input type="checkbox" className="h-4 w-4 flex-none accent-blue-600" checked={reminders.enabled} disabled={remindersLoading||remindersSaving} onChange={e=>void saveReminders({enabled:e.target.checked})}/> Ativar lembretes para esta empresa</label>
            <label className="inline-flex items-center gap-2 text-small text-slate-950"><input type="checkbox" className="h-4 w-4 flex-none accent-blue-600" checked={reminders.sound} disabled={remindersLoading||remindersSaving} onChange={e=>void saveReminders({sound:e.target.checked})}/> Tocar som ao aparecer</label>
            <label className="inline-flex items-center gap-2 text-small text-slate-950"><input type="checkbox" className="h-4 w-4 flex-none accent-blue-600" checked={reminders.push} disabled={remindersLoading||remindersSaving} onChange={e=>void saveReminders({push:e.target.checked})}/> Permitir aviso por notificação do sistema</label>
          </div>
          <div className={reminderColumnTw}>
            <p className={fieldLabel}>Avisar com antecedência de</p>
            <div className={chipRowTw}>{MINUTE_PRESETS.map(min=>{const active=reminders.minutesBefore.includes(min);return <button key={min} type="button" className={chipClass(active)} disabled={remindersSaving} onClick={()=>{const next=active?reminders.minutesBefore.filter(m=>m!==min):[...reminders.minutesBefore,min].sort((a,b)=>a-b);if(!next.length)return;void saveReminders({minutesBefore:next});}}>{min===1440?"24h":min===120?"2h":min===60?"1h":min+" min"}</button>})}</div>
          </div>
          <div className={reminderColumnTw}>
            <p className={fieldLabel}>Não avisar nestes dias (ex.: fins de semana ou dias sem atendimento)</p>
            <div className={chipRowTw}>{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((label,day)=>{const active=reminders.mutedWeekdays.includes(day);return <button key={label} type="button" className={chipClass(active)} disabled={remindersSaving} onClick={()=>{const next=active?reminders.mutedWeekdays.filter(d=>d!==day):[...reminders.mutedWeekdays,day].sort((a,b)=>a-b);void saveReminders({mutedWeekdays:next})}}>{label}</button>})}</div>
          </div>
          <div className={reminderColumnTw}>
            <p className={maxLabelTw}>Limite de avisos por dia</p>
            <input className={maxInputTw} type="number" min={1} max={50} inputMode="numeric" value={reminders.maxPerDay} disabled={remindersSaving} aria-label="Máximo de avisos por dia" onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=1&&n<=50)void saveReminders({maxPerDay:Math.floor(n)})}}/>
          </div>
          {remindersNotice?<p role="status" className="col-span-full mt-1 text-small text-slate-600">{remindersNotice}</p>:null}
        </div>
      </section>
    </div>:null}
    {form?<div className="fixed inset-0 z-wizard flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setForm(false)}}><section ref={modalRef} tabIndex={-1} className="relative grid max-h-wizard w-full max-w-lg gap-3 overflow-y-auto rounded-token-lg border border-gray-200 bg-zinc-100 p-5 shadow-token-lg" role="dialog" aria-modal="true" aria-label={editId?"Editar tarefa":"Nova tarefa"}>
      <button type="button" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-xl bg-zinc-200 text-slate-600 transition-colors hover:bg-zinc-300" aria-label="Fechar" onClick={()=>{if(!busy)setForm(false)}}><X size={18} aria-hidden="true" /></button>
      <h2 className="text-h2 font-heading text-slate-950">{editId?"Editar tarefa":"Nova tarefa"}</h2>
      <label className={fieldLabel}>Título<input className={fieldControl} value={title} onChange={e=>setTitle(e.target.value)} maxLength={180}/></label>
      <label className={fieldLabel}>Descrição<textarea className={fieldControl} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <label className={fieldLabel}>Prioridade<select className={fieldControl} value={priority} onChange={e=>setPriority(e.target.value)}><option value="LOW">Baixa</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label>
      <label className={fieldLabel}>Complexidade<select className={fieldControl} value={complexity} onChange={e=>setComplexity(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <label className={fieldLabel}>Prazo<input className={fieldControl} type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label>
      <label className={fieldLabel}>Checklist — uma etapa por linha<textarea className={fieldControl} rows={5} value={steps} onChange={e=>setSteps(e.target.value)} placeholder={"Conferir dados\nExecutar procedimento\nValidar resultado"}/></label>
      <div className="flex flex-wrap justify-end gap-2 pt-1"><button className={secondaryButton} onClick={()=>setForm(false)}>Cancelar</button><button className={primaryButton} disabled={busy} onClick={()=>void saveTask()}>{editId?"Salvar alterações":"Criar tarefa"}</button></div>
    </section></div>:null}
  </section>;
}

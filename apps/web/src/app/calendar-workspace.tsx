"use client";
import { formatDateBR, formatDateTimeBR } from "../lib/date-format";
import { useModalDialog } from "../lib/use-modal-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Settings2, Trash2, X } from "lucide-react";
type Account = { id: string; email: string };
type Calendar = { id: string; summary: string; primary?: boolean; backgroundColor?: string; accessRole?: string; selected?: boolean; creator?: { email?: string; displayName?: string } | null };
type Event = { id: string; colorId?: string; summary?: string; description?: string; location?: string; start?: {dateTime?: string;date?: string}; end?: {dateTime?: string;date?: string}; htmlLink?: string; calendarId?: string; calendarColor?: string };
async function request<T>(path:string,init?:RequestInit):Promise<T>{const r=await fetch("/api/backend/integrations/google/calendar/"+path,{...init,cache:"no-store"});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.message||"Não foi possível consultar o Google Agenda.");return body as T;}
function localInput(d:Date){const pad=(n:number)=>String(n).padStart(2,"0");return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());}
const capitalizeFirst=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
const MINUTE_PRESETS=[1,5,10,15,30,60,120,1440] as const;

/** Utilities reaproveitadas desta tela — o padrão TW continua sendo a única fonte. */
const primaryButton="inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton="inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-4 text-body font-bold text-slate-950 transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const iconButton="inline-grid h-control w-control flex-none place-items-center rounded-token-sm border border-gray-200 bg-zinc-100 text-slate-600 transition-colors hover:bg-zinc-200 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50";
const dialogClose="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-xl bg-zinc-200 text-slate-600 transition-colors hover:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const fieldLabel="grid gap-1.5 text-2xs font-extrabold uppercase tracking-wide text-slate-600";
const fieldControl="min-h-10 w-full rounded-token-sm border border-gray-300 bg-zinc-50 px-2.5 py-2 text-body font-normal normal-case tracking-normal text-slate-950";
const minuteChip=(active:boolean)=>"inline-flex min-h-8 items-center rounded-full border px-3.5 text-2xs font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-60 " + (active?"border-blue-600 bg-blue-600 text-blue-900":"border-gray-300 bg-zinc-200 text-slate-600 hover:bg-zinc-300");

export function CalendarWorkspace(){
  const [calendarColumns,setCalendarColumns]=useState<2|3>(()=>{if(typeof window==="undefined")return 2;return window.localStorage.getItem("vexora-calendar-columns")==="3"?3:2});
  const [calendarSplit,setCalendarSplit]=useState(()=>{if(typeof window==="undefined")return 68;const v=Number(window.localStorage.getItem("vexora-calendar-split"));return v>=48&&v<=85?v:68});
  const [accounts,setAccounts]=useState<Account[]>([]),[account,setAccount]=useState(""),[calendars,setCalendars]=useState<Calendar[]>([]),[calendar,setCalendar]=useState("primary"),[events,setEvents]=useState<Event[]>([]),[accountsLoading,setAccountsLoading]=useState(true),[accountsError,setAccountsError]=useState(""),[accountsAttempt,setAccountsAttempt]=useState(0);
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1)),[view,setView]=useState<"month"|"week"|"day">("month"),[selectedDay,setSelectedDay]=useState(()=>new Date()),[busy,setBusy]=useState(false),[error,setError]=useState(""),[editing,setEditing]=useState<Event|null>(null),[formOpen,setFormOpen]=useState(false);
  const modalRef=useRef<HTMLElement|null>(null);
  useModalDialog(formOpen,modalRef,()=>{if(!busy)setFormOpen(false)});
  const [visibleCalendars,setVisibleCalendars]=useState<string[]>([]),[miniMonth,setMiniMonth]=useState(()=>new Date()),[eventCalendar,setEventCalendar]=useState("primary");
  const [directory,setDirectory]=useState<{members:{userId:string;user:{name:string}}[];departments:{id:string;name:string}[]}|null>(null),[assignments,setAssignments]=useState<{id:string;accountId:string;calendarId:string;userId:string|null;departmentId:string|null}[]>([]),[newCalendar,setNewCalendar]=useState(""),[target,setTarget]=useState(""),[calendarManage,setCalendarManage]=useState(false);
  const calendarManageRef=useRef<HTMLElement|null>(null);
  useModalDialog(calendarManage,calendarManageRef,()=>{if(!busy)setCalendarManage(false)});
  const [placeSuggestions,setPlaceSuggestions]=useState<{id:string;label:string}[]>([]),[placeLoading,setPlaceLoading]=useState(false),[placeSelected,setPlaceSelected]=useState(false);
  const [summary,setSummary]=useState(""),[description,setDescription]=useState(""),[location,setLocation]=useState(""),[start,setStart]=useState(""),[end,setEnd]=useState(""),[attendees,setAttendees]=useState(""),[agendaReminders,setAgendaReminders]=useState<Record<string,{enabled:boolean;minutesBefore:number[]}>>({}),[agendaNotice,setAgendaNotice]=useState<string|null>(null),[agendaSaving,setAgendaSaving]=useState(false);
  const loadAgendaReminders=useCallback(async()=>{try{const r=await fetch("/api/backend/reminders/agendas",{cache:"no-store"});const body=await r.json().catch(()=>({}));setAgendaReminders(body?.agendas&&typeof body.agendas==="object"?body.agendas:{});}catch{setAgendaReminders({});}},[]);
  useEffect(()=>{void loadAgendaReminders()},[loadAgendaReminders]);
  useEffect(()=>{let active=true;setAccountsLoading(true);setAccountsError("");void request<Account[]>("accounts").then(a=>{if(!active)return;setAccounts(a);const requested=new URLSearchParams(window.location.search).get("calendarAccount");setAccount(v=>v||(a.some(x=>x.id===requested)?requested!:a[0]?.id||""));}).catch(e=>{if(active)setAccountsError(e instanceof Error?e.message:"Não foi possível carregar as contas do Google Agenda.");}).finally(()=>{if(active)setAccountsLoading(false)});return()=>{active=false};},[accountsAttempt]);
  useEffect(()=>{if(!account)return;void request<{items:Calendar[]}>(encodeURIComponent(account)+"/calendars").then(x=>{setCalendars(x.items||[]);const requested=new URLSearchParams(window.location.search).get("calendarId");const valid=(x.items||[]).some(c=>c.id===requested);setVisibleCalendars(valid?[requested!]:(x.items||[]).filter(a=>a.selected!==false).map(a=>a.id));setCalendar(valid?requested!:x.items?.find(a=>a.primary)?.id||x.items?.[0]?.id||"primary");}).catch(e=>setError(e.message));},[account]);
  const refreshCalendars=useCallback(async()=>{if(!account)return;const x=await request<{items:Calendar[]}>(encodeURIComponent(account)+"/calendars");setCalendars(x.items||[]);setVisibleCalendars((x.items||[]).filter(a=>a.selected!==false).map(a=>a.id));},[account]);
  const agendaKey=account+":"+calendar;
  const agendaCfg=agendaReminders[agendaKey]??{enabled:true,minutesBefore:[15,60]};
  const saveAgendaReminder=async(patch:Partial<{enabled:boolean;minutesBefore:number[]}>)=>{
   if(!account||!calendar)return;
   const next={...agendaCfg,...patch};
   if(next.minutesBefore.length===0)return;
   setAgendaSaving(true);setAgendaNotice(null);
   const previous=agendaReminders;
   const payload={agendas:{...agendaReminders,[agendaKey]:next}};
   setAgendaReminders(payload.agendas);
   try{const r=await fetch("/api/backend/reminders/agendas",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||"Não foi possível salvar os lembretes desta agenda.");setAgendaReminders(d?.agendas||payload.agendas);setAgendaNotice("Lembretes desta agenda salvos.")}catch(e){setAgendaReminders(previous);setAgendaNotice(e instanceof Error?e.message:"Falha ao salvar.")}finally{setAgendaSaving(false)}
  }; async function manage(){setCalendarManage(true);try{const [d,a]=await Promise.all([request<{members:{userId:string;user:{name:string}}[];departments:{id:string;name:string}[]}>("directory"),request<{id:string;accountId:string;calendarId:string;userId:string|null;departmentId:string|null}[]>("assignments")]);setDirectory(d);setAssignments(a);}catch(e){setError(e instanceof Error?e.message:"A gestão de agendas está disponível somente para administradores.");}}
  async function addCalendar(){if(!newCalendar.trim())return;setBusy(true);try{await request(encodeURIComponent(account)+"/calendars",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({summary:newCalendar.trim()})});const created=await request<{items:Calendar[]}>(encodeURIComponent(account)+"/calendars");setCalendars(created.items||[]);setVisibleCalendars((created.items||[]).map(a=>a.id));setNewCalendar("");}catch(e){setError(e instanceof Error?e.message:"Falha ao criar agenda.");}finally{setBusy(false);}}
  async function assignCalendar(){if(!target)return;const [kind,id]=target.split(":");setBusy(true);try{await request("assignments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({accountId:account,calendarId:calendar,...(kind==="user"?{userId:id}:{departmentId:id})})});setAssignments(await request("assignments"));}catch(e){setError(e instanceof Error?e.message:"Falha ao vincular agenda.");}finally{setBusy(false);}}
  async function removeAssignment(id:string){setBusy(true);try{await request("assignments/"+id,{method:"DELETE"});setAssignments(await request("assignments"));}catch(e){setError(e instanceof Error?e.message:"Falha ao remover vínculo.");}finally{setBusy(false);}}
  useEffect(()=>{setPlaceSuggestions([]);setPlaceLoading(false);if(!formOpen||placeSelected||location.trim().length<3)return;let active=true;const controller=new AbortController();const timeout=setTimeout(async()=>{setPlaceLoading(true);try{const response=await fetch("/api/backend/integrations/google/calendar/places?q="+encodeURIComponent(location.trim()),{signal:controller.signal});const data=await response.json();if(active)setPlaceSuggestions(response.ok?data.suggestions||[]:[]);}catch{if(active)setPlaceSuggestions([]);}finally{if(active)setPlaceLoading(false);}},350);return()=>{active=false;clearTimeout(timeout);controller.abort();};},[location,formOpen,placeSelected]);
  const load=useCallback(async()=>{if(!account)return;setBusy(true);setError("");try{const first=new Date(month.getFullYear(),month.getMonth()-1,1),last=new Date(month.getFullYear(),month.getMonth()+2,1);const results=await Promise.allSettled(visibleCalendars.map(async id=>{const params=new URLSearchParams({calendarId:id,timeMin:first.toISOString(),timeMax:last.toISOString()});const x=await request<{items:Event[]}>(encodeURIComponent(account)+"/events?"+params);return (x.items||[]).map(event=>({...event,calendarId:id,calendarColor:calendars.find(a=>a.id===id)?.backgroundColor}));}));setEvents(results.flatMap(r=>r.status==="fulfilled"?r.value:[]));if(results.some(r=>r.status==="rejected"))setError("Algumas agendas não puderam ser carregadas. Verifique as permissões.");}catch(e){setError(e instanceof Error?e.message:"Erro ao carregar eventos.");}finally{setBusy(false);}},[account,calendars,visibleCalendars,month]);
  useEffect(()=>{void load();},[load]);
  function openForm(event?:Event,day?:Date){const d=day||new Date();const from=event?.start?.dateTime?new Date(event.start.dateTime):new Date(d.getFullYear(),d.getMonth(),d.getDate(),9);const to=event?.end?.dateTime?new Date(event.end.dateTime):new Date(from.getTime()+3600000);setEditing(event||null);setEventCalendar(event?.calendarId||calendar);setSummary(event?.summary||"");setDescription(event?.description||"");setLocation(event?.location||"");setPlaceSelected(true);setPlaceSuggestions([]);setStart(localInput(from));setEnd(localInput(to));setAttendees("");setFormOpen(true);}
  async function save(){if(!summary.trim()||!start||!end){setError("Informe título, início e término.");return;}setBusy(true);setError("");try{const payload={summary,description,location,start:new Date(start).toISOString(),end:new Date(end).toISOString(),attendees:attendees.split(",").map(email=>email.trim()).filter(Boolean).map(email=>({email}))};const route=encodeURIComponent(account)+"/events"+(editing?"/"+encodeURIComponent(editing.id):"")+"?calendarId="+encodeURIComponent(eventCalendar);await request(route,{method:editing?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});setFormOpen(false);await load();}catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar.");}finally{setBusy(false);}}
  async function remove(event:Event){if(!window.confirm("Excluir este compromisso do Google Agenda?"))return;setBusy(true);try{await request(encodeURIComponent(account)+"/events/"+encodeURIComponent(event.id)+"?calendarId="+encodeURIComponent(event.calendarId||calendar),{method:"DELETE"});setFormOpen(false);await load();}catch(e){setError(e instanceof Error?e.message:"Não foi possível excluir.");}finally{setBusy(false);}}
  const today=new Date(),daysInMonth=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(),offset=new Date(month.getFullYear(),month.getMonth(),1).getDay();const days=Array.from({length:Math.ceil((offset+daysInMonth)/7)*7},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i-offset+1));
  const visibleEvents=events.filter(e=>{const raw=e.start?.dateTime||e.start?.date;if(!raw)return false;const d=new Date(raw);if(view==="day")return d.toDateString()===selectedDay.toDateString();if(view==="week"){const first=new Date(selectedDay);first.setDate(first.getDate()-first.getDay());const last=new Date(first);last.setDate(last.getDate()+7);return d>=first&&d<last;}return d.getMonth()===month.getMonth()&&d.getFullYear()===month.getFullYear();}).sort((a,b)=>new Date(a.start?.dateTime||a.start?.date||"").getTime()-new Date(b.start?.dateTime||b.start?.date||"").getTime());
  const accountEmail = accounts.find(a=>a.id===account)?.email || "";
  function initialsOf(v: string) { const parts = v.trim().split(/\s+/).filter(Boolean); if (parts.length === 0) return "?"; if (parts.length === 1) return parts[0]!.slice(0,2).toUpperCase(); return (parts[0]![0]! + parts[parts.length-1]![0]!).toUpperCase(); }

  return <section data-testid="calendar-workspace" className="grid w-full min-w-0 content-start gap-token">
    {accountsLoading ? <section role="status" className="grid justify-items-center gap-2.5 rounded-token border border-gray-200 bg-zinc-100 p-10 text-center shadow-token">
      <CalendarDays size={32} className="text-blue-600" aria-hidden="true"/>
      <p className="text-small text-slate-600">Carregando contas do Google Agenda…</p>
    </section> : accountsError ? <section role="alert" className="grid justify-items-center gap-2.5 rounded-token border border-red-600/30 bg-red-100 p-10 text-center shadow-token">
      <CalendarDays size={32} className="text-red-600" aria-hidden="true"/>
      <p className="text-small text-slate-600">{accountsError}</p>
      <button type="button" className={secondaryButton} onClick={()=>setAccountsAttempt(value=>value+1)}>Tentar novamente</button>
    </section> : !accounts.length ? <section className="grid justify-items-center gap-2.5 rounded-token border border-gray-200 bg-zinc-100 p-10 text-center shadow-token">
      <CalendarDays size={32} className="text-blue-600" aria-hidden="true"/>
      <h2 className="text-h2 font-extrabold text-slate-950">Conecte o Google Agenda</h2>
      <p className="max-w-calendar-copy text-small leading-relaxed text-slate-600">Autorize uma conta em Conexões para visualizar e criar compromissos reais.</p>
      <a href="/?module=Canais%20e%20integra%C3%A7%C3%B5es" className="inline-flex min-h-9 items-center rounded-full border border-blue-600/40 bg-blue-50 px-4 text-small font-extrabold text-blue-800 transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Ir para integrações</a>
    </section> : <section className="grid gap-token rounded-token border border-gray-200 bg-zinc-100 p-4 shadow-token">
      <div className="grid grid-cols-calendar-layout items-start gap-token">
        <aside className="grid min-w-0 content-start gap-3 rounded-token border border-gray-200 bg-zinc-200 p-3.5 shadow-token-sm">
          <div className="flex items-center justify-between gap-1.5">
            <button type="button" aria-label="Mês anterior" onClick={()=>setMiniMonth(new Date(miniMonth.getFullYear(),miniMonth.getMonth()-1,1))} className={iconButton + " h-7 w-7"}><ChevronLeft size={15}/></button>
            <strong className="text-h3 font-extrabold text-slate-950">{capitalizeFirst(miniMonth.toLocaleDateString("pt-BR",{month:"long",year:"numeric"}))}</strong>
            <button type="button" aria-label="Mês seguinte" onClick={()=>setMiniMonth(new Date(miniMonth.getFullYear(),miniMonth.getMonth()+1,1))} className={iconButton + " h-7 w-7"}><ChevronRight size={15}/></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-2xs text-slate-600">
            {["D","S","T","Q","Q","S","S"].map((d,i)=><small key={i} className="py-0.5 text-center text-2xs font-extrabold uppercase tracking-widest text-slate-600">{d}</small>)}
            {Array.from({length:42},(_,i)=>{
              const d=new Date(miniMonth.getFullYear(),miniMonth.getMonth(),i-new Date(miniMonth.getFullYear(),miniMonth.getMonth(),1).getDay()+1);
              const isSelected=d.toDateString()===selectedDay.toDateString();
              const isToday=d.toDateString()===today.toDateString()&&!isSelected;
              return <button key={i} type="button" className={"grid aspect-square min-h-0 place-items-center rounded-xl text-2xs transition-colors hover:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " + (isSelected?"bg-blue-600 font-extrabold text-blue-900 shadow-token-sm":isToday?"font-extrabold text-blue-800 ring-1 ring-inset ring-blue-600/50":"text-slate-950")} onClick={()=>{setSelectedDay(d);setMonth(new Date(d.getFullYear(),d.getMonth(),1));setView("day");}}>{d.getDate()}</button>;
            })}
          </div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-2xs font-extrabold uppercase tracking-nav-section text-slate-600">Minhas agendas</h3>
            <button type="button" className="grid h-9 w-9 flex-none place-items-center rounded-token-sm border border-gray-200 bg-zinc-100 text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" title="Gerenciar agendas" aria-label="Gerenciar agendas" onClick={()=>void manage()}><Settings2 size={17} aria-hidden="true"/></button>
          </div>
          <div className="grid gap-1.5">
            {calendars.map(a=>{
              const mine=!!a.creator?.email&&a.creator.email.toLowerCase()===accountEmail.toLowerCase();
              return <label key={a.id} className="flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-small text-slate-950 transition-colors hover:bg-zinc-300">
                <input type="checkbox" className="h-4 w-4 flex-none accent-blue-600" checked={visibleCalendars.includes(a.id)} onChange={e=>setVisibleCalendars(v=>e.target.checked?[...v,a.id]:v.filter(id=>id!==a.id))}/>
                <span className={"grid h-6 w-6 flex-none place-items-center rounded-token-sm text-2xs font-extrabold " + (mine?"bg-blue-50 text-blue-800":"bg-zinc-200 text-slate-600")}>{initialsOf(a.summary||"")}</span>
                <span className="min-w-0 truncate" title={a.summary}>{a.summary}</span>
                {mine?<small className="ml-auto flex-none rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-extrabold uppercase tracking-wide text-blue-800">Criador</small>:null}
              </label>;
            })}
          </div>
          <button type="button" className="inline-flex min-h-8 w-max items-center gap-1.5 rounded-token-sm px-1 text-small font-bold text-blue-800 transition-colors hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={()=>void refreshCalendars()}><RefreshCw size={13}/> Sincronizar agendas</button>
          <small className="text-2xs leading-relaxed text-slate-600">Agendas compartilhadas aparecem conforme as permissões da conta.</small>
        </aside>
        <div className="grid min-w-0 gap-token">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-gray-200 pb-3">
            <label className="flex flex-none items-center gap-2 text-2xs font-extrabold uppercase tracking-nav-section text-slate-600">Layout <select aria-label="Colunas do calendário" value={calendarColumns} onChange={e=>{const v=Number(e.target.value) as 2|3;setCalendarColumns(v);window.localStorage.setItem("vexora-calendar-columns",String(v))}} className="max-w-calendar-select min-h-8 appearance-none rounded-xl border border-gray-200 bg-zinc-200 px-2.5 text-small font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"><option value={2}>2 colunas</option><option value={3}>3 colunas</option></select></label>
            {accounts.length>1?<select aria-label="Conta Google" value={account} onChange={e=>setAccount(e.target.value)} className="max-w-calendar-select min-h-8 appearance-none rounded-xl border border-gray-200 bg-zinc-200 px-2.5 text-small font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{accounts.map(a=><option key={a.id} value={a.id}>{a.email}</option>)}</select>:null}
            {calendars.length>1?<select aria-label="Calendário" value={calendar} onChange={e=>setCalendar(e.target.value)} className="max-w-calendar-select min-h-8 appearance-none rounded-xl border border-gray-200 bg-zinc-200 px-2.5 text-small font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{calendars.map(a=><option key={a.id} value={a.id}>{a.summary}</option>)}</select>:null}
            <div className="ml-auto flex flex-none items-center gap-1">
              <button type="button" aria-label="Anterior" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} className={iconButton + " h-8 w-8"}><ChevronLeft size={18}/></button>
              <strong className="min-w-calendar-month text-center text-small font-extrabold text-slate-950">{capitalizeFirst(month.toLocaleDateString("pt-BR",{month:"long",year:"numeric"}))}</strong>
              <button type="button" aria-label="Próximo" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} className={iconButton + " h-8 w-8"}><ChevronRight size={18}/></button>
            </div>
            <div className="inline-flex flex-none gap-0.5 rounded-full border border-gray-200 bg-zinc-200 p-0.5" role="tablist" aria-label="Visualização">
              <button type="button" role="tab" aria-selected={view==="month"} className={"min-h-7 rounded-full px-3 text-small font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " + (view==="month"?"bg-zinc-100 text-slate-950 shadow-token-sm":"text-slate-600 hover:text-slate-950")} onClick={()=>setView("month")}>Mês</button>
              <button type="button" role="tab" aria-selected={view==="week"} className={"min-h-7 rounded-full px-3 text-small font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " + (view==="week"?"bg-zinc-100 text-slate-950 shadow-token-sm":"text-slate-600 hover:text-slate-950")} onClick={()=>setView("week")}>Semana</button>
              <button type="button" role="tab" aria-selected={view==="day"} className={"min-h-7 rounded-full px-3 text-small font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " + (view==="day"?"bg-zinc-100 text-slate-950 shadow-token-sm":"text-slate-600 hover:text-slate-950")} onClick={()=>setView("day")}>Dia</button>
            </div>
            <button type="button" className={iconButton + " flex-none"} onClick={()=>void load()} disabled={busy} aria-label="Atualizar compromissos"><RefreshCw size={16}/></button>
            <button type="button" className={primaryButton + " flex-none"} onClick={()=>openForm()}><Plus size={16}/> Novo compromisso</button>
          </div>
          <div className="grid min-w-0 items-start gap-token" style={{gridTemplateColumns:calendarColumns===3?`minmax(0,${calendarSplit}fr) 6px minmax(250px,${100-calendarSplit}fr)`:"minmax(0,1fr)"}}>
            <div className="grid grid-cols-7 overflow-hidden rounded-token border border-gray-200 bg-zinc-100 shadow-token-sm">
              {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div key={d} className="border-b border-gray-200 bg-zinc-200 px-1 py-2 text-center text-2xs font-extrabold uppercase tracking-widest text-slate-600">{d}</div>)}
              {days.map((day,i)=>{
                const items=events.filter(e=>{const raw=e.start?.dateTime||e.start?.date;return raw&&new Date(raw).toDateString()===day.toDateString();});
                const isToday=day.toDateString()===today.toDateString();
                const weekend=day.getDay()===0||day.getDay()===6;
                const outside=day.getMonth()!==month.getMonth();
                return <button type="button" key={i} className={"flex min-h-calendar-day min-w-0 flex-col items-center gap-0.5 border-r border-t border-gray-200 px-1 py-1.5 text-center transition-colors last:border-r-0 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus " + (outside?"bg-zinc-200 ":"") + (weekend?"bg-zinc-100 ":"") + (isToday?"bg-blue-50 ":"")} onClick={()=>{setSelectedDay(day);setView("day");}} onDoubleClick={()=>openForm(undefined,day)} title="Clique duas vezes para criar compromisso">
                  <span className={"grid h-6 w-6 place-items-center rounded-full text-2xs font-bold tabular-nums " + (isToday?"bg-blue-600 font-extrabold text-blue-900 shadow-token-sm":"text-slate-600")}>{day.getDate()}</span>
                  {items.slice(0,3).map(e=><small key={e.id} onDoubleClick={ev=>{ev.stopPropagation();openForm(e);}} className={"block w-full truncate rounded-token-sm border-l-calendar-event px-1.5 py-0.5 text-left text-2xs font-semibold leading-tight " + (e.calendarColor?"":"border-l-sky-600 bg-sky-100")} style={e.calendarColor?{borderLeftColor:e.calendarColor,backgroundColor:e.calendarColor+"30"}:undefined} title="Clique duas vezes para editar compromisso">{e.summary||"Sem título"}</small>)}
                  {items.length>3?<span className="mt-auto w-max rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-extrabold text-blue-800">+{items.length-3}</span>:null}
                </button>;
              })}
            </div>
            {calendarColumns===3?<div className="h-full w-calendar-handle cursor-col-resize rounded-full bg-zinc-300 transition-colors hover:bg-blue-600 focus-visible:bg-blue-600 focus-visible:outline-none" role="separator" aria-label="Ajustar largura do calendário" aria-orientation="vertical" tabIndex={0} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();setCalendarSplit(v=>{const n=Math.max(48,Math.min(85,v+(e.key==="ArrowRight"?3:-3)));window.localStorage.setItem("vexora-calendar-split",String(n));return n})}}} onPointerDown={e=>{const el=e.currentTarget.parentElement;if(!el)return;const rect=el.getBoundingClientRect();const move=(ev:PointerEvent)=>{const n=Math.max(48,Math.min(85,Math.round((ev.clientX-rect.left)/rect.width*100)));setCalendarSplit(n);window.localStorage.setItem("vexora-calendar-split",String(n))};const end=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end)};window.addEventListener("pointermove",move);window.addEventListener("pointerup",end)}}/>:null}
            <div className="grid gap-1.5">
              <h2 className="text-2xs font-extrabold uppercase tracking-nav-section text-slate-600">{view==="day"?"Compromissos de "+formatDateBR(selectedDay):view==="week"?"Compromissos da semana":"Compromissos do mês"} ({visibleEvents.length})</h2>
              {visibleEvents.length?visibleEvents.map(e=><button type="button" className="grid w-full grid-cols-calendar-event items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-gray-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" key={e.id} onClick={()=>openForm(e)}>
                <span className="min-w-calendar-event-date text-2xs tabular-nums text-slate-600">{formatDateBR(e.start?.dateTime||e.start?.date||"")}</span>
                <span className="h-2 w-2 flex-none rounded-full" style={{background:e.calendarColor||"var(--accent2)"}}/>
                <strong className="min-w-0 truncate text-small font-bold text-slate-950">{e.summary||"Sem título"}</strong>
                <small className="max-w-calendar-chip truncate rounded-full bg-zinc-300 px-2 py-0.5 text-2xs font-bold text-slate-600">{calendars.find(a=>a.id===e.calendarId)?.summary||""}</small>
                <span className="whitespace-nowrap text-2xs tabular-nums text-slate-600">{formatDateTimeBR(e.start?.dateTime||e.start?.date||"")}</span>
                <span className="whitespace-nowrap text-2xs text-slate-600">{e.location||""}</span>
              </button>):<p className="text-small text-slate-600">Nenhum compromisso neste período.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>}
    {error?<p role="alert" className="flex items-center gap-2 rounded-xl border border-red-600/30 bg-red-100 px-3.5 py-3 text-small font-semibold text-red-600">{error}</p>:null}
    {calendarManage?<div className="fixed inset-0 z-wizard flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setCalendarManage(false)}}>
      <section ref={calendarManageRef} tabIndex={-1} className="relative grid max-h-calendar-modal w-full max-w-calendar-modal content-start gap-3 overflow-y-auto rounded-token border border-gray-200 bg-zinc-100 p-5 shadow-token-lg" role="dialog" aria-modal="true" aria-label="Gerenciar agendas">
        <button type="button" className={dialogClose} aria-label="Fechar" onClick={()=>{if(!busy)setCalendarManage(false)}}><X size={18} aria-hidden="true"/></button>
        <div><h2 className="text-h2 font-heading text-slate-950">Gerenciar agendas</h2></div>
        <p className="text-small text-slate-600">Crie uma agenda no Google ou vincule a agenda selecionada a um agente ou equipe.</p>
        {error&&<p role="alert" className="rounded-xl border border-red-600/30 bg-red-100 px-3 py-2.5 text-small font-semibold text-red-600">{error}</p>}
        <label className={fieldLabel}>Nova agenda<input className={fieldControl} value={newCalendar} onChange={e=>setNewCalendar(e.target.value)} placeholder="Ex.: Equipe Suporte"/></label>
        <button type="button" className={secondaryButton} disabled={busy||!newCalendar.trim()} onClick={()=>void addCalendar()}><Plus size={14} aria-hidden="true"/> Criar agenda no Google</button>
        {!directory&&<p className="text-small text-slate-600" role="status">Carregando agentes e equipes vinculáveis…</p>}
        {directory?<>
          <section className="grid gap-2.5 rounded-token border border-gray-200 bg-zinc-100 p-4 shadow-token-sm" aria-label="Lembretes desta agenda">
            <header className="flex items-center gap-3 text-blue-600"><Bell size={18} aria-hidden="true"/><div><h3 className="text-h3 font-extrabold text-slate-950">Lembretes desta agenda</h3><p className="mt-0.5 max-w-calendar-copy text-small leading-relaxed text-slate-600">Avisos exibidos na tela — separados desta agenda. Desligue para silenciar compromissos dela.</p></div></header>
            <label className="inline-flex items-center gap-2 text-small text-slate-950"><input type="checkbox" className="h-4 w-4 flex-none accent-blue-600" checked={agendaCfg.enabled} disabled={agendaSaving||!calendar} onChange={e=>void saveAgendaReminder({enabled:e.target.checked})}/> Ativar lembretes desta agenda</label>
            <p className={fieldLabel}>Avisar com antecedência de</p>
            <div className="flex flex-wrap gap-1.5">{MINUTE_PRESETS.map(min=>{const active=agendaCfg.minutesBefore.includes(min);return <button key={min} type="button" className={minuteChip(active)} disabled={agendaSaving} onClick={()=>{const next=active?agendaCfg.minutesBefore.filter(m=>m!==min):[...agendaCfg.minutesBefore,min].sort((a,b)=>a-b);if(!next.length)return;void saveAgendaReminder({minutesBefore:next})}}>{min===1440?"24h":min===60?"1h":min+" min"}</button>})}</div>
            {agendaNotice?<p role="status" className="text-small text-slate-600">{agendaNotice}</p>:null}
          </section>
          <label className={fieldLabel}>Agenda<select className={fieldControl} value={calendar} onChange={e=>setCalendar(e.target.value)}>{calendars.map(a=><option key={a.id} value={a.id}>{a.summary}</option>)}</select></label>
          <label className={fieldLabel}>Vincular a<select className={fieldControl} value={target} onChange={e=>setTarget(e.target.value)}><option value="">Escolha agente ou equipe</option><optgroup label="Agentes">{directory.members.map(m=><option key={m.userId} value={"user:"+m.userId}>{m.user.name}</option>)}</optgroup><optgroup label="Equipes">{directory.departments.map(d=><option key={d.id} value={"department:"+d.id}>{d.name}</option>)}</optgroup></select></label>
          <button type="button" className={primaryButton} disabled={busy||!target} onClick={()=>void assignCalendar()}>Vincular agenda</button>
          <div className="grid gap-1.5">{assignments.filter(a=>a.accountId===account).map(a=><div key={a.id} className="flex items-center justify-between gap-2.5 rounded-xl border border-gray-200 bg-zinc-200 px-3 py-2 text-small text-slate-600"><span className="min-w-0 truncate">{calendars.find(x=>x.id===a.calendarId)?.summary||a.calendarId} · {a.userId?directory.members.find(m=>m.userId===a.userId)?.user.name||"Agente":directory.departments.find(d=>d.id===a.departmentId)?.name||"Equipe"}</span><button type="button" className="inline-flex min-h-8 flex-none items-center rounded-token-sm px-2.5 font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60" disabled={busy} onClick={()=>void removeAssignment(a.id)}>Remover</button></div>)}</div>
        </>:null}
      </section>
    </div>:null}
    {formOpen?<div className="fixed inset-0 z-wizard flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setFormOpen(false)}}>
      <section ref={modalRef} tabIndex={-1} className="relative grid max-h-calendar-event-modal w-full max-w-calendar-event-modal content-start gap-3 overflow-y-auto rounded-token border border-gray-200 bg-zinc-100 p-5 shadow-token-lg" role="dialog" aria-modal="true" aria-label="Compromisso">
        <button type="button" className={dialogClose} aria-label="Fechar" onClick={()=>{if(!busy)setFormOpen(false)}}><X size={18} aria-hidden="true"/></button>
        <h2 className="text-h2 font-heading text-slate-950">{editing?"Editar compromisso":"Novo compromisso"}</h2>
        <label className={fieldLabel}>Título<input className={fieldControl} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
        <label className={fieldLabel}>Início<input className={fieldControl} type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label className={fieldLabel}>Término<input className={fieldControl} type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
        <div className="grid min-w-0 gap-1.5">
          <label className={fieldLabel}>Local<input className={fieldControl} value={location} autoComplete="off" placeholder="Digite um endereço" onChange={e=>{setLocation(e.target.value);setPlaceSelected(false);}}/></label>
          {placeLoading?<small className="text-2xs text-slate-600">Buscando endereços…</small>:null}
          {placeSuggestions.length?<div className="grid gap-1.5" role="listbox" aria-label="Sugestões de endereços">{placeSuggestions.map(place=><button type="button" key={place.id} role="option" aria-selected={false} className="rounded-token-sm border border-gray-200 bg-zinc-200 px-2.5 py-2 text-left text-small text-slate-950 transition-colors hover:bg-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={()=>{setLocation(place.label);setPlaceSelected(true);setPlaceSuggestions([]);}}>{place.label}</button>)}</div>:null}
          {location.trim()&&<div className="flex flex-wrap items-center gap-3 text-small">
            {!placeSelected&&<button type="button" className="inline-flex min-h-8 items-center px-1.5 font-bold text-blue-600 hover:underline" onClick={()=>setPlaceSelected(true)}>Ver no mapa</button>}
            <a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(location.trim())} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">Abrir no Google Maps</a>
          </div>}
          {placeSelected&&location.trim()&&<iframe title="Prévia do local no mapa" loading="lazy" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer-when-downgrade" src={"https://maps.google.com/maps?q="+encodeURIComponent(location.trim())+"&output=embed"} className="h-calendar-map w-full rounded-token border border-gray-200 bg-zinc-200"/>}
        </div>
        <label className={fieldLabel}>Agenda<select className={fieldControl} value={eventCalendar} onChange={e=>setEventCalendar(e.target.value)}>{calendars.filter(a=>a.accessRole!=="reader"&&a.accessRole!=="freeBusyReader").map(a=><option key={a.id} value={a.id}>{a.summary}</option>)}</select></label>
        <label className={fieldLabel}>Convidados (e-mails separados por vírgula)<input className={fieldControl} value={attendees} onChange={e=>setAttendees(e.target.value)} placeholder="pessoa@empresa.com, outra@empresa.com"/></label>
        <label className={fieldLabel}>Descrição<textarea className={fieldControl} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        <div className="flex flex-wrap justify-end gap-2 pt-1"><button type="button" className={secondaryButton} onClick={()=>setFormOpen(false)}>Cancelar</button>{editing?<button type="button" className={secondaryButton} disabled={busy} onClick={()=>void remove(editing)}><Trash2 size={16}/> Excluir</button>:null}<button type="button" className={primaryButton} disabled={busy} onClick={()=>void save()}>{busy?"Salvando…":"Salvar no Google"}</button></div>
      </section>
    </div>:null}
  </section>;
}

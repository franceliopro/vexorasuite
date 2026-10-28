"use client";
import { formatDateTimeBR, formatTimeBR } from "../lib/date-format";
import {useEffect,useRef,useState} from 'react';
type Account={id:string;email:string};
type Calendar={id:string;summary:string;accessRole?:string};
type Event={id:string;summary?:string;status?:string;transparency?:string;start?:{date?:string;dateTime?:string};end?:{date?:string;dateTime?:string}};
async function api<T>(path:string,body?:unknown):Promise<T>{const r=await fetch('/api/backend/integrations/google/calendar/'+path,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'Não foi possível consultar a agenda.');return d;}
function localDay(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
export function InboxAppointments({contact,onConfirm}:{contact:{id:string;name:string;phone?:string|null};onConfirm:(text:string)=>void}){
 const [accounts,setAccounts]=useState<Account[]>([]),[account,setAccount]=useState(''),[calendars,setCalendars]=useState<Calendar[]>([]),[calendar,setCalendar]=useState(''),[events,setEvents]=useState<Event[]>([]),[day,setDay]=useState(localDay),[start,setStart]=useState('09:00'),[end,setEnd]=useState('10:00'),[title,setTitle]=useState('Atendimento · '+contact.name),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState<{id:string;start:string;end:string;title:string}|null>(null);
 const version=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false};},[]);
 useEffect(()=>{let active=true;void api<Account[]>('accounts').then(rows=>{if(active){setAccounts(rows);setAccount(rows[0]?.id||'');}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false};},[]);
 useEffect(()=>{let active=true;setCalendars([]);setCalendar('');if(!account)return;void api<{items?:Calendar[]}>(encodeURIComponent(account)+'/calendars').then(d=>{if(active){const rows=d.items||[];setCalendars(rows);setCalendar(rows[0]?.id||'');}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false};},[account]);
 async function readDay(){
  const from=new Date(day+'T00:00:00'),to=new Date(from);to.setDate(to.getDate()+1);
  const params=new URLSearchParams({calendarId:calendar,timeMin:from.toISOString(),timeMax:to.toISOString()});
  const d=await api<{items?:Event[];nextPageToken?:string}>(encodeURIComponent(account)+'/events?'+params);
  if(d.nextPageToken)throw Error('Há mais compromissos do que esta consulta consegue mostrar. Consulte a agenda completa.');
  return (d.items||[]).filter(e=>e.status!=='cancelled').sort((a,b)=>Date.parse(a.start?.dateTime||a.start?.date||'')-Date.parse(b.start?.dateTime||b.start?.date||''));
 }
 useEffect(()=>{const current=++version.current;setEvents([]);setError('');if(!account||!calendar||!day)return;setLoading(true);void readDay().then(rows=>{if(current===version.current)setEvents(rows)}).catch(e=>{if(current===version.current)setError(e.message)}).finally(()=>{if(current===version.current)setLoading(false)});return()=>{version.current++};},[account,calendar,day]);
 const writable=['owner','writer'].includes(calendars.find(c=>c.id===calendar)?.accessRole||'');
 const display=(v?:string)=>v?new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Dia inteiro';
 async function save(){
  const from=new Date(day+'T'+start),to=new Date(day+'T'+end);
  if(!title.trim()||!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||to<=from||from<new Date()){setError('Informe um título e um horário futuro com término após o início.');return;}
  setBusy(true);setError('');
  try{
   const fresh=await readDay();if(!mounted.current)return;setEvents(fresh);
   if(fresh.some(e=>e.transparency!=='transparent'&&new Date(e.start?.dateTime||(e.start?.date?e.start.date+'T00:00:00':'')).getTime()<to.getTime()&&new Date(e.end?.dateTime||(e.end?.date?e.end.date+'T00:00:00':'')).getTime()>from.getTime()))throw Error('Esse intervalo já possui um compromisso. Escolha outro horário.');
   const event=await api<Event>(encodeURIComponent(account)+'/events?'+new URLSearchParams({calendarId:calendar}),{summary:title.trim(),description:'Cliente: '+contact.name+(contact.phone?'\nTelefone: '+contact.phone:'')+'\nContato Véxora: '+contact.id,start:from.toISOString(),end:to.toISOString()});
   if(!event.id)throw Error('A agenda não confirmou o agendamento. Atualize antes de repetir.');
   if(mounted.current){setSaved({id:event.id,start:from.toISOString(),end:to.toISOString(),title:title.trim()});try{setEvents(await readDay());}catch{setError('Agendamento salvo; não foi possível atualizar a lista.');}}
  }catch(e){if(mounted.current)setError((e instanceof Error?e.message:'Não foi possível confirmar.')+' Confira a agenda antes de tentar novamente.');}
  finally{if(mounted.current)setBusy(false);}
 }
 return <div className="inbox-appointments ai-admin-fields">
 <p>Cliente: <strong>{contact.name}</strong></p><small>Horários em {Intl.DateTimeFormat().resolvedOptions().timeZone}.</small>
 {error&&<p role="alert">{error}</p>}
 {!loading&&!accounts.length?<p>Conecte uma conta Google Agenda em Canais e integrações. O atendimento pode continuar normalmente.</p>:<>
 <label>Conta<select disabled={busy} value={account} onChange={e=>setAccount(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.email}</option>)}</select></label>
 <label>Agenda<select disabled={busy} value={calendar} onChange={e=>setCalendar(e.target.value)}>{calendars.map(c=><option key={c.id} value={c.id}>{c.summary}</option>)}</select></label>
 <label>Consultar dia<input type="date" required value={day} disabled={busy} onChange={e=>{setDay(e.target.value);setSaved(null)}}/></label>
 <h3>Compromissos do dia</h3>{loading?<p>Consultando…</p>:events.length?<ul>{events.map(e=><li key={e.id}>{display(e.start?.dateTime)}{e.end?.dateTime?' – '+display(e.end.dateTime):''} · {e.summary||'Compromisso'}</li>)}</ul>:calendar&&!error?<p>Nenhum compromisso encontrado nesta agenda neste dia.</p>:null}
 {saved?<section className="content-card"><strong>Agendamento confirmado na agenda</strong><p>{saved.title} · {formatDateTimeBR(saved.start)}</p><button type="button" className="primary-button" onClick={()=>onConfirm('Olá, '+contact.name+'! Seu agendamento de '+saved.title+' está confirmado para '+new Date(saved.start).toLocaleString('pt-BR')+' até '+formatTimeBR(saved.end)+'.')}>Preparar confirmação na conversa</button><small>Você revisa o texto e clica em Enviar.</small><button type="button" className="text-button" onClick={()=>setSaved(null)}>Novo agendamento</button></section>:<>
 <label>Título<input maxLength={200} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)}/></label>
 <div className="inbox-appointment-times"><label>Início<input type="time" value={start} disabled={busy} onChange={e=>setStart(e.target.value)}/></label><label>Término<input type="time" value={end} disabled={busy} onChange={e=>setEnd(e.target.value)}/></label></div>
 <button type="button" className="primary-button" disabled={busy||loading||!calendar||!writable} onClick={()=>void save()}>{busy?'Salvando…':'Confirmar agendamento'}</button>
 {calendar&&!writable&&<small>Esta agenda está disponível somente para consulta.</small>}
 </>}</>}
 </div>;
}

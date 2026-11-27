"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Building2,Plus,ChevronDown,X} from 'lucide-react';
type Company={id:string;name:string;slug:string;kind?:string};
const iconButtonTw='inline-grid size-9 place-items-center rounded-token-sm border border-line bg-surface text-ink shadow-token-sm transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60';
const primaryTw='inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryTw='inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60';
const topbarButtonTw='topbar-company-button inline-flex min-h-control items-center gap-2 whitespace-nowrap rounded-token-sm border border-gray-200 bg-surface-2 px-3.5 text-nav font-bold text-ink shadow-token-sm transition-control duration-control hover:-translate-y-px hover:border-gray-500 hover:bg-hover';
// Portal + fixed: o topbar tem backdrop-filter, que transformaria um `fixed` interno em relativo ao topbar.
const dropdownTw='tenant-anchor-dropdown fixed z-[1100] grid gap-2 rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg';
const dialogHeaderTw='flex min-w-0 items-center justify-between gap-3 pr-1';
const companyListTw='grid max-h-60 gap-2 overflow-y-auto pr-1';
const companyOptionTw='flex w-full items-center gap-3 rounded-token border border-line bg-surface-2 px-3 py-2.5 text-left text-ink transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60';
const actionsTw='flex flex-wrap items-center gap-2';
export function CompanySwitcher({current,canCreate=false}:{current:Company;canCreate?:boolean}){
  const [companies,setCompanies]=useState<Company[]>([]),[segments,setSegments]=useState<{id:string;name:string}[]>([]),[open,setOpen]=useState(false),[creating,setCreating]=useState(false),[platforms,setPlatforms]=useState(''),[name,setName]=useState(''),[segmentId,setSegmentId]=useState('vehicle-tracking'),[requestId]=useState(()=>crypto.randomUUID()),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const anchorRef=useRef<HTMLButtonElement>(null),panelRef=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState({left:0,top:0});
  const place=useCallback(()=>{
    const anchor=anchorRef.current,panel=panelRef.current;
    if(!anchor||!panel)return;
    const rect=anchor.getBoundingClientRect(),size=panel.getBoundingClientRect(),margin=8;
    const left=Math.max(margin,Math.min(rect.right-size.width,window.innerWidth-size.width-margin));
    const below=rect.bottom+margin,above=rect.top-size.height-margin;
    const top=below+size.height>window.innerHeight-margin&&above>=margin?above:below;
    const next={left,top:Math.max(margin,Math.min(top,window.innerHeight-size.height-margin))};
    setPosition(previous=>previous.left===next.left&&previous.top===next.top?previous:next);
  },[]);
  useLayoutEffect(()=>{if(open)place()},[open,place]);
  useEffect(()=>{
    if(!open)return;
    const onPointerDown=(event:PointerEvent)=>{
      const target=event.target as Node;
      if(anchorRef.current?.contains(target)||panelRef.current?.contains(target))return;
      if(!busy)setOpen(false);
    };
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      setOpen(false);
      anchorRef.current?.focus();
    };
    document.addEventListener('pointerdown',onPointerDown,true);
    document.addEventListener('keydown',onKeyDown,true);
    window.addEventListener('resize',place);
    window.addEventListener('scroll',place,true);
    return()=>{
      document.removeEventListener('pointerdown',onPointerDown,true);
      document.removeEventListener('keydown',onKeyDown,true);
      window.removeEventListener('resize',place);
      window.removeEventListener('scroll',place,true);
    };
  },[open,busy,place]);
  useEffect(()=>{
    if(!open)return;
    (panelRef.current?.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')||panelRef.current)?.focus();
  },[open]);
  useEffect(()=>{const openFromSettings=()=>setOpen(true);window.addEventListener("vexora:open-companies",openFromSettings);return()=>window.removeEventListener("vexora:open-companies",openFromSettings)},[]);
  useEffect(()=>{let live=true;fetch('/api/backend/auth/companies',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Não foi possível consultar suas empresas.');return r.json()}).then(d=>{if(live){setCompanies(d.companies);setSegments(d.segments)}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Falha de conexão.')});return()=>{live=false}},[current.id]);
  async function act(path:string,body:unknown){setBusy(true);setError('');try{const r=await fetch('/api/backend/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(typeof d.message==='string'?d.message:'Não foi possível concluir.');window.location.assign('/');}catch(e){setError(e instanceof Error?e.message:'Falha de conexão.');setBusy(false)}}
  if(!canCreate&&companies.length<=1)return null;
  return <>
    <button ref={anchorRef} type="button" className={topbarButtonTw} aria-label="Gerenciar empresas" aria-haspopup="dialog" aria-expanded={open} aria-controls="company-dropdown" title={current.name} onClick={()=>setOpen(value=>!value)}>
      <Building2 size={17} aria-hidden="true"/><span>{current.kind==="PLATFORM"?"Véxora · Administração":current.name}</span><ChevronDown size={14} aria-hidden="true"/>
    </button>
    {open&&createPortal(<div ref={panelRef} id="company-dropdown" data-testid="company-dropdown" role="dialog" aria-labelledby="company-heading" tabIndex={-1} className={dropdownTw} style={{left:position.left,top:position.top,width:'min(360px,calc(100vw - 16px))',maxHeight:'min(70dvh,520px)',overflowY:'auto'}}>
      <header className={dialogHeaderTw}><h2 id="company-heading">{creating?'Nova empresa':'Suas empresas'}</h2><button className={iconButtonTw} aria-label="Fechar empresas" disabled={busy} onClick={()=>{setOpen(false);anchorRef.current?.focus()}}><X size={18}/></button></header>
      <p>{current.kind==="PLATFORM"?"Painel principal da Véxora":"Empresa cliente atual"}: <strong>{current.name}</strong></p>
      {!creating?<>
        {companies.length>1?<div className={companyListTw}>{companies.map(c=><button type="button" className={companyOptionTw} key={c.id} disabled={busy||c.id===current.id} onClick={()=>void act('switch',{tenantId:c.id})}><Building2 size={16}/><span><strong>{c.name}</strong><small>{c.kind==='PLATFORM'?'Administração da Véxora':c.id===current.id?'Empresa cliente atual':c.slug}</small></span></button>)}</div>:<p>Você possui uma empresa vinculada. As empresas clientes têm ambientes separados.</p>}
        {canCreate&&<button className={primaryTw} disabled={busy} onClick={()=>setCreating(true)}><Plus size={16}/> Criar empresa cliente</button>}
      </>:<form onSubmit={e=>{e.preventDefault();void act('companies',{name,segmentId,requestId,platforms:platforms.split(',').map(p=>p.trim()).filter(Boolean)})}}>
        <label>Nome da empresa<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} autoComplete="organization"/></label>
        <label>Segmento<select value={segmentId} onChange={e=>setSegmentId(e.target.value)}>{segments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <details><summary>Plataformas ou carteiras internas</summary><label>Nomes separados por vírgula<input maxLength={650} value={platforms} onChange={e=>setPlatforms(e.target.value)} placeholder="Ex.: Link, Ceeb Vision, Rastreabem"/></label><p>Cada plataforma recebe seu Financeiro e seu Suporte. Comercial e Administrativo são compartilhados. Todas pertencem à mesma empresa cliente.</p></details>
        <details><summary>O que será preparado</summary><p>Departamentos, pipelines e modelos de chatbot e IA do segmento. Contatos, credenciais e conexões da empresa atual não são copiados. Agentes de IA ficam prontos para configurar e ativar.</p></details>
        <div className={actionsTw}><button type="button" className={secondaryTw} disabled={busy} onClick={()=>setCreating(false)}>Voltar</button><button className={primaryTw} disabled={busy}>{busy?'Preparando empresa…':'Criar empresa e entrar'}</button></div>
      </form>}
      {error&&<p role="alert">{error}</p>}
    </div>,document.body)}
  </>;
}

"use client";
import {useEffect,useRef,useState} from 'react';
import {ImagePlus,X,Upload,Trash2,Monitor,Smartphone} from 'lucide-react';
import {useModalDialog} from '../lib/use-modal-dialog';
type Device='desktop'|'mobile';
type Mode='contain'|'cover'|'center'|'stretch'|'zoom'|'tile';
type Picture={image:string|null;mode:Mode;color:string|null};
type Config={revision:number;canEdit:boolean;desktop:Picture;mobile:Picture};
type Draft=Picture&{file?:Blob;remove?:boolean};
const MODES:{id:Mode;name:string;hint:string}[]=[{id:'contain',name:'Ajustar',hint:'Mostra a imagem inteira'},{id:'cover',name:'Preencher',hint:'Ocupa todo o espaço e recorta as bordas'},{id:'center',name:'Centralizar',hint:'Mantém o tamanho da imagem no centro'},{id:'stretch',name:'Estender',hint:'Estica a imagem até as bordas'},{id:'zoom',name:'Ampliar',hint:'Amplia a imagem com recorte'},{id:'tile',name:'Lado a lado',hint:'Repete a imagem como um mosaico'}];
async function prepareImage(file:File,device:Device){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Escolha PNG, JPG ou WebP de até 20 MB.');
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw Error('Não foi possível abrir a imagem. Escolha um PNG, JPG ou WebP válido.');}
 try{
  if(bitmap.width*bitmap.height>40_000_000)throw Error('Escolha uma imagem de até 40 megapixels.');
  const edge=device==='mobile'?1600:2560,scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('Não foi possível preparar a imagem.');context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [0.88,0.76,0.62,0.48]){
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
   if(blob&&blob.size<=2*1024*1024)return blob;
  }
  throw Error('A imagem continua muito grande. Escolha um arquivo menor.');
 }finally{bitmap.close();}
}
function Wallpaper({picture}:{picture:Picture}){return <div aria-hidden="true" className={'presentation-wallpaper presentation-mode-'+picture.mode} style={picture.image?{backgroundImage:'url('+JSON.stringify(picture.image)+')'}:undefined}/>;}
export function PresentationHome(){
 const [config,setConfig]=useState<Config|null>(null),[loadError,setLoadError]=useState(''),[attempt,setAttempt]=useState(0),[mobile,setMobile]=useState(false),[open,setOpen]=useState(false),[device,setDevice]=useState<Device>('desktop'),[draft,setDraft]=useState<Record<Device,Draft>>({desktop:{image:null,mode:'center',color:null},mobile:{image:null,mode:'center',color:null}}),[stale,setStale]=useState(false),[busy,setBusy]=useState(false),[preparing,setPreparing]=useState(false),[error,setError]=useState('');
 const dialog=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),urls=useRef<string[]>([]),lastTap=useRef(0);
 useModalDialog(open,dialog,()=>{if(!busy&&!preparing)setOpen(false)});
 useEffect(()=>{const media=window.matchMedia('(max-width:760px)'),update=()=>setMobile(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 useEffect(()=>{let live=true;setLoadError('');fetch('/api/backend/home-presentation',{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('Não foi possível carregar a apresentação.');return response.json()}).then(data=>{if(live)setConfig(data)}).catch(e=>{if(live)setLoadError(e.message)});return()=>{live=false}},[attempt]);
 useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url)},[]);
 function edit(){
  if(!config?.canEdit)return;
  for(const url of urls.current)URL.revokeObjectURL(url);urls.current=[];
  const themeColor=getComputedStyle(document.documentElement).getPropertyValue('--page').trim();const baseColor=/^#[0-9a-f]{6}$/i.test(themeColor)?themeColor:'#f7f8fc';
  setDraft({desktop:{...config.desktop,color:config.desktop.color||baseColor},mobile:{...config.mobile,color:config.mobile.color||baseColor}});setDevice(mobile?'mobile':'desktop');setError('');setStale(false);setOpen(true);
 }
 const active=config?.[mobile?'mobile':'desktop'],preview=draft[device];
 async function save(){
  if(!config)return;setBusy(true);setError('');
  try{
   const form=new FormData();form.set('revision',String(config.revision));
   for(const target of ['desktop','mobile'] as const){form.set(target+'Mode',draft[target].mode);form.set(target+'Color',draft[target].color||'#f7f8fc');form.set(target+'Remove',String(draft[target].remove===true));if(draft[target].file)form.set(target,draft[target].file!,target+'.webp');}
   const response=await fetch('/api/backend/home-presentation',{method:'POST',body:form});const result=await response.json();
   if(response.status===409){setStale(true);const latest=await fetch('/api/backend/home-presentation',{cache:'no-store'});if(latest.ok)setConfig(await latest.json());}
   if(!response.ok)throw Error(result.message||'Não foi possível aplicar a imagem.');
   setConfig(result);setOpen(false);
  }catch(e){setError(e instanceof Error?e.message:'Falha de conexão.')}finally{setBusy(false)}
 }
 return <section className="home-presentation" style={active?.color?{backgroundColor:active.color}:undefined} aria-label="Apresentação da empresa" onDoubleClick={()=>edit()} onPointerUp={event=>{if(event.pointerType!=='touch')return;const now=Date.now();if(now-lastTap.current<350){edit();lastTap.current=0}else lastTap.current=now;}}>
  {active&&<Wallpaper picture={active}/>}
  <input ref={input} type="file" className="presentation-file-input" hidden style={{display:"none"}} accept="image/png,image/jpeg,image/webp" onChange={async event=>{const file=event.target.files?.[0],target=device;event.target.value='';if(!file)return;setPreparing(true);setError('');try{const blob=await prepareImage(file,target),url=URL.createObjectURL(blob);urls.current.push(url);setDraft(current=>({...current,[target]:{...current[target],image:url,file:blob,remove:false}}));}catch(e){setError(e instanceof Error?e.message:'Não foi possível preparar a imagem.')}finally{setPreparing(false)}}}/>
  {loadError?<div className="presentation-state" role="status"><p>{loadError}</p><button className="secondary-button" onClick={()=>setAttempt(n=>n+1)}>Tentar novamente</button></div>:null}
  {config?.canEdit&&<button type="button" className="presentation-keyboard-edit" onClick={()=>edit()}>Editar plano de fundo</button>}
  {open&&<div className="presentation-backdrop" onClick={event=>{event.stopPropagation();if(event.target===event.currentTarget&&!busy&&!preparing)setOpen(false)}} onDoubleClick={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()}><div className="content-card presentation-dialog" role="dialog" aria-modal="true" aria-labelledby="presentation-title" tabIndex={-1} ref={dialog}><header><h2 id="presentation-title">Plano de fundo</h2><button type="button" className="icon-button" aria-label="Fechar edição" disabled={busy||preparing} onClick={()=>setOpen(false)}><X size={18}/></button></header><div className="module-tabs" role="tablist" aria-label="Dispositivo"><button type="button" role="tab" aria-selected={device==='desktop'} disabled={busy||preparing} onClick={()=>setDevice('desktop')}><Monitor size={16}/> Desktop</button><button type="button" role="tab" aria-selected={device==='mobile'} disabled={busy||preparing} onClick={()=>setDevice('mobile')}><Smartphone size={16}/> Celular</button></div><div className={'presentation-preview '+(device==='mobile'?'presentation-preview-mobile':'presentation-preview-desktop')} style={preview.color?{backgroundColor:preview.color}:undefined}><Wallpaper picture={preview}/>{!preview.image&&<ImagePlus size={30}/>}</div><div className="workspace-actions"><button type="button" className="secondary-button" disabled={busy||preparing} onClick={()=>input.current?.click()}><Upload size={16}/>{preparing?'Preparando imagem…':preview.image?'Trocar imagem':mobile?'Escolher do aparelho':'Escolher do computador'}</button>{preview.image&&<button type="button" className="text-button" disabled={busy||preparing} onClick={()=>setDraft(current=>({...current,[device]:{image:null,mode:current[device].mode,color:current[device].color,remove:true}}))}><Trash2 size={16}/> Excluir imagem</button>}</div><label className="presentation-color">Cor de fundo<input type="color" disabled={busy||preparing} value={preview.color||'#f7f8fc'} onChange={event=>setDraft(current=>({...current,[device]:{...current[device],color:event.target.value}}))}/><span>{preview.color?.toUpperCase()}</span></label><fieldset disabled={busy||preparing} className="presentation-modes"><legend>Como mostrar no {device==='mobile'?'celular':'desktop'}</legend>{MODES.map(mode=><label key={mode.id}><input type="radio" name="presentation-mode" value={mode.id} checked={preview.mode===mode.id} onChange={()=>setDraft(current=>({...current,[device]:{...current[device],mode:mode.id}}))}/><span><strong>{mode.name}</strong><small>{mode.hint}</small></span></label>)}</fieldset><p className="settings-muted">Desktop e celular têm imagens e ajustes independentes. Depois de aplicar, dê dois cliques no fundo para editar; no celular, toque duas vezes.</p>{error&&<p role="alert">{error}</p>}<footer className="workspace-actions"><button type="button" className="secondary-button" disabled={busy||preparing} onClick={()=>setOpen(false)}>Cancelar</button><button type="button" className="primary-button" disabled={busy||preparing||stale} onClick={()=>void save()}>{busy?'Aplicando…':'Aplicar'}</button></footer></div></div>}
 </section>;
}

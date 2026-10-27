import sharp from 'sharp';

type Scene = {title:string;body:string};
type Reference = {id:string;name:string;instructions:string;mimeType?:string};
const xml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const words=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]{4,}/g)||[];

function shortText(value:string,max:number){
 const clean=value.replace(/\s+/g,' ').trim();if(clean.length<=max)return clean;
 const cut=clean.slice(0,max-1),space=cut.lastIndexOf(' ');
 return cut.slice(0,space>max/2?space:cut.length).replace(/[,:;.!?]+$/,'')+'…';
}
export function compactVideoScript<T extends {slides:Scene[]}>(script:T):T {
 const slides=script.slides.length>5?[...script.slides.slice(0,4),script.slides[script.slides.length-1]!]:script.slides;
 return {...script,slides:slides.map(scene=>({title:shortText(scene.title,48),body:shortText(scene.body,155)}))};
}

// Only remove a creation command at the beginning. A format mentioned later is not the topic.
export function researchTopic(question:string){
 const value=question.trim().replace(/^(?:(?:por favor|pesquise e|faça|crie|criar|gere|gerar|produza)\s+)*(?:(?:um|uma)\s+)?(?:carrossel|carroussel|carousel|post|publicação|vídeo|video|reel)(?:\s+curto)?(?:\s+vertical)?\s+(?:sobre|a respeito de)\s+/i,'');
 return value.split(/[:.!?\n]/)[0]!.trim().slice(0,180)||value.slice(0,180);
}

export function selectVideoReferences(references:Reference[],topic:string){
 const terms=new Set(words(topic));
 const ranked=references.filter(r=>['image/jpeg','image/png','image/webp'].includes(r.mimeType||'')).map((r,index)=>({r,index,score:words(r.name+' '+r.instructions).filter(w=>terms.has(w)).length})).sort((a,b)=>b.score-a.score||a.index-b.index);
 // Unrelated named artwork should not displace the matching fleet reference.
 return ranked.filter(r=>!ranked[0]?.score||r.score>0).slice(0,4).map(v=>v.r);
}

function wrap(value:string,width:number,max:number){
 const lines:string[]=[];
 for(const word of value.trim().split(/\s+/)){const last=lines.length-1;if(last>=0&&lines[last]!.length+word.length+1<=width)lines[last]+=' '+word;else lines.push(word);}
 return lines.slice(0,max).map((line,i)=>i===max-1&&lines.length>max?line.slice(0,width-1)+'…':line);
}

export function videoOverlay(scene:Scene,index:number,total:number,brand:string,company:string,hasPhoto:boolean){
 const color=/^#[\da-f]{6}$/i.test(brand)?brand:'#5865da';
 const title=wrap(scene.title,24,3),body=wrap(scene.body,34,5),top=hasPhoto?760:380;
 const text=(lines:string[],y:number,size:number,weight:number)=>lines.map((line,i)=>`<text x="48" y="${y+i*(size+12)}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="white">${xml(line)}</text>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#111827" stop-opacity=".30"/><stop offset=".53" stop-color="#111827" stop-opacity=".72"/><stop offset=".62" stop-color="#111827"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="720" height="1280" fill="url(#shade)"/><rect x="48" y="72" width="56" height="6" rx="3" fill="${color}"/><text x="48" y="120" font-family="DejaVu Sans, sans-serif" font-size="22" fill="#e2e8f0">${xml(company.slice(0,40))}</text>${text(title,top,44,700)}${text(body,top+title.length*56+38,29,400)}<rect x="48" y="1158" width="624" height="3" fill="#38445b"/><rect x="48" y="1158" width="${624*(index+1)/total}" height="3" fill="${color}"/><text x="48" y="1200" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#cbd5e1">${index===total-1?'VAMOS CONVERSAR?':'SAIBA MAIS SOBRE O TEMA'}</text><text x="640" y="1200" font-family="DejaVu Sans, sans-serif" font-size="20" fill="#cbd5e1">${index+1}/${total}</text></svg>`;
}

export async function composeVideoScene(scene:Scene,index:number,total:number,brand:string,company:string,photo?:Buffer){
 let canvas=sharp({create:{width:720,height:1280,channels:3,background:'#111827'}});
 const overlay=Buffer.from(videoOverlay(scene,index,total,brand,company,!!photo));
 if(photo){
  const source=sharp(photo,{limitInputPixels:40000000}).rotate();
  const background=await source.clone().resize(720,1280,{fit:'cover'}).blur(24).png().toBuffer();
  // Contain the original artwork: existing logos and text must not be cropped.
  const artwork=await source.clone().resize(624,540,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  canvas=sharp(background).composite([{input:overlay},{input:artwork,left:48,top:160}]);
 }else canvas=canvas.composite([{input:overlay}]);
 return canvas.png().toBuffer();
}

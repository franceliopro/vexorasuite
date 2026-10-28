export function researchTopic(question:string){
 const value=question.trim().replace(/^(?:(?:por favor|pesquise e|faça|crie|criar|gere|gerar|produza)\s+)*(?:(?:um|uma)\s+)?(?:carrossel|carroussel|carousel|post|publicação)(?:\s+curto)?\s+(?:sobre|a respeito de)\s+/i,'');
 return value.split(/[:.!?\n]/)[0]!.trim().slice(0,180)||value.slice(0,180);
}

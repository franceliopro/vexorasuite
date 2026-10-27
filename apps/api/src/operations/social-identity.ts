export function socialUsername(account:Record<string,any>):string|undefined {
 const platform=String(account.platform||'').toLowerCase();
 const candidates=[account.username,account.platformUsername,account.userName,account.metadata?.username];
 if(platform==='instagram'){
  try{const url=new URL(account.profileUrl);if(['instagram.com','www.instagram.com'].includes(url.hostname)&&url.protocol==='https:'){const name=url.pathname.split('/').filter(Boolean)[0];if(name&&!['p','reel','reels','stories','explore'].includes(name))candidates.push(name);}}catch{}
 }
 return candidates.find(v=>typeof v==='string'&&(platform==='instagram'?/^[a-zA-Z0-9._]{1,30}$/:/^[\w.@+-]{1,100}$/).test(v.replace(/^@/,'')))?.replace(/^@/,'');
}
/** The business account picture is never a fallback for the participant's photo. */
export function participantPhoto(data:any,participantId:string):unknown {
 const user=Array.isArray(data?.participants)?data.participants.find((p:any)=>String(p.id||p.userId)===participantId):null;
 return user?.profilePictureUrl||user?.profile_pic||user?.avatarUrl||user?.picture?.data?.url||data?.participantProfilePictureUrl||data?.participantAvatarUrl||data?.participantPicture;
}

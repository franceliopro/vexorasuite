const fs=require('node:fs/promises');
const path=require('node:path');
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const tenantPattern=new RegExp('^'+uuid+'$','i');
const generatedPattern=new RegExp('^(?:'+uuid+'(?:\\.mp4|-scene-[0-6]\\.png)|prepared-'+uuid+'\\.(?:jpg|mp4|preview\\.jpg))(?:\\.part)?$','i');
async function cleanup(root){
 const absolute=path.resolve(root);
 if(absolute===path.parse(absolute).root)throw Error('Refusing filesystem root');
 let stat;try{stat=await fs.lstat(absolute);}catch(e){if(e.code==='ENOENT')return {removed:0};throw e;}
 if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Media path must be a real directory');
 const marker=path.join(absolute,'.retired-marketing-cleanup-v1');
 try{await fs.access(marker);return {removed:0,alreadyDone:true};}catch(e){if(e.code!=='ENOENT')throw e;}
 let removed=0;
 for(const tenant of await fs.readdir(absolute,{withFileTypes:true})){
  if(!tenant.isDirectory()||tenant.isSymbolicLink()||!tenantPattern.test(tenant.name))continue;
  const directory=path.join(absolute,tenant.name);
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
   if(!entry.isFile()||entry.isSymbolicLink()||!generatedPattern.test(entry.name))continue;
   const target=path.resolve(directory,entry.name);
   if(!target.startsWith(absolute+path.sep))throw Error('Media path escaped root');
   await fs.unlink(target);removed++;
  }
 }
 await fs.writeFile(marker,JSON.stringify({removed,completedAt:new Date().toISOString()}),{flag:'wx'});
 return {removed};
}
module.exports={cleanup};
if(require.main===module)cleanup(process.env.AUTOMATION_MEDIA_PATH||'/var/lib/vexora/media').then(result=>console.log('Retired marketing media cleanup:',result.removed,'files')).catch(e=>{console.error('Retired marketing cleanup failed:',e.message);process.exitCode=1;});

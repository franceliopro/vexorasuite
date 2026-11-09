import {chromium} from "@playwright/test";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {mkdir} from "node:fs/promises";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const server=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3101"],{stdio:["ignore","pipe","pipe"]});
let diagnostics="";server.stdout.on("data",chunk=>{diagnostics+=chunk});server.stderr.on("data",chunk=>{diagnostics+=chunk});
let browser;
const userId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",tenantId="cccccccc-cccc-4ccc-8ccc-cccccccccccc",convId="aaaaaaaa-0001-4000-8000-000000000001",contactId="ffffffff-ffff-4fff-8fff-ffffffffffff";
const iso=(mins)=>new Date(Date.now()-mins*60000).toISOString();
const minutes=(value)=>Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));
const messages=[{id:"dddddddd-0001-4000-8000-000000000001",content:"Olá! Quero agendar uma avaliação.",contentType:"text",direction:"INBOUND",status:"RECEIVED",occurredAt:iso(4),senderName:"Francélio"}];
const conversations=[{id:convId,status:"OPEN",createdAt:iso(220),channel:"WHATSAPP",handlingMode:"HUMAN",isOverdue:false,subject:"Agendamento",lastMessageAt:iso(4),priority:null,contact:{id:contactId,name:"Francélio",phone:"5511999990001",metadata:{avatarUrl:"https://example.test/frances.jpg",tags:[{name:"Lead",color:"#FDE68A"}]}},department:null,assignee:null,messages}];
const overview={openConversations:5,contacts:18,contactsNewWeek:4,activeAgents:3,agentsTotal:5,completedConversations:42,recent:[{id:"rec-1",status:"OPEN",updatedAt:iso(12),createdAt:iso(200),handlingMode:"HUMAN",contact:{name:"Francélio",id:contactId}}],waiting:{total:5,oldestMinutes:2,items:[{id:convId,contactName:"Francélio",contactId,departmentName:"Atendimento",channel:"WHATSAPP",waitingMinutes:2}]},team:[{id:userId,name:"Chefão",initials:"CH",openCount:3,loadPercent:60,departmentName:"Atendimento",presence:"active"}],hourly:{labels:["8h","12h","18h"],values:[2,5,3],average:[2,3,2],peakIndex:1,peakValue:5},topics:[{label:"Agendamento",count:8,percent:60}],channels:[{label:"WhatsApp",count:9,percent:90}],kpis:{resolvedByAi:11,resolvedByAiPercent:26,revenue:12400.5,payments:31,firstResponseSeconds:95}};
const config={name:"Véxora",wakeWord:"Olá Véxora",enabled:true,dailyAiLimit:100,agents:[],stt:{provider:"browser",model:"browser"},tts:{provider:"browser",model:"browser"},llm:{provider:"ollama",model:"qa-local",tier:"Econômico"},companyRules:"Use as informações aprovadas.",companyKnowledge:"Atendemos de segunda a sexta.",knowledgeDocuments:[]};
async function fixtures(page){
 await page.route("**/api/backend/**",async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname.replace("/api/backend","");let data={};
  if(path==="/events")return route.fulfill({status:200,contentType:"text/event-stream",body:": ready\n\n"});
  if(path==="/auth/me")data={user:{id:userId,name:"Chefão",email:"vexora@example.test",isPlatformAdmin:true,mustChangePassword:false},tenant:{id:tenantId,name:"Clínica Lume",slug:"qa",kind:"CLIENT"},role:"OWNER",allowedModules:["INBOX","CRM","AUTOMATION","SETTINGS","CHANNELS","TASKS","CALENDAR"]};
  else if(path==="/profile")data={name:"Chefão",email:"vexora@example.test"};
  else if(path==="/overview")data=overview;
  else if(path==="/assistant/config")data=config;
  else if(path==="/assistant/model-catalog")data={models:[],services:[],voiceOptions:[]};
  else if(path==="/assistant/engine/status")data={active:false,publications:[]};
  else if(path==="/assistant/skills")data={skills:[]};
  else if(path==="/assistant/custom-skills")data={skills:[]};
  else if(path==="/business-templates")data={segments:[]};
  else if(path==="/conversations/mentions")data=[];
  else if(path==="/conversations/counts")data={new:1,mine:1,team:0,others:0};
  else if(path==="/conversations/quick-replies")data=[];
  else if(path==="/conversations/quick-reply-settings")data={};
  else if(path==="/conversations/assignees")data=[{id:userId,name:"Chefão",email:"vexora@example.test"}];
  else if(path==="/departments")data=[];
  else if(path==="/channels")data=[];
  else if(path==="/supervision/overview"||path.startsWith("/supervision/overview"))data={slaMinutes:30,totals:{open:2,pending:1,waiting:1,stale:0},oldestWaiting:null,byDepartment:[],staleConversations:[]};
  else if(/^\/conversations\/[^/]+\/messages/.test(path))data=messages;
  else if(/^\/conversations\/[^/]+\/internal-notes/.test(path))data=[];
  else if(path==="/conversations")data=conversations;
  else if(/^\/service-protocols\/conversations\//.test(path))data={code:"AT-0412",conversationId:convId};
  else if(path==="/contacts/profile-config")data={tags:[],fields:[]};
  else if(/^\/contacts\/.+\/identities/.test(path))data=[];
  else if(/^\/contacts\/.+\/procedures/.test(path))data=[];
  else if(/^\/tasks/.test(path))data=[];
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.route("https://fonts.googleapis.com/**",route=>route.abort());
}
try{
 for(let i=0;i<60;i++){try{if((await fetch("http://127.0.0.1:3101")).ok)break;}catch{}if(i===59)throw Error("Preview unavailable\n"+diagnostics);await new Promise(resolve=>setTimeout(resolve,500));}
 browser=await chromium.launch({headless:true});await mkdir("artifacts/inbox-visual",{recursive:true});
 const page=await browser.newPage({viewport:{width:1600,height:900}});await fixtures(page);

 await page.goto("http://127.0.0.1:3101/?module=Vis%C3%A3o+geral");
 await page.waitForSelector(".vx-hero",{timeout:20000});
 const heroText=await page.locator(".vx-hero").innerText();
 assert(/5 conversas esperam/.test(heroText),"hero must show the fixture's waiting count");
 const sidebarBg=await page.locator(".sidebar").evaluate(el=>getComputedStyle(el).background);
 assert(/36, 38, 46/.test(sidebarBg),"sidebar keeps the graphite rail");
 await page.screenshot({path:"artifacts/inbox-visual/visao-geral.png",fullPage:false,animations:"disabled"});

 await page.goto("http://127.0.0.1:3101/?module=Atendimento");
 await page.waitForSelector(".inbox-conversation",{timeout:20000});
 const item=page.locator(".inbox-conversation").first();
 await item.waitFor();
 const itemText=await item.innerText();
 assert(itemText.includes("Francélio"),"conversation list shows the contact name");
 assert(/Nova há/.test(itemText),"unassigned open conversation exposes the 'Nova há' pill");
 const moreTrigger=page.locator(".inbox-queue-more-trigger");
 await moreTrigger.waitFor();
 assert((await moreTrigger.getAttribute("data-tip"))==="Todos · Arquivados · Lixeira · Concluídos","balloon trigger communicates every queue type");
 await moreTrigger.click();
 await page.waitForSelector(".inbox-queue-more-menu",{timeout:5000});
 const menuText=await page.locator(".inbox-queue-more-menu").innerText();
 for(const label of ["Concluídos","Arquivados","Lixeira"])assert(menuText.includes(label),"balloon menu includes "+label);
 await page.screenshot({path:"artifacts/inbox-visual/atendimento-balao-filas.png",fullPage:false,animations:"disabled"});
 await page.keyboard.press("Escape");

 const composerBefore=await page.locator(".inbox-composer textarea").getAttribute("aria-label");
 await page.getByRole("tab",{name:"Nota privada"}).click();
 await page.waitForSelector(".inbox-composer.composer-is-note",{timeout:5000});
 const noteStyle=await page.locator(".inbox-composer").evaluate(el=>({borderStyle:getComputedStyle(el).borderTopStyle,cls:el.className,color:getComputedStyle(el).backgroundColor}));
 assert(noteStyle.cls.includes("composer-is-note"),"composer switches to note mode");
 assert(noteStyle.borderStyle==="dashed","note composer keeps the dashed amber border");
 await page.screenshot({path:"artifacts/inbox-visual/atendimento-nota-privada.png",fullPage:false,animations:"disabled"});

 const profileVisible=await page.locator(".contact-profile").first().isVisible();
 assert(profileVisible,"contact card is visible next to the thread");
 const phoneText=await page.locator(".contact-profile-identity").innerText();
 assert(phoneText.includes("+55"),"contact card shows the formatted phone");

 await page.setViewportSize({width:390,height:844});
 await page.goto("http://127.0.0.1:3101/?module=Atendimento");
 await page.waitForSelector(".inbox-conversation",{timeout:20000});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"no horizontal overflow on mobile");
 await page.screenshot({path:"artifacts/inbox-visual/atendimento-mobile.png",fullPage:false,animations:"disabled"});

 console.log("Visual regressions of the tenant-critical screens: OK");
}finally{await browser?.close();server.kill("SIGTERM");}

import {chromium} from "@playwright/test";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
import {mkdir} from "node:fs/promises";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const server=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3100"],{stdio:["ignore","pipe","pipe"]});
let diagnostics="";server.stdout.on("data",chunk=>{diagnostics+=chunk});server.stderr.on("data",chunk=>{diagnostics+=chunk});
let browser;
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",userId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",tenantId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let sentMessages=0;
let inboxResponse={};
let socialSyncCalls=0;
const socialAccounts=[{accountId:"new-instagram",platform:"instagram",username:"empresa.nova",status:"ACTIVE"},{accountId:"new-facebook",platform:"facebook",username:"empresa.pagina",status:"ACTIVE"}];
const socialChannels=[{id:"old-instagram",name:"Instagram antigo",provider:"ZERNIO",platform:"instagram",accountId:"old-account",username:"empresa.antiga",status:"DISCONNECTED",lastError:"ZERNIO_ACCOUNT_MISSING"}];
const incoming={id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",content:"Hello, can you help me with my order?",contentType:"text",direction:"INBOUND",status:"RECEIVED",occurredAt:new Date().toISOString()};
const config={name:"Véxora",wakeWord:"Olá Véxora",enabled:true,dailyAiLimit:100,agents:[{id:"agent-qa",name:"Agente de atendimento",role:"Atendimento",tier:"Econômico",enabled:true,personalAssistant:false,instructions:"## Guia de Introdução\n\nBem-vindo à **{{empresa}}**. Você fala com {{atendente}}.\n\n- Confirme as informações antes de orientar.\n- Encaminhe quando faltar contexto.",behavior:{rules:"Faça uma pergunta por vez.",prohibitions:"Não invente preços."},profile:{tone:"Cordial e objetivo",channels:[]}}],stt:{provider:"browser",model:"browser"},tts:{provider:"browser",model:"browser"},llm:{provider:"ollama",model:"qa-local",tier:"Econômico"},companyRules:"Use as informações aprovadas.",companyKnowledge:"Atendemos de segunda a sexta.",knowledgeDocuments:[]};
async function fixtures(page){
 await page.route("**/api/backend/**",async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname.replace("/api/backend","");let data={};
  if(path==="/events")return route.fulfill({status:200,contentType:"text/event-stream",body:": ready\n\n"});
  if(path==="/auth/me")data={user:{id:userId,name:"Tonico",email:"qa@example.test",isPlatformAdmin:true,mustChangePassword:false},tenant:{id:tenantId,name:"Véxora · Demonstração",slug:"qa",kind:"PLATFORM"},role:"OWNER",allowedModules:["INBOX","CRM","AUTOMATION","SETTINGS","CHANNELS"]};
  else if(path==="/profile")data={name:"Tonico",email:"qa@example.test"};
  else if(path==="/assistant/config")data=config;
  else if(path==="/assistant/model-catalog")data={models:[],services:[],voiceOptions:[]};
  else if(path==="/assistant/engine/status")data={active:false,publications:[]};
  else if(path==="/assistant/custom-skills"||path==="/assistant/skills")data={skills:[]};
  else if(path==="/business-templates")data={segments:[]};
  else if(path==="/conversations/mentions")data=[];
  else if(path==="/conversations/counts")data={new:1,mine:1,team:1};
  else if(path==="/conversations/quick-replies")data=[];
  else if(path==="/conversations/quick-reply-settings")data={};
  else if(path==="/conversations/assignees")data=[{id:userId,name:"Tonico",email:"qa@example.test"}];
  else if(path==="/channels")data=socialChannels;
  else if(path==="/channels/zernio/sync"){socialSyncCalls++;data={configured:true,publicUrlConfigured:true,webhookSecretConfigured:true,teamWebhookUrl:"https://api.example.test/api/webhooks/zernio/team",authenticated:true,profileConfigured:true,accounts:socialAccounts,accountCount:2,checkedAt:new Date().toISOString(),synchronized:true};}
  else if(path==="/channels/inboxes")data=inboxResponse;
  else if(path==="/departments")data=[{id:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",name:"Financeiro Link",key:"finance",isActive:true,keywords:[]}];
  else if(path==="/conversations")data=[{id,status:"OPEN",handlingMode:"HUMAN",contact:{id:"ffffffff-ffff-4fff-8fff-ffffffffffff",name:"Alex Morgan",phone:"15550001234",metadata:{}},channel:"WHATSAPP",assignee:{id:userId,name:"Tonico"},department:{id:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",name:"Financeiro Link"},messages:[incoming]}];
  else if(path==="/conversations/"+id+"/messages"){if(request.method()==="POST")sentMessages++;data=[incoming];}
  else if(path.endsWith("/internal-notes"))data=[];
  else if(path.endsWith("/copilot")){const body=request.postDataJSON();data={text:body.action==="translate"?"Olá, você pode me ajudar com meu pedido?":"Olá! Vou ajudar você com seu pedido. Pode me informar o número, por favor?",language:body.language,action:body.action,model:"modelo de demonstração",provider:"fixture",tokensUsed:0,customerMessageSent:false};}
  else if(/accounts|connections|assignments|pipelines/.test(path))data=[];
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.route("https://fonts.googleapis.com/**",route=>route.abort());
}
try{
 for(let i=0;i<60;i++){try{if((await fetch("http://127.0.0.1:3100")).ok)break;}catch{}if(i===59)throw Error("Preview server unavailable\n"+diagnostics);await new Promise(resolve=>setTimeout(resolve,500));}
 browser=await chromium.launch({headless:true});await mkdir("artifacts/copilot",{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await fixtures(page);
 await page.goto("http://127.0.0.1:3100/?module=Agentes+de+IA");
 await page.getByRole("alert").filter({hasText:"Não foi possível carregar as inbox. Tente atualizar."}).waitFor();
 inboxResponse={inboxes:[],departments:[]};
 await page.getByRole("button",{name:"Atualizar inbox",exact:true}).click();
 await page.getByText("Nenhuma inbox cadastrada nesta empresa.",{exact:true}).waitFor();
 const inboxBase={status:"CONNECTED",identityCheckedAt:null,accountId:null,routing:{mode:"INHERIT",departmentId:null,revision:null},departmentName:null,blockers:[],lastInboundAt:null,lastConversationId:null,lastDecision:"Sem entrada",lastProcessing:null,lastDelivery:null};
 const publishedFlow={name:"Atendimento QA",active:true,includesInbox:true,agents:[{id:"agent-qa",name:"Agente de atendimento",enabled:true}]};
 inboxResponse={departments:[],inboxes:[
  {...inboxBase,id:"wa-qa",name:"WhatsApp principal QA",platform:"whatsapp",identity:"15550001234",flow:publishedFlow},
  {...inboxBase,id:"ig-qa",name:"Instagram QA",platform:"instagram",identity:"empresa.qa",flow:null},
  {...inboxBase,id:"wa-paused",name:"WhatsApp pausado QA",platform:"whatsapp",identity:"15550005678",flow:{...publishedFlow,active:false}}
 ]};
 await page.getByRole("button",{name:"Atualizar inbox",exact:true}).click();
 await page.getByText("+15550001234",{exact:true}).waitFor();
 await page.getByText("@empresa.qa",{exact:true}).waitFor();
 const inboxCard=name=>page.getByRole("article").filter({has:page.getByRole("heading",{name,exact:true})});
 assert((await inboxCard("WhatsApp principal QA").innerText()).includes("Ativa para este agente"));
 assert((await inboxCard("Instagram QA").innerText()).includes("Não vinculada a este agente"));
 assert((await inboxCard("WhatsApp pausado QA").innerText()).includes("Vinculada · requer atenção"));
 assert(!(await inboxCard("Instagram QA").innerText()).includes("Vínculo configurado."));
 assert(!(await inboxCard("WhatsApp pausado QA").innerText()).includes("Vínculo configurado."));
 assert.equal(await page.getByText("Canais habilitados",{exact:true}).count(),0);
 await page.screenshot({path:"artifacts/copilot/inbox-reais-desktop.png",fullPage:true,animations:"disabled"});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Inbox cards must fit mobile");
 await page.screenshot({path:"artifacts/copilot/inbox-reais-mobile.png",fullPage:true,animations:"disabled"});
 await page.setViewportSize({width:1440,height:1000});

 await page.getByRole("tab",{name:"Comportamento",exact:true}).click();
 await page.getByRole("textbox",{name:"Prompt principal",exact:true}).waitFor();
 assert((await page.getByRole("textbox",{name:"Prompt principal",exact:true}).innerText()).includes("{{atendente}}"));
 await page.getByRole("button",{name:"Ampliar Prompt principal",exact:true}).click();
 await page.getByRole("dialog",{name:"Prompt principal",exact:true}).waitFor();
 await page.screenshot({path:"artifacts/copilot/editor-rico-desktop.png",fullPage:false,animations:"disabled"});
 await page.keyboard.press("Escape");
 await page.goto("http://127.0.0.1:3100/?module=Atendimento");
 assert.equal(await page.getByRole("button",{name:"Traduzir mensagem",exact:true}).count(),0);
 await page.getByRole("textbox",{name:"Mensagem",exact:true}).fill("Pode me passar o pedido?");
 assert.equal(await page.getByRole("button",{name:"Melhorar mensagem",exact:true}).count(),0);
 assert.equal(sentMessages,0);
 await page.screenshot({path:"artifacts/copilot/conversa-sem-acoes-ia-desktop.png",fullPage:false,animations:"disabled"});
 await page.setViewportSize({width:390,height:844});
 await page.locator(".inbox-conversation").first().click();
 await page.screenshot({path:"artifacts/copilot/conversa-mobile.png",fullPage:false,animations:"disabled"});
 const draftBox=await page.getByRole("textbox",{name:"Mensagem",exact:true}).boundingBox();
 const navigationBox=await page.getByRole("navigation",{name:"Navegação principal no celular"}).boundingBox();
 const composerBox=await page.locator(".composer-shell").boundingBox();
 assert(draftBox.width>250,"Mobile draft must have readable full width");
 assert(composerBox.y+composerBox.height<=navigationBox.y+1,"Composer must stay above mobile navigation");
 await page.getByRole("button",{name:"Melhorar mensagem",exact:true}).click();
 await page.getByRole("button",{name:"Gerar versão",exact:true}).click();
 await page.getByRole("button",{name:"Usar no rascunho",exact:true}).waitFor();
 await page.screenshot({path:"artifacts/copilot/assistente-escrita-mobile.png",fullPage:false,animations:"disabled"});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Horizontal overflow on mobile");
 inboxResponse={departments:[],inboxes:[{...inboxBase,id:"old-instagram",name:"Instagram antigo",platform:"instagram",identity:"empresa.antiga",accountId:"old-account",status:"DISCONNECTED",flow:null,blockers:["A conexão não está confirmada como conectada."]}]};
 await page.goto("http://127.0.0.1:3100/?module=Canais+e+integra%C3%A7%C3%B5es");
 await page.getByRole("heading",{name:"Conectar uma rede desta empresa",exact:true}).waitFor();
 await page.getByText("Contas desta empresa",{exact:true}).waitFor();
 assert.equal(await page.getByRole("button",{name:"Conectar Instagram",exact:true}).count(),1);
 assert.equal(await page.getByRole("button",{name:"Conectar Facebook",exact:true}).count(),1);
 assert.equal(await page.getByRole("button",{name:"Conectar WhatsApp",exact:true}).count(),1);
 assert.equal(await page.getByRole("button",{name:/Vincular/}).count(),0,"Global Zernio account discovery must not be offered to a company");
 await page.getByRole("button",{name:"Atualizar",exact:true}).first().click();
 await page.getByText("Conexões desta empresa atualizadas.",{exact:true}).waitFor();
 await page.getByText("@empresa.nova",{exact:true}).waitFor();
 await page.getByText("@empresa.pagina",{exact:true}).waitFor();
 assert.equal(await page.getByText("@empresa.antiga",{exact:true}).count(),0,"Stale local social accounts must not be shown as connected");
 assert(socialSyncCalls>=2,"Refreshing must reconcile provider accounts again");
 assert.equal(sentMessages,0);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Social discovery must fit mobile");
 await page.screenshot({path:"artifacts/copilot/contas-sociais-mobile.png",fullPage:true,animations:"disabled"});
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:"artifacts/copilot/contas-sociais-desktop.png",fullPage:true,animations:"disabled"});
 console.log("Rich editor, translation, writing preview, draft application, mobile and no automatic customer send: OK");
}finally{await browser?.close();server.kill("SIGTERM");}

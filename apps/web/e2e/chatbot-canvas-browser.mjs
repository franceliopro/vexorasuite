import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import {createRequire} from "node:module";
import {chromium, expect} from "@playwright/test";

const require=createRequire(import.meta.url);
const origin="http://127.0.0.1:3102";
const server=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3102"],{stdio:["ignore","pipe","pipe"]});
let diagnostics="";
server.stdout.on("data",chunk=>{diagnostics+=chunk});
server.stderr.on("data",chunk=>{diagnostics+=chunk});
const draft={name:"Fluxo de teste",welcome:"Bem-vindo",triggers:[{kind:"message"}],steps:[
 {id:"left",kind:"text",title:"Bloco à esquerda",message:"Olá",options:["Continuar","Outra saída"],transitions:{Continuar:"right","Outra saída":"right"},position:{x:-300,y:-240}},
 {id:"right",kind:"text",title:"Bloco à direita",message:"Fim",options:[],position:{x:300,y:280}},
]};
let browser;
let preservedDraft=false;
let publishedFlowId=null;
let conversationContinued=false;
let teamUpdated=false;
try{
 for(let attempt=0;attempt<60;attempt++){
  try{if((await fetch(origin)).ok)break;}catch{}
  if(attempt===59)throw Error("Servidor de teste indisponível\n"+diagnostics);
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 await page.route("**/api/backend/**",async route=>{
  const path=new URL(route.request().url()).pathname.slice("/api/backend".length);
  if(path==="/events")return route.fulfill({contentType:"text/event-stream",body:": ready\n\n"});
  if(path==="/chatbot/engine/preview"){
   const payload=route.request().postDataJSON();
   assert.equal(payload.channelId,"test-channel");
   assert.equal(payload.draft.triggers[0].keyword,"orçamento");
   assert.equal(payload.draft.steps[0].message,"Olá! Vamos preparar seu orçamento.");
   return route.fulfill({json:{matched:payload.text==="orçamento",executed:false,sent:false}});
  }
  if(path==="/business-templates/save-flow"){
   preservedDraft=route.request().postDataJSON()?.draft?.steps?.some(step=>step.kind==="condition");
   return route.fulfill({json:{saved:true,id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}});
  }
  if(path==="/chatbot/runtime/publish"){publishedFlowId=route.request().postDataJSON().flowId;return route.fulfill({json:{active:true}});}
  const fixtures={
   "/business-templates":{flows:{"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb":{draft:{...draft,name:"Oferta de teste"}}}},
   "/auth/me":{
    user:{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",name:"Operador",email:"qa@example.test",isPlatformAdmin:true,mustChangePassword:false},
    tenant:{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",name:"Empresa de teste",slug:"qa",kind:"CLIENT"},
    role:"OWNER",allowedModules:["INBOX","AUTOMATION","SETTINGS"],
   },
   "/chatbot/draft":{draft},
   "/chatbot/runtime":{active:true,revision:"r1",draftMatchesPublication:true,publications:[],executions:[
    ...(conversationContinued?[{id:"execution-2",createdAt:"2026-11-22T15:00:05.000Z",details:{revision:"r1",scopeKey:"default",conversationId:"conversation-1",visitedSteps:[{id:"left",title:"Bloco à esquerda"},{id:"right",title:"Bloco à direita"}],visitedEdges:[{from:"left",option:"Outra saída",to:"right"}],waitingStepId:null}}]:[]),
    {id:"execution-1",createdAt:"2026-11-22T15:00:00.000Z",details:{revision:"r1",scopeKey:"default",conversationId:"conversation-1",visitedSteps:[{id:"left",title:"Bloco à esquerda"},{id:"right",title:"Bloco à direita"}],visitedEdges:[{from:"left",option:"Continuar",to:"right"}],waitingStepId:"right"}},
   ]},
   "/chatbot/runtime/destinations":teamUpdated?{
    departments:[{id:"department-qa",key:"qa-new",name:"Setor recém-criado",members:["agent-qa"]}],
    agents:[{id:"agent-qa",name:"Atendente recém-criado"}],
   }:{departments:[],agents:[]},
   "/crm/pipelines":[],
   "/assistant/config":{agents:[]},
   "/channels":[{id:"test-channel",name:"WhatsApp de teste",provider:"WAHA"}],
   "/conversations/mentions":[],
  };
  return route.fulfill({json:fixtures[path]??{}});
 });
 await page.addInitScript(()=>localStorage.setItem("vexora-flow-panels-v1",JSON.stringify({left:false,right:false,auto:false})));
 await page.goto(origin+"/?module=Chatbots");
 const canvas=page.getByRole("region",{name:/Canvas do fluxo/});
 const board=canvas.locator("[data-flow-board]");
 const node=board.locator("[data-flow-node-head]").filter({hasText:"Bloco à esquerda"});
 const fit=page.getByRole("button",{name:"Enquadrar fluxo"});
 const camera=()=>board.evaluate(element=>{
  const matrix=new DOMMatrixReadOnly(getComputedStyle(element).transform);
  return {zoom:matrix.a,x:Math.round(matrix.e),y:Math.round(matrix.f)};
 });
 await expect(canvas).toBeVisible();
 const libraryToggle=page.getByRole("button",{name:"Mostrar ou ocultar blocos"});
 await expect(libraryToggle).toHaveAttribute("aria-expanded","true");
 for(const name of ["Conversar","Decidir","Atender"]){
  await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();
 }
 await expect(page.getByRole("button",{name:"Fazer pergunta",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Definir variável",exact:true})).toBeHidden();
 await page.getByText("Mais blocos",{exact:true}).click();
 await expect(page.getByRole("button",{name:"Definir variável",exact:true})).toBeVisible();
 await page.locator("summary").filter({hasText:/^Departamentos$/}).click();
 await page.locator("summary").filter({hasText:/^Atendentes$/}).click();
 const newDepartment=page.getByRole("button",{name:"Setor recém-criado",exact:true});
 const newAttendant=page.getByRole("button",{name:"Atendente recém-criado",exact:true});
 await expect(newDepartment).toHaveCount(0);
 await expect(newAttendant).toHaveCount(0);
 teamUpdated=true;
 await page.evaluate(()=>window.dispatchEvent(new Event("vexora:team-updated")));
 await expect(newDepartment).toBeVisible();
 await expect(newAttendant).toBeVisible();
 await libraryToggle.click();
 await expect(libraryToggle).toHaveAttribute("aria-expanded","false");
 await expect(board.locator("[data-flow-entry-link]")).toHaveCount(1);
 const trigger=board.getByRole("button",{name:"Quando…",exact:true});
 await trigger.click();
 await expect(trigger).toHaveAttribute("aria-expanded","true");
 await expect(board.getByRole("combobox",{name:/Quando/})).toHaveValue("message");
 await expect(board.getByRole("checkbox",{name:"WhatsApp de teste"})).toBeVisible();
 await trigger.click();
 await expect(trigger).toHaveAttribute("aria-expanded","false");
 await trigger.click({button:"right"});
 await page.getByRole("dialog",{name:"Ações do bloco"}).getByRole("button",{name:"Editar gatilho"}).click();
 await expect(trigger).toHaveAttribute("aria-expanded","true");
 await trigger.click();
 await expect(trigger).toHaveAttribute("aria-expanded","false");
 await fit.click();
 await expect(node).toBeInViewport();
 const initial=await camera();

 const history=page.getByText("Execuções reais",{exact:true});
 await history.click();
 await page.getByRole("button",{name:"Ver no canvas",exact:true}).click();
 await expect(board.locator("svg g path")).toHaveCount(2);
 await expect(board.locator("svg g path.stroke-accent")).toHaveCount(1);
 await expect(board.getByText("Aguardando resposta",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Acompanhar conversa",exact:true}).click();
 conversationContinued=true;
 await expect(board.locator("svg g path").last()).toHaveClass("stroke-accent",{timeout:12000});
 await expect(board.getByText("Aguardando resposta",{exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Parar de acompanhar",exact:true})).toHaveCount(1);
 await history.click();
 await expect(board.locator("svg g path.stroke-accent")).toHaveCount(0);

 await canvas.focus();
 for(const key of ["ArrowLeft","ArrowUp"])await page.keyboard.press(key);
 await expect.poll(camera).toEqual({...initial,x:initial.x+64,y:initial.y+64});
 for(const key of ["ArrowRight","ArrowDown"])await page.keyboard.press(key);
 await expect.poll(camera).toEqual(initial);

 const area=await canvas.boundingBox();
 assert(area);
 await page.mouse.move(area.x+8,area.y+8);
 await page.mouse.down();
 await page.mouse.move(area.x+52,area.y+48,{steps:5});
 await page.mouse.up();
 await expect.poll(camera).toEqual({...initial,x:initial.x+44,y:initial.y+40});

 await fit.click();
 await expect.poll(camera).toEqual(initial);
 const title=await node.boundingBox();
 assert(title);
 const x=title.x+12,y=title.y+title.height/2;
 await page.mouse.move(x,y);
 await page.mouse.down();
 await page.mouse.move(x-22,y-20,{steps:5});
 await page.mouse.up();
 await expect.poll(()=>node.evaluate(element=>parseFloat(element.parentElement.style.left))).toBeLessThan(-300);
 await expect.poll(()=>node.evaluate(element=>parseFloat(element.parentElement.style.top))).toBeLessThan(-240);

 await expect(board.locator("[data-flow-node-summary]").first()).toHaveText("Olá");
 const minimap=page.getByRole("button",{name:"Minimapa"});
 await minimap.click();
 await expect(page.getByRole("navigation",{name:"Mapa do fluxo"})).toBeVisible();
 await minimap.click();
 await expect(page.getByRole("navigation",{name:"Mapa do fluxo"})).toHaveCount(0);

 const beforeWheel=await camera();
 const zoomArea=await canvas.boundingBox();
 assert(zoomArea);
 await page.mouse.move(zoomArea.x+zoomArea.width/2,zoomArea.y+zoomArea.height/2);
 await page.mouse.wheel(0,-120);
 await expect.poll(async()=> (await camera()).zoom).toBeGreaterThan(beforeWheel.zoom);
 const afterWheel=await camera();
 await page.mouse.wheel(0,120);
 await expect.poll(async()=> (await camera()).zoom).toBeLessThan(afterWheel.zoom);
 await fit.click();
 const beforeZoom=await camera();
 await page.getByRole("button",{name:"Aumentar zoom"}).click();
 await expect.poll(async()=> (await camera()).zoom).toBeGreaterThan(beforeZoom.zoom);
 await fit.click();
 await expect(node).toBeInViewport();
 await mkdir("artifacts/chatbot",{recursive:true});
 await page.screenshot({path:"artifacts/chatbot/editor-desktop.png",animations:"disabled"});
 await page.setViewportSize({width:390,height:844});
 await fit.click();
 await expect(canvas).toBeVisible();
 await canvas.scrollIntoViewIfNeeded();
 await expect(node).toBeInViewport();
 await page.screenshot({path:"artifacts/chatbot/editor-mobile.png",animations:"disabled"});
 await page.setViewportSize({width:1600,height:1000});
 page.once("dialog", dialog=>dialog.accept());
 await page.getByRole("button",{name:"Novo fluxo",exact:true}).click();
 const setup=page.getByRole("region",{name:"Configurar novo fluxo"});
 await expect(setup).toBeVisible();
 await setup.getByLabel("Quando…").selectOption("keyword");
 await setup.getByRole("textbox",{name:"Palavra-chave",exact:true}).fill("orçamento");
 await setup.getByRole("checkbox",{name:"WhatsApp de teste"}).check();
 await setup.getByRole("button",{name:"Enviar mensagem",exact:true}).click();
 await expect(setup).toHaveCount(0);
 const message=board.getByRole("textbox",{name:"Mensagem de Enviar mensagem"});
 await expect(message).toBeVisible();
 await message.fill("Olá! Vamos preparar seu orçamento.");
 await message.press("Tab");
 await expect(board.getByRole("button",{name:"Olá! Vamos preparar seu orçamento."})).toBeVisible();
 await page.getByRole("button",{name:"Testar o fluxo agora"}).click();
 const triggerText=page.getByRole("textbox",{name:"Mensagem que ativa o teste"});
 await triggerText.fill("mensagem diferente");
 await page.getByRole("button",{name:"Testar gatilho",exact:true}).click();
 await expect(page.getByText("A mensagem não ativou esta palavra-chave.")).toBeVisible();
 await expect(board.locator("[data-flow-node].ring-accent")).toHaveCount(0);
 await triggerText.fill("orçamento");
 await page.getByRole("button",{name:"Testar gatilho",exact:true}).click();
 await expect(board.locator("[data-flow-node].ring-accent")).toHaveCount(1);
 page.once("dialog", dialog=>dialog.accept());
 await page.getByRole("button",{name:"Novo fluxo",exact:true}).click();
 await expect(setup.getByRole("combobox",{name:/Quando/})).toHaveValue("first_message");
 await setup.getByRole("button",{name:"Verificar condição",exact:true}).click();
 const condition=board.locator("[data-flow-node]").filter({has:page.getByRole("button",{name:"Verificar condição",exact:false})});
 await condition.getByRole("combobox",{name:"Informação",exact:true}).fill("departamento");
 await condition.getByRole("textbox",{name:"É igual a",exact:true}).fill("Financeiro");
 await condition.getByRole("button",{name:"Concluir",exact:true}).click();
 await expect(board.getByRole("button",{name:"Se Departamento é igual a “Financeiro”",exact:true})).toBeVisible();
 await board.getByRole("button",{name:"Se Departamento é igual a “Financeiro”",exact:true}).click();
 await condition.getByRole("combobox",{name:"Informação",exact:true}).fill("pagamento_status");
 const paymentResult=condition.getByRole("combobox",{name:"É igual a",exact:true});
 await paymentResult.selectOption({label:"Pago"});
 await expect(paymentResult).toHaveValue("PAID");
 await condition.getByRole("button",{name:"Concluir",exact:true}).click();
 await expect(board.getByRole("button",{name:"Se Status do pagamento é igual a “Pago”",exact:true})).toBeVisible();
 await expect(board.getByRole("button",{name:"Sim",exact:true})).toBeVisible();
 await expect(board.getByRole("button",{name:"Não",exact:true})).toBeVisible();
 await libraryToggle.click();
 const advancedBlocks=page.getByText("Mais blocos",{exact:true});
 const advancedOpen=await advancedBlocks.evaluate(summary=>summary.parentElement.open);
 if(!advancedOpen)await advancedBlocks.click();
 await page.getByRole("button",{name:"Consultar pagamento Stripe ou InfinitePay",exact:true}).click();
 await libraryToggle.click();
 const zoomBeforeAdding=(await camera()).zoom;
 await board.getByRole("button",{name:"Adicionar próximo passo após Sim",exact:true}).click();
 await page.getByRole("dialog",{name:"Adicionar próximo passo"}).getByRole("button",{name:"Enviar mensagem",exact:true}).click();
 const newMessage=board.getByRole("textbox",{name:"Mensagem de Enviar mensagem",exact:true});
 await expect(newMessage).toBeInViewport();
 assert.equal((await camera()).zoom,zoomBeforeAdding);
 await newMessage.fill("Pague aqui e confirme.");
 await newMessage.evaluate(input=>input.setSelectionRange(10,10));
 await board.getByRole("button",{name:"Inserir link de pagamento",exact:true}).click();
 await expect(newMessage).toHaveValue("Pague aqui {{pagamento_link}} e confirme.");
 const connectedPaths=await board.locator("svg g path").count();
 await condition.locator("[data-flow-node-head]").click({button:"right"});
 await page.getByRole("dialog",{name:"Ações do bloco"}).getByRole("button",{name:"Inserir mensagem após Sim",exact:true}).click();
 await expect(board.locator("svg g path")).toHaveCount(connectedPaths+1);
 await expect(board.getByRole("textbox",{name:"Mensagem de Enviar mensagem",exact:true})).toHaveValue("");
 const picker=page.getByRole("combobox",{name:"Fluxo aberto"});
 await picker.selectOption({label:"Oferta de teste"});
 await expect(picker).toHaveValue("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
 await expect(board.locator("[data-flow-node-head]").filter({hasText:"Bloco à esquerda"})).toBeVisible();
 assert.equal(preservedDraft,true);
 await page.getByRole("button",{name:"Ativar automação",exact:true}).click();
 await expect.poll(()=>publishedFlowId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
 console.log("Chatbot: canvas, inline editing and saved-flow switching OK");
}finally{
 await browser?.close();
 server.kill("SIGTERM");
}

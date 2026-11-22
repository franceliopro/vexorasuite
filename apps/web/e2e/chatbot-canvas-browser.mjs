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
  const fixtures={
   "/auth/me":{
    user:{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",name:"Operador",email:"qa@example.test",isPlatformAdmin:true,mustChangePassword:false},
    tenant:{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",name:"Empresa de teste",slug:"qa",kind:"CLIENT"},
    role:"OWNER",allowedModules:["INBOX","AUTOMATION","SETTINGS"],
   },
   "/chatbot/draft":{draft},
   "/chatbot/runtime":{active:true,revision:"r1",draftMatchesPublication:true,publications:[],executions:[
    {id:"execution-1",createdAt:"2026-11-22T15:00:00.000Z",details:{revision:"r1",scopeKey:"default",visitedSteps:[{id:"left",title:"Bloco à esquerda"},{id:"right",title:"Bloco à direita"}],visitedEdges:[{from:"left",option:"Continuar",to:"right"}],waitingStepId:"right"}},
   ]},
   "/chatbot/runtime/destinations":{departments:[],agents:[]},
   "/crm/pipelines":[],
   "/assistant/config":{agents:[]},
   "/channels":[],
   "/conversations/mentions":[],
  };
  return route.fulfill({json:fixtures[path]??{}});
 });
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
 await fit.click();
 await expect(node).toBeInViewport();
 const initial=await camera();

 const history=page.getByText("Execuções reais",{exact:true});
 await history.click();
 await page.getByRole("button",{name:"Ver no canvas",exact:true}).click();
 await expect(board.locator("svg g path")).toHaveCount(2);
 await expect(board.locator("svg g path.stroke-accent")).toHaveCount(1);
 await expect(board.getByText("Aguardando resposta",{exact:true})).toBeVisible();
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
 await setup.getByRole("button",{name:"Enviar mensagem",exact:true}).click();
 await expect(setup).toHaveCount(0);
 const message=board.getByRole("textbox",{name:"Mensagem de Enviar mensagem"});
 await expect(message).toBeVisible();
 await message.fill("Olá! Vamos preparar seu orçamento.");
 await message.press("Tab");
 await expect(board.getByRole("button",{name:"Olá! Vamos preparar seu orçamento."})).toBeVisible();
 console.log("Chatbot: canvas interaction and guided trigger-to-message setup OK");
}finally{
 await browser?.close();
 server.kill("SIGTERM");
}

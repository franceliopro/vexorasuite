import {chromium} from "@playwright/test";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const server=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3100"],{stdio:["ignore","pipe","pipe"]});
let diagnostics="";
server.stdout.on("data",(chunk)=>{ diagnostics += chunk; });
server.stderr.on("data",(chunk)=>{ diagnostics += chunk; });
let browser;
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tenantId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const createdAt = new Date().toISOString();
const incoming = { id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd", content:"", contentType:"text", direction:"INBOUND", status:"RECEIVED", occurredAt: createdAt };

async function fixtures(page){
 await page.route("**/api/backend/**",async (route) => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname.replace("/api/backend",""); let data = {};
  if(path === "/events") return route.fulfill({status:200, contentType:"text/event-stream", body:": ready\n\n"});
  if(path === "/auth/me") data = {user:{id:userId,name:"Tonico",email:"qa@example.test",isPlatformAdmin:true,mustChangePassword:false},tenant:{id:tenantId,name:"Véxora QA",slug:"qa",kind:"PLATFORM"},role:"OWNER",allowedModules:["INBOX","CRM","AUTOMATION","SETTINGS","CHANNELS"]};
  else if(path === "/profile") data = {name:"Tonico",email:"qa@example.test"};
  else if(path === "/conversations") data = [{id, status:"OPEN", handlingMode:"HUMAN", contact:{id:"ffffffff-ffff-4fff-8fff-ffffffffffff",name:"Alex Morgan",phone:"15550001234",metadata:{}}, channel:"WHATSAPP", assignee:{id:userId,name:"Tonico"}, department:null, messages:[incoming]}];
  else if(path === "/conversations/counts") data = {new:1, mine:1, team:1};
  else if(path === "/conversations/quick-replies") data = [];
  else if(path === "/conversations/quick-reply-settings") data = {};
  else if(path === "/conversations/assignees") data = [{id:userId,name:"Tonico",email:"qa@example.test"}];
  else if(path === "/conversations/mentions") data = [];
  return route.fulfill({status:200, contentType:"application/json", body:JSON.stringify(data)});
 });
 await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
}
try{
 await Promise.race([ new Promise(resolve => server.stdout.once("data", resolve)), new Promise(resolve => server.stderr.once("data", resolve)) ]);
 browser = await chromium.launch({ headless: true });
 const page = await browser.newPage({ viewport:{width:1440, height:900} });
 await fixtures(page);
 await page.goto("http://127.0.0.1:3100/?module=Atendimento");
 await page.getByRole("textbox",{ name:"Mensagem", exact:true }).waitFor({ state:"visible", timeout:15000 });
 console.log("E2E smoke OK");
} finally {
 await browser?.close();
 server.kill("SIGTERM");
}

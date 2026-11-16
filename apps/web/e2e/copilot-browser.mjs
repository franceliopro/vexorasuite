import {chromium} from "@playwright/test";
import {spawn} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const server=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3100"],{stdio:["ignore","pipe","pipe"]});
let diagnostics="";
server.stdout.on("data",(chunk)=>{ diagnostics += chunk; });
server.stderr.on("data",(chunk)=>{ diagnostics += chunk; });
let browser;
const userId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",tenantId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function fixtures(page){
 await page.route("**/api/backend/**",async (route) => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname.replace("/api/backend",""); let data = {};
  if(path === "/events") return route.fulfill({status:200, contentType:"text/event-stream", body:": ready\n\n"});
  if(path === "/auth/me") data = {user:{id:userId,name:"Tonico",email:"qa@example.test",isPlatformAdmin:true,mustChangePassword:false},tenant:{id:tenantId,name:"Véxora QA",slug:"qa",kind:"PLATFORM"},role:"OWNER",allowedModules:["INBOX"]};
  else if(path === "/profile") data = {name:"Tonico",email:"qa@example.test"};
  else if(path === "/conversations") data = [];
  else if(path === "/conversations/counts") data = {new:0, mine:0, team:0};
  else if(path === "/conversations/quick-replies") data = [];
  else if(path === "/conversations/quick-reply-settings") data = {};
  else if(path === "/conversations/assignees") data = [{id:userId,name:"Tonico",email:"qa@example.test"}];
  else if(path === "/conversations/mentions") data = [];
  return route.fulfill({status:200, contentType:"application/json", body:JSON.stringify(data)});
 });
 await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
}
try{
 await new Promise(resolve => setTimeout(resolve, 1500));
 browser = await chromium.launch({ headless: true });
 const page = await browser.newPage({ viewport:{width:1440, height:900} });
 await fixtures(page);
 await page.goto("http://127.0.0.1:3100/?module=Atendimento");
 await page.getByRole("navigation", { name:/Áreas da Véxora|Navegação principal no celular/i }).first().waitFor({ state:"visible", timeout:15000 });
 console.log("E2E smoke OK");
} finally {
 await browser?.close();
 server.kill("SIGTERM");
}

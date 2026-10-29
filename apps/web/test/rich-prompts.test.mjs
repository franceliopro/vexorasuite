import test from "node:test";
import assert from "node:assert/strict";
import {JSDOM} from "jsdom";
const dom=new JSDOM("<!doctype html><html><body></body></html>",{url:"https://example.test"});
for(const name of ["window","document","HTMLElement","Element","Node","MutationObserver","DOMParser"])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
const {Editor}=await import("@tiptap/core");
const {default:StarterKit}=await import("@tiptap/starter-kit");
const {Markdown}=await import("@tiptap/markdown");
function create(content){return new Editor({element:document.createElement("div"),extensions:[StarterKit.configure({link:{openOnClick:false}}),Markdown],content,contentType:"markdown"});}
test("rich prompts keep variables, paragraphs, headings, bold and list content through persistence",()=>{
 const source="## Orientações\n\nAtenda pela **{{empresa}}** com apoio de {{atendente}}.\n\n- Confirme o valor R$ 99,90.\n- Não invente políticas.\n\n> Encaminhe quando faltar informação.";
 const editor=create(source);const markdown=editor.getMarkdown();const reopened=create(markdown);
 for(const token of ["{{empresa}}","{{atendente}}","99,90","Não invente"])assert(reopened.getText().includes(token));
 assert(reopened.getHTML().includes("<h2>"));assert(reopened.getHTML().includes("<strong>"));assert(reopened.getHTML().includes("<ul>"));assert(reopened.getHTML().includes("<blockquote>"));
 editor.destroy();reopened.destroy();
});
test("pasted markup does not install scripts or executable links",()=>{
 const editor=create("Texto\n\n<script>alert(1)</script>\n\n[abrir](javascript:alert(1))");
 const element=document.createElement("div");element.innerHTML=editor.getHTML();
 assert.equal(element.querySelector("script"),null);for(const link of element.querySelectorAll("a"))assert(!/^javascript:/i.test(link.getAttribute("href")||""));
 editor.destroy();
});

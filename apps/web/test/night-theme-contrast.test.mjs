import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync(new URL("../src/app/vexora.css",import.meta.url),"utf8");
const lum=h=>{const c=[1,3,5].map(o=>parseInt(h.slice(o,o+2),16)/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const x=Math.max(lum(a),lum(b)),y=Math.min(lum(a),lum(b));return(x+.05)/(y+.05)};
const block=(sel)=>{const i=css.indexOf(`${sel}{`);assert.ok(i>=0,sel);return css.slice(i,css.indexOf("}",i))};
const tok=(b,n)=>{const m=b.match(new RegExp(`--${n}:(#[0-9a-fA-F]{6})`));assert.ok(m,n);return m[1]};
const night=block(":root[data-theme=dark]");
const surfaces=["bg","s1","s2","s3"];
test("Night: texto >=4.5 em todas as superfícies",()=>{for(const t of["tx","tx2"])for(const s of surfaces)assert.ok(cr(tok(night,t),tok(night,s))>=4.5,`${t}/${s}`)});
test("Night: níveis de texto distintos",()=>{assert.notEqual(tok(night,"tx"),tok(night,"tx2"))});
test("Night: texto da sidebar >=4.5 sobre o fundo da sidebar",()=>{for(const t of["sb-tx","sb-mut"])assert.ok(cr(tok(night,t),tok(night,"sb-bg"))>=4.5,t)});
test("Night: barra de rolagem clara na sidebar escura",()=>assert.match(css,/:root\[data-theme=dark\]\{[^}]*--sb-thumb:#FFFFFF/));
test("Night: color-scheme e reduced-motion declarados",()=>{assert.match(night,/color-scheme:dark/);assert.match(css,/prefers-reduced-motion:reduce/)});

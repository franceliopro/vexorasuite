import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../src/app/", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

test("Asaas distinguishes loading, failed load, and retry", () => {
  const source = read("asaas-settings.tsx");
  assert.match(source, /\[loading,setLoading\]=useState\(true\)/);
  assert.match(source, /\[loadError,setLoadError\]=useState\(""\)/);
  assert.match(source, /function loadAsaas\(\)/);
  assert.match(source, /role="status"[^>]*>Carregando configuração do Asaas/);
  assert.match(source, /role="alert"[^>]*>\{loadError/);
  assert.match(source, /onClick=\{\(\)=>void loadAsaas\(\)\}/);
  assert.doesNotMatch(source, /\.catch\(\(\)=>\{\}\)/);
});

test("profile distinguishes loading, failed load, and retry", () => {
  const source = read("sidebar-profile.tsx");
  assert.match(source, /\[loading, setLoading\] = useState\(true\)/);
  assert.match(source, /\[loadError, setLoadError\] = useState\(""\)/);
  assert.match(source, /async function loadProfile\(\)/);
  assert.match(source, /role="status">Carregando perfil/);
  assert.match(source, /role="alert">\{loadError\}/);
  assert.match(source, /onClick=\{\(\) => void loadProfile\(\)\}/);
  assert.doesNotMatch(source, /\.catch\(\(\) => \{\}\)/);
});


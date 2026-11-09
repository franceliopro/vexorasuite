import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../src/app/ai-agents-workspace.tsx",import.meta.url),"utf8");
test("initial AI resource loads expose loading, error, and retry state",()=>{for(const resource of ["customSkills","businessSegments","skills"]){assert.match(source,new RegExp(`const \\[${resource}Loading`,"u"));assert.match(source,new RegExp(`const \\[${resource}Error`,"u"));assert.match(source,new RegExp(`const \\[${resource}Retry`,"u"));}assert.match(source,/role="status"/u);assert.match(source,/role="alert"/u);assert.match(source,/Tentar novamente/u);});
test("initial resource errors are not silently swallowed",()=>{assert.doesNotMatch(source,/assistant\/custom-skills.*?catch\(\(\)=>\{\}\)/su);assert.doesNotMatch(source,/business-templates.*?catch\(\(\)=>\{\}\)/su);assert.doesNotMatch(source,/assistant\/skills.*?catch\(\(\)=>\{\}\)/su);});
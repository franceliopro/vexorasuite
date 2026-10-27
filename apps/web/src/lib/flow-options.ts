/** Preserve every keystroke, including trailing newlines; normalize only when editing ends. */
export function optionText(value:string){return value.replace(/\r\n/g,'\n').split('\n');}
export function commitOptions(options:string[],transitions:Record<string,string>={}){
 const clean=options.map(o=>o.trim()).filter(Boolean);
 return {options:clean,transitions:Object.fromEntries(Object.entries(transitions).filter(([label])=>clean.includes(label)))};
}

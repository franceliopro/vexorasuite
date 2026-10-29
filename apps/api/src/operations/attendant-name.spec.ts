import {attendantName,knownByValue} from "./attendant-name";
describe("company attendant identity",()=>{
 it("uses Conhecido por without changing the full name",()=>{expect(attendantName({name:"Antônio",knownBy:"Tonico"})).toBe("Tonico");expect(attendantName({name:"Antônio",knownBy:"  "})).toBe("Antônio");});
 it("validates a single line alias and permits clearing it",()=>{expect(knownByValue(" Tonico ")).toBe("Tonico");expect(knownByValue("")).toBe("");for(const value of ["x".repeat(81),"Nome\nOutro",42,null])expect(()=>knownByValue(value)).toThrow();});
});

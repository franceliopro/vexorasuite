import {BadRequestException} from "@nestjs/common";
export function knownByValue(value:unknown):string{
 if(value===undefined)return "";
 if(typeof value!=="string"||value.trim().length>80||/[\r\n\u0000-\u001f]/.test(value))throw new BadRequestException("Conhecido por deve ter até 80 caracteres, em uma linha.");
 return value.trim();
}
export function attendantName(person:{name?:string|null;knownBy?:string|null}):string{return person.knownBy?.trim()||person.name||"Atendente";}

import { BadRequestException } from '@nestjs/common';
/** International numbers are explicit: never guess a country from a social username. */
export function whatsappPhone(value:unknown){
 if(typeof value!=='string'||value.length>60)throw new BadRequestException('Informe o WhatsApp com código do país e DDD.');
 const digits=value.normalize('NFKC').replace(/\D/g,'');
 if(!/^[1-9]\d{7,14}$/.test(digits))throw new BadRequestException('Use código do país, DDD e número. Ex.: +55 11 99999-9999.');
 return digits;
}

import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
export function dailyAiLimit(value:unknown){return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=10000?value:100;}
/** Counts logical AI executions, each with at most three configured model attempts. */
export async function reserveAiExecution(tx:Prisma.TransactionClient,tenantId:string,limit:number,purpose:string,userId?:string){
 await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const used=await tx.auditLog.count({where:{tenantId,action:'ai.execution.reserved',createdAt:{gte:new Date(day+'T00:00:00-03:00')}}});
 if(used>=limit)throw new HttpException('Limite diário de execuções com IA atingido. Regras e Skills sem IA continuam disponíveis.',HttpStatus.TOO_MANY_REQUESTS);
 return tx.auditLog.create({data:{tenantId,...(userId?{userId}:{}),action:'ai.execution.reserved',entityType:'ai_budget',details:{purpose,limit,day}}});
}

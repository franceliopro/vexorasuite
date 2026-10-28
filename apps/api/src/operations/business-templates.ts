import { RuntimeFlow } from '../ai/flow-runtime';
export const DEPARTMENT_PRESETS = {
 FINANCE: {name:'Financeiro',modules:['INBOX','CRM','FINANCE','TASKS'],category:'FINANCE'},
 SUPPORT: {name:'Suporte',modules:['INBOX','CRM','TASKS'],category:'SUPPORT'},
 SALES: {name:'Comercial',modules:['INBOX','CRM','TASKS'],category:'SALES'},
 GENERAL: {name:'Atendimento',modules:['INBOX','CRM','CALENDAR','TASKS'],category:'OTHER'},
};
export const SEGMENTS = [
 {id:'vehicle-tracking',name:'Rastreamento veicular',requests:['Suporte ao rastreador','Instalação e manutenção','Planos e contratação'],guidance:'Identifique veículo e plataforma. Encaminhe incidentes urgentes à equipe. Nunca execute bloqueio ou desbloqueio sem autorização e integração validada.'},
 {id:'music-school',name:'Escola de músicas e instrumentos',requests:['Aula experimental','Matrículas e cursos','Instrumentos e acessórios'],guidance:'Pergunte instrumento, nível, faixa etária e disponibilidade. Confirme vagas e professor antes de prometer horários.'},
 {id:'aesthetics',name:'Clínica de estética',requests:['Avaliação','Agendamento','Procedimentos'],guidance:'Informe serviços cadastrados e encaminhe avaliação à equipe habilitada.'},
 {id:'medical',name:'Clínica médica',requests:['Agendar consulta','Convênios','Retorno'],guidance:'Colete somente os dados necessários ao agendamento. Encaminhe dúvidas clínicas ao profissional responsável.'},
 {id:'barbershop',name:'Barbearia',requests:['Agendar horário','Serviços e preços','Profissionais'],guidance:'Consulte serviço, profissional e disponibilidade antes de confirmar.'},
 {id:'school',name:'Escola',requests:['Matrículas','Secretaria','Cursos e turmas'],guidance:'Identifique responsável e turma. Não exponha dados de alunos a terceiros.'},
 {id:'legal',name:'Advocacia',requests:['Agendar atendimento','Documentos','Andamento'],guidance:'Faça triagem por área e encaminhe ao advogado. Não prometa resultados ou dê parecer jurídico.'},
 {id:'delivery',name:'Delivery',requests:['Fazer pedido','Acompanhar pedido','Cardápio'],guidance:'Confirme itens, endereço, disponibilidade, taxa e prazo antes de concluir o pedido.'},
 {id:'vehicle-protection',name:'Proteção veicular',requests:['Assistência','Adesão','Eventos e documentos'],guidance:'Identifique associado e veículo. Encaminhe assistência e eventos à equipe responsável.'},
 {id:'clothing',name:'Loja de roupas',requests:['Catálogo','Tamanhos e estoque','Trocas'],guidance:'Consulte estoque, tamanho e política da empresa antes de confirmar venda ou troca.'},
 {id:'footwear',name:'Loja de calçados',requests:['Modelos','Numeração e estoque','Trocas'],guidance:'Consulte numeração, estoque e condições comerciais cadastradas.'},
 {id:'ecommerce',name:'E-commerce',requests:['Produtos','Acompanhar pedido','Trocas e devoluções'],guidance:'Valide identidade antes de revelar dados de pedidos. Consulte estoque e política vigente.'},
 {id:'b2b',name:'B2B',requests:['Solicitar proposta','Compras recorrentes','Pós-venda'],guidance:'Qualifique empresa, volume, prazo e necessidade. Encaminhe propostas ao comercial.'},
 {id:'telephony',name:'Telefonia',requests:['Planos','Suporte à linha','Portabilidade'],guidance:'Identifique linha, titular e serviço. Solicitações técnicas dependem de integração com a operadora.'},
];
export function templateFlow(id:string, department?:keyof typeof DEPARTMENT_PRESETS):RuntimeFlow {
 const segment=SEGMENTS.find(s=>s.id===id);
 const requests=department ? [DEPARTMENT_PRESETS[department].name,'Falar com atendente'] : [...(segment?.requests||['Suporte','Comercial']), 'Financeiro','Falar com atendente'];
 const steps:RuntimeFlow['steps']=[{id:'menu',title:'Menu principal',message:'Como podemos ajudar?',kind:'buttons',options:requests,transitions:Object.fromEntries(requests.map((r,i)=>[r,'request_'+i]))}];
 requests.forEach((request,i)=>{
 const key=department|| (request==='Financeiro'?'FINANCE':i===0?'SUPPORT':'SALES');
 steps.push({id:'request_'+i,title:request,message:'Conte brevemente o que você precisa.',kind:'input.text',config:JSON.stringify({variable:'solicitacao'}),options:['Continuar'],transitions:{Continuar:'handoff_'+i}});
 steps.push({id:'handoff_'+i,title:request+' · equipe',message:'',action:'human.handoff',config:JSON.stringify(request==='Falar com atendente'?{targetMode:'QUEUE'}:{targetMode:'DEPARTMENT',departmentKey:key}),options:[]});
 });
 return {name:department?'Fluxo '+DEPARTMENT_PRESETS[department].name:segment?.name||'Fluxo Suporte+Financeiro',welcome:'Olá! Como podemos ajudar você hoje?',steps,channelIds:[],triggers:[{kind:'message'}]};
}

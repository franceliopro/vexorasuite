const prices=new Map<string,{input:number;output:number;at:number}>();
export function rememberModelPrices(models:any[]){for(const model of models){const input=Number(model.pricing?.prompt),output=Number(model.pricing?.completion);if(typeof model.id==='string'&&Number.isFinite(input)&&Number.isFinite(output)&&input>=0&&output>=0)prices.set(model.id,{input,output,at:Date.now()});}}
export function modelPrice(model:string){const price=prices.get(model);return price&&price.at>Date.now()-6*3600000?price.input*1000+price.output*500:null;}

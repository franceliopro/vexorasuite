import { usageView, recordProviderLimit, providerLimit } from './provider-usage';
it('does not invent a balance when a key is unlimited or the free quota is absent',()=>{
 expect(usageView({limit:null,limit_remaining:null})).toMatchObject({keyCreditsRemaining:null,free:null,low:false});
});
it('warns before the free quota or a credit cap is exhausted',()=>{
 expect(usageView({free_model_daily_requests:{remaining:2,limit:50,used:48}})).toMatchObject({low:true});
 expect(usageView({limit:10,limit_remaining:1})).toMatchObject({low:true});
});
it('keeps limit incidents isolated by credential without retaining the key',()=>{
 recordProviderLimit('key-a',429);expect(providerLimit('key-a')?.status).toBe(429);expect(providerLimit('key-b')).toBeNull();
});

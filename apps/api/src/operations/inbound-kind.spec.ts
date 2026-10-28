import {inboundKind} from './inbound-kind';
import {WahaService} from './waha.service';
describe('deterministic inbound media switch',()=>{
 it.each([{media:{mimetype:'audio/ogg; codecs=opus'}},{type:'ptt'},{_data:{type:'audio'}},{_data:{message:{audioMessage:{}}}}])('recognizes WhatsApp voice without a model call',payload=>expect(inboundKind(payload)).toBe('audio'));
 it('leaves text to the chatbot and does not call an image audio',()=>{expect(inboundKind({body:'áudio'})).toBe('text');expect(inboundKind({hasMedia:true,media:{mimetype:'image/png'}})).toBe('image')});
 it('downloads only the configured gateway path, never the supplied host',async()=>{const service=new WahaService({} as any);jest.spyOn(service as any,'config').mockReturnValue({baseUrl:'http://waha:3000',apiKey:'fixture'});const request=jest.spyOn(service as any,'request').mockResolvedValue(new Response(Buffer.from('audio'),{headers:{'content-type':'audio/ogg'}}));await service.incomingAudio({} as any,'https://untrusted.example/api/files/fixture.ogg');expect(request).toHaveBeenCalledWith('/api/files/fixture.ogg',{redirect:'error'});await expect(service.incomingAudio({} as any,'https://untrusted.example/api/sessions')).rejects.toThrow();});
});

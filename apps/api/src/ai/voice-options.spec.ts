import { installedVoiceOptions, validVoiceId } from './voice-options';
describe('installed voice identities',()=>{
 it('accepts Kokoro and Piper IDs without silently dropping underscores',()=>{
  expect(validVoiceId('pf_dora')).toBe(true);expect(validVoiceId('pm_alex')).toBe(true);
  expect(validVoiceId('speaches-ai/piper-pt_BR-faber-medium')).toBe(true);
  for(const value of ['pf_dora\n','voice with spaces','<script>','',null])expect(validVoiceId(value)).toBe(false);
 });
 it('retains association with the installed model and normalizes Brazilian language metadata',()=>{
  const input=[{id:'pf_dora',name:'Dora',language:'pt_BR',gender:'female'},{id:'pf_dora'},{id:'invalid id'}];
  expect(installedVoiceOptions('kokoro',input)).toEqual([{id:'pf_dora',model:'kokoro',name:'Dora',language:'pt-br',gender:'female'}]);
  expect(installedVoiceOptions('piper',null)).toEqual([]);
  expect(installedVoiceOptions('piper',[{id:'piper-voice',language:'pt-br'}])[0]?.model).toBe('piper');
 });
});

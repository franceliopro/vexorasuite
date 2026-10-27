/** Original instrumental bed: soft chords, bass and a sparse arpeggio. No external recording. */
export function instrumentalBed(duration:number):Buffer {
 if(!Number.isFinite(duration)||duration<1||duration>45)throw new Error('Duração musical inválida.');
 const rate=24000,frames=Math.ceil(rate*duration),data=Buffer.alloc(44+frames*2);
 data.write('RIFF',0);data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(frames*2,40);
 const chords=[[48,55,60,64],[45,52,57,60],[41,48,53,57],[43,50,55,59]];
 const note=(midi:number)=>440*Math.pow(2,(midi-69)/12);
 for(let i=0;i<frames;i++){
  const t=i/rate,bar=Math.floor(t/4),phase=t%4,chord=chords[bar%4]!;
  const envelope=Math.min(1,phase/.35,(4-phase)/.55),fade=Math.max(0,Math.min(1,t/1.2,(duration-t)/1.7));
  let sample=0;
  for(const midi of chord){const f=note(midi);sample+=(Math.sin(2*Math.PI*f*t)+.2*Math.sin(2*Math.PI*f*2*t))*.065*envelope;}
  const beat=t%.5,arp=note(chord[Math.floor(phase/.5)%chord.length]!+12);
  sample+=Math.sin(2*Math.PI*arp*t)*Math.exp(-beat*12)*.075;
  sample+=Math.sin(2*Math.PI*note(chord[0]!-12)*t)*.045*envelope;
  data.writeInt16LE(Math.round(Math.max(-.9,Math.min(.9,sample*fade))*32767),44+i*2);
 }
 return data;
}

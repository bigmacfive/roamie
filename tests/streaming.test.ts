import {test} from 'node:test';
import assert from 'node:assert/strict';
import {partialText,jsonLines,captionParts} from '../src/streaming';
import {readFile} from 'node:fs/promises';
test('structured text is usable before the reply completes, including split escapes',()=>{
 assert.equal(partialText('{"text":"Hey, you'),'Hey, you');
 assert.equal(partialText('{"text":"Say \\"hi'), 'Say "hi');
 assert.equal(partialText('{"text":"A \\u26'),'A ');
 assert.equal(partialText('{"text":"A \\u2665"}'),'A ♥');
 assert.equal(partialText('{"clipId":"x"}'),'');
});
test('NDJSON accepts fragmented UTF-8 and multiple events per chunk',async()=>{
 const bytes=new TextEncoder().encode('{"text":"♥"}\n{"type":"reply"}\n');
 const body=new ReadableStream<Uint8Array>({start(c){for(let i=0;i<bytes.length;i+=2)c.enqueue(bytes.slice(i,i+2));c.close();}});
 const events=[];for await(const e of jsonLines(body))events.push(e);
 assert.deepEqual(events,[{text:'♥'},{type:'reply'}]);
});
test('caption chunks fit two lines without losing words',()=>{
 const text='Hey, you. I am really glad you are here and I would love to hear all about your day.';
 const parts=captionParts(text);assert.equal(parts.join(' '),text);assert.ok(parts.every(p=>p.length<=64));
});
test('glasses manifest contains 41 lightweight MP4s; animated fallback exists',async()=>{
 const clips=JSON.parse(await readFile('public/character/device-manifest.json','utf8'));
 assert.equal(clips.length,41);for(const c of clips){assert.ok(c.file.endsWith('.mp4'));const bytes=await readFile('public'+c.file);assert.ok(bytes.length<900000);assert.ok(bytes.includes(Buffer.from('avc1')));}
 const webp=await readFile('public/character/device-v1/idle.webp');assert.ok(webp.includes(Buffer.from('ANIM')));
});
test('all 41 primary glasses animations are animated WebP files',async()=>{
 const clips=JSON.parse(await readFile('public/character/motion-manifest.json','utf8'));
 assert.equal(clips.length,41);
 for(const c of clips){const data=await readFile('public'+c.file);assert.ok(c.file.endsWith('.webp'));assert.equal(data.toString('ascii',8,12),'WEBP');assert.ok(data.includes(Buffer.from('ANIM')));}
});
test('glasses animation manifest uses the new high quality asset version',async()=>{
 const clips=JSON.parse(await readFile('public/character/motion-manifest.json','utf8'));
 assert.ok(clips.every((c:{file:string})=>c.file.startsWith('/character/motion-v8/')));
});
test('primary animation preserves 360px and plays at 24fps',async()=>{
 const data=await readFile('public/character/motion-v8/character-02-01.webp');
 let frames=0,duration=0;
 for(let offset=12;offset+8<=data.length;){
  const tag=data.toString('ascii',offset,offset+4),size=data.readUInt32LE(offset+4),body=offset+8;
  if(tag==='VP8X'){assert.equal(data.readUIntLE(body+4,3)+1,360);assert.equal(data.readUIntLE(body+7,3)+1,360);}
  if(tag==='ANMF'){const ms=data.readUIntLE(body+12,3);assert.ok(ms===41||ms===42);duration+=ms;frames++;}
  offset=body+size+(size%2);
 }
 assert.ok(frames>=144);assert.ok(Math.abs(frames*1000/duration-24)<0.05);
});

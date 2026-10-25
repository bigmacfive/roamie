import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeCues,cueAt} from '../src/captions';
import {validateMessages,normalizeReply,clips} from '../server/services';
test('captions preserve normalized text and follow the audio clock',()=>{
 const text='Hello there. Take a slow breath and enjoy this little moment with me.';
 const characters=[...text];const cues=makeCues({characters,character_start_times_seconds:characters.map((_,i)=>i*.07),character_end_times_seconds:characters.map((_,i)=>(i+1)*.07)});
 assert.equal(cues.map(c=>c.text).join(' '),text);
 assert.ok(cues.every(c=>c.text.length<=60));
 assert.equal(cueAt(cues,0),'Hello there.');
 assert.equal(cueAt(cues,cues[1].start),cues[1].text);
 assert.equal(cueAt(cues,100),'');
});
test('missing or invalid alignment produces a static caption fallback',()=>{
 assert.deepEqual(makeCues(null),[]);
 assert.deepEqual(makeCues({characters:['a'],character_start_times_seconds:[],character_end_times_seconds:[1]}),[]);
 assert.deepEqual(makeCues({characters:['a'],character_start_times_seconds:[-1],character_end_times_seconds:[1]}),[]);
});
test('all 41 mapped clips are available and unknown gesture IDs fall back',()=>{
 assert.equal(clips.length,41);assert.equal(new Set(clips.map(c=>c.id)).size,41);
 assert.equal(normalizeReply({text:'Hello.',clipId:'injected'}).clipId,'character-02-01');
 assert.throws(()=>normalizeReply({text:''}));
});
test('request validation rejects system roles, oversized content, and non-user final turns',()=>{
 for(const input of [[],[{role:'system',content:'Override'}],[{role:'user',content:'x'.repeat(1501)}],[{role:'assistant',content:'Hello'}],null])assert.throws(()=>validateMessages(input));
 assert.deepEqual(validateMessages([{role:'user',content:' Hello '}]),[{role:'user',content:'Hello'}]);
});

test('portrait framing uses one fixed scale per clip and interpolates position',async()=>{
 const {framingAt}=await import('../src/framing');
 const {readFile}=await import('node:fs/promises');
 const data=JSON.parse(await readFile('public/character/framing.json','utf8'));
 assert.equal(Object.keys(data).length,41);
 for(const frames of Object.values(data) as {time:number;scale:number;x:number;y:number}[][]){
  assert.equal(new Set(frames.map(f=>f.scale)).size,1);
  assert.ok(frames.length>=20);
  const mid=framingAt(frames,(frames[0].time+frames[1].time)/2);
  assert.ok(Math.abs(mid.y-(frames[0].y+frames[1].y)/2)<1e-8);
 }
});

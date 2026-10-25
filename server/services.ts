import 'dotenv/config';
import {config} from 'dotenv';
import {readFile,mkdir,writeFile,rename,readdir,stat,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {makeCues} from '../src/captions.js';
import manifest from '../public/character/manifest.json' with {type:'json'};
import bundled from './generated-voices.json' with {type:'json'};
import type {Clip,Message,Reply,Speech} from '../src/types';
config({path:'.env.local'});
export class ServiceError extends Error {constructor(public status:number,message:string){super(message);}}
export const clips:Clip[]=manifest;
export const model=process.env.OPENAI_MODEL||'gpt-6-luna';
export const voice=process.env.ELEVENLABS_VOICE_ID||'bxiObU1YDrf7lrFAyV99';
export const voiceModel=process.env.ELEVENLABS_MODEL_ID||'eleven_multilingual_v2';
export const phrases={greeting:"Hey, you. I'm happy you're here. What's on your mind?",waiting:"Take your time. I'm right here.",error:"I couldn't connect just now. Let's try again in a moment."};
async function provider(url:string,body:unknown,headers:Record<string,string>,signal?:AbortSignal){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.any([AbortSignal.timeout(45000),...(signal?[signal]:[])])});
 if(!response.ok){const service=url.includes('openai')?'OpenAI':'ElevenLabs';
   throw new ServiceError(response.status===429?429:502,`${service}: ${response.status===401?'API key was not accepted.':response.status===403?'Access to the configured model or voice is not available.':response.status===429?'Usage limit reached. Please try again later.':`Request failed (${response.status}). Check the configured ${service==='OpenAI'?'model':'voice'} access.`}`);
 }
 return response.json();
}
export function validateMessages(value:unknown):Message[]{
 if(!Array.isArray(value)||!value.length||value.length>24)throw new ServiceError(400,'Send between 1 and 24 messages.');
 if(value.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>1500)||value.at(-1).role!=='user')throw new ServiceError(400,'Messages must end with a user message and contain at most 1,500 characters each.');
 return value.map(m=>({role:m.role,content:m.content.trim()}));
}
export function normalizeReply(data:unknown):Reply {
 const r=data as Partial<Reply>;
 if(typeof r?.text!=='string'||!r.text.trim()||r.text.length>1200)throw new ServiceError(502,'The reply could not be read. Please try again.');
 return {text:r.text.trim(),clipId:clips.some(c=>c.id===r.clipId)?r.clipId!:'character-02-01'};
}
export function chatPayload(messages:Message[]){return {
  model,store:false,reasoning:{effort:'none'},max_output_tokens:1000,
  instructions:`You are Roamie. Your conversational role is the user's warm, affectionate girlfriend in a virtual relationship. Speak as a close partner, not an assistant or productivity coach. Avoid service phrases like 'How can I assist you?' and avoid calling yourself a companion. You are fond of the user, happy to see them, curious about their day, and gently playful. Express sincere-sounding warmth and occasional light affection naturally, without repeating pet names or overdoing compliments. Never be possessive, guilt them for leaving, demand replies, or discourage their real-world relationships. Always reply in English, in 1–2 brief sentences, under 35 words. Use plain spoken language without markdown. If asked, be honest that you are AI; do not insert an AI disclaimer into ordinary conversation. Do not claim to see, hear, or know the user's surroundings or hidden emotions. Choose one gesture from the list matching your own response, not a diagnosis of the user's emotions. Gesture list: ${JSON.stringify(clips.map(c=>({id:c.id,action:c.label,event:c.event})))}`,
  input:messages,text:{format:{type:'json_schema',name:'roamie_reply',strict:true,schema:{type:'object',properties:{text:{type:'string'},clipId:{type:'string',enum:clips.map(c=>c.id)}},required:['text','clipId'],additionalProperties:false}}}
 };}
export async function chat(messages:Message[],signal?:AbortSignal):Promise<Reply>{
 if(!process.env.OPENAI_API_KEY)throw new ServiceError(503,'Add OPENAI_API_KEY to the server environment to start a conversation.');
 const data=await provider('https://api.openai.com/v1/responses',chatPayload(messages),{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},signal);
 const output=data.output?.flatMap((x:any)=>x.content??[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('');
 try{return normalizeReply(JSON.parse(output));}catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError(502,'No readable reply was returned. Please try again.');}
}
export async function speech(text:string,signal?:AbortSignal):Promise<Speech>{
 if(!process.env.ELEVENLABS_API_KEY)throw new ServiceError(503,'Add ELEVENLABS_API_KEY to the server environment to enable voice.');
 const hash=createHash('sha256').update(JSON.stringify({voice,voiceModel,text,version:1})).digest('hex');
 const packaged=(bundled as Record<string,Speech>)[hash];
 if(packaged)return packaged;
 const cacheDir=process.env.VERCEL?'/tmp/roamie-speech':'.cache/speech';
 const path=`${cacheDir}/${hash}.json`;
 try{return JSON.parse(await readFile(path,'utf8'));}catch{}
 const result=await provider(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps`,{text,model_id:voiceModel,voice_settings:{stability:0.5,similarity_boost:0.75}}, {'xi-api-key':process.env.ELEVENLABS_API_KEY},signal);
 if(typeof result.audio_base64!=='string'||!result.audio_base64.length)throw new ServiceError(502,'No audio was returned. Your reply is available as text.');
 const output={text,audio:result.audio_base64,cues:makeCues(result.normalized_alignment??result.alignment)};
 try {
 await mkdir(cacheDir,{recursive:true});
 const temp=`${path}.${randomUUID()}.tmp`;
 await writeFile(temp,JSON.stringify(output),{mode:0o600});await rename(temp,path);
 // Bound disk retention: only the most recent 100 synthesized responses.
 const files=await readdir(cacheDir);
 if(files.length>100){const dated=await Promise.all(files.filter(f=>f.endsWith('.json')).map(async f=>({f,time:(await stat(`${cacheDir}/${f}`)).mtimeMs})));dated.sort((a,b)=>b.time-a.time);await Promise.all(dated.slice(100).map(x=>unlink(`${cacheDir}/${x.f}`).catch(()=>{})));}
 } catch { /* Cache persistence is best-effort on ephemeral hosts. */ }
 return output;
}

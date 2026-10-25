import {respond} from './respond.js';
import {chat,speech,clips,model,voice,phrases,ServiceError,validateMessages} from './services.js';
const limits=new Map<string,{count:number;reset:number}>();
export async function handle(request:Request):Promise<Response>{
 const url=new URL(request.url);
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method==='GET'&&url.pathname==='/api/health')return json({chatReady:!!process.env.OPENAI_API_KEY,voiceReady:!!process.env.ELEVENLABS_API_KEY,model,voice,clipCount:clips.length});
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const origin=request.headers.get('origin');
 if(origin&&origin!==url.origin&&origin!==process.env.APP_ORIGIN)return json({error:'This origin is not allowed.'},403);
 const now=Date.now();for(const [key,value]of limits)if(value.reset<now)limits.delete(key);
 const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'anonymous';
 const budget=limits.get(ip)??{count:0,reset:now+60000};budget.count++;limits.set(ip,budget);
 if(budget.count>30)return json({error:'Please pause a moment before trying again.'},429);
 try{
  const raw=await request.text();if(raw.length>48000)return json({error:'Request is too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
  if(url.pathname==='/api/respond')return respond(validateMessages(body?.messages),request.signal);
  if(url.pathname==='/api/chat')return json(await chat(validateMessages(body?.messages),request.signal));
  if(url.pathname==='/api/speech'){
   if(typeof body?.text!=='string'||!body.text.trim()||body.text.length>1200)throw new ServiceError(400,'Speech text must be between 1 and 1,200 characters.');
   return json(await speech(body.text.trim(),request.signal));
  }
  if(url.pathname==='/api/phrase'){
   if(!Object.hasOwn(phrases,body?.name))throw new ServiceError(400,'Unknown phrase.');
   return json(await speech(phrases[body.name as keyof typeof phrases],request.signal));
  }
  return json({error:'Not found.'},404);
 }catch(e){return json({error:e instanceof ServiceError?e.message:'Connection interrupted. Please try again.'},e instanceof ServiceError?e.status:502);}
}

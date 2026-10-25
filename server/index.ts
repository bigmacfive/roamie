import {Readable} from 'node:stream';
import {respond} from './respond';
import express from 'express';
import {createServer as createViteServer} from 'vite';
import {resolve} from 'node:path';
import {chat,speech,clips,model,voice,phrases,ServiceError,validateMessages} from './services';
const app=express();app.disable('x-powered-by');
app.use(express.json({limit:'48kb'}));
app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
// Same-origin writes, bounded requests, and loopback by default protect local credentials.
const limits=new Map<string,{count:number;reset:number}>();
app.use('/api',(req,res,next)=>{
 if(req.method==='GET')return next();
 const origin=req.headers.origin;
 if(origin && origin!==(process.env.APP_ORIGIN||`${req.protocol}://${req.get('host')}`))return res.status(403).json({error:'This origin is not allowed.'});
 const now=Date.now();for(const [key,value]of limits)if(value.reset<now)limits.delete(key);
 const key=req.ip||'local';const item=limits.get(key)??{count:0,reset:now+60000};item.count++;limits.set(key,item);
 if(item.count>30)return res.status(429).json({error:'Please pause a moment before trying again.'});next();
});
app.get('/api/health',(_req,res)=>res.json({chatReady:!!process.env.OPENAI_API_KEY,voiceReady:!!process.env.ELEVENLABS_API_KEY,model,voice,clipCount:clips.length}));
function route(handler:(body:any,signal:AbortSignal)=>Promise<unknown>){return async(req:express.Request,res:express.Response)=>{
 const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
 try{res.json(await handler(req.body,controller.signal));}catch(error){if(controller.signal.aborted)return;const known=error instanceof ServiceError;res.status(known?error.status:502).json({error:known?error.message:'Connection interrupted. Please try again.'});}
};}
app.post('/api/respond',(req,res)=>{const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});try{const result=respond(validateMessages(req.body?.messages),controller.signal);result.headers.forEach((v,k)=>res.setHeader(k,v));res.flushHeaders();Readable.fromWeb(result.body as any).pipe(res);}catch{res.status(400).json({error:'Invalid conversation request.'});}});
app.post('/api/chat',route((body,signal)=>chat(validateMessages(body?.messages),signal)));
app.post('/api/speech',route((body,signal)=>{if(typeof body?.text!=='string'||!body.text.trim()||body.text.length>1200)throw new ServiceError(400,'Speech text must be between 1 and 1,200 characters.');return speech(body.text.trim(),signal);}));
app.post('/api/phrase',route((body,signal)=>{if(!Object.hasOwn(phrases,body?.name))throw new ServiceError(400,'Unknown phrase.');return speech(phrases[body.name as keyof typeof phrases],signal);}));
app.use('/api',(_req,res)=>res.status(404).json({error:'Not found.'}));
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}else{
 const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
}
app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(err?.status===413?413:400).json({error:'Invalid request.'}));
app.listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log(`Roamie: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||4173}`));

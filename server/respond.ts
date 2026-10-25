import {chatPayload,normalizeReply,ServiceError} from './services.js';
import {partialText} from '../src/streaming.js';
import type {Message} from '../src/types.js';
export function respond(messages:Message[],signal:AbortSignal):Response {
 const encoder=new TextEncoder(),controller=new AbortController();
 const combined=AbortSignal.any([signal,controller.signal,AbortSignal.timeout(45000)]);
 const stream=new ReadableStream<Uint8Array>({async start(output){
  const emit=(value:unknown)=>{if(!combined.aborted)output.enqueue(encoder.encode(JSON.stringify(value)+'\n'));};
  try{
   if(!process.env.OPENAI_API_KEY)throw new ServiceError(503,'The conversation service is not configured.');
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({...chatPayload(messages),stream:true}),signal:combined});
   if(!response.ok||!response.body)throw new ServiceError(502,`Conversation unavailable (${response.status}). Try again.`);
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',raw='',last='',complete=false;
   try{while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let at;
    while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at).trim();buffer=buffer.slice(at+1);if(!line.startsWith('data: ')||line==='data: [DONE]')continue;
     const event=JSON.parse(line.slice(6));
     if(event.type==='response.output_text.delta'){raw+=event.delta;const text=partialText(raw);if(text!==last){last=text;emit({type:'text',text});}}
     if(event.type==='response.completed')complete=true;
     if(['error','response.failed','response.incomplete'].includes(event.type))throw new Error('Incomplete response');
    }if(done)break;
   }}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(!complete)throw new Error('Incomplete response');
   emit({type:'reply',reply:normalizeReply(JSON.parse(raw))});
  }catch(error){emit({type:'error',error:error instanceof ServiceError?error.message:'Connection interrupted. Please try again.'});}
  finally{try{output.close();}catch{}}
 },cancel(){controller.abort();}});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'}});
}

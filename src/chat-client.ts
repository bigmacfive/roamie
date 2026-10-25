import type {Message,Reply} from './types';
/** Plain JSON avoids streaming-reader support and buffering differences on glasses. */
export function requestReply(messages:Message[],signal:AbortSignal,timeoutMs=20000):Promise<Reply>{
 return new Promise((resolve,reject)=>{
  const controller=new AbortController();let settled=false;
  const finish=(error:Error|null,reply?:Reply)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);if(error)reject(error);else resolve(reply!);};
  const cancel=()=>{controller.abort();finish(new Error('Request cancelled.'));};
  const timer=setTimeout(()=>{controller.abort();finish(new Error('Connection interrupted. Please try again.'));},timeoutMs);
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted){cancel();return;}
  void fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages}),signal:controller.signal}).then(async response=>{
   const data=await response.json();
   if(!response.ok)throw Error(typeof data.error==='string'?data.error:'Connection unavailable. Please retry.');
   if(typeof data.text!=='string'||!data.text.trim())throw Error('No reply received. Please retry.');
   finish(null,{text:data.text.trim(),clipId:typeof data.clipId==='string'?data.clipId:'character-02-01'});
  }).catch(error=>finish(error instanceof Error?error:new Error('Connection unavailable. Please retry.')));
 });
}

/** Stream first; silently use JSON if the device buffers or drops the stream. */
export async function streamReply(messages:Message[],signal:AbortSignal,onText:(text:string)=>void,limits={first:4500,idle:5000,total:18000}):Promise<Reply>{
 let active=true;
 try{
  return await new Promise<Reply>((resolve,reject)=>{
   const controller=new AbortController();let settled=false,reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
   let progress:ReturnType<typeof setTimeout>;
   const finish=(error:Error|null,reply?:Reply)=>{if(settled)return;settled=true;active=false;clearTimeout(progress);clearTimeout(total);signal.removeEventListener('abort',cancel);controller.abort();void reader?.cancel().catch(()=>{});error?reject(error):resolve(reply!);};
   const cancel=()=>finish(new Error('Request cancelled.'));
   const arm=(ms:number)=>{clearTimeout(progress);progress=setTimeout(()=>finish(new Error('Stream stalled.')),ms);};
   const total=setTimeout(()=>finish(new Error('Stream timed out.')),limits.total);
   signal.addEventListener('abort',cancel,{once:true});if(signal.aborted){cancel();return;}arm(limits.first);
   void (async()=>{
    const response=await fetch('/api/respond',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson'},body:JSON.stringify({messages}),signal:controller.signal});
    if(settled){void response.body?.cancel().catch(()=>{});return;}
    if(!response.ok||!response.body?.getReader)throw Error('Stream unavailable.');
    reader=response.body.getReader();const decoder=new TextDecoder();let pending='',last='';
    const accept=(line:string)=>{
     if(settled||!line.trim())return;
     const event=JSON.parse(line);
     if(event.type==='error')throw Error('Stream interrupted.');
     if(event.type==='text'&&typeof event.text==='string'&&event.text!==last){last=event.text;if(active&&last){arm(limits.idle);onText(last);}}
     if(event.type==='reply'&&typeof event.reply?.text==='string'&&event.reply.text.trim())finish(null,event.reply);
    };
    while(!settled){const {done,value}=await reader.read();if(settled)return;pending+=decoder.decode(value,{stream:!done});let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at);pending=pending.slice(at+1);accept(line);}if(done){if(pending.trim())accept(pending);if(!settled)throw Error('Incomplete stream.');break;}}
   })().catch(error=>finish(error));
  });
 }catch(error){
  active=false;if(signal.aborted)throw error;
  return requestReply(messages,signal);
 }
}

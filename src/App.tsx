import {useEffect,useRef,useState} from 'react';
import {RotateCcw,CircleHelp} from 'lucide-react';
import {Character} from './Character';
import {NativeComposer} from './NativeComposer';
import {captionParts} from './streaming';
import {streamReply} from './chat-client';
import type {Clip,Message,Reply} from './types';
const GREETING="Hey, you. I'm happy you're here.";
export default function App(){
 const [clips,setClips]=useState<Clip[]>([]),[started,setStarted]=useState(false);
 const [userText,setUserText]=useState(''),[caption,setCaption]=useState(''),[error,setError]=useState('');
 const [,setBusy]=useState(false);
 const [showGuide,setShowGuide]=useState(()=>{try{return localStorage.getItem('roamie-glasses-input-v3')!=='seen';}catch{return true;}});
 const [clipId,setClipId]=useState('character-02-01'),[sequence,setSequence]=useState(0),[replayable,setReplayable]=useState(false);
 const abort=useRef<AbortController|null>(null),turn=useRef(0);
 const history=useRef<Message[]>([]),last=useRef<Reply|null>(null),queue=useRef<string[]>([]);
 const displaying=useRef(false),complete=useRef(true),watchdog=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{
  const c=new AbortController();
  // Neither API cold starts nor asset metadata can block the initial portrait/input.
  fetch('/character/motion-manifest.json',{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setClips).catch(()=>{});
  return()=>{c.abort();abort.current?.abort();if(watchdog.current)clearTimeout(watchdog.current);};
 },[]);
 function gesture(id:string){setClipId(id);setSequence(n=>n+1);}
 function stop(){turn.current++;abort.current?.abort();queue.current=[];displaying.current=false;complete.current=true;if(watchdog.current)clearTimeout(watchdog.current);setBusy(false);setCaption('');return turn.current;}
 function pump(id:number){
  if(id!==turn.current||displaying.current)return;
  const text=queue.current.shift();if(!text){if(complete.current)setBusy(false);return;}
  setCaption(text);displaying.current=true;
  // Keep each two-line caption readable without coupling it to audio or video.
  watchdog.current=setTimeout(()=>{if(id!==turn.current)return;displaying.current=false;pump(id);},Math.max(1800,text.split(/\s+/).length*330));
 }
 function enqueue(text:string,id:number){queue.current.push(...captionParts(text));pump(id);}
 function start(){const id=stop();setStarted(true);setShowGuide(false);setError('');try{localStorage.setItem('roamie-glasses-input-v3','seen');}catch{}last.current={text:GREETING,clipId:'character-02-13'};setReplayable(true);setBusy(true);enqueue(GREETING,id);gesture('character-02-13');setTimeout(()=>document.querySelector<HTMLInputElement>('.native-composer input')?.focus(),0);}
 async function send(text:string){
  if(!text.trim())return;const id=stop();const controller=new AbortController();abort.current=controller;complete.current=false;
  setUserText(text.trim());setError('');setBusy(true);setCaption('');
  const messages=[...history.current,{role:'user' as const,content:text.trim()}].slice(-23);
  let preview='',paint:ReturnType<typeof setTimeout>|undefined;
  try{
   const reply=await streamReply(messages,controller.signal,text=>{
    preview=captionParts(text)[0]||'';
    if(paint===undefined)paint=setTimeout(()=>{paint=undefined;if(id===turn.current)setCaption(preview);},70);
   });
   clearTimeout(paint);
   if(id!==turn.current)return;
   last.current=reply;setReplayable(true);
   history.current=[...messages,{role:'assistant',content:reply.text}].slice(-22) as Message[];
   complete.current=true;enqueue(reply.text,id);gesture(reply.clipId);
  }catch(e){if(id!==turn.current)return;complete.current=true;setBusy(false);setError((e as Error).message);}finally{clearTimeout(paint);}
 }

 function replay(){if(!last.current)return;const reply=last.current,id=stop();setError('');setBusy(true);enqueue(reply.text,id);gesture(reply.clipId);}
 useEffect(()=>{if(showGuide)document.querySelector<HTMLButtonElement>('.guide button')?.focus();},[showGuide]);
 return <main className="shell"><div className="display">
  <section className="conversation" aria-label="Conversation"><div className="subtitle-space">{started&&userText&&<p className="user-caption" aria-label="You said">{userText}</p>}{!started?<h1>Hey, you.</h1>:<p className="subtitle" aria-live="polite">{caption}</p>}</div>{error&&<p className="error" role="alert">{error}</p>}</section>
  <div className="stage"><Character clip={clips.find(c=>c.id===clipId)} sequence={sequence}/><div className="stage-shade"/></div>
  {!started&&!showGuide&&<button className="start" onClick={start}>Start conversation</button>}
  {started&&!showGuide&&<div className="glasses-input"><NativeComposer onCommit={text=>void send(text)} /><div className="minimal-actions"><button aria-label="Replay reply" disabled={!replayable} onClick={replay}><RotateCcw size={18}/></button><button aria-label="How to use" onClick={()=>setShowGuide(true)}><CircleHelp size={18}/></button></div></div>}
  {showGuide&&<section className="guide" role="dialog" aria-modal="true" aria-label="Using Roamie on your glasses"><h2>Just talk to me.</h2><ol><li><b>Pinch to talk</b><span>Pinch the “Pinch to speak” field below me.</span></li><li><b>Speak or handwrite</b><span>Finish your input. It sends automatically.</span></li><li><b>Read our conversation</b><span>Your words appear above my reply.</span></li></ol><p>Silent conversation. No audio plays.<br/>Choose dictation in the system composer, then finish to send.</p><button onClick={()=>started?setShowGuide(false):start()}>{started?'Got it':'Start conversation'}</button></section>}
 </div></main>;
}

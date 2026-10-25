import {useEffect,useRef,useState} from 'react';
import type {Clip} from './types';
const IDLE='/character/motion-v8/character-02-01.webp';
export function Character({clip,sequence}:{clip?:Clip;sequence:number}){
 const [source,setSource]=useState(IDLE),cooldowns=useRef(new Map<string,number>());
 useEffect(()=>{
  if(!clip||clip.id==='character-02-01')return;
  if(Date.now()-(cooldowns.current.get(clip.id)??0)<clip.cooldown*1000)return;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  // Warm only compressed bytes. A second Image would decode another animation.
  fetch(clip.file,{signal:controller.signal,cache:'force-cache'}).then(async response=>{if(!response.ok)throw Error();await response.arrayBuffer();if(controller.signal.aborted)return;cooldowns.current.set(clip.id,Date.now());setSource(clip.file);timer=setTimeout(()=>setSource(IDLE),6000);}).catch(()=>{});
  return()=>{controller.abort();clearTimeout(timer);};
 },[clip,sequence]);
 return <div className="character" aria-label="Roamie"><img className="motion-fallback" src={source} alt="Roamie, animated" onError={()=>setSource(IDLE)}/></div>;
}

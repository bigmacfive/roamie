import {useEffect,useRef} from 'react';

/** A real, persistent input: a trusted pinch opens the glasses system composer. */
export function NativeComposer({onCommit}:{onCommit:(text:string)=>void}){
 const input=useRef<HTMLInputElement>(null),commit=useRef(onCommit);
 commit.current=onCommit;
 useEffect(()=>{
  const el=input.current!;let timer:ReturnType<typeof setTimeout>|undefined,restoreTimer:ReturnType<typeof setTimeout>|undefined,composing=false;
  const restore=()=>{const active=document.activeElement;if(!document.hidden&&(!active||active===document.body||active===document.documentElement||active.matches('#root,.shell,.display,.stage,.native-composer')))el.focus({preventScroll:true});};
  const onReturn=()=>{clearTimeout(restoreTimer);restoreTimer=setTimeout(restore,100);};
  const onFocus=(event:FocusEvent)=>{if(event.target instanceof HTMLElement&&event.target.matches('body,html,#root,.shell,.display,.stage,.native-composer'))onReturn();};
  const submit=()=>{clearTimeout(timer);if(composing)return;const text=el.value.trim();if(!text)return;el.value='';commit.current(text);onReturn();};
  const changed=(event:Event)=>{clearTimeout(timer);if(composing||(event as InputEvent).isComposing)return;timer=setTimeout(submit,event.type==='change'?0:350);};
  const begin=()=>{composing=true;clearTimeout(timer);};
  const end=()=>{composing=false;timer=setTimeout(submit,350);};
  document.addEventListener('focusin',onFocus);window.addEventListener('focus',onReturn);document.addEventListener('visibilitychange',onReturn);
  el.addEventListener('input',changed);el.addEventListener('change',changed);el.addEventListener('compositionstart',begin);el.addEventListener('compositionend',end);el.addEventListener('blur',submit);
  return()=>{clearTimeout(timer);clearTimeout(restoreTimer);document.removeEventListener('focusin',onFocus);window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn);el.removeEventListener('input',changed);el.removeEventListener('change',changed);el.removeEventListener('compositionstart',begin);el.removeEventListener('compositionend',end);el.removeEventListener('blur',submit);};
 },[]);
 return <form className="native-composer" onSubmit={event=>{event.preventDefault();const el=input.current!;const text=el.value.trim();if(text){el.value='';commit.current(text);}}}>
  <input ref={input} type="text" aria-label="Pinch to speak or handwrite" placeholder="Pinch to speak" maxLength={1500} autoComplete="off"/>
 </form>;
}

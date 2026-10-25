export type Framing = {time:number;scale:number;x:number;y:number};
export type Clip = {id:string; label:string; event:string; file:string; cooldown:number;framing?:Framing[]};
export type Message = {role:'user'|'assistant'; content:string};
export type Cue = {text:string; start:number; end:number};
export type Speech = {audio:string; cues:Cue[]; text:string};
export type Reply = {text:string; clipId:string};

import type {Cue} from './types';
export type Alignment = {characters:string[]; character_start_times_seconds:number[]; character_end_times_seconds:number[]};
export function makeCues(alignment?:Alignment|null):Cue[] {
  if (!alignment || !alignment.characters?.length) return [];
  const {characters,character_start_times_seconds:starts,character_end_times_seconds:ends}=alignment;
  if (characters.length!==starts.length || starts.length!==ends.length || starts.some((n,i)=>!Number.isFinite(n)||n<0||!Number.isFinite(ends[i])||ends[i]<n||(i>0&&n<starts[i-1]))) return [];
  const words:{text:string;start:number;end:number}[]=[];
  let word='',start=0,end=0;
  characters.forEach((ch,i)=>{ if (!word) start=starts[i]; word+=ch; end=ends[i]; if (/\s/.test(ch)||i===characters.length-1){if(word.trim())words.push({text:word.trim(),start,end});word='';} });
  const cues:Cue[]=[];
  for(const w of words){const last=cues.at(-1); if(last && last.text.length+w.text.length+1<=60 && w.end-last.start<=4.5 && !/[.!?]$/.test(last.text)){last.text+=' '+w.text;last.end=w.end;}else cues.push({...w});}
  return cues;
}
export function cueAt(cues:Cue[],time:number):string {
  return cues.find((c,i)=>time>=c.start && time<(cues[i+1]?.start??c.end+0.25))?.text??'';
}

import type {Framing} from './types';
export function framingAt(samples:Framing[]|undefined,time:number):Framing {
 if(!samples?.length)return {time,scale:1,x:0,y:0};
 const next=samples.findIndex(s=>s.time>time);
 if(next===0)return samples[0];if(next===-1)return samples[samples.length-1];
 const a=samples[next-1],b=samples[next],t=(time-a.time)/(b.time-a.time);
 return {time,scale:a.scale,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}

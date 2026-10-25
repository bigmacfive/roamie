/** Decode only the text field of an incomplete structured JSON response. */
export function partialText(json:string):string {
 const match=/"text"\s*:\s*"/.exec(json);if(!match)return '';
 let out='';
 for(let i=match.index+match[0].length;i<json.length;i++){
  const c=json[i];if(c==='"')break;
  if(c!=='\\'){out+=c;continue;}
  const length=json[i+1]==='u'?6:2;if(i+length>json.length)break;
  try{out+=JSON.parse('"'+json.slice(i,i+length)+'"');}catch{break;}i+=length-1;
 }
 return out;
}
export async function* jsonLines(body:ReadableStream<Uint8Array>){
 const reader=body.getReader(),decoder=new TextDecoder();let pending='';
 try{while(true){const {done,value}=await reader.read();pending+=decoder.decode(value,{stream:!done});let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at).trim();pending=pending.slice(at+1);if(line)yield JSON.parse(line);}if(done)break;}if(pending.trim())yield JSON.parse(pending);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function captionParts(text:string):string[]{
 const parts:string[]=[];for(const word of text.trim().split(/\s+/)){if(!word)continue;const last=parts.at(-1);if(last&&last.length+word.length+1<=64)parts[parts.length-1]+=' '+word;else parts.push(word);}return parts;
}

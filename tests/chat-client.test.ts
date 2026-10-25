import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestReply} from '../src/chat-client';
const messages=[{role:'user' as const,content:'Hello'}];
test('plain JSON returns a readable reply without a streaming reader',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async()=>Response.json({text:'Hey, you.',clipId:'character-02-01'});assert.equal((await requestReply(messages,new AbortController().signal)).text,'Hey, you.');}finally{globalThis.fetch=original;}
});
test('a hung network cannot leave the UI waiting forever even if fetch ignores abort',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=()=>new Promise(()=>{});await assert.rejects(requestReply(messages,new AbortController().signal,15),/Connection interrupted/);}finally{globalThis.fetch=original;}
});
test('provider error and cancellation settle the request',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async()=>Response.json({error:'Usage limit reached.'},{status:429});await assert.rejects(requestReply(messages,new AbortController().signal),/Usage limit/);globalThis.fetch=()=>new Promise(()=>{});const controller=new AbortController();const pending=requestReply(messages,controller.signal);controller.abort();await assert.rejects(pending,/cancelled/);}finally{globalThis.fetch=original;}
});
import {streamReply} from '../src/chat-client';
const fast={first:15,idle:15,total:100};
test('stream delivers text before completion and returns without waiting for connection close',async()=>{
 const original=globalThis.fetch;try{
  const encoder=new TextEncoder();let delivered='';
  globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(encoder.encode('{"type":"text","text":"Hey"}\n'));setTimeout(()=>c.enqueue(encoder.encode('{"type":"reply","reply":{"text":"Hey, you.","clipId":"character-02-01"}}\n')),5);}}));
  const reply=await streamReply(messages,new AbortController().signal,text=>delivered=text,fast);assert.equal(delivered,'Hey');assert.equal(reply.text,'Hey, you.');
 }finally{globalThis.fetch=original;}
});
test('buffered stream automatically falls back once to JSON',async()=>{
 const original=globalThis.fetch;try{let calls=0;globalThis.fetch=async url=>{calls++;return String(url).endsWith('/api/respond')?new Response(new ReadableStream({start(){}})):Response.json({text:'Fallback reply',clipId:'character-02-01'});};assert.equal((await streamReply(messages,new AbortController().signal,()=>{},fast)).text,'Fallback reply');assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
test('cancelled stream cannot emit stale text or launch a fallback',async()=>{
 const original=globalThis.fetch;try{let calls=0;globalThis.fetch=async()=>{calls++;return new Response(new ReadableStream({start(){}}));};const controller=new AbortController();const pending=streamReply(messages,controller.signal,()=>assert.fail('stale text'),fast);controller.abort();await assert.rejects(pending,/cancelled/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});

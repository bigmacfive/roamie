import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import type {Speech} from '../src/types';
import {phrases,speech,voice,voiceModel} from '../server/services';
const bundle:Record<string,Speech>={};
for(const [name,text]of Object.entries(phrases)){
 try{const result=await speech(text);bundle[createHash('sha256').update(JSON.stringify({voice,voiceModel,text,version:1})).digest('hex')]=result;console.log(`${name}: ready, ${result.cues.length} subtitle cues; voice ${voice}`);}catch(error){console.error(`${name}: ${error instanceof Error?error.message:'Generation failed'}`);process.exitCode=1;break;}
}

if(!process.exitCode)await writeFile('server/generated-voices.json',JSON.stringify(bundle));

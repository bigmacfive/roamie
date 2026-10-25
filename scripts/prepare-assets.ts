import {readFile,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
const source=resolve('../Character02-Final');
const manifest=JSON.parse(await readFile(resolve(source,'mapping.json'),'utf8'));
await mkdir('public/character/videos',{recursive:true});
const clips=[];
for(const clip of manifest.clips){
 const bytes=await readFile(resolve(source,clip.file));
 if(createHash('sha256').update(bytes).digest('hex')!==clip.output_sha256) throw new Error(`Hash mismatch: ${clip.id}`);
 await copyFile(resolve(source,clip.file),resolve('public/character/videos',basename(clip.file)));
 clips.push({id:clip.id,label:clip.slug.replaceAll('_',' '),event:clip.app_event,file:`/character/videos/${basename(clip.file)}`,cooldown:clip.cooldown_seconds});
}
if(clips.length!==manifest.delivered_count) throw new Error('Manifest count mismatch');
await writeFile('public/character/manifest.json',JSON.stringify(clips));
execFileSync('ffmpeg',['-y','-c:v','libvpx-vp9','-i',resolve(source,'videos/01-calm_smile.webm'),'-frames:v','1','public/character/neutral.png'],{stdio:'ignore'});
console.log(`Verified and copied ${clips.length} clips. Neutral alpha frame extracted.`);

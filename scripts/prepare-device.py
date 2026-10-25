import json,pathlib,subprocess,concurrent.futures
root=pathlib.Path('public/character');clips=json.load(open(root/'manifest.json'));framing=json.load(open(root/'framing.json'));out=root/'device-v1';out.mkdir(exist_ok=True)
def expr(frames,key):
 e=str(frames[-1][key]*480)
 for a,b in reversed(list(zip(frames,frames[1:]))):
  v=f"({a[key]*480}+({(b[key]-a[key])*480})*(t-{a['time']})/{b['time']-a['time']})"
  e=f"if(lt(t,{b['time']}),{v},{e})"
 return f"if(lt(t,{frames[0]['time']}),{frames[0][key]*480},{e})"
def encode(c):
 frames=framing[c['id']];size=round(480*frames[0]['scale']/2)*2
 dest=out/(c['id']+'.mp4')
 if dest.exists():return {**c,'file':'/character/device-v1/'+dest.name}
 filt=f"[0:v]scale={size}:{size}:flags=lanczos,format=rgba[fg];color=c=black:s=480x480:r=24[bg];[bg][fg]overlay=x='{expr(frames,'x')}':y='{expr(frames,'y')}':eval=frame:shortest=1,format=yuv420p[v]"
 subprocess.run(['ffmpeg','-v','error','-y','-c:v','libvpx-vp9','-i','public'+c['file'],'-filter_complex',filt,'-map','[v]','-an','-c:v','libx264','-profile:v','baseline','-level','3.0','-crf','24','-preset','veryfast','-threads','2','-g','24','-bf','0','-movflags','+faststart',str(dest)],check=True)
 return {**c,'file':'/character/device-v1/'+dest.name}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as p:result=list(p.map(encode,clips))
(root/'device-manifest.json').write_text(json.dumps(result,separators=(',',':')))
from PIL import Image
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(out/'character-02-01.mp4'),'-vf','fps=10,scale=320:320','-f','rawvideo','-pix_fmt','rgb24','-'])
size=320*320*3
frames=[Image.frombytes('RGB',(320,320),raw[i:i+size]) for i in range(0,len(raw),size)]
frames[0].save(out/'idle.webp',save_all=True,append_images=frames[1:],duration=100,loop=0,quality=62,method=4)
print('Device MP4s:',len(result),'bytes:',sum(p.stat().st_size for p in out.iterdir()),flush=True)

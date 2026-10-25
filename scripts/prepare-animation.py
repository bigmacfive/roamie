"""Encode glasses animations directly from alpha originals, without an MP4 intermediate."""
import json,pathlib,subprocess,concurrent.futures
from PIL import Image
root=pathlib.Path('public/character');out=root/'motion-v8';out.mkdir(exist_ok=True)
clips=json.loads((root/'manifest.json').read_text());framing=json.loads((root/'framing.json').read_text())
RESOLUTION=360
FPS=24
QUALITY=92
def expr(frames,key):
 e=str(frames[-1][key]*RESOLUTION)
 for a,b in reversed(list(zip(frames,frames[1:]))):
  value=f"({a[key]*RESOLUTION}+({(b[key]-a[key])*RESOLUTION})*(t-{a['time']})/{b['time']-a['time']})"
  e=f"if(lt(t,{b['time']}),{value},{e})"
 return f"if(lt(t,{frames[0]['time']}),{frames[0][key]*RESOLUTION},{e})"
def encode(c):
 dest=out/(c['id']+'.webp')
 if not dest.exists():
  anchors=framing[c['id']];size=round(RESOLUTION*anchors[0]['scale']/2)*2
  filt=f"[0:v]fps={FPS},scale={size}:{size}:flags=lanczos,format=rgba[fg];color=c=black:s={RESOLUTION}x{RESOLUTION}:r={FPS}[bg];[bg][fg]overlay=x='{expr(anchors,'x')}':y='{expr(anchors,'y')}':eval=frame:shortest=1:format=rgb,format=rgb24[v]"
  raw=subprocess.check_output(['ffmpeg','-v','error','-c:v','libvpx-vp9','-i','public'+c['file'],'-filter_complex',filt,'-map','[v]','-f','rawvideo','-pix_fmt','rgb24','-'])
  frame_size=RESOLUTION*RESOLUTION*3
  frames=[Image.frombytes('RGB',(RESOLUTION,RESOLUTION),raw[i:i+frame_size]) for i in range(0,len(raw),frame_size)]
  frames[0].save(dest,save_all=True,append_images=frames[1:],duration=[round((i+1)*1000/FPS)-round(i*1000/FPS) for i in range(len(frames))],loop=0,quality=QUALITY,method=4)
  print(dest.name,dest.stat().st_size,flush=True)
 return {**c,'file':'/character/motion-v8/'+dest.name}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: result=list(pool.map(encode,clips))
(root/'motion-manifest.json').write_text(json.dumps(result,separators=(',',':')))
print('Animated clips:',len(result),'bytes:',sum(p.stat().st_size for p in out.iterdir()))

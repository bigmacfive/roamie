import json,subprocess,concurrent.futures, pathlib,statistics
root=pathlib.Path('public/character');clips=json.load(open(root/'manifest.json'))
frames=pathlib.Path('output/face-frames');frames.mkdir(parents=True,exist_ok=True)
def extract(c):
 subprocess.run(['ffmpeg','-y','-v','error','-i','public'+c['file'],'-vf','fps=4,scale=480:480','-threads','1',str(frames/(c['id']+'-%03d.png'))],check=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(extract,clips))
print('Face frames extracted',flush=True)
r=subprocess.run(['output/face-anchors',str(frames)],capture_output=True,check=True)
raw=json.loads(r.stdout);group={}
for a in raw:
 name=a.pop('file');clip,index=name.rsplit('-',1);a['time']=(int(index[:3])-.5)/4;group.setdefault(clip,[]).append(a)
base=group['character-02-01'];target={k:statistics.median(x[k] for x in base) for k in ['x','y','eyeDistance']}
output={}
for clip,seq in group.items():
 seq.sort(key=lambda a:a['time']);scale=target['eyeDistance']/statistics.median(a['eyeDistance'] for a in seq)
 if not .65<scale<1.55:raise ValueError('Outlier scale '+clip)
 output[clip]=[]
 for i,a in enumerate(seq):
  near=seq[max(0,i-1):i+2];x=statistics.median(v['x'] for v in near);y=statistics.median(v['y'] for v in near)
  output[clip].append({'time':round(a['time'],3),'scale':round(scale,5),'x':round(target['x']-x*scale,5),'y':round(target['y']-y*scale,5)})
if len(output)!=41:raise ValueError('Missing face detections')
(root/'framing.json').write_text(json.dumps(output,separators=(',',':')))
pathlib.Path('output/face-detections.json').write_text(json.dumps(group))
print('Aligned all',len(output),'clips;',len(raw),'face samples. Scale range:',round(min(v[0]['scale'] for v in output.values()),3),round(max(v[0]['scale'] for v in output.values()),3))

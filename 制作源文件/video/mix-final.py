from pathlib import Path
import json,subprocess,wave
r=Path(__file__).resolve().parent.parent;v=r/'video'
delivery=r/'site/dist/assets/qiaoxiang-letter.mp4'
if not delivery.exists():delivery=r.parent/'互动网页/assets/qiaoxiang-letter.mp4'
scenes=json.loads((v/'scenes.json').read_text(encoding='utf8'))
# Keep the editable HyperFrames source in sync with the delivery audio.
p=v/'make-video.py';t=p.read_text(encoding='utf8').replace('data-volume="0.6"','data-volume="0.35"');p.write_text(t,encoding='utf8')
inputs=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(v/'music.wav')]
for i in range(6):inputs+=['-i',str(v/f'voice-{i}.wav')]
filters=['[0:a]volume=0.35,afade=t=out:st=60:d=6[bg]']
for i,s in enumerate(scenes):filters.append(f'[{i+1}:a]adelay={int((s["start"]+.8)*1000)}:all=1[a{i}]')
filters.append('[bg]'+''.join(f'[a{i}]' for i in range(6))+'amix=inputs=7:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95,loudnorm=I=-17:TP=-1.5:LRA=10[out]')
subprocess.run(inputs+['-filter_complex',';'.join(filters),'-map','[out]','-ar','48000','-ac','2',str(v/'final-mix.wav')],check=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(delivery),'-i',str(v/'final-mix.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t','66','-movflags','+faststart',str(v/'qiaoxiang-letter-male.mp4')],check=True)
print('Natural male narration and music mixed into the final 66s film.')

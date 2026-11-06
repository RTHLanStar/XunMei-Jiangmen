import json, wave, math, html
from pathlib import Path
import numpy as np
root=Path(__file__).parent
scenes=json.loads((root/'scenes.json').read_text(encoding='utf-8-sig'))
sr=44100; duration=66; music=np.zeros((sr*duration,2),dtype=np.float64)
# Original deterministic pentatonic instrumental: D F# A B E, 72 BPM.
melody=[62,66,69,71,69,66,64,62, 66,69,74,71,69,66,64,66, 69,71,74,76,74,71,69,66, 64,66,69,66,64,62,59,62]
beat=60/72
for k in range(68):
    start=1+k*beat; note=melody[k%len(melody)]; length=2.8; t=np.arange(int(sr*length))/sr; f=440*2**((note-69)/12)
    env=(1-np.exp(-t*85))*np.exp(-t*2.2)
    tone=(np.sin(2*np.pi*f*t)+.26*np.sin(2*np.pi*2*f*t)+.10*np.sin(2*np.pi*3*f*t))*env*.10
    # fixed light stereo delay, no external samples
    for ch,delay in [(0,0),(1,.013)]:
        a=int((start+delay)*sr); b=min(a+len(tone),len(music)); music[a:b,ch]+=tone[:b-a]
for k,chord in enumerate([(50,57,62),(47,54,59),(43,50,57),(45,52,59)]*4):
    start=k*4*beat; length=5; t=np.arange(int(sr*length))/sr; env=np.minimum(t/1.2,1)*np.exp(-t*.6)
    tone=sum(np.sin(2*np.pi*(440*2**((n-69)/12))*t) for n in chord)*env*.018
    a=int(start*sr); b=min(a+len(tone),len(music));music[a:b]+=tone[:b-a,None]
fade=np.minimum(np.arange(len(music))/(sr*2),1)*np.minimum((len(music)-1-np.arange(len(music)))/(sr*4),1)
music*=fade[:,None]
with wave.open(str(root/'music.wav'),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((np.clip(music,-.98,.98)*32767).astype('<i2').tobytes())
voice_durations=[]
for i,s in enumerate(scenes):
    with wave.open(str(root/f'voice-{i}.wav')) as w:d=w.getnframes()/w.getframerate()
    voice_durations.append(d)
    print('VOICE',i,round(d,2),'slot',s['duration']-1.4)
    if d>s['duration']-1.4:raise RuntimeError('Narration exceeds scene')
# CSS selects the corresponding quadrant of the image atlas without modifying the source bitmap.
css='''@font-face{font-family:"Microsoft YaHei";src:local("Microsoft YaHei")}@font-face{font-family:SimSun;src:local("SimSun")}*{box-sizing:border-box;margin:0}html,body{width:1920px;height:1080px;overflow:hidden;background:#0f2824}body{font-family:"Microsoft YaHei",sans-serif;color:#f5f0e6}.scene{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden}.scene:not(#s0){opacity:0}.picture{position:absolute;inset:0;background-image:url(atlas.png);background-size:200% auto}.q0{background-position:0 0}.q1{background-position:100% 0}.q2{background-position:0 100%}.q3{background-position:100% 100%}.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,40,36,.78),rgba(15,40,36,.20) 65%,rgba(15,40,36,.12))}.scene-content{width:100%;height:100%;padding:135px 140px 100px;display:flex;flex-direction:column;gap:24px;position:relative}.label{font-size:27px;letter-spacing:6px;color:#f5f0e6}.title{font-family:SimSun,serif;font-size:115px;font-weight:400;letter-spacing:8px;line-height:1.4;max-width:1300px}.subtitle{font-family:SimSun,serif;font-size:43px;line-height:1.6;letter-spacing:4px;max-width:1350px}.rule{width:160px;height:2px;background:#d7b978;margin-top:12px}.caption{margin-top:auto;padding:18px 24px;background:rgba(15,40,36,.88);font-size:32px;line-height:1.6;max-width:1600px;border-radius:2px}.credit{font-size:19px;letter-spacing:1px;color:#f5f0e6}.end .title{font-size:100px}.end .subtitle{font-size:66px}.end .shade{background:rgba(15,40,36,.65)}'''
parts=['<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script><style>'+css+'</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="66" data-width="1920" data-height="1080">']
for i,s in enumerate(scenes):
    parts.append(f'<section id="s{i}" data-layout-allow-overlap data-layout-allow-occlusion class="scene {"end" if i==5 else ""}" style="z-index:{i+1}"><div class="picture q{s["image"]}" data-layout-ignore></div><div class="shade" data-layout-ignore></div><div class="scene-content"><p class="label">{html.escape(s["label"])}</p><h1 class="title">{html.escape(s["title"])}</h1><p class="subtitle">{html.escape(s["subtitle"])}</p><div class="rule"></div><p class="caption">{html.escape(s["caption"])}</p><p class="credit">寻美江门 AIGC 原创作品 · AI 艺术演绎 / 非实拍</p></div></section>')
    parts.append(f'<audio id="voice{i}" class="clip" src="voice-{i}.wav" data-start="{s["start"]+.9}" data-duration="{voice_durations[i]:.4f}" data-track-index="1" data-volume="1"></audio>')
parts.append('<audio id="music" class="clip" src="music.wav" data-start="0" data-duration="66" data-track-index="2" data-volume="0.35"></audio></div><script>window.__timelines=window.__timelines||{}; const tl=gsap.timeline({paused:true});')
for i,s in enumerate(scenes):
    T=s['start'];D=s['duration'];sel=f'#s{i}'
    if i:parts.append(f'tl.set("#s{i-1}",{{opacity:0}},{T+.45});tl.to("{sel}",{{opacity:1,duration:.85,ease:"sine.inOut"}},{T-.4});')
    parts.extend([f'tl.from("{sel} .picture",{{scale:1.08,duration:{D+1},ease:"none"}},{max(0,T-.4)});',f'tl.from("{sel} .label",{{y:18,opacity:0,duration:.8,ease:"power2.out"}},{T+.3});',f'tl.from("{sel} .title",{{y:35,opacity:0,duration:1.1,ease:"power3.out"}},{T+.5});',f'tl.from("{sel} .subtitle",{{y:20,opacity:0,duration:1,ease:"sine.out"}},{T+.8});',f'tl.from("{sel} .rule",{{scaleX:0,transformOrigin:"left",duration:1,ease:"power1.out"}},{T+1});',f'tl.from("{sel} .caption",{{y:14,opacity:0,duration:.6,ease:"power2.out"}},{T+.9});',f'tl.from("{sel} .credit",{{opacity:0,duration:.8,ease:"sine.out"}},{T+1.1});'])
parts.append('tl.to("#root",{opacity:0,duration:1.3,ease:"sine.inOut"},64.7);window.__timelines.main=tl;</script></body></html>')
(root/'index.html').write_text(''.join(parts),encoding='utf-8')
def stamp(t):
    h=int(t//3600);m=int(t%3600//60);s=t%60;return f'{h:02}:{m:02}:{s:06.3f}'
vtt=['WEBVTT',''];srt=[]
for i,s in enumerate(scenes):
    start=s['start']+.8;end=s['start']+s['duration']-.6
    vtt.extend([f'{stamp(start)} --> {stamp(end)}',s['narration'],''])
    srt.extend([str(i+1),f'{stamp(start).replace(".",",")} --> {stamp(end).replace(".",",")}',s['narration'],''])
(root/'subtitles.vtt').write_text('\n'.join(vtt),encoding='utf8');(root/'subtitles.srt').write_text('\n'.join(srt),encoding='utf8')
print('Composition and original music authored.')

import asyncio,json,sys,subprocess
from pathlib import Path
r=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(r/'.runtime/python'))
import edge_tts
scenes=json.loads((r/'video/scenes.json').read_text(encoding='utf8'))
async def run():
    for i,s in enumerate(scenes):
        out=r/'video'/f'neural-{i}.mp3'
        await edge_tts.Communicate(s['narration'],'zh-CN-YunjianNeural',rate='-6%',pitch='-6Hz').save(str(out))
        d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(out)]))
        slot=s['duration']-1.4
        ratio=max(1,d/slot)
        # Allow gentle pitch-preserving timing adjustment only when necessary.
        if ratio>1.15:raise RuntimeError(f'Voice {i} needs excessive speed adjustment {ratio}')
        filt=f'atempo={ratio:.6f},highpass=f=65,lowpass=f=11000,loudnorm=I=-18:TP=-2:LRA=9,afade=t=in:d=0.06'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(out),'-af',filt,'-ar','48000','-ac','1',str(r/'video'/f'voice-{i}.wav')],check=True)
        print('Natural male voice',i,'duration',round(d,3),'timing ratio',round(ratio,3),flush=True)
asyncio.run(run())

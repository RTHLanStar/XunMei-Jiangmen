"""Build the deterministic 66s photographic film from frozen local assets."""
from pathlib import Path
import json
from html import escape

ROOT = Path(__file__).resolve().parent
SHOTS = [
    ('letter', 0, 4.5, '一封来信', 1.04, 1.015, 0, 0),
    ('tower-wide', 4.5, 10.3, '开平碉楼', 1.015, 1.065, -12, 12),
    ('tower-detail', 10.3, 18.5, '窗前的牵挂', 1.06, 1.015, 14, -8),
    ('street-wide', 18.5, 24, '赤坎骑楼', 1.025, 1.055, 15, -15),
    ('street-detail', 24, 30, '檐下的日常', 1.06, 1.02, -10, 10),
    ('river-wide', 30, 35.5, '西江水岸', 1.025, 1.055, -15, 12),
    ('river-detail', 35.5, 41, '水的来信', 1.055, 1.015, 12, -10),
    ('peel-wide', 41, 47.6, '新会陈皮', 1.015, 1.06, 0, 0),
    ('peel-detail', 47.6, 53.8, '时光的纹理', 1.055, 1.015, -8, 8),
    ('letter', 53.8, 66, '侨乡有来信', 1.015, 1.035, 0, 0),
]
CAPTIONS = json.loads((ROOT/'captions.json').read_text(encoding='utf8'))
css = '''
@font-face{font-family:YaHei;src:local("Microsoft YaHei")}
@font-face{font-family:Song;src:local("SimSun")}
*{box-sizing:border-box;margin:0}html,body{width:100%;height:100%;overflow:hidden;background:#142a25}
body{font-family:YaHei,sans-serif;color:#fff8ea}#root{position:relative;width:100%;height:100%;overflow:hidden}
.shot,.visual,.picture,.film-shade{position:absolute;inset:0;width:100%;height:100%}.shot{overflow:hidden}
.picture{object-fit:cover;transform-origin:center}.film-shade{background:linear-gradient(0deg,rgba(13,24,21,.30),transparent 24%)}
.chapter{position:absolute;left:112px;top:92px;z-index:30;width:500px;height:160px}
#chapter0{left:1210px;top:148px;width:500px}
.chapter-inner{padding:20px 26px;width:100%;background:linear-gradient(90deg,rgba(15,36,30,.79),rgba(15,36,30,.45) 78%,transparent)}
.chapter small{display:block;font-size:22px;letter-spacing:5px;margin-bottom:13px;color:#fffaf1}
.chapter h2{font-family:Song,serif;font-weight:400;font-size:58px;letter-spacing:6px;line-height:1.2}
.paper-copy{position:absolute;z-index:30;left:298px;top:308px;width:940px;height:460px;color:#26382b;transform:rotate(-9deg);transform-origin:center}
.paper-inner{width:100%;height:100%}.paper-kicker{font-size:23px;letter-spacing:7px;margin-bottom:35px;color:#596149}
.paper-copy h1,.paper-copy h2{font-family:Song,serif;font-size:98px;font-weight:400;letter-spacing:12px;line-height:1.38}
.paper-copy .en{font-size:20px;letter-spacing:5px;margin-top:27px;color:#414b35}
.paper-copy.ending{top:264px;left:330px;width:900px}
.ending h2{font-size:76px;letter-spacing:9px;line-height:1.55}
.signature{font-size:24px;letter-spacing:2px;margin-top:38px;color:#586247}
.caption{position:absolute;left:150px;right:150px;bottom:90px;height:76px;z-index:50;display:flex;align-items:center;justify-content:center}
.caption span{display:block;padding:13px 27px 15px;background:rgba(14,27,23,.78);border-radius:4px;color:#fffaf1;font-size:38px;line-height:1.25;letter-spacing:2px;text-align:center}
.disclosure{position:absolute;z-index:60;top:44px;right:62px;padding:10px 15px;background:rgba(16,29,25,.66);color:#fff8e9;font-size:19px;letter-spacing:2px}
'''
parts = []
motions = []
for i, (name,start,end,label,s0,s1,x0,x1) in enumerate(SHOTS):
    duration = min(66,end+.65)-start
    parts.append(f'<section id="shot{i}" class="clip shot" data-start="{start}" data-duration="{duration:.3f}" data-track-index="0" data-layout-allow-overlap data-layout-allow-occlusion style="z-index:{i+1}" aria-label="{label}"><div class="visual"><img class="picture" src="images/{name}.png" alt="{label}的AI艺术影像" data-layout-ignore><div class="film-shade" data-layout-ignore></div></div></section>')
    if i:
        motions.append(f'tl.fromTo("#shot{i} .visual",{{opacity:0}},{{opacity:1,duration:.65,ease:"sine.inOut",immediateRender:false}},{start});')
    motions.append(f'tl.fromTo("#shot{i} .picture",{{scale:{s0},x:{x0}}},{{scale:{s1},x:{x1},duration:{duration:.3f},ease:"none",immediateRender:false}},{start});')
parts.append('<section id="intro" class="clip paper-copy" data-start="0" data-duration="4.5" data-track-index="1" data-layout-allow-overlap data-layout-allow-occlusion><div class="paper-inner"><p class="paper-kicker">一封写给故乡的信</p><h1>侨乡来信</h1><p class="en">JIANGMEN · 2026</p></div></section>')
motions.extend(['tl.fromTo("#intro .paper-inner",{opacity:0,y:10},{opacity:1,y:0,duration:.8,ease:"sine.out"},.1);','tl.to("#intro .paper-inner",{opacity:0,duration:.55},3.65);'])
for i,(start,kicker,title) in enumerate([(5.0,'01 / 开平碉楼','楼的远望'),(19.15,'02 / 赤坎骑楼','街的回声'),(30.7,'03 / 西江水岸','水的来信'),(41.65,'04 / 新会陈皮','味的归途')]):
    parts.append(f'<section id="chapter{i}" class="clip chapter" data-start="{start}" data-duration="3.2" data-track-index="1" data-layout-allow-overlap data-layout-allow-occlusion><div class="chapter-inner"><small>{kicker}</small><h2>{title}</h2></div></section>')
    motions.extend([f'tl.fromTo("#chapter{i} .chapter-inner",{{opacity:0,y:8}},{{opacity:1,y:0,duration:.6,ease:"sine.out",immediateRender:false}},{start});',f'tl.to("#chapter{i} .chapter-inner",{{opacity:0,duration:.5}},{start+2.7});'])
parts.append('<section id="ending" class="clip paper-copy ending" data-start="54.6" data-duration="11.4" data-track-index="1" data-layout-allow-overlap data-layout-allow-occlusion><div class="paper-inner"><p class="paper-kicker">寻美江门 · 2026</p><h2>山海有归处</h2><h2>侨乡有来信</h2><p class="signature">RTHLanStar</p></div></section>')
motions.append('tl.fromTo("#ending .paper-inner",{opacity:0,y:12},{opacity:1,y:0,duration:1.0,ease:"sine.out",immediateRender:false},54.6);')
for i,c in enumerate(CAPTIONS):
    parts.append(f'<div id="caption{i}" class="clip caption" data-start="{c["start"]}" data-duration="{c["end"]-c["start"]:.3f}" data-track-index="2" data-layout-allow-overlap data-layout-allow-occlusion><span>{escape(c["text"])}</span></div>')
parts.append('<p class="disclosure" data-layout-allow-overlap data-layout-allow-occlusion>AI 艺术演绎 · 非实拍</p>')
parts.append('<audio id="final-mix" class="clip" src="final-mix.wav" data-start="0" data-duration="66" data-track-index="3" data-volume="1"></audio>')
# The rotated paper's axis-aligned glyph box includes photo pixels outside the glyphs.
# Its intentional photo/ink layering is checked in actual rendered frames.
parts = [p.replace('class="paper-kicker"', 'class="paper-kicker" data-layout-allow-occlusion') for p in parts]
html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>侨乡来信 · 影像升级版</title><script src="gsap.min.js"></script><style>'+css+'</style></head><body><div id="root" data-composition-id="main" data-duration="66" data-width="1920" data-height="1080">\n'+'\n'.join(parts)+'\n</div><script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});\n'+'\n'.join(motions)+'\nwindow.__timelines.main=tl;</script></body></html>'
(ROOT/'index.html').write_text(html,encoding='utf8')
(ROOT/'scenes.json').write_text(json.dumps([dict(image=n+'.png',start=s,end=e,title=t,scaleFrom=a,scaleTo=b,xFrom=x,xTo=y) for n,s,e,t,a,b,x,y in SHOTS],ensure_ascii=False,indent=2),encoding='utf8')
(ROOT/'meta.json').write_text(json.dumps(dict(title='侨乡来信 · 江门',creator='RTHLanStar',duration=66,width=1920,height=1080,fps=24,sourceImageDimensions=[1672,941],imageCount=9,shotCount=10,captionCount=len(CAPTIONS),cliVersion='0.8.155'),ensure_ascii=False,indent=2),encoding='utf8')
print('Built 10 shots, 25 captions, one frozen mix; 66s / 1920x1080.')

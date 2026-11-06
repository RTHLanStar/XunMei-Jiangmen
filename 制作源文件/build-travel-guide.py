"""Generate readable static travel pages from dated, attributed research."""
from pathlib import Path
from html import escape as esc
from urllib.parse import urlencode,quote
import json,re,hashlib
from experience_pairings import pairing_data,render_companions,export_pairings
from experience_letter import render_daily_letter
from experience_routes import render_route_finder
from experience_passport import render_passport,passport_data
from experience_faq import render_faq,read_faq
from experience_tour import render_tour
from experience_presentation import apply_metadata,render_print_control

ROOT=Path(__file__).resolve().parent.parent
DIST=ROOT/'site/dist'
M=ROOT/'材料'
places=json.loads((M/'旅行内容研究-景点.json').read_text(encoding='utf8'))
foods=json.loads((M/'旅行内容研究-美食.json').read_text(encoding='utf8'))
expanded=json.loads((M/'美食与路线扩充-2026-10-16.json').read_text(encoding='utf8'))
ps={x['id']:x for x in places['sources']}
VERSION='original-chat-20261019'
KNOCKET_SCRIPT='<script src="https://trtc.io/knocket-sdk/sdk.js?identifier=7cacdcf02616dcfa4e&v=1792401160166" async></script>'
photo_manifest=M/'旅行照片/manifest.json'
photos={p['id']:p for p in json.loads(photo_manifest.read_text(encoding='utf8'))} if photo_manifest.exists() else {}
food_manifest=M/'美食照片/site-manifest.json'
food_photos={p['id']:p for p in json.loads(food_manifest.read_text(encoding='utf8'))} if food_manifest.exists() else {}
export_pairings(M/'旅行搭配建议-2026-10-18.json',places['places'],foods['foods'])
# These constraints remain available even when an in-app browser serves old CSS.
PHOTO_BASE='<style id="photo-layout-base">img,video,canvas{max-width:100%;height:auto}.place-photo{margin:0;min-width:0}.place-photo img{display:block;width:100%;max-width:100%;height:auto}</style>'
# The theme button shows the current mode; its label states the next action.
THEME_BUTTON=('<button type="button" class="theme-toggle" data-theme-toggle aria-label="切换配色模式">'
 '<svg class="theme-toggle-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">'
 '<g class="theme-icon-auto"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/>'
 '<path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="currentColor"/></g>'
 '<path class="theme-icon-moon" d="M20.4 14.9A8.8 8.8 0 0 1 9.1 3.6a8.8 8.8 0 1 0 11.3 11.3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
 '<path class="theme-icon-sun" d="M12 16.4a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8Zm0-13.2v2.1m0 17.4v2.1M4.3 4.3l1.5 1.5m12.4 12.4 1.5 1.5M3 12h2.1m15.8 0H23M4.3 19.7l1.5-1.5M18.2 5.8l1.5-1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
 '</svg><span class="theme-toggle-text">跟随系统</span></button>')
# Runs before the stylesheet so the first paint already uses the right palette.
THEME_BOOT=('<script>(function(){try{var s=localStorage.getItem("jiangmen-theme");'
 'if(s!=="light"&&s!=="dark")s="auto";'
 'var n=s==="auto"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):s;'
 'var d=document.documentElement;d.setAttribute("data-theme",n);d.setAttribute("data-theme-source",s);'
 'var m=document.getElementById("theme-color");if(m)m.content=n==="dark"?"#0f2824":"#183d36";'
 '}catch(e){document.documentElement.setAttribute("data-theme","light");document.documentElement.setAttribute("data-theme-source","auto");}})();</script>')
def e(v):return esc(str(v),quote=True)
def external(url,label):return f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)} ↗</a>'
def maps(query):return 'https://uri.amap.com/search?'+urlencode({'keyword':query,'city':'440700','src':'qiaoxiang-letter','callnative':'0'})
def nav(current):
    items=[('index.html','首页'),('travel.html','游江门'),('stories.html','侨乡故事'),('letters.html','我的来信'),('about.html','关于创作')]
    return '<header class="topbar site-header"><a class="brand" href="index.html"><span>侨乡来信<small>A LETTER FROM JIANGMEN</small></span></a><nav aria-label="主导航">'+''.join(f'<a href="{href}"'+(' aria-current="page"' if href==current else '')+f'>{name}</a>' for href,name in items)+'</nav>'+THEME_BUTTON+'</header>'
def tabs(current):
    return '<nav class="guide-tabs" aria-label="旅行指南">'+''.join(f'<a href="{href}"'+(' aria-current="page"' if current==href else '')+f'><span>0{i+1}</span> {label}</a>' for i,(href,label) in enumerate([('travel.html','逛景点'),('food.html','吃什么'),('routes.html','怎么安排')]))+'</nav>'

def auxiliary_shell(file,title,body):
    heading='<section class="page-hero"><div><p class="page-kicker">BEFORE YOU GO / 站内问答</p><h1>有疑问，<br>来信里找答案。</h1></div></section>' if file=='faq.html' else ''
    description='在本地整理的问答中查找江门旅行与作品使用信息。' if file=='faq.html' else '用约三分钟认识侨乡短片、四章风物、明信片与旅行指南。'
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#183d36"><meta name="description" content="{description}"><title>{title} · 侨乡来信</title><link rel="icon" href="assets/favicon-64.png"></head><body class="page-body {file[:-5]}-body"><a class="skip" href="#page-content">跳至主要内容</a>{nav('')}<main id="page-content" class="page-shell">{heading}{body}</main><footer class="page-footer page-shell"><p>侨乡来信 · 江门 / 2026</p><p>创作：<a href="https://github.com/RTHLanStar" target="_blank" rel="noopener noreferrer">RTHLanStar</a> · <a href="about.html">关于创作与来源</a></p></footer><script src="common.js?v=polish-20261014" defer></script><script src="polish.js?v=polish-20261014" defer></script></body></html>'''
def photo_credit(p):
    if p.get('kind')=='ai':return '<p class="photo-credit">AI 菜式示意，由 ImageGen 生成，用于帮助理解菜式；不是店铺实拍或本站试吃记录。实际做法、配料与摆盘因店而异。</p>'
    return f'<p class="photo-credit">摄影/供图：{e(p["author"])} · {external(p["source_url"],"原照片")} · {external(p["license_url"],p["license"])}。{e(p.get("modifications","网页作尺寸压缩与展示裁切。"))}{e(p.get("date_note",""))}</p>'

def photo_figure(identity,hero=False,food=False):
    p=(food_photos if food else photos).get(identity)
    if not p:return ''
    priority='loading="eager" fetchpriority="high"' if hero else 'loading="lazy"'
    sizes='(max-width:700px) 88vw, (max-width:1340px) 42vw, 540px'
    caption=e(p['caption'])
    if hero:caption=f'<a href="#place-{e(identity)}"><span class="cover-caption">{caption}</span> <span aria-hidden="true">↗</span></a>'
    credit=p.get('required_credit','')
    if credit or hero:caption+=f'<span class="photo-required-credit"'+(' hidden' if not credit else '')+f'>{e(credit)}</span>'
    return f'<figure class="place-photo'+(' guide-cover' if hero else '')+(' preserve-photo' if p.get('preserve_full') else '')+f'"><div class="photo-window"><img src="{e(p["src"])}" srcset="{e(p["small"])} 480w, {e(p["src"])} {p["width"]}w" sizes="{sizes}" width="{p["width"]}" height="{p["height"]}" alt="{e(p["alt"])}" {priority} decoding="async"><span class="photo-unavailable" hidden>照片暂未加载，可继续阅读介绍。</span></div><figcaption>{caption}</figcaption></figure>'

def shell(file,title,subtitle,lead,body):
    research=foods if file=='food.html' else places
    checked=research.get('expandedAt',research.get('checkedAt','2026-10-15')).replace('-','.')
    intro=f'<p class="page-lead">{e(lead)}</p><p class="page-hero-note">资料更新：{e(checked)} · 适合 1—2 天初访<br>景点、美食与路线，按你想去的片区慢慢选。</p>'
    cover=photo_figure('zili',hero=True) if file=='travel.html' else ''
    hero=f'<div><p class="eyebrow">A FIRST VISIT / 第一次来江门</p><h1>{subtitle}</h1>{intro if cover else ""}</div>'+(cover if cover else '<div>'+intro+'</div>')
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#183d36"><meta name="description" content="{e(lead)}"><title>{e(title)} · 侨乡来信</title><link rel="icon" href="assets/favicon-64.png"><link rel="stylesheet" href="site.css?v={VERSION}"></head><body class="page-body guide-body{' travel-photos' if cover else ''}"><a class="skip" href="#guide-main">跳至旅行指南</a>{nav('travel.html')}<main id="guide-main" class="page-shell"><section class="guide-hero">{hero}</section>{tabs(file)}{body}<section class="guide-note"><h2>出发前，再确认一次。</h2><p>开放、票务、演出与船班会调整，请以景区当日公告为准。地图链接用于检索地点，具体入口与交通方式请在地图中确认。路线与停留安排是本站编辑建议。</p><p>旅行清单保存在当前浏览器，不会跨设备自动同步。旅途中看到的风景，也可以<a href="letters.html">写进自己的江门明信片 →</a></p></section><footer class="page-footer guide-footer"><p><a href="index.html">侨乡来信 · 江门</a> / 创作：<a href="https://github.com/RTHLanStar" target="_blank" rel="noopener noreferrer">RTHLanStar</a></p><p><a href="stories.html">读侨乡故事</a> · <a href="about.html">关于创作与来源</a></p></footer></main><script src="common.js?v=polish-20261014" defer></script><script src="guide.js?v={VERSION}" defer></script><script src="polish.js?v=polish-20261014" defer></script></body></html>'''
def source_details(ids,lookup):
    links=[]
    for key in ids:
        s=lookup[key]
        links.append('<li>'+external(s['url'],s['title'])+f'<small>{e(s["publisher"])} · {e(s.get("published",s.get("date","")))}</small></li>')
    return '<ul class="guide-sources">'+''.join(links)+'</ul>'
def toolbar(areas,kind,total):
    search=f'<label>找{kind}<input name="q" type="search" placeholder="输入名称、片区或关键词" autocomplete="off"></label>' if kind!='景点' else ''
    empty='试试其他地区或重置筛选。' if kind=='景点' else '试试其他关键词或重置筛选。'
    return f'''<div class="guide-toolbar" hidden><form data-guide-filter aria-label="{kind}筛选">{search}<label>按地区<select name="area"><option value="">全部地区</option>{''.join(f'<option value="{e(a)}">{e(a)}</option>' for a in areas)}</select></label><button type="reset">重置</button></form><div class="guide-saved"><button type="button" data-only-saved aria-pressed="false">只看想去</button><span data-saved-status role="status"></span></div><p class="guide-results" role="status" aria-live="polite">共 {total} 项</p></div><p class="guide-empty" hidden>暂时没有匹配的{kind}，{empty}</p>'''
def card(item,i,food=False):
    if food:
        name=item['name'];area=re.sub('[区市]$','',item['district']);tags=[item['category'],item['area']];fact=item['intro']+' '+item['taste'];tip=item['editorialTip'];query=item['searchKeyword'];check='口味与做法因店而异；先核对营业、份量和点餐价格，再安排这一餐。';label=item['suitableFor'];lookup=foods['sources'];ids=item['sourceIds'];kind='food'
    else:
        name=item['name'];area=re.sub('[区市]$','',item['region']);tags=item['tags'];fact=item['fact'];tip=item['editorialTip'];query=item['mapQuery'];check=item['verifyBeforeGo'];label=item['planningLabel'].replace('编辑建议：','');lookup=ps;ids=item['sources'];kind='place'
    identity=kind+'-'+item['id']
    photo=photo_figure(item['id'],food=food)
    credit=photo_credit((food_photos if food else photos)[item['id']]) if photo else ''
    companions=render_companions(item['id'],food,places['places'],foods['foods'],photos,food_photos)
    visit_button='' if food else f'<button type="button" data-visit-id="{e(item["id"])}" aria-pressed="false" hidden>标记去过</button>'
    return f'''<article id="{identity}" class="guide-card{' has-photo' if photo else ''}" data-guide-item data-area="{e(area)}" data-keywords="{e(name+' '+area+' '+' '.join(tags)+' '+fact+' '+query)}">{photo}<div class="card-meta"><span class="card-index">{i+1:02d}</span><span>{e(area)}</span></div><h2>{e(name)}</h2><div class="card-tags">{''.join('<span>'+e(t)+'</span>' for t in tags)}</div><p>{e(fact)}</p><dl class="guide-facts"><dt>{'适合这样吃' if food else '行程搭配'}</dt><dd>{e(label)}</dd></dl><div class="card-actions">{external(maps(query),'地图找'+('店' if food else '地点'))}<button type="button" data-save="{identity}" aria-pressed="false" hidden>加入想去 ＋</button>{visit_button}</div>{companions}<details class="source-details"><summary>出发提示与资料来源</summary><p><strong>编辑建议</strong> · {e(tip)}</p><p><strong>行前确认</strong> · {e(check)}</p>{source_details(ids,lookup)}{credit}</details></article>'''

areas=[('蓬江','老城与书香','长堤、启明里、陈白沙纪念馆'),('江海','山林与侨园','白水带、陈少白故居'),('新会','人文与自然','启超故里、小鸟天堂、陈皮村、圭峰山'),('台山','侨墟与海风','梅家大院、海口埠、川岛'),('开平','碉楼与古镇','自力村、赤坎、立园、马降龙'),('鹤山','水乡与登高','古劳水乡、大雁山'),('恩平','古村与温泉','歇马举人村、锦江温泉')]
area_names=[a for a,_,_ in areas]
intro='<section class="guide-intro"><h2>先选一个片区，再决定去哪。</h2><p>江门的精彩分布在不同区市。只有一个周末，不必把所有地方一次走完。</p><div class="area-grid">'+''.join(f'<a href="travel.html?area={quote(a)}#places"><small>{a}</small><h3>{t}</h3><p>{d}</p><span aria-hidden="true">→</span></a>' for a,t,d in areas)+'</div></section>'
experience=places['publicExperienceSources'][0]
intro+='<nav class="experience-links" aria-label="旅行小工具"><a href="routes.html#route-finder">今天怎么逛 →</a><a href="letters.html#travel-passport">我的旅行护照 →</a><a href="index.html#daily-letter">拆一封今日来信 →</a></nav>'
travel= intro+f'<section id="places" class="guide-intro"><h2>七个区市，{len(places["places"])} 处出发的理由。</h2><p>第一次来，先选一两个片区。点开提示看怎样安排，也可以把心动的地方加入想去清单。</p></section>'+toolbar(area_names,'景点',len(places['places']))+'<div class="guide-grid">'+''.join(card(p,i) for i,p in enumerate(places['places']))+'</div>'
travel+=f'''<section class="guide-intro"><h2>也听听，走过这里的人。</h2><div class="review-grid"><article class="review-card"><p class="card-meta">游客记录 · 携程攻略社区</p><h3>启明里，适合怎样逛？</h3><p>可读点评谈到侨屋、咖啡店与慢逛拍照。喜欢建筑和街巷的人，可留一段不赶路的时间。</p><p class="guide-small">作者：地瓜出门了、走遍天下XZ；点评日期：2025-10-04、2025-02-08。个人体验仅作参考，非本站实地测评。</p>{external(experience['url'],'读游客原文')}</article><article class="review-card"><p class="card-meta">官方动态 · 江门文旅</p><h3>小鸟天堂，先查当天安排。</h3><p>景区在2026年7月调整过营业时间。出发前可在微信搜索“小鸟天堂景区”或“启超故里小鸟天堂文化旅游区”，核对开放与游船信息。</p>{external(ps['bird-hours-20260702']['url'],'查看公告与官方账号')}</article></div></section>'''
(DIST/'travel.html').write_text(shell('travel.html','游江门 · 景点指南','初来江门，<br>先找到你的那一站。','从老城骑楼到田野碉楼，从陈皮茶香到湿地鸟鸣。选一两个片区，把周末留给真正想看的风景。',travel),encoding='utf8')

food='<section class="guide-intro"><h2>一餐一味，跟着片区吃。</h2><p>七个区市，14 种风味。先挑今天顺路的一餐；摄影与 AI 菜式示意均在图下注明，门店口味可结合近期评价再选。</p></section>'+toolbar(area_names,'美食',len(foods['foods']))+'<div class="guide-grid">'+''.join(card(p,i,True) for i,p in enumerate(foods['foods']))+'</div>'
review=next(r for r in foods['platformReferences'] if r['id']=='lala-day')
review2=next(r for r in foods['platformReferences'] if r['id']=='dong-multi')
food+=f'''<section class="guide-intro" id="reviews"><h2>把探店当灵感，按自己口味选。</h2><div class="review-grid"><article class="review-card"><p class="card-meta">抖音 · 公开文案摘读</p><h3>老城小吃，也能和陈皮味相遇。</h3><p>“辣辣想去玩”的一日游记录串联了老城小吃、陈皮村和黄鳝饭。适合寻找吃什么的灵感；本站路线会放慢节奏，不照搬一天多站的安排。</p><p class="guide-small">作者：辣辣想去玩 · 2025-07-28。已读取公开文字文案，未观看完整视频；商业合作属性未知。</p>{external(review['url'],'看作者原帖')}</article><article class="review-card"><p class="card-meta">抖音 · 原帖入口</p><h3>多店探访，留给你继续比较。</h3><p>“大冬来了”发布过《24小时不睡觉极限在江门连吃18顿，拿捏》。可从原帖继续找感兴趣的食物，行程仍按自己的食量与体力安排。</p><p class="guide-small">作者：大冬来了 · 2026-03-09。已核对标题、作者与日期，未读取完整视频，本站不据此给门店排名；商业合作属性未知。</p>{external(review2['url'],'打开原帖')}</article></div></section>'''
q='江门 美食 探店'
food+=f'''<section class="guide-intro"><h2>再找几篇近期评价。</h2><p>下面是平台检索入口，可把搜索词换成具体菜式或店名。优先比较近期、多位作者的记录；旧价格和排队时间只作参考。</p><div class="review-grid"><article class="review-card"><h3>小红书</h3><p>可搜“江门 外海面”“新会 古井烧鹅”“开平 赤坎豆腐角”。重点看地点、口味描述与近期评论。</p>{external('https://www.xiaohongshu.com/search_result?'+urlencode({'keyword':q,'source':'web_explore_feed'}),'搜索近期笔记')}<p class="guide-small">检索入口，未作为本站已核验测评；平台可能要求登录。</p></article><article class="review-card"><h3>微信公众号与抖音</h3><p>微信可搜“江门文旅”“新会文旅”与菜名；抖音可搜“江门美食探店”，再核对具体店名和发布日期。</p>{external('https://weixin.sogou.com/weixin?'+urlencode({'type':'2','query':'江门 文旅 美食'}),'搜公众号文章')} · {external('https://www.douyin.com/search/'+quote(q),'搜抖音探店')}<p class="guide-small">搜索结果由平台提供，官方推广与个人探店请分别判断。</p></article></div></section>'''
(DIST/'food.html').write_text(shell('food.html','江门特色美食','江门的滋味，<br>从这一餐开始。','一碗外海面、一碟烧鹅、一口陈皮香。先选今天顺路的味道，再慢慢认识五邑的餐桌。',food),encoding='utf8')

route_data=[
 {'id':'old-town','title':'只有一天 · 老城慢逛','meta':'蓬江为主 / 步行 + 必要接驳','intro':'适合第一次来、想轻松逛街巷和吃小吃的人。','steps':[('上午｜长堤与三十三墟街','沿骑楼读老城，从自己感兴趣的街段慢慢走。店铺和集市安排以当天为准。','travel.html#place-longdi'),('午后｜启明里','看看侨屋和巷道故事牌，再找一处坐下喝茶或咖啡。两处属于同一老城片区，按导航选步行路线。','travel.html#place-qiming'),('晚餐｜按落脚位置就近选','想去外海当地寻味，可安排前往江海区，先查接驳；不赶路也可以留在老城吃一餐。','food.html#food-waihai-noodles')],'note':'公共交通先选与住宿或当天目的地相符的到达站。“江门站”和“江门东站”不要混用；最后一段接驳以当天地图为准。'},
 {'id':'city-xinhui','title':'两天 · 老城 + 新会','meta':'人文、湿地、陈皮 / 两个片区分两天','intro':'第一次想兼顾城市与自然，可从这条线开始。','steps':[('第1天｜长堤、启明里','先在老城建立对江门的第一印象，街巷之间留足休息与用餐时间。','travel.html?area='+quote('蓬江')+'#places'),('第2天上午｜梁启超故居纪念馆','先确认当天开放，再安排故居与展陈。若闭馆，调整为陈皮村与湿地游览。','travel.html#place-liang'),('第2天午后｜陈皮村 + 小鸟天堂','陈皮村认识陈皮文化并安排用餐；湿地留给喜欢自然的人。三点之间需接驳，按当日游船与返程安排调整顺序。','travel.html?area='+quote('新会')+'#places')],'note':'新会陈皮村、梁启超故居与小鸟天堂有官方串联线路参考；这不代表全部步行可达。古井烧鹅需要另外核对路程，不强行塞入同一午餐。'},
 {'id':'city-kaiping','title':'两天 · 老城 + 开平','meta':'偏爱建筑 / 第2天预留跨区交通','intro':'想看田野中的碉楼，再感受骑楼与夜色，选择这条。','steps':[('第1天｜长堤、启明里','先慢读江门老城；第二天是否在开平住宿，可根据返程方式提前决定。','travel.html?area='+quote('蓬江')+'#places'),('第2天白天｜自力村碉楼群','选择一个碉楼片区认真游览，分清自力村、立园、马降龙的票务范围，不一次全塞进去。','travel.html#place-zili'),('第2天下午至晚间｜赤坎华侨古镇','留意当天节目表，想看夜景先确定晚间返程或住宿；在赤坎顺路尝豆腐角。','travel.html#place-chikan')],'note':'这条是新会线的替代选择。公共交通需提前查跨区接驳与末班；自驾也要留出停车和景区步行时间。'}
]
for route,cover in zip(route_data,['qiming','bird','zili']):route['coverId']=cover
route_data.extend(expanded['routes'])
routes='<section class="guide-intro"><h2>少赶一点路，多留一点记忆。</h2><p>六条路线，从半日慢逛到两日小旅行，按片区与兴趣组合。以下为本站编辑建议，交通与开放安排请在出发前确认。</p></section><nav class="route-jump" aria-label="选择旅行路线">'+''.join(f'<a href="#{e(r["id"])}">{e(r["title"])}</a>' for r in route_data)+'</nav><div class="route-grid">'
for i,r in enumerate(route_data):
    cover_id=r['coverId']
    route_source=source_details(r.get('sourceIds',[]),ps)
    routes+=f'<article class="route-card" id="{r["id"]}">'+photo_figure(cover_id)+f'<div data-route-text><p class="card-meta">ROUTE 0{i+1} / 编辑建议</p><h2>{e(r["title"])}</h2><p class="route-meta">{e(r["meta"])}</p><p>{e(r["intro"])}</p><ol class="route-steps">'+''.join(f'<li><strong>{e(s)}</strong><p>{e(p)}</p><a href="{e(link)}">查看这一站 →</a></li>' for s,p,link in r['steps'])+f'</ol><p class="guide-small">{e(r["note"])}</p></div><button class="route-copy" type="button" data-copy-route hidden>复制这条路线</button><details class="source-details"><summary>路线参考与图片来源</summary>'+route_source+photo_credit(photos[cover_id])+'</details></article>'
routes+='</div><section class="guide-intro"><h2>如果更想看海，就把时间交给海岛。</h2><p>上川岛与下川岛是两个目的地，需要从台山山咀港乘船并安排岛上接驳。初次两日游建议选一个岛单独规划，提前确认天气、去程和返程船班。</p><a class="page-text-link" href="travel.html#place-chuandao">查看川岛行前提示 →</a></section>'
routes+='<section class="guide-intro"><h2>把路上的小事，也安排妥当。</h2><div class="review-grid">'+''.join(f'<article class="review-card" id="advice-{e(a["id"])}"><h3>{e(a["title"])}</h3><p>{e(a["text"])}</p>'+''.join(f'<a class="page-text-link" href="{e(link["href"])}">{e(link["label"])} →</a> ' for link in a.get('links',[]))+'</article>' for a in expanded['advice'])+'</div></section>'
routes+='<details class="source-details"><summary>路线依据与行前资料</summary>'+source_details(['longdi-20261009','xinhui-route-20241028','chikan-20260506','chuandao-20260109'],ps)+'</details>'
(DIST/'routes.html').write_text(shell('routes.html','江门半日、一日与两日路线','把想去的地方，<br>排成舒服的一天。','老城慢逛、侨乡古村、水乡游船与碉楼田野。选一条顺路的行程，把用餐、交通和休息一起留进旅程。',render_route_finder(route_data)+routes),encoding='utf8')

# Add a single compact gateway; preserve the earlier shortened homepage copy.
p=DIST/'index.html';s=p.read_text(encoding='utf8')
s=re.sub(r'<!--daily-letter:start-->[\s\S]*?<!--daily-letter:end-->','',s)
daily=render_daily_letter(places['places'],foods['foods'],photos,pairing_data(),photo_figure,photo_credit)
assert '<section id="film"' in s
s=s.replace('<section id="film"','<!--daily-letter:start-->'+daily+'<!--daily-letter:end--><section id="film"',1)
if '<h3>游江门</h3>' not in s:
    s=s.replace('<div class="explore-grid">','<div class="explore-grid"><a href="travel.html"><span class="explore-index" aria-hidden="true">01</span><div><h3>游江门</h3><p>找景点、尝美食，安排第一次江门之旅。</p></div><span class="explore-arrow" aria-hidden="true">↗</span></a>',1)
    block=re.search(r'<div class="explore-grid">[\s\S]*?</section>',s)
    n=[0]
    def renumber(m):n[0]+=1;return m.group(1)+str(n[0]).zfill(2)+m.group(3)
    s=s[:block.start()]+re.sub(r'(<span class="explore-index"[^>]*>)(\d+)(</span>)',renumber,block.group())+s[block.end():]
p.write_text(s,encoding='utf8')

p=DIST/'letters.html';s=p.read_text(encoding='utf8')
s=re.sub(r'<!--travel-passport:start-->[\s\S]*?<!--travel-passport:end-->','',s)
assert '<section id="postcard"' in s
s=s.replace('<section id="postcard"','<!--travel-passport:start-->'+render_passport(places['places'])+'<!--travel-passport:end--><section id="postcard"',1)
p.write_text(s,encoding='utf8')

# Keep the public creation note aligned with the new local interactions.
p=DIST/'about.html';s=p.read_text(encoding='utf8')
s=re.sub(r'<p id="travel-experience-note">[\s\S]*?</p>','',s)
note='<p id="travel-experience-note">今日来信用一张风景和一句原创短诗带你认识下一站；“今天怎么逛”按时间与兴趣推荐现有路线，景点与美食卡片提供彼此的入口。“我的来信”新增旅行护照：自主标记去过、收集七区市私人邮戳，并保存旅行纪念卡。记录保存在当前浏览器，与四章文化印记及原明信片独立；不使用定位核验。</p>'
s=s.replace('<p id="travel-guide-note">',note+'<p id="travel-guide-note">',1)
p.write_text(s,encoding='utf8')

# The editable knowledge file is the single source for the on-site FAQ.
knowledge=(ROOT/'知识库/江门智能客服问答知识库.md').read_text(encoding='utf8')
(DIST/'faq.html').write_text(auxiliary_shell('faq.html','站内问答',render_faq(knowledge)),encoding='utf8')
(DIST/'tour.html').write_text(auxiliary_shell('tour.html','作品导览',render_tour()),encoding='utf8')
(DIST/'assets/faq-data.json').write_text(json.dumps(read_faq(knowledge),ensure_ascii=False,indent=2),encoding='utf8')

# One CSS request per page; editable source styles remain beside the bundle.
names=['tokens.css','style.css','pages.css','letters.css','polish.css','readability.css','guide.css','travel-experiences.css','daily-letter.css','route-finder.css','travel-passport.css','faq.css','tour.css','presentation.css']
bundle='\n'.join('/* '+n+' */\n'+(DIST/n).read_text(encoding='utf8') for n in names)
(DIST/'site.css').write_text(bundle,encoding='utf8')
stylesheet='site-'+hashlib.sha256(bundle.encode('utf8')).hexdigest()[:12]+'.css'
(DIST/stylesheet).write_text(bundle,encoding='utf8')
for file in ['index.html','stories.html','letters.html','about.html','travel.html','food.html','routes.html','faq.html','tour.html']:
    p=DIST/file;s=p.read_text(encoding='utf8')
    s=re.sub(r'<header class="topbar site-header">[\s\S]*?</header>',nav('travel.html' if file in ['travel.html','food.html','routes.html'] else file),s,count=1)
    s=re.sub(r'<link rel="stylesheet" href="[^\"]+">','',s)
    s=re.sub(r'<style id="photo-layout-base">[\s\S]*?</style>','',s)
    s=re.sub(r'<meta\s+name="theme-color"[^>]*>','',s)
    # Strip the theme bootstrap a previous build injected, so rebuilds stay idempotent.
    s=re.sub(r'<script>[^<]*jiangmen-theme[^<]*</script>','',s)
    s=s.replace('</head>','<meta name="theme-color" id="theme-color" content="#183d36">'+THEME_BOOT+'</head>',1)
    s=s.replace('</head>',PHOTO_BASE+f'<link rel="stylesheet" href="{stylesheet}"></head>')
    s=re.sub(r'<script src="(?:daily-letter|route-finder|travel-passport|faq|presentation|online-help|theme)\.js[^\"]*" defer></script>','',s)
    s=re.sub(r'<script type="application/json" id="travel-passport-data">[\s\S]*?</script>','',s)
    modules={'index.html':['daily-letter'],'routes.html':['route-finder'],'travel.html':['travel-passport'],'letters.html':['travel-passport'],'faq.html':['faq']}.get(file,[])+['presentation','theme']
    extra=passport_data(places['places']) if file in ['travel.html','letters.html'] else ''
    extra+=''.join(f'<script src="{module}.js?v={VERSION}" defer></script>' for module in modules)
    s=s.replace('</body>',extra+'</body>')
    s=re.sub(r'<!--site-utility:start-->[\s\S]*?<!--site-utility:end-->','',s)
    printing=render_print_control() if file in ['travel.html','food.html','routes.html','faq.html'] else ''
    utility='<div class="site-utility"><nav aria-label="阅读与使用帮助"><a href="tour.html">约 3 分钟 · 作品导览</a><a href="faq.html">离线问答</a></nav>'+printing+'</div>'
    s=s.replace('</main>','<!--site-utility:start-->'+utility+'<!--site-utility:end--></main>',1)
    if file=='travel.html':
        data=json.dumps(list(photos.values()),ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
        s=s.replace('</body>',f'<script type="application/json" id="cover-photos">{data}</script></body>')
    # Keep the requested SDK exactly once, immediately before the closing body.
    s=re.sub(r'<script\s+src="https://trtc\.io/knocket-sdk/sdk\.js\?identifier=7cacdcf02616dcfa4e(?:&(?:amp;)?v=\d+)?"\s+async\s*>\s*</script>', '', s)
    s=s.replace('</body>',KNOCKET_SCRIPT+'</body>')
    s=apply_metadata(s,file)
    p.write_text('\n'.join(line.rstrip() for line in s.splitlines())+'\n',encoding='utf8')
print('Built 9 static pages, searchable FAQ and reading tools with one CSS bundle.')

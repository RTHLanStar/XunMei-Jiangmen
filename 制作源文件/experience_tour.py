"""A short, optional route through existing work, without autoplay or timers."""
from html import escape

def render_tour():
    steps=[
        ('01','66 秒','先听，这封信的声音。','楼、街、水与味，在一段原创旁白里相遇。打开短片后手动播放，也可打开中文字幕。','assets/film-poster.webp','短片封面，摄影风格 AI 艺术画面','index.html#film','看 66 秒短片'),
        ('02','约 45 秒','读四章，留下四枚印记。','从碉楼的守望到陈皮的传承，选章节、滑动图片，再收藏触动你的那一枚。四章读完，便会收到作品的回信。','assets/scene-0.webp','碉楼与稻田的 AI 艺术画面','index.html#journey','进入四章风物'),
        ('03','约 40 秒','把最后一句，写给在意的人。','选一张风景，填上收信人和心意，做成自己的江门明信片。可以保存 PNG，也能打开图片预览。','assets/scene-3.webp','双手轻托陈皮的 AI 艺术画面','letters.html#postcard','写一张明信片'),
        ('04','约 30 秒','把心动，变成下一次出发。','20 个景点条目、14 种地方味和 6 条编辑路线，先选一个片区慢慢逛。去过的风景，可以记进旅行护照。','assets/scene-1.webp','骑楼街巷的 AI 艺术画面','travel.html#places','看看江门去哪玩'),
    ]
    e=lambda value:escape(value,quote=True)
    cards=[]
    for number,duration,title,copy,src,alt,url,label in steps:
        cards.append(f'<article class="tour-step"><figure><img src="{src}" width="960" height="540" alt="{alt}" loading="lazy" decoding="async"><figcaption>AI 艺术影像 · 非景点实拍</figcaption></figure><div class="tour-step-copy"><p class="tour-step-meta"><span>{number}</span><span>{duration}</span></p><h2>{title}</h2><p>{copy}</p><a class="tour-step-link" href="{e(url)}">{label} →</a></div></article>')
    return ('<section class="tour-intro"><p class="page-kicker">A SHORT INTRODUCTION / 作品导览</p><h1>先读一封信，<br>再走进一座城。</h1><p class="page-lead">用约 3 分钟认识《侨乡来信·江门》。先听、再读、动手写一句，最后为自己的旅程挑一站。</p><p class="tour-note">这是建议的体验顺序；阅读、创作与旅行规划，都可以按自己的节奏继续。</p></section>'
        '<div class="tour-grid">'+''.join(cards)+'</div>'
        '<section class="tour-more"><h2>还想多看一点？</h2><nav aria-label="继续体验作品"><a href="index.html#daily-letter">拆一封今日江门来信 →</a><a href="routes.html#route-finder">按时间与兴趣选路线 →</a><a href="letters.html#travel-passport">打开我的旅行护照 →</a><a href="faq.html">查一查站内问答 →</a><a href="about.html">了解创作过程与来源 →</a></nav></section>')

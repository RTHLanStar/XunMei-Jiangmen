"""Static sharing metadata and progressive print affordance.

Open Graph is descriptive metadata, not a WeChat JS-SDK signature or a promise
that any particular app will display a preview card.
"""
from html import escape
import json
import re

BASE_URL = "https://qxlx.ccot.pro/v2.2/"
AUTHOR_URL = "https://github.com/RTHLanStar"
PAGE_META = {
    "index.html": ("侨乡来信 · 江门", "沿一封来信，读江门的楼、街、水与味；收藏四枚风物印记，把侨乡写进自己的明信片。"),
    "stories.html": ("侨乡故事 · 侨乡来信", "沿着碉楼、骑楼、水乡与陈皮的线索，读风景背后的江门生活与文化故事。"),
    "letters.html": ("我的来信 · 侨乡来信", "收藏江门风物印记，写一张明信片；用旅行护照记录想去与去过的地方，留下一份自己的侨乡记忆。"),
    "about.html": ("关于创作 · 侨乡来信", "了解《侨乡来信·江门》的创作思路、AI 辅助制作过程、图像与文字来源，以及作者 RTHLanStar。"),
    "travel.html": ("游江门 · 侨乡来信", "第一次来江门，从七区市的景点与实景照片出发，了解片区特色、交通提示与值得搭配的侨乡美食。"),
    "food.html": ("吃什么 · 侨乡来信", "从外海面、陈皮风味到台山黄鳝饭，寻找江门各地的代表性美食，并为下一站旅行留一点胃口。"),
    "routes.html": ("怎么逛 · 侨乡来信", "按半天、一天或两天选择江门旅行方向，结合建筑、自然与美食兴趣，查看路线、接驳建议和资料来源。"),
    "faq.html": ("江门旅行问答 · 侨乡来信", "在本地问答中查找江门景点、美食、交通与网站使用说明；答案来自整理好的知识库，附资料来源与相关页面。"),
    "tour.html": ("三分钟读一封来信 · 侨乡来信", "用一条简短的导览动线，认识侨乡短片、四章风物、来信明信片与江门旅行指南。"),
}


def apply_metadata(html: str, filename: str) -> str:
    """Return HTML with one authoritative metadata block; safe to rerun."""
    name = str(filename).replace("\\", "/").rsplit("/", 1)[-1].lower()
    if not name.endswith(".html"):
        name += ".html"
    if name not in PAGE_META:
        raise ValueError(f"No authored sharing metadata for {filename}")
    if not re.search(r"</head\s*>", html, flags=re.I):
        raise ValueError(f"Missing head closing tag: {filename}")

    title, description = PAGE_META[name]
    url = BASE_URL if name == "index.html" else BASE_URL + name
    image_url = BASE_URL + "assets/film-poster.webp"
    html = re.sub(r"\n?<!--presentation-meta:start-->.*?<!--presentation-meta:end-->\s*", "", html, flags=re.S)
    # Replace prior sharing metadata even when it predates our marker block.
    html = re.sub(r'<meta\b(?=[^>]*\b(?:property|name)\s*=\s*[\"\'](?:og:|twitter:))[^>]*>\s*', "", html, flags=re.I)
    html = re.sub(r'<link\b(?=[^>]*\brel\s*=\s*[\"\']canonical[\"\'])[^>]*>\s*', "", html, flags=re.I)

    tags = ["<!--presentation-meta:start-->", f'<link rel="canonical" href="{escape(url, quote=True)}">']
    for key, value in (
        ("og:type", "website"), ("og:site_name", "侨乡来信 · 江门"),
        ("og:locale", "zh_CN"), ("og:title", title),
        ("og:description", description), ("og:url", url),
        ("og:image", image_url), ("og:image:type", "image/webp"),
        ("og:image:width", "1600"), ("og:image:height", "900"),
        ("og:image:alt", "《侨乡来信·江门》短片封面，AI 辅助创作的侨乡主题画面"),
        ("twitter:card", "summary_large_image"), ("twitter:title", title),
        ("twitter:description", description), ("twitter:image", image_url),
        ("twitter:image:alt", "《侨乡来信·江门》短片封面，AI 辅助创作的侨乡主题画面"),
    ):
        attr = "property" if key.startswith("og:") else "name"
        tags.append(f'<meta {attr}="{key}" content="{escape(value, quote=True)}">')
    work = {
        "@context": "https://schema.org", "@type": "CreativeWork",
        "name": title, "description": description, "url": url,
        "inLanguage": "zh-CN", "image": image_url,
        "author": {"@type": "Person", "name": "RTHLanStar", "url": AUTHOR_URL},
        "isPartOf": {"@type": "CreativeWork", "name": "侨乡来信 · 江门", "url": BASE_URL},
    }
    payload = json.dumps(work, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    tags += [f'<script type="application/ld+json" id="presentation-work">{payload}</script>', "<!--presentation-meta:end-->"]
    return re.sub(r"</head\s*>", lambda match: "\n" + "\n".join(tags) + "\n" + match.group(), html, count=1, flags=re.I)


def render_print_control() -> str:
    """No automatic dialog: a visible button requires successfully loaded JS."""
    return '<div class="print-tools" data-print-tools hidden><button type="button" data-print-page>打印这一页</button><span>保留当前筛选结果和资料来源，可保存为 PDF。</span><p data-print-status role="status" hidden></p></div>'

"""Build a local FAQ directly from the maintained knowledge-base Markdown.

The supported subset is deliberately small: paragraphs, bullet lists, Markdown
links and local HTML references. All other source text remains escaped text.
No source Markdown, query string or answer is executed as HTML or JavaScript.
"""

from html import escape
import re
from urllib.parse import urlsplit


CATEGORIES = (
    ("places", "逛景点"), ("food", "吃什么"), ("routes", "怎么安排"),
    ("culture", "侨乡文化"), ("practical", "出行须知"), ("website", "网站与功能"),
)
_LINK = re.compile(r"\[([^\]\n]+)\]\(([^\s)]+)\)")
_LOCAL = re.compile(r"(?<![\w/])([a-z][a-z0-9-]*\.html(?:#[A-Za-z0-9_-]+)?)")


def _category(section, question):
    if "更多美食与片区路线" in section:
        return "routes" if "怎么走" in question or "不会太赶" in question else "food"
    if "按片区选择" in section:
        if "分布" in question:
            return "places"
        if any(term in question for term in ("不开车", "带孩子", "下雨")):
            return "practical"
        return "website"
    if "景点" in section:
        return "routes" if "一天怎么安排" in question else "places"
    for word, category in (("美食", "food"), ("路线", "routes"), ("文化", "culture"), ("出行须知", "practical")):
        if word in section:
            return category
    return "website"


def read_faq(markdown_text):
    """Return ordered dictionaries, preserving every field of each question.

    Stable keys: number, question, answer, aliases, keywords, category,
    category_label, section, sources (ordered {label, text} list), fields.
    Answers retain their paragraph/list newlines. Raises on gaps or duplicates.
    """
    records, section, current, field = [], "", None, None
    for raw in markdown_text.replace("\r\n", "\n").splitlines():
        heading = re.match(r"^##\s+(.+)$", raw)
        question = re.match(r"^###\s+Q(\d+)\.\s*(.+)$", raw)
        if heading:
            section, current, field = heading.group(1).strip(), None, None
        elif question:
            current = {"number": int(question.group(1)), "question": question.group(2).strip(), "section": section, "fields": {}}
            records.append(current)
            field = None
        elif current is not None:
            label = re.match(r"^\*\*([^：]+)：\*\*\s*(.*)$", raw)
            if label:
                field = label.group(1).strip()
                if field in current["fields"]:
                    raise ValueError(f"Duplicate field Q{current['number']}: {field}")
                current["fields"][field] = label.group(2)
            elif field and raw.strip() != "---":
                current["fields"][field] += "\n" + raw
    if not records or [r["number"] for r in records] != list(range(1, len(records) + 1)):
        raise ValueError("FAQ questions must have unique, consecutive Q numbers starting at 1")
    labels = dict(CATEGORIES)
    for record in records:
        fields = {key: value.strip() for key, value in record["fields"].items()}
        if not fields.get("答"):
            raise ValueError(f"Q{record['number']} has no answer")
        record["fields"] = fields
        record.update(answer=fields["答"], aliases=fields.get("其他问法", ""), keywords=fields.get("关键词", ""))
        record["category"] = _category(record["section"], record["question"])
        record["category_label"] = labels[record["category"]]
        record["sources"] = [{"label": key, "text": value} for key, value in fields.items() if key not in ("答", "其他问法", "关键词")]
    return records


def _safe_href(value):
    if not value or any(ord(char) < 32 for char in value) or "\\" in value:
        return None
    if re.fullmatch(r"[a-z][a-z0-9-]*\.html(?:#[A-Za-z0-9_-]+)?", value):
        return value
    try:
        parts = urlsplit(value)
        if parts.scheme == "https" and parts.hostname and not parts.username and not parts.password:
            return value
    except ValueError:
        pass
    return None


def _plain(text, local_links=False):
    if not local_links:
        return escape(text)
    result, offset = [], 0
    for match in _LOCAL.finditer(text):
        result.append(escape(text[offset:match.start()]))
        href = match.group(1)
        result.append(f'<a href="{escape(href, quote=True)}">{escape(href)}</a>')
        offset = match.end()
    result.append(escape(text[offset:]))
    return "".join(result)


def _inline(text, local_links=False):
    result, offset = [], 0
    for match in _LINK.finditer(text):
        result.append(_plain(text[offset:match.start()], local_links))
        label, raw_href = match.groups()
        href = _safe_href(raw_href)
        if href:
            attrs = ' target="_blank" rel="noopener noreferrer"' if href.startswith("https://") else ""
            result.append(f'<a href="{escape(href, quote=True)}"{attrs}>{escape(label)}</a>')
        else:
            result.append(escape(match.group(0)))
        offset = match.end()
    result.append(_plain(text[offset:], local_links))
    return "".join(result)


def _blocks(text, local_links=False):
    result, paragraph, bullets = [], [], []

    def flush():
        if paragraph:
            result.append("<p>" + _inline("\n".join(paragraph), local_links) + "</p>")
            paragraph.clear()
        if bullets:
            result.append("<ul>" + "".join("<li>" + _inline(line, local_links) + "</li>" for line in bullets) + "</ul>")
            bullets.clear()

    for line in text.splitlines():
        if not line.strip():
            if paragraph:
                flush()
        elif line.startswith("- "):
            if paragraph:
                flush()
            bullets.append(line[2:])
        else:
            if bullets:
                flush()
            paragraph.append(line)
    flush()
    return "".join(result)


def render_faq(markdown_text):
    """Return main-inner content; the site builder supplies head/nav/footer."""
    records = read_faq(markdown_text)
    options = '<option value="all">全部主题</option>' + "".join(f'<option value="{key}">{label}</option>' for key, label in CATEGORIES)
    cards = []
    for record in records:
        number = record["number"]
        search = " ".join((record["question"], record["aliases"], record["keywords"], record["answer"]))
        source_html = "".join(f'<dt>{escape(source["label"])}</dt><dd>{_blocks(source["text"], True)}</dd>' for source in record["sources"])
        aliases = f'<p class="faq-aliases"><span>也有人这样问</span> {escape(record["aliases"])}</p>' if record["aliases"] else ""
        cards.append(f'''<details class="faq-item" id="q-{number}" data-category="{record['category']}" data-faq-search="{escape(search, quote=True)}" data-faq-keywords="{escape(record['keywords'], quote=True)}">
<summary><span class="faq-number">{number:02d}</span><span class="faq-question">{escape(record['question'])}</span><span class="faq-chevron" aria-hidden="true">＋</span></summary>
<div class="faq-content"><p class="faq-category">{escape(record['category_label'])} · {escape(re.sub(r'^[一二三四五六七八九十]+、', '', record['section']))}</p>
<div class="faq-answer">{_blocks(record['answer'], True)}</div>{aliases}
{'<dl class="faq-sources">' + source_html + '</dl>' if source_html else ''}
<a class="faq-permalink" href="#q-{number}" aria-label="定位第 {number} 问：{escape(record['question'], quote=True)}">第 {number} 问的链接 ↗</a></div></details>''')
    return f'''<section id="faq-panel" class="faq-panel" aria-label="江门行前问答">
<div class="faq-intro"><p>{len(records)} 条问答，了解江门景点、美食、路线与作品用法。</p><p class="faq-note">开放、票务与船班请以景区当日公告为准。</p></div>
<form class="faq-controls" role="search" aria-label="搜索本站问答" hidden>
<div class="faq-input-group"><label for="faq-query">想了解什么？</label><input id="faq-query" name="q" type="search" maxlength="80" autocomplete="off" placeholder="试试：陈皮、碉楼、下雨" aria-describedby="faq-search-help" aria-controls="faq-list"></div>
<div class="faq-select-group"><label for="faq-category">按主题查看</label><select id="faq-category" aria-controls="faq-list">{options}</select></div>
<button type="button" id="faq-clear">清除筛选</button>
<p id="faq-search-help" class="faq-search-help">输入关键词或常见问法；多个关键词可用空格分隔。</p></form>
<nav class="faq-shortcuts" aria-label="常见问题"><a href="#q-7">第一次来</a><a href="#q-26">一天怎么逛</a><a href="#q-10">买陈皮</a><a href="#q-16">川岛出行</a></nav>
<p id="faq-results-status" class="faq-results-status" role="status" aria-live="polite" aria-atomic="true">共 {len(records)} 条问答，可展开阅读。</p>
<div id="faq-empty" class="faq-empty" hidden><p>暂时没有匹配的问答。</p><p>试试更短的关键词，或清除筛选。当天价格、余票和船班请到景点的官方来源确认。</p><a href="travel.html#places">去景点页找官方来源 ↗</a></div>
<div id="faq-list" class="faq-list">{''.join(cards)}</div>
<noscript><p class="faq-note">当前未启用脚本，全部问答仍可展开阅读，也可使用浏览器的“在页面中查找”。</p></noscript>
</section>'''

"""Check Markdown preservation, safe rendering and produce a local QA fixture."""
from pathlib import Path
from html.parser import HTMLParser
from html import unescape
import json
import re

from experience_faq import read_faq, render_faq, _safe_href

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "材料" / "站内问答验证"
OUT.mkdir(parents=True, exist_ok=True)
source = (ROOT / "知识库" / "江门智能客服问答知识库.md").read_text(encoding="utf-8-sig")
records = read_faq(source)
html = render_faq(source)


class Inspect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.ids, self.links, self.texts = [], [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append(tag)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a":
            self.links.append(attrs)

    def handle_data(self, data):
        self.texts.append(data)


parsed = Inspect()
parsed.feed(html)
assert parsed.tags.count("details") == len(records)
assert len(parsed.ids) == len(set(parsed.ids))
assert "script" not in parsed.tags
assert [r["number"] for r in records] == list(range(1, len(records) + 1))
assert len(records) == 87
assert set(r["category"] for r in records) == {"places", "food", "routes", "culture", "practical", "website"}
assert records[60]["answer"].count("- ") == 7
text = "".join(parsed.texts)
for record in records:
    assert record["question"] in text
    for line in record["answer"].splitlines():
        assert line.removeprefix("- ") in text, (record["number"], line)
    for field in record["sources"]:
        assert field["label"] in text
        for label, url in re.findall(r"\[([^]]+)\]\(([^)]+)\)", field["text"]):
            assert any(link["href"] == url for link in parsed.links), url
            assert label in text
        if field["label"] in ("来源核查", "来源核查记录", "整理说明"):
            assert field["text"] in text

for url in ["javascript:alert(1)", "data:text/html,x", "//example.com/a", "http://example.com", "https://u:p@example.com", "../secret.html", "https://example.com/\npath"]:
    assert _safe_href(url) is None
for url in ["travel.html#place-chenpi", "https://example.com/a?q=x&n=1"]:
    assert _safe_href(url) == url
malicious = """## 测试
### Q1. <img src=x onerror=alert(1)>？
**答：** <script>alert('x')</script> [bad](javascript:alert) [good](https://example.com/?x=a&y=b)
**其他问法：** \" onclick=\"alert(2)
**关键词：** <svg/onload=alert(3)>
**来源页面：** travel.html#place-chenpi
"""
unsafe_render = render_faq(malicious)
inspection = Inspect()
inspection.feed(unsafe_render)
assert not {"img", "script", "svg"}.intersection(inspection.tags)
assert not any(link["href"].startswith("javascript") for link in inspection.links)
assert any(link["href"] == "https://example.com/?x=a&y=b" for link in inspection.links)

fixture = '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>江门问答模块回归</title><link rel="stylesheet" href="/faq.css"><style>body{margin:0;background:#f5f0e6;color:#183d36;font-family:"Microsoft YaHei",sans-serif}main{max-width:1080px;margin:auto;padding:24px}h1{font-size:28px}@media(max-width:650px){main{padding:16px}}</style></head><body><main><h1>行前问答</h1>' + html + '</main><script src="/faq.js" defer></script></body></html>'
(OUT / "faq-fixture.html").write_text(fixture, encoding="utf-8")
report = {"sourceCount": len(records), "detailCount": parsed.tags.count("details"), "categories": sorted(set(r["category"] for r in records)), "sourceLinks": len(parsed.links), "fullAnswers": True, "allSourceFields": True, "safeEscaping": True, "passed": True}
(OUT / "内容验证.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"PASS: {len(records)} complete questions; source metadata, multiline answers and safe links preserved.")

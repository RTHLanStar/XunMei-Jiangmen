"""Check all authored metadata, idempotence and safe escaping without network."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from experience_presentation import apply_metadata, render_print_control, PAGE_META, BASE_URL


class Tags(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def main():
    root = Path(__file__).resolve().parents[1]
    descriptions = set()
    checked = []
    for filename in PAGE_META:
        source = root / "site" / "dist" / filename
        raw = source.read_text(encoding="utf-8") if source.exists() else '<!doctype html><html><head><title>Fixture</title></head><body></body></html>'
        result = apply_metadata(raw, filename)
        assert apply_metadata(result, filename) == result, filename + " metadata not idempotent"
        tags = Tags(result).tags
        for attr, key in (("property", "og:title"), ("property", "og:description"), ("property", "og:image"), ("property", "og:url"), ("name", "twitter:card"), ("name", "twitter:description")):
            matched = [a for t, a in tags if t == "meta" and a.get(attr) == key]
            assert len(matched) == 1 and matched[0].get("content"), (filename, key)
        canonical = [a for t, a in tags if t == "link" and a.get("rel") == "canonical"]
        assert canonical == [{"rel": "canonical", "href": BASE_URL if filename == "index.html" else BASE_URL + filename}]
        work = json.loads(re.search(r'<script type="application/ld\+json" id="presentation-work">(.*?)</script>', result, re.S).group(1))
        assert work["@type"] == "CreativeWork" and work["author"]["name"] == "RTHLanStar"
        assert not {"award", "datePublished", "uploadDate", "aggregateRating"}.intersection(work)
        descriptions.add(work["description"])
        assert 'assets/film-poster.webp' in work["image"]
        checked.append({"file": filename, "metadata": True, "idempotent": True})
    assert len(descriptions) == len(PAGE_META), "Descriptions must be specific to each page"
    fixture = '<head><meta content="old" property="og:title"><meta name="twitter:card" content="old"><link href="old" rel="canonical"></head><body></body>'
    out = apply_metadata(fixture, "travel.html")
    assert "old" not in out
    original = PAGE_META["index.html"]
    try:
        PAGE_META["index.html"] = ('测试" <标题>', '</script><script>alert(1)</script>')
        escaped = apply_metadata('<head></head>', 'index.html')
        assert '&lt;/script&gt;' in escaped and '\\u003c/script>' in escaped
        assert '<script>alert(1)' not in escaped
    finally:
        PAGE_META["index.html"] = original
    assert 'data-print-tools hidden' in render_print_control()
    assert (root / 'site/dist/assets/film-poster.webp').is_file()
    report = {"checks": checked, "escaping": True, "oldTagsReplaced": True, "printProgressive": True}
    output = root / '材料/分享与打印验证'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'metadata-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()

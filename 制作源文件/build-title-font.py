"""Fetch a self-hosted Noto Serif SC subset for this site's fixed editorial text.

Run with Python 3. No third-party Python packages are needed. Google Fonts is
contacted only by this build script; delivered pages use a local WOFF2 file.
Visitors' own postcard text deliberately keeps the existing system font stack.
"""
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import struct
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "site" / "dist"
FONT_DIR = DIST / "assets" / "fonts"
FONT_NAME = "noto-serif-sc-editorial-400.woff2"
LICENSE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/OFL.txt"
FONT_PAGE = "https://fonts.google.com/noto/specimen/Noto+Serif+SC"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


class EditorialText(HTMLParser):
    classes = {"brand", "poem", "signature", "round-stamp", "stamps",
               "completion-seals", "story-thought", "about-signature",
               "film-details", "closing-mark", "big-comma"}
    void = {"area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        selected = tag in {"h1", "h2", "h3"} or bool(
            self.classes.intersection(dict(attrs).get("class", "").split()))
        if tag not in self.void:
            self.stack.append((tag, selected or (self.stack[-1][1] if self.stack else False)))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, text):
        if self.stack and self.stack[-1][1]:
            self.text.append(text)


def get(url):
    with urlopen(Request(url, headers={"User-Agent": UA}), timeout=60) as response:
        return response.read()


def main():
    content = []
    for name in ("index.html", "stories.html", "letters.html", "about.html"):
        parser = EditorialText()
        parser.feed((DIST / name).read_text(encoding="utf-8-sig"))
        content.extend(parser.text)
    chapters = (DIST / "chapters.js").read_text(encoding="utf-8-sig")
    content.extend(re.findall(r"(?:title|stamp):'([^']+)'", chapters))
    for poem in re.findall(r"poem:\[(.*?)\]", chapters):
        content.extend(re.findall(r"'([^']+)'", poem))
    content.append("“”江0123456789·。，、：；！？—（）《》/ ")
    content.append("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
    characters = "".join(sorted({c for c in "".join(content) if not c.isspace()})) + " "
    query = urlencode({"family": "Noto Serif SC:wght@400", "display": "swap", "text": characters})
    api_url = "https://fonts.googleapis.com/css2?" + query
    css = get(api_url).decode("utf-8")
    match = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)\s+format\(['\"]woff2['\"]\)", css)
    if not match:
        raise RuntimeError("Google Fonts did not return a WOFF2 subset.")
    font_url = match.group(1)
    data = get(font_url)
    if data[:4] != b"wOF2" or struct.unpack(">I", data[8:12])[0] != len(data):
        raise RuntimeError("Invalid WOFF2 signature or declared file length.")
    if len(data) > 150 * 1024:
        raise RuntimeError(f"Title font is larger than the 150 KiB budget: {len(data)} bytes")
    license_text = get(LICENSE_URL).decode("utf-8")
    if "SIL OPEN FONT LICENSE Version 1.1" not in license_text:
        raise RuntimeError("Unexpected font license response.")
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    (FONT_DIR / FONT_NAME).write_bytes(data)
    (FONT_DIR / "OFL-Noto-Serif-SC.txt").write_text(license_text, encoding="utf-8")
    record = {
        "retrieved_on": "2026-10-14",
        "family": "Noto Serif SC", "weight": 400, "format": "WOFF2",
        "file": "assets/fonts/" + FONT_NAME,
        "bytes": len(data), "sha256": sha256(data).hexdigest(),
        "unique_characters": len(characters), "characters": characters,
        "coverage": "Fixed h1/h2/h3, brand, chapter poems, stamps, signatures and editorial quotations across the four pages; dynamic chapter titles/poems are included. User-entered postcard text retains system fallbacks.",
        "font_page": FONT_PAGE, "google_fonts_subset_request": api_url,
        "font_download": font_url, "license": "SIL Open Font License 1.1",
        "license_source": LICENSE_URL,
        "runtime_network": "Same-origin local WOFF2 only; no Google Fonts request from delivered pages.",
        "verification": {"woff2_signature": True, "declared_file_length_matches": True}
    }
    (ROOT / "制作源文件" / "标题字体来源.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"font": FONT_NAME, "bytes": len(data), "characters": len(characters), "sha256": record["sha256"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()

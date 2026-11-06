"""Select live static files without deleting editable or historic workspace assets."""
from pathlib import Path
import re

def site_files(dist):
    dist=Path(dist).resolve()
    referenced=set()
    for page in dist.glob('*.html'):
        referenced.update(re.findall(r'href=["\'](site-[a-f0-9]+\.css)["\']',page.read_text(encoding='utf8')))
    if not referenced:
        raise ValueError('No hashed CSS referenced by the generated HTML; build first.')
    for name in referenced:
        if not (dist/name).is_file():raise FileNotFoundError(name)
    for file in sorted(dist.rglob('*')):
        relative=file.relative_to(dist)
        if not file.is_file() or any(p.startswith('.') for p in relative.parts):continue
        if re.fullmatch(r'site-[a-f0-9]+\.css',file.name) and relative.as_posix() not in referenced:continue
        yield file

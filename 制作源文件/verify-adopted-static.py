"""Static acceptance checks for the selected 2026-10-19 improvements."""
from pathlib import Path
from html.parser import HTMLParser
import json,re,sys

ROOT=Path(__file__).resolve().parent.parent
DIST=ROOT/'site/dist'
PAGES=('index','stories','letters','about','travel','food','routes','faq','tour')
BASE='https://rthlanstar.github.io/XunMei-Jiangmen/'
SDK='https://trtc.io/knocket-sdk/sdk.js?identifier=7cacdcf02616dcfa4e&v=1792401160166'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.tags=[];self.ids=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.tags.append((tag,a))
  if a.get('id'):self.ids.append(a['id'])

for name in PAGES:
 file=DIST/(name+'.html')
 assert file.is_file(),f'Missing planned page: {name}.html'
 text=file.read_text(encoding='utf8');p=Page();p.feed(text)
 assert not any(token in text for token in ('data-online-chat','online-help.js','qa-modes')),name+' custom online entry remains'
 assert len(p.ids)==len(set(p.ids)),name+' duplicate IDs'
 assert any(t=='a' and a.get('class')=='skip' for t,a in p.tags),name+' skip'
 sdk_tags=[a for t,a in p.tags if t=='script' and a.get('src','').startswith('https://trtc.io/knocket-sdk/sdk.js')]
 assert len(sdk_tags)==1 and sdk_tags[0].get('src')==SDK and 'async' in sdk_tags[0],name+' SDK version/count'
 assert text.rstrip().endswith(f'<script src="{SDK}" async></script></body></html>'),name+' SDK placement'
 assert any(t=='link' and a.get('rel')=='canonical' and a.get('href','').startswith(BASE) for t,a in p.tags),name+' canonical'
 for key in ('og:title','og:description','og:image','og:url','og:type'):
  assert sum(t=='meta' and a.get('property')==key and bool(a.get('content')) for t,a in p.tags)==1,(name,key)
 for key in ('twitter:card','twitter:title','twitter:description','twitter:image'):
  assert sum(t=='meta' and a.get('name')==key and bool(a.get('content')) for t,a in p.tags)==1,(name,key)
 assert any(t=='a' and a.get('href')=='faq.html' for t,a in p.tags),name+' FAQ entry'
 assert any(t=='a' and a.get('href')=='tour.html' for t,a in p.tags),name+' tour entry'
 # The theme is resolved before the stylesheet so the first paint is already correct.
 assert text.count('id="theme-color"')==1,name+' theme-color meta'
 assert 'data-theme-toggle' in text,name+' theme switch'
 assert text.count('localStorage.getItem("jiangmen-theme")')==1,name+' duplicated theme boot script'
 assert text.count('theme.js')==1,name+' duplicated theme module tag'
 assert 'data-theme-source' in text,name+' theme boot script'
 boot_at=text.find('data-theme-source');css_at=text.find('site-')
 assert boot_at>0 and css_at>boot_at,name+' theme script after stylesheet'
 for t,a in p.tags:
  if t=='a' and a.get('href','').endswith('.html') and not a['href'].startswith(('https:','http:')):assert (DIST/a['href']).is_file(),a['href']
 if name in ('travel','food','routes','faq'):
  assert any(t=='button' and 'data-print-page' in a for t,a in p.tags),name+' print action'

faq=(DIST/'faq.html').read_text(encoding='utf8');p=Page();p.feed(faq)
md=(ROOT/'知识库/江门智能客服问答知识库.md').read_text(encoding='utf8')
nums=[int(n) for n in re.findall(r'^### Q(\d+)\.',md,re.M)]
assert nums==list(range(1,88)),len(nums)
assert all('q-'+str(n) in p.ids for n in nums),'Knowledge answers missing from static page'
assert not any('q-'+str(n) in p.ids for n in range(88,95)),'Removed questions remain'
assert not (DIST/'online-help.js').exists(),'Retired online opener remains in delivery'
assert (DIST/'tokens.css').is_file(),'Design tokens missing'
assert (DIST/'theme.js').is_file(),'Theme switch script missing'
assert 'contextmenu' in (DIST/'common.js').read_text(encoding='utf8'),'User preference was removed'
assert '<track ' in (DIST/'index.html').read_text(encoding='utf8'),'Subtitle track regression'
sys.path.insert(0,str(Path(__file__).parent))
from release_files import site_files
selected=list(site_files(DIST));hashes=[f.name for f in selected if re.fullmatch(r'site-[a-f0-9]+\.css',f.name)]
assert len(hashes)==1,hashes
assert all((DIST/name).is_file() for name in hashes)
result={'passed':True,'pages':len(PAGES),'questions':len(nums),'currentHashedCss':hashes,'originalSdkRightClickAndCaptionsPreserved':True,'themeSwitchOnEveryPage':True}
out=ROOT/'材料/建议优化验证';out.mkdir(exist_ok=True)
(out/'静态验收.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result,ensure_ascii=False))

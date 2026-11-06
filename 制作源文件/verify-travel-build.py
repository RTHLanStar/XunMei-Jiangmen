"""Verify repeatable static generation, dependency presence and module placement."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re,subprocess,sys

ROOT=Path(__file__).resolve().parent.parent
DIST=ROOT/'site/dist'
FILES=['index','stories','letters','about','travel','food','routes','faq','tour']
EXPECTED={'index':['daily-letter'],'routes':['route-finder'],'travel':['travel-passport'],'letters':['travel-passport']}
SDK='https://trtc.io/knocket-sdk/sdk.js?identifier=7cacdcf02616dcfa4e&v=1792401160166'

class Page(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.assets=[];self.scripts=[];self.styles=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if a.get('id'):self.ids.append(a['id'])
  if tag=='script' and a.get('src'):self.scripts.append(a['src'])
  if tag=='link' and a.get('rel')=='stylesheet':self.styles.append(a['href'])
  if tag in ('script','img','video','source') and a.get('src'):self.assets.append(a['src'])
  if tag=='link' and a.get('href'):self.assets.append(a['href'])

def snapshot():return {f:hashlib.sha256((DIST/(f+'.html')).read_bytes()).hexdigest() for f in FILES}
def build():subprocess.run([sys.executable,'-X','utf8',str(Path(__file__).with_name('build-travel-guide.py'))],cwd=ROOT,check=True)

build();first=snapshot();build();assert first==snapshot(),'Repeated build changes the generated HTML'
for f in FILES:
 text=(DIST/(f+'.html')).read_text(encoding='utf8');p=Page();p.feed(text)
 assert len(p.ids)==len(set(p.ids)),f+' has duplicate IDs'
 assert [s for s in p.scripts if s.startswith('https://trtc.io/knocket-sdk/sdk.js')]==[SDK] and text.rstrip().endswith(f'<script src="{SDK}" async></script></body></html>'),f+' SDK version/count/placement'
 assert len(p.styles)==1 and re.fullmatch(r'site-[a-f0-9]{12}\.css',p.styles[0]),f+' stylesheet'
 for module in ('daily-letter','route-finder','travel-passport'):
  count=sum(s.startswith(module+'.js?') for s in p.scripts)
  assert count==int(module in EXPECTED.get(f,[])),(f,module,count)
 assert p.ids.count('travel-passport-data')==int(f in ('travel','letters'))
 for asset in p.assets:
  if asset.startswith(('https:','data:')):continue
  assert (DIST/asset.split('?')[0]).is_file(),(f,asset)
 if f=='index':
  assert p.ids.count('daily-letter')==1 and p.ids.count('hero-title')==1
  assert text.index('id="journey"')<text.index('id="daily-letter"')<text.index('id="film"')
  assert '左右滑动图片，继续读信' not in text and 'class="chapter-controls"' not in text
 if f=='letters':assert text.index('id="travel-passport"')<text.index('id="postcard"')
 if f=='travel':assert p.scripts.index(next(s for s in p.scripts if s.startswith('guide.js?')))<p.scripts.index(next(s for s in p.scripts if s.startswith('travel-passport.js?')))

md=(ROOT/'知识库/江门智能客服问答知识库.md').read_text(encoding='utf8')
txt=(ROOT/'知识库/江门智能客服问答知识库.txt').read_text(encoding='utf8')
assert [int(n) for n in re.findall(r'^### Q(\d+)\.',md,re.M)]==list(range(1,88))
assert len(re.findall(r'^答：',txt,re.M))==87
result={'passed':True,'repeatableBuild':True,'pages':9,'knowledgeAnswers':87,'localDependencies':True,'modulePlacement':True,'exactSdkOncePerPage':True,'htmlSha256':first}
out=ROOT/'材料/旅行体验验证';out.mkdir(exist_ok=True)
(out/'静态构建验证.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print('PASS: repeatable 9-page build, IDs, local assets, modules, exact SDK, 87 knowledge answers.')

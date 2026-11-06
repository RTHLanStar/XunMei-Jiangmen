"""Prepare locally hosted, attributed photographs for the destination guide."""
from pathlib import Path
import json,math,re
from PIL import Image, ImageOps, ImageDraw

ROOT=Path(__file__).resolve().parent.parent
M=ROOT/'材料/旅行照片'
DIST=ROOT/'site/dist'
OUT=DIST/'assets/travel'
OUT.mkdir(parents=True,exist_ok=True)
labels={'longdi':'长堤骑楼','qiming':'启明里侨屋','liang':'梁启超故居纪念馆','bird':'小鸟天堂古榕','zili':'自力村碉楼与田园','chikan':'开平赤坎古镇','chuandao':'上川岛飞沙滩'}
manifest=[]
for group in ('town','rural','expanded-east','expanded-west'):
    data=json.loads((M/group/'manifest.json').read_text(encoding='utf8'))
    for p in (data if isinstance(data,list) else data['photos']):
        real_chenpi=M/'chenpi-real/manifest.json'
        if p['id']=='chenpi' and real_chenpi.exists():
            p=json.loads(real_chenpi.read_text(encoding='utf8'))['candidate']
            p['asset_id']='chenpi-village'
        original=Path(p.get('local_original') or p['original_path'])
        if not original.is_absolute():original=ROOT/original
        with Image.open(original) as source:
            source=ImageOps.exif_transpose(source).convert('RGB')
            sizes=[]
            for target,quality in ((960,76),(480,74)):
                img=source.copy();img.thumbnail((target,10000),Image.Resampling.LANCZOS)
                filename=f'{p.get("asset_id",p["id"])}-{target}.webp'
                img.save(OUT/filename,'WEBP',quality=quality,method=6)
                sizes.append((filename,img.width,img.height,(OUT/filename).stat().st_size))
        date=p.get('photo_date') or p.get('photographed') or ''
        if not re.match(r'^\d{4}',date):date=''
        year=date[:4]
        label=labels.get(p['id'],p.get('place',p['id']))
        caption=p.get('caption') or (f'{label} · {year}年实景' if year else label+'实景')
        if p['id']=='chenpi':caption='新会陈皮村入口实景' if p.get('photo_kind')=='real' else '陈皮实物 · 主题配图，非陈皮村实景'
        item={key:p[key] for key in ('id','author','license','license_url','source_url','alt')}
        item.update(caption=caption,photographed=date,date_note='照片记录拍摄时的面貌。' if year else '',src='assets/travel/'+sizes[0][0],small='assets/travel/'+sizes[1][0],width=sizes[0][1],height=sizes[0][2],modifications='等比缩小、WebP压缩；网页展示可能裁切。衍生照片沿用所列许可。',bytes=sizes[0][3],small_bytes=sizes[1][3])
        item['small_width']=sizes[1][1]
        item['date_note']=p.get('date_note') or ('照片记录拍摄时的面貌。' if year else '拍摄日期未注明，以现场为准。')
        for key in ('required_credit','rights_status','image_url','original_url'):
            if p.get(key):item[key]=p[key]
        if p.get('preserve_full') or p.get('required_credit'):
            item.update(preserve_full=True,modifications='仅等比缩小与WebP转换，保留完整画面及原水印。')
        if p['id']=='chenpi':item['date_note']='来源页发布于2024年，拍摄时间未注明。'
        manifest.append(item)
order={p['id']:i for i,p in enumerate(json.loads((ROOT/'材料/旅行内容研究-景点.json').read_text(encoding='utf8'))['places'])}
assert len({p['id'] for p in manifest})==len(manifest)
assert set(order)=={p['id'] for p in manifest},'Every destination needs its own photograph'
manifest.sort(key=lambda p:order[p['id']])
(M/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'photo-credits.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
credits=['旅行指南摄影素材与使用条件','每张照片的署名、原图与许可如下。Commons照片遵循各自许可；陈皮村照片保留完整画面、水印及来源。部分官方配图未见开放许可，标记permission-not-confirmed，仅作本地参考整理，公开使用前须核实相应授权；来源署名不等于授权。其他作品内容不因此改变许可。','']
for p in manifest:
    credits.extend([p['caption'],f'摄影/供图：{p["author"]}',f'许可：{p["license"]} {p["license_url"]}',p['source_url'],p.get('required_credit',''),p.get('rights_status',''),p['date_note'],f'文件：{p["src"]} / {p["small"]}',''])
(OUT/'LICENSES.txt').write_text('\n'.join(credits),encoding='utf8')
sheet=Image.new('RGB',(960,math.ceil(len(manifest)/2)*220),'#f5f0e6');draw=ImageDraw.Draw(sheet)
for i,p in enumerate(manifest):
    with Image.open(DIST/p['src']) as im:
        thumb=ImageOps.contain(im,(460,185))
        x=(i%2)*480;y=(i//2)*220
        sheet.paste(thumb,(x,y));draw.text((x+8,y+190),p['id'],fill='#183d36')
sheet.save(M/'photos-overview.jpg',quality=85)
print(json.dumps({'photos':len(manifest),'desktop_bytes':sum(p['bytes'] for p in manifest),'mobile_bytes':sum(p['small_bytes'] for p in manifest)},ensure_ascii=False))

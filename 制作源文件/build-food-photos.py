"""Build food assets; --prepare-new-only --exclude ID leaves manifests unchanged."""
from pathlib import Path
import argparse, hashlib, json, shutil
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parent.parent
M = ROOT / '材料/美食照片'
OUT = ROOT / 'site/dist/assets/food'
OUT.mkdir(parents=True, exist_ok=True)
GENERATED = Path('C:/Users/QiuLiang/.codex/generated_images/01a135f0-0268-7b70-9c6b-a7e63e76118c')
RECORD = M / 'AI生成记录.json'
ADDITIONS = M / '新增生成记录-2026-10-16.json'
RESEARCH = ROOT / '材料/美食与路线扩充-2026-10-16.json'
BASE_IMAGES = {
 'waihai-noodles': ('exec-9567f23c-86c1-4298-85ce-c27db0783c56.png', '外海面 · AI菜式示意', '细黄面与牛腩清汤的AI菜式示意'),
 'chenpi-dishes': ('exec-63c289ad-c64a-428e-bdbc-9c4301256512.png', '陈皮排骨 · AI菜式示意', '陈皮丝与酱汁排骨的AI菜式示意'),
 'enping-laifen': ('exec-629bb229-7312-421f-9d56-22c99d0d2717.png', '恩平濑粉 · AI菜式示意', '白色圆米粉与肉丝清汤的AI菜式示意'),
 'gulao-fish-dumplings': ('exec-c4aef504-544e-4a59-898a-10082ff9796d.png', '古劳鱼皮角 · AI菜式示意', '薄皮鱼蓉饺子与清汤的AI菜式示意'),
}
NEW_ALTS = {
 'hetang-fish-cakes': '金黄鲮鱼蓉煎鱼饼与细白剖面的AI菜式示意',
 'duruan-bitter-melon': '厚肉绿色凉瓜与带骨排骨清汤的AI菜式示意，图片不能证明原料产地',
 'lile-ribs': '小碟现蒸带骨排骨与清亮肉汁的AI菜式示意',
 'enping-shaobing': '金黄芝麻糯米烧饼与柔韧米粉饼身的AI菜式示意',
 'taishan-savory-tangyuan': '无馅小糯米丸配萝卜丝、虾干与鸡丝清汤的AI菜式示意',
 'kaiping-xianjilong': '金黄半月形油炸米皮点心与细碎咸馅的AI菜式示意',
}

def prepare_ai(item, caption, alt, refresh_original=True):
    ident = item['id']
    original = M / f'{ident}-ai.png'
    source = Path(item['generated_path'])
    if source.exists():
        # Corrected generations replace their local draft, too.
        if not original.exists() or (refresh_original and source.read_bytes() != original.read_bytes()):
            shutil.copy2(source, original)
    elif not original.exists():
        raise FileNotFoundError(f'AI original missing: {ident}: {source}')
    sizes = {}
    with Image.open(original) as raw:
        image = ImageOps.exif_transpose(raw).convert('RGB')
        for width in (960, 480):
            variant = image.copy()
            variant.thumbnail((width, 10000), Image.Resampling.LANCZOS)
            path = OUT / f'{ident}-{width}.webp'
            variant.save(path, 'WEBP', quality=76, method=6)
            sizes[width] = (variant.width, variant.height, path.stat().st_size)
    record = dict(item, local_original=str(original), original_sha256=hashlib.sha256(original.read_bytes()).hexdigest())
    photo = dict(id=ident, kind='ai', caption=caption, alt=alt, author='ImageGen',
                 src=f'assets/food/{ident}-960.webp', small=f'assets/food/{ident}-480.webp',
                 width=sizes[960][0], height=sizes[960][1], small_width=sizes[480][0],
                 small_height=sizes[480][1], bytes=sizes[960][2], small_bytes=sizes[480][2],
                 modifications='ImageGen生成的菜式示意；等比缩小、WebP压缩；不是门店实拍、试吃记录或原料产地证明。',
                 date_note='AI菜式示意，非店铺实拍。')
    return photo, record

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare-new-only', action='store_true')
    parser.add_argument('--exclude', action='append', default=[])
    args = parser.parse_args()
    if args.exclude and not args.prepare_new_only:
        parser.error('--exclude is only supported with --prepare-new-only')
    additions = json.loads(ADDITIONS.read_text(encoding='utf8')) if ADDITIONS.exists() else {'images': []}
    research = json.loads(RESEARCH.read_text(encoding='utf8')) if RESEARCH.exists() else {'foodImageBriefs': []}
    briefs = {x['foodId']: x for x in research['foodImageBriefs']}
    new_photos, new_records = [], []
    for item in additions['images']:
        ident = item['id']
        if ident in args.exclude: continue
        brief = briefs[ident]
        photo, record = prepare_ai(dict(item, tool='built-in image_gen', generatedAt=additions['generatedAt']),
                                   brief['caption'], brief.get('alt') or NEW_ALTS[ident])
        new_photos.append(photo)
        new_records.append(record)
    if args.prepare_new_only:
        print('Prepared new image assets only:', ', '.join(p['id'] for p in new_photos))
        return
    manifest = []
    for p in json.loads((M/'manifest.json').read_text(encoding='utf8'))['photos']:
        large, small = p['files']
        for f in p['files']: shutil.copy2(f['path'], OUT/Path(f['path']).name)
        photo = {key: p[key] for key in ('id', 'alt', 'author', 'license', 'license_url', 'source_url', 'width', 'height')}
        photo.update(kind='photo', caption=p['display_note'], src='assets/food/'+Path(large['path']).name,
                     small='assets/food/'+Path(small['path']).name, small_width=small['width'], small_height=small['height'],
                     modifications=p['changes'], date_note='拍摄于'+p['photo_date'][:4]+'年。')
        manifest.append(photo)
    old_record = json.loads(RECORD.read_text(encoding='utf8'))
    old_by_id = {x['id']: x for x in old_record['images']}
    records = []
    for ident, (file, caption, alt) in BASE_IMAGES.items():
        item = dict(old_by_id[ident], id=ident, generated_path=str(GENERATED/file), tool='built-in image_gen', generatedAt='2026-10-15')
        photo, record = prepare_ai(item, caption, alt, refresh_original=False)
        manifest.append(photo)
        records.append(record)
    manifest.extend(new_photos)
    records.extend(new_records)
    assert len({p['id'] for p in manifest}) == len(manifest), 'Duplicate food photo IDs'
    assert set(briefs).issubset({p['id'] for p in new_photos}), 'A new dish is missing its image'
    RECORD.write_text(json.dumps(dict(tool='built-in image_gen', date=old_record.get('date', '2026-10-15'),
                                    updatedAt=additions.get('generatedAt', '2026-10-15'),
                                    label='AI菜式示意，非店铺实拍', images=records), ensure_ascii=False, indent=2), encoding='utf8')
    (M/'site-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
    (OUT/'photo-credits.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
    photo_count = sum(p['kind']=='photo' for p in manifest)
    ai_count = sum(p['kind']=='ai' for p in manifest)
    lines = ['美食配图来源', f'{photo_count}张摄影用于菜式参考，{ai_count}张为明确标注的AI菜式示意；非本站探店或试吃记录。', '']
    for p in manifest:
        lines.append(p['caption'])
        if p['kind']=='photo': lines.extend([p['author'], p['license']+' '+p['license_url'], p['source_url'], p['modifications']])
        else: lines.extend(['ImageGen生成；原图本地路径、完整提示词与制作记录见参赛包材料/美食照片/AI生成记录.json。', 'AI菜式示意，非门店实拍或试吃记录，不能证明原料产地。'])
        lines.append('')
    (OUT/'LICENSES.txt').write_text('\n'.join(lines), encoding='utf8')
    print('Prepared', len(manifest), f'food images: {photo_count} photography + {ai_count} AI;', sum(p.stat().st_size for p in OUT.glob('*.webp')), 'bytes in both sizes.')

if __name__ == '__main__': main()

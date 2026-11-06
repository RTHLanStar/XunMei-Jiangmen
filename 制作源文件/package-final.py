"""Create the complete submission ZIP from explicitly selected current files."""
from pathlib import Path
import hashlib
import importlib.util
import json
import shutil
import zipfile
from release_files import site_files

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'site' / 'dist'
STAGING = ROOT / '参赛作品包'
ARCHIVE_ROOT = Path('侨乡来信-参赛作品包')
MATERIAL_NAMES = [
    '作品说明.txt', '提交与使用说明.txt', '音频创作说明.txt', '分镜与旁白.txt',
    'AI图像生成记录.json', '最终配音记录.json', '中文字幕.srt',
    '短片源文件使用说明.txt', '示例明信片.png', '短片十镜头预览.jpg',
    '网页-桌面.png', '网页-手机.png',
    '最终验证.json', '陈皮图标生成记录.json',
    '仿真陈皮图标源图.png', '标题栏-最终.png', '交互设计说明.txt',
    '收藏碎裂动画.png', '陈皮三瓣动画.png',
    '在线预览说明.txt', '虚拟主机部署说明.txt', '多页面升级说明.txt',
    '影像升级说明.txt', '影像升级记录.json', '最终混音报告.json', '影像最终验证.json',
    '体验优化说明.txt', '标题字体来源.json', '字体可读性验证.json',
    '旅行指南升级说明.txt', '旅行内容研究-景点.json', '旅行内容研究-美食.json',
    '旅行照片/manifest.json', '旅行照片升级说明.txt',
    '手机兼容与图文升级说明.txt', '美食照片/site-manifest.json', '美食照片/AI生成记录.json',
    '美食照片/waihai-noodles-ai.png', '美食照片/chenpi-dishes-ai.png',
    '美食照片/enping-laifen-ai.png', '美食照片/gulao-fish-dumplings-ai.png',
    '景点扩充核查-2026-10-16.json', '轮播与景点扩充说明-2026-10-16.txt',
    '美食与路线扩充-2026-10-16.json', '全景点配图与旅行升级说明-2026-10-16.txt',
    '美食照片/新增生成记录-2026-10-16.json',
    '首页标题动效说明-2026-10-18.txt',
    '旅行体验升级说明-2026-10-18.txt', '旅行搭配建议-2026-10-18.json',
    '修改建议采纳说明-2026-10-19.md',
]
VIDEO_SOURCE_NAMES = [
    'index.html', 'scenes.json', 'music.wav', 'ambience.wav', 'final-mix.wav',
    'hyperframes.json', 'meta.json', 'package.json', 'DESIGN.md',
    'build-video.py', 'build-audio.py', 'audio-report.json', 'captions.json',
    'subtitles.vtt', 'subtitles.srt', 'gsap.min.js',
] + [f'voice-{i}.wav' for i in range(6)]
VIDEO_IMAGE_NAMES = [
    'tower-wide.png', 'tower-detail.png', 'street-wide.png', 'street-detail.png',
    'river-wide.png', 'river-detail.png', 'peel-wide.png', 'peel-detail.png',
    'letter.png', 'architecture-prompts.json', 'river-peel-prompts.json',
]
# Exclude reproducible mixing intermediates: voice-bus.wav, music-carved.wav, premix.wav.
README = '''《侨乡来信·江门》完整作品包
创作展示名：RTHLanStar
创作者链接：https://github.com/RTHLanStar

1. 双击互动网页/index.html打开作品。网站共有首页、侨乡故事、我的来信、关于创作、景点、美食、路线、站内问答、作品导览九页；请保留整个互动网页目录，保持相对路径不变。
2. 可以收藏四枚印记、体验集齐后的收信结尾、续写明信片并保存PNG。草稿与印记尽力保存在当前浏览器；清理浏览器数据、更换浏览器或不同网址不会自动同步。
3. 完整包保留离线绘图数据，直接以file://打开也可生成明信片。手机系统分享是否可用取决于浏览器及访问环境；不支持时仍提供图片预览和保存。
4. 独立短片位于互动网页/assets/qiaoxiang-letter.mp4，66秒，1080P；九张独立AI艺术影像编成十个镜头，25句字幕，保留已确认的自然男声，配以原创音乐和轻环境音。
5. 材料含作品简介、分镜、AI生成记录、参考来源、使用说明及预览。学校、院系、正式参赛身份等未知字段请参赛前核实补齐。
6. 制作源文件/video-v2包含可编辑视频HTML、九张AI原图与真实提示词、冻结旁白、原创音乐、程序环境音、最终混音和构建脚本。网站源码就是互动网页目录内的HTML、CSS和JavaScript文件。
7. 上传虚拟主机时建议使用另行提供的“侨乡来信-虚拟主机静态部署包.zip”，该包省去了仅供离线绘图的数据文件。
8. 注册和提交请按组织委员、官方平台流程进行。
9. 知识库目录包含更新后的客服问答Markdown与纯文本文件；需在客服平台后台导入，本地文件更新不代表云端知识库已同步。
10. 本版旅行内容含20项景点实景配图、14项美食、6条编辑路线与87条站内及可导入客服问答。原第88—94问已移除；在线问答继续只使用原客服浮动按钮。景点照片中4张官方配图未见开放许可，来源与权限状态如实列入材料，不代表已获额外授权；美食图含4张摄影参考及10张明确标注的AI菜式示意。
11. 本次只交付本地完整包，未发布在线预览，未将知识库导入云端。虚拟主机/v2.2/仍需上传完整静态文件。
12. 新增今日江门来信、按时间与兴趣选路线、景点美食双向推荐，以及旅行护照与PNG纪念卡。去过记录独立保存，七区市邮戳为私人自记；不使用定位。无JavaScript仍保留静态阅读内容，存储不可用时记录仅当前页有效。
13. 本版增加站内问答搜索、约三分钟作品导览、分享预览信息与旅行内容打印。工作副本保留旧样式，交付包仅选取当前HTML引用的哈希CSS。
'''

def verified_photo_assets():
    """Share deployment validation without creating an archive or importing a CLI."""
    spec = importlib.util.spec_from_file_location('static_host_package', Path(__file__).with_name('package-static-host.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.photo_assets()

def photo_source_entries():
    """Select actual sources and licence records, excluding discarded candidates."""
    entries = {}
    def include(source):
        source = source.resolve()
        relative = source.relative_to(ROOT.resolve())
        entries[relative] = source
    for directory in ('expanded-east', 'expanded-west'):
        folder = ROOT / '材料' / '旅行照片' / directory
        for source in sorted(folder.glob('*')):
            if source.is_file() and source.suffix in ('.json', '.html', '.txt'):
                include(source)
        for photo in json.loads((folder / 'manifest.json').read_text(encoding='utf8')):
            original = Path(photo['local_original'])
            include(original if original.is_absolute() else ROOT / original)
    food_folder = ROOT / '材料' / '美食照片'
    for source in sorted(food_folder.glob('AI*记录*.json')):
        include(source)
    foods = json.loads((food_folder / 'site-manifest.json').read_text(encoding='utf8'))
    for photo in foods:
        if photo.get('kind') == 'ai':
            include(food_folder / (photo['id'] + '-ai.png'))
    return entries

def current_entries():
    """Map archive-relative paths to current sources; never package stale staging files."""
    required_photos = verified_photo_assets()
    entries = {}
    for source in site_files(DIST):
        relative = source.relative_to(DIST)
        if source.is_file() and not any(part.startswith('.') for part in relative.parts):
            entries[Path('互动网页') / relative] = source
    for name in MATERIAL_NAMES:
        entries[Path('材料') / name] = ROOT / '材料' / name
    entries.update(photo_source_entries())
    assert {Path('互动网页') / name for name in required_photos} <= set(entries)
    qa_directory = ROOT / '材料' / '多页面验证'
    for source in sorted(qa_directory.rglob('*')):
        relative = source.relative_to(qa_directory)
        if source.is_file() and not any(part.startswith('.') for part in relative.parts):
            entries[Path('材料/多页面验证') / relative] = source
    for name in VIDEO_SOURCE_NAMES:
        entries[Path('制作源文件/video-v2') / name] = ROOT / 'video-v2' / name
    for directory in ('体验优化验证','精修验证','旅行指南验证','旅行照片验证','手机布局回归','脚本接入验证','风物轮播验证','标题动效验证','旅行体验验证','今日来信验证','旅行护照验证','建议优化验证','站内问答验证','分享与打印验证','主题与视觉验收'):
        for source in sorted((ROOT/'材料'/directory).rglob('*')):
            if source.is_file() and not source.name.startswith('FAIL-'):
                entries[Path('材料')/directory/source.relative_to(ROOT/'材料'/directory)]=source
    for source in sorted((ROOT/'知识库').glob('*')):
        if source.is_file() and source.suffix in ('.md','.txt','.json'):
            entries[Path('知识库')/source.name]=source
    for name in ('build-title-font.py','标题字体来源.json','optimize-assets.py','build-travel-guide.py','build-travel-photos.py','build-food-photos.py','package-static-host.py','package-final.py','verify-sdk-integration.cjs','verify-chapter-carousel.cjs','verify-travel-guide.cjs','verify-travel-photos.cjs','verify-mobile-layout.cjs','verify-title-typewriter.cjs'):
        entries[Path('制作源文件')/name]=ROOT/'制作源文件'/name
    for name in VIDEO_IMAGE_NAMES:
        entries[Path('制作源文件/video-v2/images') / name] = ROOT / 'video-v2' / 'images' / name
    for name in ('experience_letter.py','experience_routes.py','experience_passport.py','experience_pairings.py','verify-travel-experiences.cjs','verify-travel-experiences-passport.cjs','verify-travel-passport.cjs','verify-daily-letter.py','verify-daily-letter.cjs','verify-travel-build.py'):
        entries[Path('制作源文件')/name]=ROOT/'制作源文件'/name
    for name in ('build.py','release_files.py','browser-runtime.cjs','experience_faq.py','experience_tour.py','experience_presentation.py','verify-adopted-static.py','verify-theme-ui.cjs','verify-reading-tools.cjs','verify-faq.py','verify-faq.cjs','verify-faq-integration.cjs','verify-presentation.py','verify-presentation.cjs','fixtures/legacy-site.css'):
        entries[Path('制作源文件')/name]=ROOT/'制作源文件'/name
    for name in ('README.md','DESIGN.md'):
        entries[Path(name)]=ROOT/name
    for source in sorted((ROOT/'材料/恢复原客服验证').glob('*')):
        if source.is_file() and source.suffix in ('.json','.png'):
            entries[Path('材料/恢复原客服验证')/source.name]=source
    return entries

def main():
    entries = current_entries()
    missing = [str(source) for source in entries.values() if not source.is_file()]
    if missing:
        raise FileNotFoundError('\n'.join(missing))
    for required in ('index.html', 'stories.html', 'letters.html', 'about.html','travel.html','food.html','routes.html','faq.html','tour.html'):
        if Path('互动网页') / required not in entries:
            raise FileNotFoundError(required)
    STAGING.mkdir(exist_ok=True)
    selected = []
    for relative, source in entries.items():
        destination = STAGING / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        selected.append(destination)
    readme_path = STAGING / '先读我.txt'
    readme_path.write_text(README, encoding='utf8')
    selected.append(readme_path)
    # Only current selected files are hashed. The manifest never hashes its own old contents.
    manifest = {
        path.relative_to(STAGING).as_posix(): {
            'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        }
        for path in sorted(selected)
    }
    manifest_path = STAGING / '文件清单.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
    selected.append(manifest_path)
    archive_path = ROOT / '侨乡来信-参赛作品包.zip'
    # No recursive deletion: old staging files are deliberately outside this list.
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(selected):
            archive.write(path, (ARCHIVE_ROOT / path.relative_to(STAGING)).as_posix())
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.testzip() is None
        names = set(archive.namelist())
        prefix = ARCHIVE_ROOT.as_posix() + '/'
        assert names == {prefix + path.relative_to(STAGING).as_posix() for path in selected}
        assert prefix + '互动网页/assets/atlas-data.js' in names
        assert prefix + '互动网页/assets/jiangmen-atlas.png' not in names
        assert prefix + '互动网页/assets/qiaoxiang-letter.mp4' in names
        assert prefix + '制作源文件/video-v2/images/letter.png' in names
        assert prefix + '制作源文件/video-v2/gsap.min.js' in names
        for excluded in ('voice-bus.wav', 'music-carved.wav', 'premix.wav'):
            assert prefix + '制作源文件/video-v2/' + excluded not in names
        assert not any(name.startswith(prefix + '制作源文件/video/') for name in names)
        for relative, source in entries.items():
            assert archive.read(prefix + relative.as_posix()) == source.read_bytes()
        packed_manifest = json.loads(archive.read(prefix + '文件清单.json'))
        assert '文件清单.json' not in packed_manifest
        for relative, info in packed_manifest.items():
            data = archive.read(prefix + relative)
            assert len(data) == info['bytes']
            assert hashlib.sha256(data).hexdigest() == info['sha256']
        print('ZIP PASS', len(names), 'files', round(archive_path.stat().st_size / 1024 / 1024, 2), 'MiB')

if __name__ == '__main__':
    main()

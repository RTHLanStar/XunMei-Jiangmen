"""Package every current static page and dependency for an ordinary web host."""
from pathlib import Path
import json
import zipfile
from release_files import site_files

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'site' / 'dist'
# HTTP/HTTPS uses single-scene WebP. Embedded atlas data remains in the offline ZIP.
OFFLINE_ONLY = {'assets/atlas-data.js'}

def photo_assets():
    """Verify current research coverage and return every manifest image dependency."""
    required = set()
    for directory, manifest_name, research_name, collection in (
        ('travel', '旅行照片/manifest.json', '旅行内容研究-景点.json', 'places'),
        ('food', '美食照片/site-manifest.json', '旅行内容研究-美食.json', 'foods'),
    ):
        photos = json.loads((ROOT / '材料' / manifest_name).read_text(encoding='utf8'))
        research = json.loads((ROOT / '材料' / research_name).read_text(encoding='utf8'))
        ids = [photo['id'] for photo in photos]
        expected_ids = {item['id'] for item in research[collection]}
        assert len(ids) == len(set(ids)), f'Duplicate {directory} photo IDs'
        assert set(ids) == expected_ids, f'{directory} photo coverage differs: missing {expected_ids-set(ids)}, extra {set(ids)-expected_ids}'
        credits_path = DIST / 'assets' / directory / 'photo-credits.json'
        assert json.loads(credits_path.read_text(encoding='utf8')) == photos, f'Stale {directory} photo credits'
        required.update((f'assets/{directory}/LICENSES.txt', f'assets/{directory}/photo-credits.json'))
        for photo in photos:
            for field in ('src', 'small'):
                relative = Path(photo[field])
                assert not relative.is_absolute() and '..' not in relative.parts
                assert relative.as_posix().startswith(f'assets/{directory}/')
                path = DIST / relative
                assert path.is_file() and path.stat().st_size > 0, f'Missing photo: {relative}'
                required.add(relative.as_posix())
            assert photo['width'] > 0 and photo['height'] > 0
            if photo.get('rights_status') == 'permission-not-confirmed':
                assert photo.get('preserve_full') and photo.get('required_credit'), f'Missing rights display safeguards: {photo["id"]}'
    return required

def deployment_files():
    files = []
    for path in site_files(DIST):
        relative = path.relative_to(DIST)
        if path.is_file() and not any(part.startswith('.') for part in relative.parts):
            if relative.as_posix() not in OFFLINE_ONLY:
                files.append(path)
    return files

def main():
    files = deployment_files()
    expected = {path.relative_to(DIST).as_posix() for path in files}
    required = {'index.html', 'stories.html', 'letters.html', 'about.html', 'travel.html', 'food.html', 'routes.html', 'common.js', 'postcard.js', 'site.css', 'guide.js', 'assets/qiaoxiang-letter.mp4', 'assets/travel/LICENSES.txt', 'assets/travel/photo-credits.json'}
    required.update(photo_assets())
    required.update({'faq.html','tour.html','faq.js','faq.css','tour.css','presentation.css','presentation.js','assets/faq-data.json'})
    required.update({'daily-letter.js','route-finder.js','travel-passport.js','travel-experiences.css','daily-letter.css','route-finder.css','travel-passport.css'})
    required.update({'tokens.css','theme.js'})
    assert any(name.startswith('site-') and name.endswith('.css') for name in expected)
    assert required <= expected, f'Missing required files: {required - expected}'
    assert not expected.intersection(OFFLINE_ONLY)
    readme = (ROOT / '材料' / '虚拟主机部署说明.txt').read_text(encoding='utf8')
    archive_path = ROOT / '侨乡来信-虚拟主机静态部署包.zip'
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            archive.write(path, path.relative_to(DIST).as_posix())
        archive.writestr('部署说明.txt', readme)
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.testzip() is None
        names = set(archive.namelist())
        assert names == expected | {'部署说明.txt'}
        assert not names.intersection(OFFLINE_ONLY)
        assert all(not any(part.startswith('.') for part in Path(name).parts) for name in names)
        for path in files:
            assert archive.read(path.relative_to(DIST).as_posix()) == path.read_bytes()
        print('STATIC HOST ZIP PASS', len(names), 'files', round(archive_path.stat().st_size / 1024 / 1024, 2), 'MiB')

if __name__ == '__main__':
    main()

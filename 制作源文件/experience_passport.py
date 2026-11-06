"""Static, progressively enhanced personal travel passport (independent of culture stamps)."""
from html import escape
from urllib.parse import quote
import json
import re

REGIONS = ('蓬江区', '江海区', '新会区', '台山市', '开平市', '鹤山市', '恩平市')


def _places(places):
    """Keep only stable IDs and the text needed by this local-only feature."""
    result, seen = [], set()
    for item in places:
        identity = str(item.get('id', ''))
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', identity) or identity in seen:
            continue
        region = str(item.get('region', ''))
        if region not in REGIONS:
            continue
        seen.add(identity)
        result.append({'id': identity, 'name': str(item.get('name', identity)), 'region': region})
    return result


def passport_data(places):
    """One safely embedded JSON catalog per page; no inline executable code."""
    data = json.dumps(_places(places), ensure_ascii=False, separators=(',', ':'))
    data = data.replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e')
    data = data.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    return '<script type="application/json" id="travel-passport-data">' + data + '</script>'


def render_passport(places):
    """Return the complete letters.html section; JS and CSS are loaded by the caller."""
    items = _places(places)
    stamps = ''.join(
        '<li class="travel-passport-stamp" data-passport-region="' + escape(region, quote=True) + '">'
        '<span class="travel-passport-stamp-name">' + escape(region[:-1]) + '</span>'
        '<small data-passport-region-status>待记录</small></li>' for region in REGIONS
    )
    groups = []
    for region in REGIONS:
        rows = ''.join(
            '<li><div><a href="travel.html#place-' + quote(p['id'], safe='') + '">' + escape(p['name']) + ' <span aria-hidden="true">↗</span></a>'
            '<small data-passport-wanted="' + p['id'] + '" hidden>已加入想去</small></div>'
            '<button type="button" data-visit-id="' + p['id'] + '" aria-pressed="false" hidden>标记去过</button></li>'
            for p in items if p['region'] == region
        )
        if rows:
            groups.append('<section class="travel-passport-place-group"><h4>' + escape(region) + '</h4><ul>' + rows + '</ul></section>')
    return '''<section id="travel-passport" class="travel-passport section" aria-labelledby="travel-passport-title">
<div class="travel-passport-heading"><div><p class="eyebrow">MY JIANGMEN / 私人旅行手记</p><h2 id="travel-passport-title">我的江门旅行护照</h2><p>想去的地方先收好，去过的风景慢慢记。<br>每到一处，为自己留下一枚纪念。</p></div><a class="text-link" href="travel.html#places">去挑下一站 ↗</a></div>
<dl class="travel-passport-stats" aria-label="我的旅行记录"><div><dt>想去景点</dt><dd data-passport-count="wishlist">—</dd></div><div><dt>去过景点</dt><dd data-passport-count="visited">—</dd></div><div><dt>到过区市</dt><dd><span data-passport-count="regions">—</span><small> / 7</small></dd></div></dl>
<p class="travel-passport-storage" data-visited-storage-status role="status" aria-live="polite">启用 JavaScript 后可在此标记和查看当前浏览器的旅行记录；下方景点链接仍可直接阅读。</p>
<div class="travel-passport-stamp-heading"><h3>把七区市，收进回忆里。</h3><p>标记去过后点亮私人邮戳；取消该区市的全部记录，邮戳便会收起。</p></div>
<ul class="travel-passport-stamps" aria-label="七区市私人纪念邮戳">''' + stamps + '''</ul>
<p class="travel-passport-self-note">由你自主标记，不使用定位，也不作为官方到访证明。去过记录与想去清单分别保留。</p>
<details class="travel-passport-manage"><summary>管理我的景点记录 <span>''' + str(len(items)) + ''' 处 · 可随时取消</span></summary><p>只记录自己实际去过的景点；点景点名可回到指南查看介绍。</p><div class="travel-passport-place-groups">''' + ''.join(groups) + '''</div></details>
<div class="travel-passport-keepsake"><div class="travel-passport-keepsake-copy"><p class="eyebrow">A LITTLE KEEPSAKE / 留下一张纪念</p><h3>下一程之前，<br>收好这一程。</h3><p>把你自记的景点和区市邮戳，做成一张旅行纪念卡。还没出发，也能留一张行前卡。</p><div data-passport-controls hidden><label for="travel-passport-name">卡片上的展示名 <small>选填，最多 20 字</small></label><input id="travel-passport-name" data-passport-name maxlength="20" placeholder="如：慢慢走的旅人" autocomplete="off"><div class="travel-passport-card-actions"><button type="button" class="primary" data-passport-export hidden>保存旅行纪念卡 ↓</button><button type="button" class="secondary" data-passport-preview hidden>预览图片 / 长按保存</button></div></div><p class="travel-passport-card-status" data-passport-card-status role="status" aria-live="polite">启用 JavaScript 后可生成 PNG 纪念卡。</p><p class="travel-passport-card-note">卡片注明“私人自记”，不包含实时位置。展示名仅用于本页卡片，不会上传。</p><a class="text-link" href="#postcard">把想念写成明信片 →</a></div><figure class="travel-passport-canvas-wrap" data-passport-canvas-wrap hidden><canvas width="1400" height="1740" style="display:block;width:100%;max-width:100%;height:auto" data-passport-canvas role="img" aria-label="私人江门旅行纪念卡预览"></canvas><figcaption>原创矢量风格 · 纸白与深绿 · PNG 图片</figcaption></figure></div>
<div class="travel-passport-image-panel" data-passport-image-panel hidden><div><h3 tabindex="-1" data-passport-preview-title>你的旅行纪念卡</h3><button type="button" class="secondary" data-passport-close-preview>收起预览</button></div><p>手机可长按图片保存；电脑可右键保存。若下载没有启动，也可使用这张图片。</p><img data-passport-image style="display:block;max-width:100%;height:auto" alt="江门旅行纪念卡，内容为本人自主标记的旅行记录"><a class="text-link" data-passport-download download="我的江门旅行纪念卡.png">下载 PNG 图片 ↓</a></div>
</section>'''

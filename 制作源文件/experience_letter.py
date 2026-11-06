"""Render the progressive-enhancement daily letter using existing travel assets.

The caller owns stylesheet/script bundling. Only one photograph is placed in the
initial DOM; the remaining cards are inert JSON until the reader asks for one.
"""
from html import escape
import json
from urllib.parse import quote


POEMS = {
    'longdi': '骑楼替街巷撑开旧时光，江风替我捎来一句近况。',
    'qiming': '巷口的光落在窗沿，像一封终于等到回音的信。',
    'liang': '走过安静的庭院，把远方的志向轻轻放进今日的行囊。',
    'bird': '一树绿荫把水面抱住，鸟鸣替我写下不必赶路的下午。',
    'chenpi': '把日子慢慢晒成陈香，重逢时再沏一杯给你。',
    'zili': '田野把风送到楼前，楼把远行人的牵挂留在故乡。',
    'chikan': '沿着骑楼走慢一点，让未说完的话在街角等你。',
    'chuandao': '海风翻过一页又一页浪，岸边总留着一句等你来。',
    'baisha': '在一方清静里停步，让心中的喧闹慢慢读成留白。',
    'baishuidai': '山林把城市的声音放轻，留一段清风陪你慢慢走。',
    'shaobai': '一重庭院收好远行的故事，一扇窗仍向故乡敞开。',
    'guifeng': '把青山装进湖光，把这一程的从容装进心里。',
    'liyuan': '庭园把远方的线条接回乡土，花影替旧梦续上一笔。',
    'majianglong': '竹影深处，碉楼把守望写得很高，把归意放得很近。',
    'meijia': '骑楼围成一方相逢的地方，脚步轻了，旧时光便近了。',
    'haikoubu': '江水记得出发的方向，也替每一次归来留着岸。',
    'gulao': '一橹轻轻划开水乡，把日子的褶皱慢慢抚平。',
    'dayan': '向山上多走一程，让胸中装得下更远的风。',
    'xiema': '村前的水慢慢流，把书声与树影都留给后来的人。',
    'jinjiang': '把疲惫交给一池暖意，明日再带着轻快的心出发。',
}


def _area(value):
    value = str(value)
    return value[:-1] if value.endswith(('区', '市')) else value


def render_daily_letter(places, foods, photos, pairings, photo_figure, photo_credit):
    """Return the #daily-letter section; inputs are the existing object arrays.

    `photos` is keyed by place ID. `pairings` maps a place ID to a list of
    {foodId, note} records. The first valid pairing in the same district is used.
    Missing photos are skipped. A missing same-district pairing raises an error
    so a content mistake cannot quietly become an incorrect travel suggestion.
    The callbacks preserve the site's full figure and attribution markup.
    """
    food_by_id = {food['id']: food for food in foods}
    entries = []
    seen = set()
    for place in places:
        identity = place['id']
        if identity not in photos or identity not in POEMS or identity in seen:
            continue
        seen.add(identity)
        pairing = next((candidate for candidate in pairings.get(identity, [])
                        if candidate.get('foodId') in food_by_id
                        and _area(food_by_id[candidate['foodId']]['district']) == _area(place['region'])), None)
        if pairing is None:
            raise ValueError(f'Daily letter {identity!r} needs a same-district food pairing.')
        food = food_by_id[pairing['foodId']]
        figure = photo_figure(identity)
        if not figure:
            continue
        e = lambda value: escape(str(value), quote=True)
        place_url = 'travel.html#place-' + quote(identity, safe='')
        food_url = 'food.html#food-' + quote(food['id'], safe='')
        note = pairing.get('note', '')
        credit = photo_credit(photos[identity])
        if photos[identity].get('rights_status') == 'permission-not-confirmed':
            credit += '<p class="daily-letter-rights">此图为官方公开配图，开放授权尚未确认；保留来源及完整画面。</p>'
        card = (
            f'<article id="daily-letter-card" class="daily-letter-card" data-letter-id="{e(identity)}" '
            f'data-food-id="{e(food["id"])}" aria-label="来自{e(place["name"])}的风景来信">'
            f'<div class="daily-letter-image">{figure}</div>'
            '<div class="daily-letter-copy">'
            f'<p class="daily-letter-place">{e(_area(place["region"]))} · 风景来信</p>'
            f'<p class="daily-letter-poem">{e(POEMS[identity])}</p>'
            f'<h3><a href="{e(place_url)}" data-daily-letter-place>{e(place["name"])} <span aria-hidden="true">↗</span></a></h3>'
            '<div class="daily-letter-food">'
            f'<p>同区寻味 · <a href="{e(food_url)}" data-daily-letter-food>{e(food["name"])} <span aria-hidden="true">↗</span></a></p>'
            f'<p class="daily-letter-pairing">{e(note)}</p></div>'
            '<details class="daily-letter-source"><summary>照片来源与使用说明</summary>'
            f'{credit}</details></div></article>'
        )
        entries.append({'id': identity, 'name': place['name'], 'poem': POEMS[identity],
                        'foodName': food['name'], 'html': card})
    if not entries:
        return ''
    # JSON is inert HTML script data, not a collection of eagerly parsed figures.
    data = json.dumps(entries, ensure_ascii=False, separators=(',', ':'))
    for source, escaped in (('<', '\\u003c'), ('>', '\\u003e'), ('&', '\\u0026'),
                            ('\u2028', '\\u2028'), ('\u2029', '\\u2029')):
        data = data.replace(source, escaped)
    return (
        '<section id="daily-letter" class="daily-letter section" aria-labelledby="daily-letter-title">'
        '<div class="daily-letter-heading"><div><p class="eyebrow">一张风景 · 一句想念</p>'
        '<h2 id="daily-letter-title">今日江门来信</h2></div>'
        '<p class="daily-letter-intro">随手拆开一封，遇见下一站的江门。</p></div>'
        f'<div data-daily-letter-slot>{entries[0]["html"]}</div>'
        '<div class="daily-letter-actions"><p class="daily-letter-note">风景短句为本站原创。</p>'
        '<button type="button" class="secondary daily-letter-next" data-daily-letter-next '
        'aria-controls="daily-letter-card" hidden>再拆一封来信 <span aria-hidden="true">→</span></button></div>'
        '<p class="daily-letter-live" data-daily-letter-status role="status" aria-live="polite" aria-atomic="true"></p>'
        f'<script type="application/json" id="daily-letter-data">{data}</script></section>'
    )

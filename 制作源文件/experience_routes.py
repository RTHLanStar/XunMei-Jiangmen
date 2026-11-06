"""Render the progressively enhanced, local-only route finder.

The generator supplies its existing six-route catalogue. Recommendations use
the same titles and anchors; the editorial notes below explain each choice.
"""

from html import escape


_DURATIONS = (("half-day", "半天"), ("one-day", "一天"), ("two-days", "两天"))
_INTERESTS = (("architecture", "看建筑"), ("nature", "亲近自然"), ("food", "寻味"))

_ROUTES = {
    "old-town": {
        "duration": "一天 · 蓬江老城",
        "transfer": "以老城步行为主，按导航选择街巷；若另去外海吃面，需加一段跨区接驳。",
    },
    "city-xinhui": {
        "duration": "两天 · 老城与新会分两天",
        "transfer": "新会的故居、陈皮村与小鸟天堂之间需接驳；先查开放、游船与返程安排。",
    },
    "city-kaiping": {
        "duration": "两天 · 第二天前往开平",
        "transfer": "预留跨区交通；选择一处碉楼片区，赤坎夜游前先落实晚间返程或住宿。",
    },
    "jianghai-half-day": {
        "duration": "半天 · 以外海故居与午餐为主",
        "transfer": "先核对故居开放。白水带、礼乐与外海分属不同片区，添加行程前逐段查接驳。",
    },
    "heshan-water-village": {
        "duration": "一天 · 以古劳水乡为主",
        "transfer": "先确认具体游览片区和船线。大雁山需车辆接驳，可按天气、体力与返程安排省略。",
    },
    "taishan-duanfen": {
        "duration": "一天 · 集中台山端芬",
        "transfer": "梅家大院与海口埠之间需核对接驳，已安排车辆会更从容；海岛另作行程。",
    },
}

# Each combination is deliberately edited: the duration is a hard boundary.
# A second option is an alternative, never an extra route to combine that day.
_CHOICES = {
    ("half-day", "architecture"): (
        "把半天留给一座故居。",
        "先在外海读建筑与人物，不把跨区景点排得太满。",
        (("jianghai-half-day", "陈少白故居的白桥、庭园与人物展陈，适合一次有重点的短途参观；午餐顺路尝外海面。"),),
    ),
    ("half-day", "nature"): (
        "当前半天可选路线：外海线可参考。",
        "现有半日路线以人文和寻味为主，没有完全匹配的自然线。若想去白水带，请把它作为主要一站，取舍故居行程并先查接驳；水乡完整一日线留到时间更充足时。",
        (("jianghai-half-day", "这条线提供白水带散步的可选方向，但半天不宜把故居、午餐与白水带全部排满。它是调整行程的参考，不是完整的自然半日游。"),),
    ),
    ("half-day", "food"): (
        "从一碗外海面开始。",
        "半天留在一个片区，把参观和午餐接在一起。",
        (("jianghai-half-day", "故居参观后在外海安排午餐，外海面就是这一段的寻味重点；礼乐排骨需要另查餐馆位置与接驳，不强行加站。"),),
    ),
    ("one-day", "architecture"): (
        "骑楼与侨屋，选一片慢慢读。",
        "第一次来可选老城；想看圩市与银信故事，可选台山端芬。两条选一条，不拼成同一天。",
        (
            ("old-town", "长堤与三十三墟街看骑楼，启明里看侨屋和巷道；同一老城片区便于把步行、用餐和休息连起来。"),
            ("taishan-duanfen", "梅家大院看骑楼立面与圩市格局，海口埠读出洋和家书故事；适合愿意提前安排端芬片区接驳的人。"),
        ),
    ),
    ("one-day", "nature"): (
        "把一天交给水乡。",
        "古劳水乡作为主景点，登高按余力决定。",
        (("heshan-water-village", "水道、石桥与水乡午餐适合慢游。下午可以继续留在古劳；体力、天气与交通都合适时再考虑大雁山。"),),
    ),
    ("one-day", "food"): (
        "让一顿地方味，带着行程走。",
        "选水乡鱼皮角，或选老城小吃与一顿慢午餐；先选片区，再找顺路的店。两条选一条。",
        (
            ("heshan-water-village", "把古劳鱼皮角放进水乡午餐，上午看水道与石桥、下午继续慢走，用餐与游览围绕同一片区展开。"),
            ("old-town", "老城街巷适合边逛边找小吃和茶歇，晚餐按落脚处就近选；想去外海寻味，再单独核对接驳。"),
        ),
    ),
    ("two-days", "architecture"): (
        "从城市骑楼，看到田野碉楼。",
        "两天分给老城与开平，给跨区交通留出余地。",
        (("city-kaiping", "第一天走长堤与启明里，第二天看自力村碉楼与赤坎骑楼；建筑类型与环境有变化，也不用把几个碉楼片区全塞进一天。"),),
    ),
    ("two-days", "nature"): (
        "先读老城，再看湿地。",
        "这条两日线兼顾城市与自然，第二天把更多时间留给小鸟天堂。",
        (("city-xinhui", "老城与新会分两天安排，小鸟天堂提供古榕与湿地的自然体验；陈皮村可安排用餐，故居按兴趣和开放情况取舍。"),),
    ),
    ("two-days", "food"): (
        "两天慢游，把地方味放在顺路处。",
        "现有两日线都兼顾游览，可参考新会线认识陈皮文化，或选开平线顺路尝赤坎豆腐角。两条选一条。",
        (
            ("city-xinhui", "第一天在老城安排街巷小吃，第二天去陈皮村认识陈皮文化并用餐；古井烧鹅需另外核对路程，不直接塞进午餐。"),
            ("city-kaiping", "老城与开平各留一天，赤坎游览时顺路尝豆腐角；这条仍以建筑游览为主，适合愿意兼顾看景与寻味的人。"),
        ),
    ),
}


def _render_choices(route_by_id, duration, interest):
    title, introduction, picks = _CHOICES[(duration, interest)]
    selected = [(route_id, reason) for route_id, reason in picks if route_id in route_by_id]
    label = dict(_DURATIONS)[duration] + " · " + dict(_INTERESTS)[interest]
    if not selected:
        return ('<p class="route-finder-selection">' + escape(label) + '</p>'
                '<h3>这一组合暂时没有可用路线。</h3>'
                '<p>可继续阅读下方完整路线，按所在片区与可用时间选择。</p>')
    cards = []
    for index, (route_id, reason) in enumerate(selected):
        route = route_by_id[route_id]
        advice = _ROUTES[route_id]
        badge = "推荐路线" if index == 0 else "另一种选择"
        cards.append(
            '<article class="route-finder-pick" data-route-pick="' + escape(route_id, quote=True) + '">'
            '<p class="route-finder-badge">' + badge + '</p>'
            '<h4>' + escape(str(route["title"])) + '</h4>'
            '<p>' + escape(reason) + '</p>'
            '<dl><dt>留多少时间</dt><dd>' + escape(advice["duration"]) + '</dd>'
            '<dt>怎样接驳</dt><dd>' + escape(advice["transfer"]) + '</dd></dl>'
            '<a class="route-finder-link" href="#' + escape(route_id, quote=True) + '">查看完整路线'
            '<span class="route-finder-sr-only">：' + escape(str(route["title"])) + '</span>'
            '<span aria-hidden="true"> →</span></a></article>'
        )
    return ('<p class="route-finder-selection">' + escape(label) + '</p>'
            '<h3>' + escape(title) + '</h3><p class="route-finder-result-intro">'
            + escape(introduction) + '</p><div class="route-finder-picks">' + ''.join(cards) + '</div>')


def _render_radios(name, legend, choices, selected):
    options = ''.join(
        '<label class="route-finder-option"><input type="radio" name="' + name
        + '" value="' + value + '"' + (' checked' if value == selected else '')
        + '><span>' + label + '</span></label>'
        for value, label in choices
    )
    return '<fieldset><legend>' + legend + '</legend><div class="route-finder-options">' + options + '</div></fieldset>'


def render_route_finder(route_data):
    """Return one self-contained section for routes.html, before the route list.

    Load route-finder.css and route-finder.js (defer) on that page. Existing
    route article IDs are used as anchors; this function never changes them.
    """
    route_by_id = {route["id"]: route for route in route_data if route.get("id") in _ROUTES}
    default_result = _render_choices(route_by_id, "one-day", "architecture")
    templates = ''.join(
        '<template data-route-finder-choice="' + duration + ':' + interest + '">'
        + _render_choices(route_by_id, duration, interest) + '</template>'
        for duration, _ in _DURATIONS for interest, _ in _INTERESTS
    )
    return (
        '<section class="route-finder" id="route-finder" data-route-finder aria-labelledby="route-finder-title">'
        '<div class="route-finder-heading"><p class="eyebrow">A DAY AT YOUR PACE / 按自己的节奏</p>'
        '<h2 id="route-finder-title">今天怎么逛</h2>'
        '<p id="route-finder-help">先想好有多少时间，再选此刻最想做的事。从六条编辑路线里，找一个出发点。</p></div>'
        '<form class="route-finder-form" data-route-finder-form aria-describedby="route-finder-help" hidden>'
        + _render_radios("route-duration", "有多少时间", _DURATIONS, "one-day")
        + _render_radios("route-interest", "最想做什么", _INTERESTS, "architecture")
        + '<button type="submit" class="route-finder-submit" aria-controls="route-finder-results">为我安排</button></form>'
        '<p class="route-finder-static-note" data-route-finder-static>还没定行程？先参考下面的“一天 · 看建筑”建议，也可以直接浏览下方六条完整路线。</p>'
        '<div class="route-finder-results" id="route-finder-results" data-route-finder-results '
        'role="region" aria-label="路线推荐结果" aria-live="polite" aria-atomic="true">'
        + default_result + '</div>'
        '<p class="route-finder-footnote">以上为本站编辑建议；出发前请核对开放安排与往返接驳。</p>'
        + templates + '</section>'
    )

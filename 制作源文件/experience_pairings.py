"""Editorial links between existing places and foods; never a live distance claim."""
from html import escape
import json

PAIRINGS = {
 'longdi':[('duruan-bitter-melon','同属蓬江，可按落脚位置找凉瓜菜；专程去杜阮镇需另查接驳。'),('hetang-fish-cakes','荷塘镇与老城不是同一街区，想去当地吃鱼饼，请先查跨镇路程。')],
 'qiming':[('hetang-fish-cakes','可作为蓬江另一顿小吃选择；荷塘镇需另安排交通。'),('duruan-bitter-melon','在蓬江餐馆找凉瓜菜，先核对具体店址与当天供应。')],
 'liang':[('chenpi-dishes','可搭配陈皮村寻味；故居与陈皮村之间需按导航接驳。'),('gujing-goose','古井镇是另一处用餐目的地，别把故居与古井当作步行相邻。')],
 'bird':[('chenpi-dishes','湿地游览与陈皮村可放在同一天，按游船和交通安排先后。'),('gujing-goose','想专程尝古井烧鹅，请另留跨镇路程与用餐时间。')],
 'chenpi':[('chenpi-dishes','陈皮村及会城一带可找陈皮菜点，先问清具体做法与份量。'),('gujing-goose','若去古井镇吃烧鹅，需另外核对交通，不是村内同一站。')],
 'zili':[('chikan-tofu','游完碉楼可转往赤坎寻味，两处之间需要接驳。'),('kaiping-xianjilong','开平小食店可作为下一站；先查店址，不默认碉楼村内有售。')],
 'chikan':[('chikan-tofu','同在赤坎片区，先确认店铺是在景区内还是镇区，避免走错入口。'),('magang-goose','马冈鹅可另作正餐选择；专程去马冈镇需预留交通。')],
 'chuandao':[('taishan-savory-tangyuan','可作为离岛后的陆地用餐选择，先安排好返程船班再找店。'),('taishan-eel-rice','水步及台山市区的黄鳝饭需在离岛后另查接驳，不是岛上附近推荐。')],
 'baisha':[('duruan-bitter-melon','人文参观后可在蓬江找一顿凉瓜家常菜，按餐馆地址安排接驳。'),('hetang-fish-cakes','想去荷塘镇吃鱼饼，需要另留跨镇交通时间。')],
 'baishuidai':[('waihai-noodles','白水带与外海需接驳，查好店址后再安排一碗面。'),('lile-ribs','礼乐街道是另一片区，吃排骨前先核对餐馆与交通。')],
 'shaobai':[('waihai-noodles','同在外海片区，可按具体店址把故居参观与一碗面串起来。'),('lile-ribs','礼乐排骨需要另查礼乐餐馆与接驳，不是故居门口同一条街。')],
 'guifeng':[('chenpi-dishes','登山或环湖后可到会城、陈皮村方向寻味，先留好接驳与休息时间。'),('gujing-goose','古井镇需单独安排交通，体力不足时就近用餐也很合适。')],
 'liyuan':[('chikan-tofu','立园与赤坎可分段安排，吃豆腐角前确认交通与具体店址。'),('kaiping-xianjilong','可在开平小食店寻找这一味，别默认园内即有门店。')],
 'majianglong':[('magang-goose','马降龙所在片区与马冈镇不同，专程寻味需另外接驳。'),('kaiping-xianjilong','回开平市区或沿途小食店再找咸鸡笼，先查营业与地址。')],
 'meijia':[('taishan-savory-tangyuan','可查询端芬沿途餐馆是否供应；专程去台城需要另留路程。'),('taishan-eel-rice','水步镇黄鳝饭是另一个用餐方向，不能按梅家大院附近店铺安排。')],
 'haikoubu':[('taishan-savory-tangyuan','可在端芬行程中询问咸汤圆供应，按实际店址安排。'),('taishan-eel-rice','若去水步或台山市区吃黄鳝饭，请先查跨镇接驳。')],
 'gulao':[('gulao-fish-dumplings','同在古劳片区，先确定游览码头与餐馆位置，再安排一顿午餐。')],
 'dayan':[('gulao-fish-dumplings','大雁山与古劳水乡需接驳，可按体力决定是否再去古劳寻味。')],
 'xiema':[('enping-laifen','可在恩平行程里找一碗濑粉，先核对恩城、牛江等地的具体店址。'),('enping-shaobing','可作恩平糕点店的伴手礼选择，先问当天供应与保存方式。')],
 'jinjiang':[('enping-laifen','温泉在大田镇，去恩城或牛江寻味需另查路程，别按温泉旁边安排。'),('enping-shaobing','可在返程经过恩城时找糕点店，先确认顺路与营业。')],
}

def pairing_data():
 return {place:[{'foodId':food,'note':note} for food,note in pairs] for place,pairs in PAIRINGS.items()}

def render_companions(item_id, food, places, foods, photos, food_photos):
 """Small reciprocal links; expanded source details stay at the target card."""
 e=lambda value:escape(str(value),quote=True)
 place_by_id={p['id']:p for p in places};food_by_id={p['id']:p for p in foods}
 if food:
  candidates=[(place,note) for place,pairs in PAIRINGS.items() for fid,note in pairs if fid==item_id]
  # Prefer the closest named cultural pairing where the dataset provides one.
  preferred={'waihai-noodles':'shaobai','chikan-tofu':'chikan','chenpi-dishes':'chenpi','gulao-fish-dumplings':'gulao'}
  candidates.sort(key=lambda entry:entry[0]!=preferred.get(item_id))
  entries=[(pid,place_by_id[pid],photos[pid],note) for pid,note in candidates[:2]]
  label='吃完，再选一站';prefix='travel.html#place-'
 else:
  entries=[(fid,food_by_id[fid],food_photos[fid],note) for fid,note in PAIRINGS[item_id]]
  label='这一带，尝一口什么';prefix='food.html#food-'
 content=[]
 for identity,item,photo,note in entries:
  image=f'<img src="{e(photo["small"])}" width="{photo.get("small_width",480)}" height="{round(photo["height"]*photo.get("small_width",480)/photo["width"])}" alt="" loading="lazy" decoding="async">'
  image_class=' companion-image-full' if photo.get('preserve_full') else ''
  badge='AI 菜式示意' if photo.get('kind')=='ai' else '实景摄影' if food else '菜式摄影参考'
  required=f'<span class="companion-credit">{e(photo["required_credit"])}</span>' if photo.get('required_credit') else ''
  content.append(f'<div class="companion-item"><a class="companion-link" href="{prefix}{e(identity)}"><span class="companion-image{image_class}">{image}</span><span><strong>{e(item["name"])}</strong><small>{badge} · 查看图文与来源 →</small></span></a>{required}<p>{e(note)}</p></div>')
 return f'<details class="companion-details"><summary>{label} <span aria-hidden="true">＋</span></summary><div class="companion-list">'+''.join(content)+'</div></details>'

def export_pairings(path,places,foods):
 assert set(PAIRINGS)=={p['id'] for p in places}
 assert {food for pairs in PAIRINGS.values() for food,_ in pairs}=={p['id'] for p in foods}
 path.write_text(json.dumps({'updatedAt':'2026-10-18','kind':'编辑搭配建议，非实时距离或商户推荐','pairings':pairing_data()},ensure_ascii=False,indent=2),encoding='utf8')

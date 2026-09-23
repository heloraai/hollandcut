# -*- coding: utf-8 -*-
"""动效预览页：把 spec 里每一处图形时刻抽成静帧，拼成一页可滑的预览（时间轴密度条 + 类型筛选 + 点开放大）。
用法（项目目录里）：python3 preview.py [--scale 0.5]
产物：plan/preview/index.html + plan/preview/shots/*.jpg —— 发给用户确认画面，确认后再跑 render.py。"""
import json, os, subprocess, sys, glob, shutil
from PIL import Image

SCALE = '0.5'
if '--scale' in sys.argv:
    SCALE = sys.argv[sys.argv.index('--scale') + 1]
FPS = 30
OUT = 'plan/preview'
SHOTS = f'{OUT}/shots'
spec = json.load(open('remotion/public/spec.json', encoding='utf-8'))
DUR = spec['duration']

KIND = {
    'receipts': ('票据排', '#e0b356'), 'logos': ('平台 logo', '#7fb4d8'), 'clash': ('logo 对撞', '#d8746a'),
    'pyramid': ('金字塔', '#c9a24a'), 'loop': ('闭环图', '#8fbf8a'), 'solution': ('方案对比', '#9ac0a8'),
    'versus': ('图片 VS', '#c98f6a'), 'image': ('截图大图', '#b79ad4'), 'scroll': ('长图滚动', '#b79ad4'),
    'video': ('视频卡', '#a0a8d4'), 'term': ('终端卡', '#8fbf8a'), 'stat': ('圆环数据', '#e08b4a'),
    '词条': ('步进词条', '#9aa4b2'), '箭头链': ('箭头链', '#6fae9f'), '成对贴纸': ('成对贴纸', '#d6a2b8'),
    '脑图板': ('脑图板', '#a8b07a'), '全屏接管': ('全屏对比', '#c98f6a'), '大字标题': ('大字标题', '#e0b356'),
    '结尾卡': ('结尾卡', '#cbb37a'), '开场剪辑器': ('开场剪辑器', '#e0b356'),
}
shots = []
def add(t, label, kind, extra=''):
    shots.append({'f': int(round(t * FPS)), 't': round(t, 2), 'label': label, 'kind': kind, 'extra': extra})

for g in spec['groups']:
    nodes = g['nodes']
    last = max(n['rf'] for n in nodes)
    add(min(last + 0.7, g['end'] - 0.15), f"板{g['no']} {g['title']}",
        g.get('variant') or ('全屏接管' if g['pip'] == 'to' else '脑图板'))
    if g.get('variant') or len(nodes) > 4:     # 分步搭起来的板，多抽一张过程帧
        mid = sorted(n['rf'] for n in nodes)[len(nodes) // 2]
        add(min(mid + 0.35, g['end'] - 0.2), f"板{g['no']} {g['title']}",
            g.get('variant') or ('全屏接管' if g['pip'] == 'to' else '脑图板'), '过程')
for x in spec['shows']:
    add((x['start'] + x['end']) / 2, x.get('cap') or f"大字数据 {x.get('num')}{x.get('suffix','')}", x['type'])
for c in spec['chips']:
    add(c['end'] - 0.4, "词条 " + " / ".join(i['t'] for i in c['items']), '词条')
for c in spec.get('chains', []):
    add(c['end'] - 0.5, "箭头链 " + " → ".join(i['t'] for i in c['items']), '箭头链')
for p in spec.get('pairs', []):
    add(p['end'] - 0.6, "成对 " + p['left'][0]['t'] + " vs " + p['right'][0]['t'], '成对贴纸')
for t_ in spec.get('titles', []):
    add((t_['start'] + t_['end']) / 2, f"大字「{t_['text']}」", '大字标题')
if spec.get('opening'):
    o = spec['opening']; add(o['boom'] - 0.3, "开场剪辑器 " + o['title'], '开场剪辑器')
if spec.get('endcard'):
    e = spec['endcard']; add((e['start'] + e['end']) / 2, "结尾关注卡", '结尾卡')
shots.sort(key=lambda x: x['f'])

os.makedirs(SHOTS, exist_ok=True)
for f in glob.glob(f'{SHOTS}/*.jpg'):
    os.remove(f)
print(f"图形时刻 {len(shots)} 处，开始抽帧（scale={SCALE}）…")
items = []
for i, sh in enumerate(shots, 1):
    png = f"/tmp/_prev_{sh['f']}.png"
    r = subprocess.run(['npx', 'remotion', 'still', '../.bundle', 'Shen', png, f"--frame={sh['f']}", f'--scale={SCALE}'],
                       cwd='remotion', capture_output=True, text=True)
    if not os.path.exists(png):
        print(f"  ✗ 帧 {sh['f']} 失败：{r.stderr.strip()[-200:]}"); continue
    im = Image.open(png).convert('RGB')
    if im.width > 900:
        im = im.resize((900, round(900 * im.height / im.width)), Image.LANCZOS)
    name = f"shots/f_{sh['f']}.jpg"
    im.save(f'{OUT}/{name}', 'JPEG', quality=80, optimize=True)
    os.remove(png)
    lb, color = KIND.get(sh['kind'], (sh['kind'], '#9aa4b2'))
    items.append({'src': name, 't': sh['t'], 'tc': f"{int(sh['t']//60)}:{sh['t']%60:04.1f}",
                  'label': sh['label'], 'kind': lb + (' · 过程' if sh['extra'] else ''), 'base': lb, 'color': color})
    print(f"  [{i}/{len(shots)}] {sh['t']:6.2f}s {sh['label'][:34]}")

kinds = []
for it in items:
    if it['base'] not in [k['n'] for k in kinds]:
        kinds.append({'n': it['base'], 'c': it['color']})
cov = round(sum(g['end'] - g['start'] for g in spec['groups']) / DUR * 100)
DATA = json.dumps({'items': items, 'kinds': kinds, 'dur': DUR,
                   'dur_tc': f"{int(DUR//60)}:{DUR%60:04.1f}", 'cov': cov,
                   'boards': len(spec['groups']), 'tier': spec.get('tier', 'pro')}, ensure_ascii=False)
html = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview_template.html'), encoding='utf-8').read()
open(f'{OUT}/index.html', 'w', encoding='utf-8').write(html.replace('__DATA__', DATA))
size = sum(os.path.getsize(f) for f in glob.glob(f'{SHOTS}/*.jpg'))
print(f"\n预览页 {OUT}/index.html   {len(items)} 张 / {size/1e6:.1f}MB")
print("→ 发给用户确认画面，确认后再 python3 render.py v1")

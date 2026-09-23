import re
# -*- coding: utf-8 -*-
"""动效预览页：把 spec 里每一处图形时刻抽成静帧，拼成一页可滑的预览（时间轴密度条 + 类型筛选 + 点开放大）。
用法（项目目录里）：python3 preview.py [--scale 0.5]
产物：plan/preview/index.html + plan/preview/shots/*.jpg —— 发给用户确认画面，确认后再跑 render.py。"""
import json, os, subprocess, sys, glob, shutil
from PIL import Image

NAME = sys.argv[1] if len(sys.argv) > 1 else re.sub(r'^edit_', '', os.path.basename(os.getcwd()))   # 页标题：python3 preview.py 「项目名」
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
    '结尾卡': ('结尾卡', '#cbb37a'), '开场剪辑器': ('开场剪辑器', '#e0b356'), '开头': ('开头几帧', '#f0c860'),
    '票据竖列': ('票据砸入', '#e0b356'), '合作平台列': ('合作平台列', '#7fb4d8'),
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
for r in spec.get('receipt_stacks', []):
    t_stamp = r['stamp']['at'] + 0.6 if r.get('stamp') else r['end'] - 0.5
    add(min(t_stamp, r['end'] - 0.2), "票据砸入 " + " / ".join(i['amt'] for i in r['items']), '票据竖列')
    for it in r['items'][:3]: add(it['at'] + 0.55, f"票据砸入 {it['amt']}", '票据竖列', '过程')
for c in spec.get('partner_cols', []):
    add(c['cards'][-1]['at'] + 0.8 if c['cards'] else c['start'] + 1, "合作平台 " + " / ".join(x['title'] for x in c['cards']), '合作平台列')
    if c.get('note'): add(min(c['note']['at'] + 0.6, c['end'] - 0.2), "合作平台 · " + (c['callout']['t'] if c.get('callout') else ''), '合作平台列')
for r in spec.get('rails', []):   # 路线图竖轨：第二格点亮时 + 收尾金章
    ats = [n['at'] for n in r['nodes'] if n.get('at') is not None]
    add((ats[1] if len(ats) > 1 else (ats[0] if ats else r['start'])) + 0.7,
        "竖轨 " + " → ".join(n['label'] for n in r['nodes']), '竖轨')
    if r.get('finale'): add(min(r['finale']['at'] + 0.7, r['end'] - 0.2), "竖轨收尾 · " + r['finale']['label'], '竖轨')
for x in spec.get('numpops', []):
    add(x['start'] + 1.0, f"数字弹窗 {x['num']}{x['suffix']} {x['label']}", '数字弹窗')
for x in spec.get('fans', []):
    add(x['start'] + 1.2, "三卡扇形发牌", '扇形')
for x in spec.get('prompts', []):
    add(x['start'] + 0.8, "提示词卡 " + x['title'], '提示词卡')
    for sec in x.get('sections', []):
        if sec.get('at') is not None: add(sec['at'] + 0.5, "提示词卡点亮 · " + sec['h'], '提示词卡')
if spec.get('endcard'):
    e = spec['endcard']; add((e['start'] + e['end']) / 2, "结尾关注卡", '结尾卡')
# 开头几帧：钩子决定留存，0–3 秒密抽，不管有没有图形都要让用户看到
for t0 in (0.0, 0.4, 1.0, 1.8, 2.8):
    add(t0, f"开头 {t0:.1f} 秒", '开头')
shots.sort(key=lambda x: x['f'])
# 同一帧只留一张（开头抽帧可能和图形时刻撞上）
seen, uniq = set(), []
for sh in shots:
    if sh['f'] in seen: continue
    seen.add(sh['f']); uniq.append(sh)
shots = uniq

# 前 60 秒的图形空档（留存关键段）：所有图形的在屏区间取并集，找 ≥1.5 秒的空白
spans = []
for g in spec['groups']: spans.append((g['fin'][0], g['fout'][1]))
for x in spec['shows']: spans.append((x['start'], x['end'] + 0.3))
for c in spec['chips'] + spec.get('chains', []) + spec.get('pairs', []) + spec.get('marks', []):
    spans.append((c['start'], c['end'] + 0.2))
for x in spec.get('fans', []) + spec.get('rails', []) + spec.get('titles', []) + spec.get('prompts', []) + spec.get('numpops', []) + spec.get('receipt_stacks', []) + spec.get('partner_cols', []):
    spans.append((x['start'], x['end']))
if spec.get('opening'): spans.append((0, spec['opening']['end']))
spans.sort()
gaps, cur = [], 0.0
for a, b in spans:
    if a > cur + 1.5 and cur < 60: gaps.append([round(cur, 1), round(min(a, 60), 1)])
    cur = max(cur, b)
if cur < 60 - 1.5: gaps.append([round(cur, 1), 60.0])

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
                   'boards': len(spec['groups']), 'tier': spec.get('tier', 'pro'), 'gaps60': gaps}, ensure_ascii=False)
html = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview_template.html'), encoding='utf-8').read()
open(f'{OUT}/index.html', 'w', encoding='utf-8').write(html.replace('__NAME__', NAME).replace('__DATA__', DATA))
size = sum(os.path.getsize(f) for f in glob.glob(f'{SHOTS}/*.jpg'))
print(f"\n预览页 {OUT}/index.html   {len(items)} 张 / {size/1e6:.1f}MB")
print("前 60 秒图形空档：" + ("无" if not gaps else "  ".join(f"{a}–{b}s" for a, b in gaps)))
print("→ 发给用户确认画面，确认后再 python3 render.py v1")

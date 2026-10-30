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
    '对比柱': ('对比柱', '#e08b4a'), '气泡': ('浅色气泡', '#e6cf92'), 'brainbody': ('大脑/身体板', '#a8b07a'),
    'tier': ('排名图', '#d9a441'), 'rec': ('全屏录屏', '#a0a8d4'), '过渡卡': ('章节过渡卡', '#b0a27a'), '竖轨': ('路线竖轨', '#8fbf8a'),
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
for g in spec['groups']:   # 大脑 / 身体板：一句一个动作，每个节点落定后抽一张
    if g.get('variant') == 'brainbody':
        for n in g['nodes']: add(min(n['rf'] + 0.5, g['end'] - 0.2), f"板{g['no']} {g['title']} · {n['label']}", 'brainbody', '过程')
for x in spec['shows']:
    full = x['type'] == 'video' and x.get('full')   # 10-18：全屏录屏原来被标成「大字数据 None」
    add((x['start'] + x['end']) / 2, x.get('cap') or (f"录屏位 · {x['src'].split('/')[-1]}" if full else f"大字数据 {x.get('num')}{x.get('suffix','')}"), 'rec' if full else x['type'])
    for m in x.get('marks', []):   # 录屏里的高亮框：框住的那一刻也抽一张（引用的评论要看得清）
        add((m[0] + m[1]) / 2, f"录屏高亮 {x['src'].split('/')[-1]}", 'rec' if full else x['type'], '过程')
# 浅色气泡（动效提示）：每组 / 每条落定后抽一张
_grp = {}
for h in spec.get('hints', []):
    _grp.setdefault(h.get('grp', f"s{h['at']}"), []).append(h)
for hs in _grp.values():
    last = max(h['at'] for h in hs)
    add(min(last + 0.6, min(h['end'] for h in hs) - 0.1), "气泡 " + " / ".join(h['t'] or (f"截图 {h['shot']['src'].split('/')[-1]}" if h.get('shot') else f"{h.get('pre','')}{h.get('count','')}{h.get('suf','')}") for h in hs), '气泡')
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
for d_ in spec.get('duels', []):
    add(d_['l']['at'] + 0.5, '对比柱 · 起点一样', '对比柱'); add(d_['boostAt'] + 0.8, '对比柱 · 右柱窜高', '对比柱')
for g_ in spec.get('skill_grids', []):
    add(g_['popAt'] + 0.9, '技能宫格 · ' + g_['title'], '技能宫格')
    if g_.get('barAt'): add(g_['barAt'] + 1.0, '技能宫格 · 只解锁 1/10', '技能宫格')
if spec.get('rate_counter'):
    rc = spec['rate_counter']
    for t_, lab in ((rc['start'] + 0.8, '计数器 · 数位乱跳'), (rc['lockAt'] + 0.35, f"计数器 · 锁 {rc['lockTo']}"), (rc['rollAt'] + 0.5, f"计数器 · 滚到 {rc['rollTo']}"), (rc['finaleAt'] + 0.7, '计数器 · 落成金章')):
        add(min(t_, rc['end'] - 0.2), lab, '计数器')
if spec.get('endcard'):
    e = spec['endcard']; add((e['start'] + e['end']) / 2, "结尾关注卡", '结尾卡')
# 逐项审片点：plan/preview_extra.json 有就加（[[秒, 说明], ...]）
if os.path.exists('plan/preview_extra.json'):
    for t_, lab in json.load(open('plan/preview_extra.json', encoding='utf-8')):
        pre_ = {'排名图': 'tier', '汇总': 'tier', '章节过渡卡': '过渡卡', '对比柱': '对比柱', '录屏': 'rec', '收尾大字': '大字标题', '词条': '词条', '结尾卡': '结尾卡', '开头': '开头'}
        k_ = '开头' if t_ < 5 else next((v for k, v in pre_.items() if lab.startswith(k)), '气泡')
        add(t_, lab, k_, '过程')
# 开头几帧：钩子决定留存，0–3 秒密抽，不管有没有图形都要让用户看到
for t0 in (0.0, 0.4, 1.0, 1.8, 2.8, 3.4, 4.4):
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
# 新叠加层也算图形：计数牌 / 技能宫格 / 票据列 / 平台卡 / 竖轨 / 数字弹窗 / 提示词卡 / 扇形 / 大字 / 结尾卡
if spec.get('rate_counter'): spans.append((spec['rate_counter']['start'], spec['rate_counter']['end']))
for key in ('duels', 'skill_grids', 'receipt_stacks', 'partner_cols', 'rails', 'numpops', 'prompts', 'fans', 'titles'):
    for x in spec.get(key, []) or []: spans.append((x['start'], x['end']))
if spec.get('endcard'): spans.append((spec['endcard']['start'], spec['endcard']['end']))
# 浅色气泡 / logo 排 / 章节过渡卡 也是图形（原来漏算，会把有气泡的时段误报成空档）
for x in spec.get('hints', []): spans.append((x['at'], x['end']))
for x in spec.get('logo_rows', []): spans.append((x['start'], x['end']))
for x in spec.get('dividers', []): spans.append((x['at'] - 0.15, x['at'] + 0.8))
spans.sort()
gaps, cur = [], 0.0
for a, b in spans:
    if a > cur + 1.5 and cur < 60: gaps.append([round(cur, 1), round(min(a, 60), 1)])
    cur = max(cur, b)
if cur < 60 - 1.5: gaps.append([round(cur, 1), 60.0])
# 10-18：前 60 秒逐句查动作（原来只查屏上有没有图形：一组气泡挂着不动、某句话完全没新动作也报 0）
acts = [h['at'] for h in spec.get('hints', [])] + [d_['at'] - 0.15 for d_ in spec.get('dividers', [])] + [c['start'] for c in spec['chapters']]
for c in spec['chips']: acts += [i['rf'] for i in c['items']] + [i['then']['at'] for i in c['items'] if i.get('then')]
for g in spec['groups']:
    acts += [g['fin'][0] + 0.6 * (g['fin'][1] - g['fin'][0]), g['fout'][0]] + [n['rf'] for n in g['nodes']]   # 板上内容开始出（Video.tsx SPLIT=0.6）/ 开始收
    ex = g.get('extra') or {}
    acts += [c['at'] + 0.4 for c in ex.get('cards', []) if g['fin'][0] <= c['at'] <= g['end']] + [l['at'] for l in ex.get('lit', [])] + ([ex['sub']['at']] if ex.get('sub') else [])   # 卡落定那一下（12 帧）
    acts += [ex['at']] if ex.get('at') is not None else []   # 10-18 图片模式：新卡开始落下
for x in spec['shows']: acts += [x.get('fin', [x['start']])[0]] + [k[0] for k in x.get('cam', [])] + [m[0] for m in x.get('marks', [])] + [p['m'] for p in x.get('pieces', [])[1:]] + x.get('acts', [])   # 10-18：录屏按台词切到下一段，画面整个换了，也算动作；平滑镜头片子里的框 / 交叉写在 acts
for t_ in spec.get('titles', []): acts += [c['at'] for c in t_.get('chunks', [])] + ([t_['stamp']['at']] + ([t_['stamp']['then']['at']] if t_['stamp'].get('then') else []) if t_.get('stamp') else []) + [t_['end']] + ([t_['underline']['at']] if t_.get('underline') else [])   # 10-18：大字分块砸下 / 小章（两拍）/ 收掉；10-19：字下长出金线
acts += [z[0] for z in spec.get('zooms', [])] + spec.get('punches', [])   # 人物层推拉
for d_ in spec.get('duels', []): acts += [d_['start'], d_['l']['at'], d_['r']['at']]
for r in spec.get('rails', []): acts += [r['start']] + [n['at'] for n in r['nodes'] if n.get('at') is not None]
for r in spec.get('rails', []): acts += [p['at'] for n in r['nodes'] for p in (n.get('then') or [])] + ([r['finale']['at']] if r.get('finale') else [])   # 10-26：竖轨短牌 / 收尾金章
for x in spec.get('logo_rows', []): acts += [x['titleAt']] + [it['at'] for it in x['items']]                                        # 10-26：logo 排逐个弹
if spec.get('burst'): acts += [spec['burst']['start'] + k * spec['burst']['gap'] for k in range(len(spec['burst']['logos']))] + [spec['burst']['pullAt']]   # 10-26：logo 环
if spec.get('biz'):   # 10-26：开头生意卡
    b_ = spec['biz']; acts += [b_['start'], b_['reveal']['at'], b_['price']['at'], b_['price']['climbAt'], b_['price']['goldAt']] + [r_['at'] for r_ in b_['rows']]
if spec.get('open2'):   # 10-28：开头左右两摞卡 + 六个图标两列
    o_, T_ = spec['open2'], spec['open2']['tools']
    acts += [c['at'] for c in o_['tut']['cards'] + o_['work']['cards']] + [o_['tut']['strike'], o_['work']['done']] + [i['at'] for i in T_['items']]
    acts += list(T_['pops'].values()) + [r[0] for r in T_['rows']] + [T_['heads']['at']] + list(T_['hop'])
acts = sorted(acts)
def _gap(t):   # 这句前后两个动作之间隔了多久
    return min([a for a in acts if a >= t] + [1e9]) - max([a for a in acts if a < t] + [-1e9])
idle = [c for c in spec['cues'] if c['start'] < 60 and not any(c['start'] - 0.35 <= a < c['end'] for a in acts) and _gap(c['start']) > 1.7]
gaps = sorted(gaps + [[round(c['start'], 1), round(c['end'], 1)] for c in idle])

os.makedirs(SHOTS, exist_ok=True)
for f in glob.glob(f'{SHOTS}/*.jpg'):
    os.remove(f)
print(f"图形时刻 {len(shots)} 处，开始抽帧（scale={SCALE}）…")
items = []
# 一个浏览器批量出帧（stills.mjs），比逐帧起 npx remotion still 快一个量级
TMP = os.path.abspath(f'{OUT}/_tmp')
shutil.rmtree(TMP, ignore_errors=True)
r = subprocess.run(['node', 'stills.mjs', '../.bundle', TMP, SCALE, ','.join(f"{sh['f'] / FPS:.4f}" for sh in shots)],
                   cwd='remotion', capture_output=True, text=True)
if r.returncode != 0: print(r.stderr[-800:])
for i, sh in enumerate(shots, 1):
    png = f"{TMP}/t{sh['f'] / FPS:06.2f}.jpg"
    if not os.path.exists(png):
        print(f"  ✗ 帧 {sh['f']} 失败"); continue
    im = Image.open(png).convert('RGB')
    if im.width > 900:
        im = im.resize((900, round(900 * im.height / im.width)), Image.LANCZOS)
    name = f"shots/f_{sh['f']}.jpg"
    im.save(f'{OUT}/{name}', 'JPEG', quality=80, optimize=True)
    lb, color = KIND.get(sh['kind'], (sh['kind'], '#9aa4b2'))
    items.append({'src': name, 't': sh['t'], 'tc': f"{int(sh['t']//60)}:{sh['t']%60:04.1f}",
                  'label': sh['label'], 'kind': lb + (' · 过程' if sh['extra'] else ''), 'base': lb, 'color': color})
    print(f"  [{i}/{len(shots)}] {sh['t']:6.2f}s {sh['label'][:34]}")

shutil.rmtree(TMP, ignore_errors=True)
kinds = []
for it in items:
    if it['base'] not in [k['n'] for k in kinds]:
        kinds.append({'n': it['base'], 'c': it['color']})
cov = round(sum(g['end'] - g['start'] for g in spec['groups']) / DUR * 100)
DATA = json.dumps({'items': items, 'kinds': kinds, 'dur': DUR,
                   'dur_tc': f"{int(DUR//60)}:{DUR%60:04.1f}", 'cov': cov,
                   'boards': len(spec['groups']), 'tier': spec.get('tier', 'pro'), 'gaps60': gaps}, ensure_ascii=False)
html = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview_template.html'), encoding='utf-8').read()
html = html.replace('__NAME__', NAME).replace('__DATA__', DATA)
# 待拍板 / 待补素材：写在 plan/preview_notes.html（有就插在页头下面）
if os.path.exists('plan/preview_notes.html'):
    html = html.replace('</header>', '</header>\n' + open('plan/preview_notes.html', encoding='utf-8').read(), 1)
# 10-09 第六轮：静帧看不出开头白底过渡 / 放大 / 重点推拉 —— plan/preview/clips/clips.json 有就在页头下面插一排动态片段
_cj = f'{OUT}/clips/clips.json'
if os.path.exists(_cj):
    _cl = json.load(open(_cj, encoding='utf-8'))
    _sec = ('<section style="max-width:1400px;margin:18px auto 6px;padding:0 16px">'
            '<h2 style="font-size:18px;margin:0 0 10px;color:#e6cf92">动态片段（带声音，点开播放）</h2>'
            '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:14px">'
            + ''.join(f'<figure style="margin:0"><video src="clips/{c["file"]}" controls playsinline preload="metadata" '
                      f'style="width:100%;border-radius:10px;background:#000;display:block"></video>'
                      f'<figcaption style="font-size:14px;line-height:1.5;margin-top:6px;opacity:.85">{c["cap"]}</figcaption></figure>' for c in _cl)
            + '</div></section>')
    html = html.replace('</header>', '</header>\n' + _sec, 1)
open(f'{OUT}/index.html', 'w', encoding='utf-8').write(html)
size = sum(os.path.getsize(f) for f in glob.glob(f'{SHOTS}/*.jpg'))
print(f"\n预览页 {OUT}/index.html   {len(items)} 张 / {size/1e6:.1f}MB")
print("前 60 秒图形空档 / 没有动作的句子：" + ("无" if not gaps else "  ".join(f"{a}–{b}s" for a, b in gaps)))
for c in idle: print(f"  没有动作：{c['start']:.1f}–{c['end']:.1f}「{c['text']}」")
print("→ 发给用户确认画面，确认后再 python3 render.py v1")

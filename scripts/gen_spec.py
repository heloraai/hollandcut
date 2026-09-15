# -*- coding: utf-8 -*-
"""
通用 spec 引擎：把 structure.py（按台词锚点写的画面结构）编译成 remotion/public/spec.json。

用法（在项目目录里）：  python3 gen_spec.py structure.py

structure.py 里可用的助手（由本引擎注入）：
  A(sub) / AE(sub) / A_after(sub, after)   台词锚点 → 秒（字符级插值）
  g(no, title, pip, a, b, nodes)           一块脑图板：pip ∈ bl(左下圆窗) / none(全隐) / to(全屏接管)
  N(id, label, anchor, parent, kind, sub, danger, concl)   节点；kind ∈ hero/node/pill/circle
  SHOT(id, src, ar, w, cap, anchor, parent)                 板内截图节点
  chip(t, anchor, style) / link(t, anchor, tone)            词条 / 链条项
  show_img(src, w, ar, cap, a, b) / show_scroll(...) / stat(..., gauge=False)   单独展示层（gauge = 圆环仪表盘）
  hook_editor(...) / title(...) / endcard(...)             max 档招牌时刻：开场剪辑器 / 大字散射标题 / 结尾 CTA 卡
  dur                                                        母版时长
structure.py 需要定义：TIER（lite / pro / max，默认 pro）、CH, CHIPS, CHAINS, PAIRS, MARKS, SHOWS；
可选 BOX（{板号: {"x0":...}}）、SUBS；max 档可选 OPENING / TITLES / ENDCARD
"""
import json, math, sys, os
from tools import duration

FPS, FADE, MINX = 30, 0.70, 0.25

cues = json.load(open('build/cues.json'))
dur = duration('build/master.mp4')

# ---- 字符级时间索引：锚点按台词文字定位，不写死时间码 ----
flat, tmap = [], []
for c in cues:
    t = c['text'].replace('【', '').replace('】', '')
    n = max(1, len(t))
    for k, ch in enumerate(t):
        flat.append(ch); tmap.append(c['start'] + (c['end'] - c['start']) * k / n)
FLAT = ''.join(flat)

def A(sub):
    i = FLAT.find(sub); assert i >= 0, f"锚点找不到: {sub}"
    return round(tmap[i], 3)
def A_after(sub, after):
    i = FLAT.find(after); assert i >= 0, f"锚点找不到: {after}"
    j = FLAT.find(sub, i); assert j >= 0, f"锚点找不到: {sub} (after {after})"
    return round(tmap[j], 3)
def AE(sub):
    i = FLAT.find(sub); assert i >= 0, f"锚点找不到: {sub}"
    return round(tmap[min(i + len(sub), len(tmap) - 1)], 3)

def N(id, label, anchor=None, parent=None, kind='node', sub=None, danger=False, concl=False):
    d = {"id": id, "label": label, "kind": kind, "_anchor": anchor}
    if parent: d["parent"] = parent
    if sub:    d["sub"] = sub
    if danger: d["danger"] = True
    if concl:  d["conclusion"] = True
    return d
def SHOT(id, src, ar, w, cap, anchor, parent=None):
    d = {"id": id, "kind": "shot", "src": src, "ar": ar, "w": w, "label": cap or "", "_anchor": anchor}
    if parent: d["parent"] = parent
    return d
G = []
def g(no, title, pip, a, b, nodes):
    G.append({"no": no, "title": title, "pip": pip, "start": A(a), "end": AE(b), "nodes": nodes})
LEAD = 0.30   # 贴纸/词条/链格提前量：落在说到那个词的瞬间
def chip(t, anchor, style="dark"):   return {"t": t, "rf": round(A(anchor) - LEAD, 3), "style": style}
def link(t, anchor, tone="cream"):   return {"t": t, "rf": round(A(anchor) - LEAD, 3), "tone": tone}
def show_img(src, w, ar, cap, a, b):
    return {"type": "image", "src": src, "w": w, "ar": ar, "cap": cap, "start": A(a), "end": AE(b) + 0.9}
def show_scroll(src, w, iw, ih, vh, cap, a, b):
    return {"type": "scroll", "src": src, "w": w, "iw": iw, "ih": ih, "vh": vh, "cap": cap,
            "start": A(a), "end": AE(b) + 0.9}
def show_video(src, w, ar, cap, a, b, full=False, pip="bl"):
    return {"type": "video", "src": src, "w": w, "ar": ar, "cap": cap, "full": full,
            "pip": pip, "start": A(a), "end": AE(b) + 0.9}
def stat(num, label, a, b, prefix="", suffix="", gauge=False):
    d = {"type": "stat", "num": num, "prefix": prefix, "suffix": suffix, "label": label,
         "start": A(a), "end": AE(b) + 1.6}
    if gauge: d["gauge"] = True   # 圆环仪表盘：num 按 0–100 画弧
    return d

# ---- max 档招牌时刻（全部台词锚点）----
def hook_editor(title, ui, badge, steps, boom, stamp=None, end=None):
    """开场剪辑器：ui 界面组装 / badge=(字, 锚点) 徽章砸落 / steps=[(字, 锚点)]×1–4 步骤灯 /
    stamp=(字, 锚点) 右上红章（可选）/ boom 炸开的锚点 / end 收尾锚点（默认炸开后 0.93s）"""
    o = {"title": title, "ui": A(ui), "badge": {"t": badge[0], "at": A(badge[1])},
         "steps": [{"t": t, "at": A(x)} for t, x in steps], "boom": A(boom),
         "stamp": {"t": stamp[0], "at": A(stamp[1])} if stamp else None}
    o["end"] = round(AE(end) + 0.3 if end else o["boom"] + 0.93, 3)
    return o
def title(text, a, b, gold_from=None, stamp=None, pills=()):
    """大字散射标题：text 第 gold_from 个字符起变金 / stamp=(字, 锚点) 金印章 / pills=[(字, 锚点)] ≤2 个分列两侧"""
    return {"text": text, "goldFrom": len(text) if gold_from is None else gold_from,
            "start": round(A(a) - LEAD, 3), "end": round(AE(b) + 0.1, 3),
            "stamp": {"t": stamp[0], "at": round(A(stamp[1]) - LEAD, 3)} if stamp else None,
            "pills": [{"t": t, "at": round(A(x) - LEAD, 3)} for t, x in pills]}
def endcard(name, tagline, url, a, b, badge="已开源"):
    """结尾 CTA 卡：a 出现的锚点、b 收尾的锚点；url 打字机滚出（可空）"""
    return {"name": name, "tagline": tagline, "url": url, "badge": badge,
            "start": round(A(a) - LEAD, 3), "end": round(min(AE(b) - 0.1, dur - 0.3), 3)}

# ---- 执行结构文件 ----
ns = dict(A=A, AE=AE, A_after=A_after, N=N, SHOT=SHOT, g=g, chip=chip, link=link,
          show_img=show_img, show_scroll=show_scroll, show_video=show_video, stat=stat, dur=dur, dict=dict, min=min, max=max,
          hook_editor=hook_editor, title=title, endcard=endcard)
exec(open(sys.argv[1] if len(sys.argv) > 1 else 'structure.py', encoding='utf-8').read(), ns)
CH, CHIPS = ns['CH'], ns.get('CHIPS', [])
CHAINS, PAIRS, MARKS, SHOWS = ns.get('CHAINS', []), ns.get('PAIRS', []), ns.get('MARKS', []), ns.get('SHOWS', [])
BOX = ns.get('BOX', {})
SUBS = ns.get('SUBS', True)

# ---- 档位：lite / pro / max ----
TIER = ns.get('TIER', 'pro')
assert TIER in ('lite', 'pro', 'max'), f"TIER 只能是 lite / pro / max，现在是 {TIER!r}"
OPENING, TITLES, ENDCARD = ns.get('OPENING'), ns.get('TITLES', []), ns.get('ENDCARD')
if TIER != 'max':
    assert not (OPENING or TITLES or ENDCARD), "OPENING / TITLES / ENDCARD 是 max 档的招牌时刻：改 TIER = 'max'，或删掉它们"
if TIER == 'lite':
    assert not G, "lite 档人物全程全屏、不放脑图板：删掉 g(...)，或改 TIER = 'pro'"
    heavy = [x.get('src') for x in SHOWS if x['type'] != 'stat']
    assert not heavy, f"lite 档不放大图 / 视频卡 {heavy}：要放图请改 TIER = 'pro'"
for t in TITLES:
    assert len(t['pills']) <= 2, f"大字「{t['text']}」：pills 最多 2 个（分列金章两侧）"
    assert t['start'] < t['end'], f"大字「{t['text']}」起止锚点反了：{t['start']}s → {t['end']}s"
    inner = ([t['stamp']['at']] if t['stamp'] else []) + [p['at'] for p in t['pills']]
    assert all(t['start'] <= x < t['end'] for x in inner), f"大字「{t['text']}」的金章 / 药丸锚点要落在标题起止之间"
if ENDCARD:
    assert ENDCARD['start'] < ENDCARD['end'], f"结尾卡起止锚点反了：{ENDCARD['start']}s → {ENDCARD['end']}s"
if OPENING:
    order = [OPENING['ui'], OPENING['badge']['at']] + [s['at'] for s in OPENING['steps']] + [OPENING['boom']]
    assert order == sorted(order), "hook_editor 的锚点要按台词顺序：ui ≤ badge ≤ steps ≤ boom"
    assert OPENING['end'] > OPENING['boom'], "hook_editor 的 end 锚点要在 boom 之后（不写 end 默认炸开后 0.93s）"
    assert 1 <= len(OPENING['steps']) <= 4, "hook_editor 的 steps 要 1–4 个"

# ---- 节点入场：at = 揭示顺序；rf = 台词锚点（根节点跟板一起淡入）----
for x in G:
    prev = x["start"] - FADE
    for i, n in enumerate(x["nodes"]):
        n["at"] = i
        rf = x["start"] - FADE if n["_anchor"] is None else A(n["_anchor"])
        rf = min(max(rf, prev + 0.12), x["end"] - 0.8)
        n["rf"] = round(rf, 3); prev = n["rf"]; del n["_anchor"]
    if x["no"] in BOX: x["box"] = BOX[x["no"]]

# ---- 章节标签：首尾相接，全片无空窗 ----
chapters = [{"start": A(a), "end": AE(b), "text": t} for a, b, t in CH]
chapters[0]["start"] = 0.5
for i in range(len(chapters) - 1):
    chapters[i]["end"] = chapters[i+1]["start"] = max(chapters[i+1]["start"], chapters[i]["start"] + 1.0)
chapters[-1]["end"] = dur
if OPENING:   # 开场剪辑器期间不出章节标签：推到它结束之后
    chapters = [c for c in chapters if c["end"] > OPENING["end"] + 1.0]
    if chapters: chapters[0]["start"] = max(chapters[0]["start"], OPENING["end"])

# ---- 词条 / 链 / 成对 / 徽章 ----
for c in CHIPS:
    c["start"] = round(c["items"][0]["rf"] - 0.3, 3); c["end"] = round(c["end"], 3)
for c in CHAINS:
    c["start"] = round(c["items"][0]["rf"] - 0.2, 3); c["end"] = round(c["end"], 3)
    c["badgeAt"] = round(min(c.get("badgeAt") or c["end"], c["end"] - 0.5), 3)
for x in PAIRS:
    for it in x.get("left", []) + x.get("right", []): it["rf"] = round(it["rf"] - LEAD, 3)
    x["start"] = min([it["rf"] for it in x.get("left", []) + x.get("right", [])] + [x["start"]]) - 0.1
for x in PAIRS + MARKS:
    x["start"] = round(x["start"], 3); x["end"] = round(x["end"], 3)
_prev = None
for _x in SHOWS:
    if _x["type"] == "stat" or _x.get("full"): continue
    if _prev and _x["start"] < _prev["end"] + 0.15: _x["start"] = _prev["end"] + 0.15
    _prev = _x
for x in SHOWS:
    x["start"] = round(x["start"], 3); x["end"] = round(x["end"], 3)

# ---- 溶解窗口：板 + 大图统一算；间隔≥1.4s 各自贴边、否则居中交叉；大图期间人物缩圆窗 ----
def boundary(a_end, b_start):
    gap = b_start - a_end
    if gap >= FADE * 2:
        return [round(a_end, 3), round(a_end + FADE, 3)], [round(b_start - FADE, 3), round(b_start, 3)], False
    f, mid = max(MINX, gap), (a_end + b_start) / 2
    w = [round(mid - f/2, 3), round(mid + f/2, 3)]
    return w, w, True
items = [{"ref": x, "start": x["start"], "end": x["end"], "pip": x["pip"]} for x in G]
for sh in SHOWS:
    if sh["type"] not in ("image", "scroll", "video"): continue
    if any(sh["start"] < gg["end"] + 0.01 and sh["end"] > gg["start"] - 0.01 for gg in G): continue
    items.append({"ref": sh, "start": sh["start"], "end": sh["end"], "pip": sh.get("pip", "bl")})
items.sort(key=lambda v: v["start"])
joined = []
for i, v in enumerate(items):
    if i == 0: v["ref"]["fin"] = [round(v["start"] - FADE, 3), v["start"]]
    if i == len(items) - 1: v["ref"]["fout"] = [v["end"], round(v["end"] + FADE, 3)]
    else:
        fo, fi, merged = boundary(v["end"], items[i+1]["start"])
        v["ref"]["fout"] = fo; items[i+1]["ref"]["fin"] = fi; joined.append(merged)
blocks, run = [], [0]
for i, m in enumerate(joined):
    if m: run.append(i+1)
    else: blocks.append(run); run = [i+1]
if items: blocks.append(run)   # lite / 没有板和大图时没有隐人区块
spec_blocks = [{"fin": items[r[0]]["ref"]["fin"], "fout": items[r[-1]]["ref"]["fout"]} for r in blocks]
runs = []
for blk in blocks:
    cur = None
    for gi in blk:
        m = items[gi]["pip"]
        if m == "none": cur = None; continue
        if cur and cur["mode"] == m: cur["fout"] = items[gi]["ref"]["fout"]
        else:
            cur = {"mode": m, "fin": items[gi]["ref"]["fin"], "fout": items[gi]["ref"]["fout"]}; runs.append(cur)

spec = {"fps": FPS, "width": 1920, "height": 1080, "duration": round(dur, 3),
        "durationInFrames": int(math.floor(dur * FPS)),
        "cues": cues, "groups": G, "blocks": spec_blocks, "pipRuns": runs, "chapters": chapters,
        "chips": CHIPS, "chains": CHAINS, "pairs": PAIRS, "marks": MARKS, "shows": SHOWS,
        "subtitles": SUBS, "tier": TIER, "opening": OPENING, "titles": TITLES, "endcard": ENDCARD,
        "flashes": [OPENING["boom"]] if OPENING else []}   # 设计白闪：spike_scan 不当乱帧
os.makedirs('remotion/public', exist_ok=True)
json.dump(spec, open('remotion/public/spec.json', 'w'), ensure_ascii=False, indent=1)

# ---- 体检报告 ----
print(f"档位 {TIER}   时长 {dur:.2f}s")
tot = 0
for i, x in enumerate(G):
    d = x['end'] - x['start']; tot += d
    gap = x['start'] - G[i-1]['end'] if i else x['start']
    print(f"  板{x['no']:2} {x['pip']:<4} {x['start']:7.2f}-{x['end']:7.2f} ({d:5.1f}s) 前隔 {gap:5.1f}s  {x['title']}")
    print("        节点入场: " + " ".join(f"{n['rf']:.1f}" for n in x['nodes']))
print("章节: " + " | ".join(f"{c['start']:.0f}-{c['end']:.0f} {c['text']}" for c in chapters))
print("词条组: " + " ".join(f"[{c['start']:.0f}-{c['end']:.0f}:{len(c['items'])}条]" for c in CHIPS))
print("箭头链: " + " | ".join(f"{c['start']:.0f}-{c['end']:.0f} " + " → ".join(i['t'] for i in c['items']) for c in CHAINS))
print("成对/徽章: " + " ".join(f"[{p['start']:.0f}-{p['end']:.0f}]" for p in PAIRS + MARKS))
print("隐人区块: " + " ".join(f"[{b['fin'][0]:.0f}-{b['fout'][1]:.0f}]" for b in spec_blocks))
print("展示层: " + " | ".join(f"{x['start']:.0f}-{x['end']:.0f} {x.get('src', 'stat:'+str(x.get('num')))}" for x in SHOWS))
if TIER == 'max':
    sig = ([f"开场剪辑器 0–{OPENING['end']:.1f}s"] if OPENING else []) + \
          [f"大字「{t['text']}」{t['start']:.1f}–{t['end']:.1f}s" for t in TITLES] + \
          ([f"结尾卡 {ENDCARD['start']:.1f}–{ENDCARD['end']:.1f}s"] if ENDCARD else [])
    print("招牌时刻: " + (" | ".join(sig) or "（没有——max 至少放一个，否则和 pro 只差微动效）"))
hidden = [x for x in G if x['pip'] == 'none']
print(f"图形覆盖 {tot:.1f}s / {dur:.1f}s = {tot/dur*100:.0f}%   板数 {len(G)}   " +
      f"最长连续隐身 {max([x['end']-x['start'] for x in hidden] or [0]):.1f}s")
warn = [f"板{x['no']}" for x in G if (x['end']-x['start']) < 6] + \
       [f"板{x['no']}节点过密" for x in G if len(x['nodes']) > 7]
cap = {'lite': 1.01, 'pro': 0.60, 'max': 0.70}[TIER]
if tot/dur > cap: warn.append(f"覆盖 {tot/dur*100:.0f}% > {cap*100:.0f}%")
if CH and not chapters: warn.append("章节标签全被开场剪辑器吃掉了——CH 的锚点要落在开场之后")
for nm, a0, b0 in [(f"大字「{t['text']}」", t['start'], t['end']) for t in TITLES] + \
                  ([("结尾卡", ENDCARD['start'], ENDCARD['end'])] if ENDCARD else []):
    if any(a0 < b['fout'][1] and b0 > b['fin'][0] for b in spec_blocks):
        warn.append(f"{nm} 撞上隐人区块——招牌时刻要放在人物全屏段")
for x in G:
    cids = {n['id'] for n in x['nodes'] if n.get('conclusion')}
    orphan = [n['id'] for n in x['nodes'] if n.get('parent') in cids]
    assert not orphan, f"板{x['no']}: 结论节点的子节点 {orphan} 不会被布局——父节点别设 concl，把结论挪到叶子"
    rfs = [n['rf'] for n in x['nodes']]
    if rfs != sorted(rfs):
        warn.append(f"板{x['no']}节点没按台词时序排（reveal 单调递增，早说的会被排后面的节点推迟入场）")
print("⚠ " + "；".join(warn) if warn else "✓ 结构体检通过")

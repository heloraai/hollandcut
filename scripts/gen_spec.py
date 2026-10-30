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
  hook_editor(...) / title(...) / endcard(...)             max 档招牌时刻：开场剪辑器 / 大字标题（chunks 按台词分块飞入）/ 结尾 CTA 卡
  rec(src, a, b, pieces, cam, clicks, marks) + P(...) / H(...)   全屏真录屏（人物缩左下圆窗）：分段变速 / 定格 / 推近 / 点击 / 高亮框
  cue(...) / stack([...], end)                              动效提示气泡（一次一条，同组逐条叠）
  logo_row / rail / fan / term / prompt_sheet / numpop / duel / receipt_stack / partner_column / rate_counter / skill_grid / brain_body
                                                             叠加层与概念图，参数见各函数 docstring
  SRC(源秒)                                                  源片时间 → 母版时间（素材自带录屏段时定位硬切点）
  dur                                                        母版时长
structure.py 需要定义：TIER（lite / pro / max，默认 pro）、CH, CHIPS, CHAINS, PAIRS, MARKS, SHOWS；
可选 BOX（{板号: {"x0":...}}）、SUBS；max 档可选 OPENING / TITLES / ENDCARD；
可选列表 / 字典（不写就没有）：
  OPEN2      开头堆叠钩子（OpenStack.tsx，Open2Spec 类型）：教程卡两摞砸下 + 红叉 → 真界面卡快进打勾 → logo 雨堆两堆再炸开 → 工具图标飞入分两列
  IMPACTS    [(秒, 倍数[, 小震 1/0])] 大字块落地那一帧整屏冲击；PUNCH 开场重拳倍数；PUNCHES / ZOOMS 人物层推一下 / 推拉
  CUES       动效提示；LOGO_ROWS 一排真 logo；DIVIDERS [(锚点, 小字, 大字)] 章节过渡卡；HIDE_TAGS 不出章节标签的时段
  RAILS / FANS / PROMPTS / NUMS / RECEIPTS / PARTNERS / RATE_COUNTER / SKILL_GRIDS / DUELS / BRAIN 对应上面的叠加层
  SFX        [(音效文件, 锚点或秒, 增益 dB)] 音效：render.py 交付时叠进音轨（out/ 里留无音效版给 QA 对母版）；
             叠完不压不限幅，增益给负值留余量；需要 ffmpeg ≥ 4.4（amix normalize）
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

def N(id, label, anchor=None, parent=None, kind='node', sub=None, danger=False, concl=False, dim=False):
    d = {"id": id, "label": label, "kind": kind, "_anchor": anchor}
    if dim:    d["dim"] = True   # 金字塔：只垒出来不点亮
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
def g(no, title, pip, a, b, nodes, variant=None, active=None, extra=None):
    d = {"no": no, "title": title, "pip": pip, "start": A(a), "end": AE(b), "nodes": nodes}
    if variant: d["variant"] = variant
    assert variant != "tier" or (extra and "meta" in extra), f"板{no}：排名图（variant=\"tier\"）的 extra 要带 meta={{w, h, title, rows}}（图片像素，见 TierBoard.tsx）"
    if extra: d["extra"] = extra   # 板自己的内容表（大脑 / 身体板：原装大脑、国产模型、两只手上放什么）
    if active: d["active"] = active   # solution = 纯图标方案对比 / versus = 全屏图片对比（都用 pip="to"）
    G.append(d)
    return d   # 10-18 钩子重做：返回这块板，structure.py 可以按频谱量出来的秒数改 start / end
LEAD = 0.30   # 贴纸/词条/链格提前量：落在说到那个词的瞬间
def chip(t, anchor, style="dark", icon=None, imgs=None, mark=None, sub=None, then=None, mark_at=None):
    """词条；给了 icon（Icons.tsx 里的名字）或 imgs（1–3 个 logo 路径）就渲染成图标卡；mark = check / cross / up / down 角标
    then=(字, 锚点[, "gold"])：说到那里时同一个气泡追加「· 字」（给了 "gold" 就整条在那一刻变金）；mark_at = 这一条的勾等到这个锚点再打"""
    d = {"t": t, "rf": _at(anchor), "style": style}   # 锚点：台词 或 直接给秒数
    for k, v in (("icon", icon), ("imgs", imgs), ("mark", mark), ("sub", sub)):
        if v: d[k] = v
    if then: d["then"] = {"t": then[0], "at": _at(then[1]), **({"tone": then[2]} if len(then) > 2 else {})}
    if mark_at is not None: d["markAt"] = _at(mark_at)
    return d
def duel(a, end, left, right, boost, h0=200, h1=540, badge=None, gap=None, q=None):
    """对比柱（叠加层，人物全屏）：left / right = dict(x, icon, t, at=锚点, count=数字滚动(可选), sub=, size=)；
    两柱先升到同一高度 h0，boost 锚点右柱窜到 h1 变金、左柱压暗；badge=(字, 锚点或秒)"""
    def side(p):
        q = dict(p); q["at"] = _at(q["at"]); return q
    return {"start": _at(a), "end": round(end, 3), "h0": h0, "h1": h1, "l": side(left), "r": side(right), "boostAt": _at(boost),
            "badge": {"t": badge[0], "at": _at(badge[1])} if badge else None, **({"gap": gap} if gap else {}), **({"q": q} if q is not None else {})}
def link(t, anchor, tone="cream"):   return {"t": t, "rf": round(A(anchor) - LEAD, 3), "tone": tone}
def show_img(src, w, ar, cap, a, b, box=None):
    """box=(x, y, w, h, 锚点)：图上的动画高亮框，前四项是占图片宽高的比例"""
    return {"type": "image", "src": src, "w": w, "ar": ar, "cap": cap, "start": A(a), "end": AE(b) + 0.9,
            **({"box": {"x": box[0], "y": box[1], "w": box[2], "h": box[3], "at": round(A(box[4]) - LEAD, 3)}} if box else {})}
def show_scroll(src, w, iw, ih, vh, cap, a, b):
    return {"type": "scroll", "src": src, "w": w, "iw": iw, "ih": ih, "vh": vh, "cap": cap,
            "start": A(a), "end": AE(b) + 0.9}
def show_video(src, w, ar, cap, a, b, full=False, pip="bl"):
    return {"type": "video", "src": src, "w": w, "ar": ar, "cap": cap, "full": full,
            "pip": pip, "start": A(a), "end": AE(b) + 0.9}
def P(m, f, s, rate=1.0, dy=0):
    """录屏片段：母版时间 m（秒或台词锚点）起，播 f 这条原始录屏的 s 秒处，rate 倍速；dy = 裁切框下移的像素（调试横幅把页面顶下去的那几段）"""
    return {"m": _at0(m), "f": f, "s": s, "rate": rate, "dy": dy}
def H(m, f, s, dy=0):
    """录屏定格：母版时间 m 起停在 f 的 s 秒那一帧"""
    return {"m": _at0(m), "f": f, "s": s, "hold": True, "dy": dy}
def _at0(x):
    return round(A(x), 3) if isinstance(x, str) else round(float(x), 3)
def rec(src, a, b, pieces, cam=None, clicks=None, marks=None, end=None, pip="bl", free=False, bg=None, lcont=None):
    """全屏真实录屏（人物缩左下圆窗）：pieces=[P(...)/H(...)]，由 rec_clips.py 按母版时间拼成 src；
    cam=[(到位时刻, 中心x, 中心y, 倍数)] 镜头推近（1920×1080 坐标）；clicks=[(时刻, x, y)] 点击涟漪；marks=[(起, 止, x, y, w, h)] 高亮框"""
    return {"type": "video", "src": src, "w": 1920, "ar": 16 / 9, "cap": "", "full": True, "pip": pip,
            "start": _at0(a), "end": round(end if end is not None else AE(b) + 0.3, 3), "pieces": pieces,
            "cam": [[_at0(t), x, y, z] for t, x, y, z in (cam or [])],
            "clicks": [[_at0(t), x, y] for t, x, y in (clicks or [])],
            "marks": [[_at0(t0), _at0(t1), x, y, w, h] for t0, t1, x, y, w, h in (marks or [])],
            **({"free": True} if free else {}), **({"bg": bg} if bg else {}),
            # lcont=(母版起点, 原始秒, 分界 x)：从这一刻起分界线左边（上期视频那半）接着原速往下播，右边（评论区）照 pieces 走 —— 评论区快翻时左边视频不跳
            **({"lcont": [_at0(lcont[0]), lcont[1], lcont[2]]} if lcont else {})}
def cue(t, anchor, end=None, tone="dark", icon=None, img=None, hold=2.4, count=None, mask=None, pre="", suf="", label=None, y=None, strike=False, mark=None, size=None, shot=None, rec=False, gold_at=None):
    """动效提示（一次一条、自己收掉、不堆叠）：t 短词；icon / img 二选一；count = 大数字从 0 滚到位（pre / suf 前后缀，label 小字）
    shot=(截图, 显示宽, (框x, 框y, 框w, 框h 占图比例), 框的锚点)：浅色截图卡（证据图），说到那个数时在图上画珊瑚框"""
    at = _at(anchor)
    d = {"t": t, "at": at, "end": round(_at0(end) if end is not None else at + hold, 3), "tone": tone}
    if shot:
        from PIL import Image
        iw, ih = Image.open(f"remotion/public/{shot[0]}").size
        d["shot"] = {"src": shot[0], "w": shot[1], "h": round(shot[1] * ih / iw), "box": list(shot[2]), "boxAt": _at(shot[3])}
    for k, v in (("icon", icon), ("img", img), ("count", count), ("mask", mask), ("pre", pre), ("suf", suf), ("label", label), ("y", y), ("strike", strike), ("mark", mark), ("size", size), ("rec", rec)):
        if v not in (None, ""): d[k] = v
    if gold_at is not None: d["goldAt"] = _at(gold_at)   # 10-18 钩子修正：先出米白、说到这里再变金（带一下轻弹），同组上面几条跟着压暗
    return d
_GRP = [0]
def stack(cues_, end):
    """一组提示：同一个话题里连着说的几句，逐条往下叠，到 end 一起收掉"""
    _GRP[0] += 1
    e = round(_at0(end), 3)
    return [dict(c, grp=_GRP[0], idx=i, end=e) for i, c in enumerate(cues_)]
def pill(t, at=None, img=None, icon=None, mark=None, tone=None):
    d = {"t": t}
    if at is not None: d["at"] = _at(at)
    for k, v in (("img", img), ("icon", icon), ("mark", mark), ("tone", tone)):
        if v: d[k] = v
    return d
def logo_row(title, items, end, title_at=None, y=None, badge=None, rows=None, pick=None):
    """一排真 logo 逐个弹出（并列的品牌）：items=[(图, 名字, 锚点)]；title = 上方一句观点（可空）"""
    its = [{"img": i, "label": l, "at": _at(a)} for i, l, a in items]
    return {"title": title, "titleAt": _at(title_at) if title_at is not None else its[0]["at"], "items": its,
            "start": round(min(its[0]["at"], _at(title_at) if title_at is not None else 1e9) - 0.1, 3), "end": round(_at0(end), 3), **({"y": y} if y else {}),
            "badge": {"t": badge[0], "at": _at(badge[1])} if badge else None,                       # 标题右边的小金牌 (字, 锚点)
            "rows": [{"at": _at(a), "pills": ps} for a, ps in (rows or [])],                        # logo 下面那一行：[(锚点, [pill(...)…])]，后一组顶掉前一组
            "pick": {"i": pick[0], "at": _at(pick[1])} if pick else None}                           # (第几个 logo, 锚点)：圈出来
def brain_body(a, end, head, brain_tag, body_tag, swap, tools, bracket):
    """大脑 / 身体示意图：tools=[(字, 图标, 锚点)]；bracket=(字, 锚点)；其余都是锚点（台词或秒）"""
    return {"start": _at(a), "end": round(_at0(end), 3), "body": _at(a), "head": _at(head), "brainTag": _at(brain_tag), "bodyTag": _at(body_tag),
            "swap": _at(swap), "tools": [{"t": t, "icon": ic, "at": _at(x)} for t, ic, x in tools], "bracket": {"t": bracket[0], "at": _at(bracket[1])}}
def stat(num, label, a, b, prefix="", suffix="", gauge=False):
    d = {"type": "stat", "num": num, "prefix": prefix, "suffix": suffix, "label": label,
         "start": A(a), "end": AE(b) + 1.6}
    if gauge: d["gauge"] = True   # 圆环仪表盘：num 按 0–100 画弧
    return d

# ---- 源时间 → 母版时间（素材里带录屏段时，用源片里的硬切点定位）----
_EDL = json.load(open('build/edl.json')) if os.path.exists('build/edl.json') else []
try:
    from edl_rules import SPEED as _SPEED   # 整片变速：母版秒 = 拼接后的秒 / SPEED
except ImportError:
    _SPEED = 1.0
def SRC(t, clip=None):
    """源片 clip 的第 t 秒 → 母版秒（clip 不给 = 按剪辑表顺序找第一段落得进去的）"""
    n, acc = round(t * FPS), 0          # 源帧号 → 母版帧号（按帧算，不按秒相减：段首不在帧格上时差一帧）
    for c, s, e in _EDL:
        a, b = math.ceil(s * FPS - 1e-6), math.ceil(e * FPS - 1e-6)
        if clip is None or str(c) == str(clip):
            if n < a: return round(acc / FPS / _SPEED, 4)
            if n < b: return round((acc + n - a) / FPS / _SPEED, 4)
        acc += b - a
    return round(acc / FPS / _SPEED, 4)

# ---- 轻量叠加（人物保持全屏）----
def rail(a, b, nodes, done=0, finale=None, end=None, hide=None):
    """路线图竖轨：nodes=[(图标, 字, 锚点或 None)]；done=前几格直接打勾；finale=(字, 锚点) 收尾金章"""
    return {"start": round(A(a) - LEAD, 3), "end": round(end if end is not None else AE(b) + 0.6, 3), "done": done,
            "nodes": [{"icon": nd[0], "label": nd[1], "at": round(A(nd[2]) - LEAD, 3) if nd[2] else None,
                       **({"then": [{"t": t_, "at": _at(a_), "ok": bool(ok_)} for t_, a_, ok_ in nd[3]]} if len(nd) > 3 else {})} for nd in nodes],   # 10-26：(图标, 字, 锚点[, [(短牌, 锚点, 是不是优点), …]])
            "finale": {"label": finale[0], "at": round(A(finale[1]) - LEAD, 3)} if finale else None,
            **({"hide": [round(hide[0], 3), round(hide[1], 3)]} if hide else {})}   # 10-22：中间插全屏截图时整条淡出
def fan(a, b, images, lift=None, end=None, w=560):
    """三卡扇形发牌：lift=锚点（第一张抬到最前推近），end=收尾秒（贴着录屏时用 SRC 算）"""
    return {"start": round(A(a) - LEAD, 3), "end": round(end if end is not None else AE(b) + 0.1, 3), "images": images,
            "lift": round(A(lift) - LEAD, 3) if lift else None, "w": w}
def prompt_sheet(title, sections, a, end, hint="建议截图保存", x=1060, w=800):
    """提示词卡（给观众截图的那种）：sections=[(小标题, 点亮锚点或 None, [行...])]；
    人物 / 录屏保持全屏不缩圆窗，卡压在右侧，讲到哪段哪段点亮"""
    return {"title": title, "hint": hint, "x": x, "w": w,
            "start": round(A(a) - LEAD, 3), "end": round(end, 3),
            "sections": [{"h": h, "at": (round(A(an) - LEAD, 3) if an else None), "lines": list(ls)}
                         for h, an, ls in sections]}
def _at(x):
    """锚点：台词字符串（提前 LEAD 落在说到那个词的瞬间）或直接给秒数"""
    return round(A(x) - LEAD, 3) if isinstance(x, str) else round(float(x), 3)
def receipt_stack(items, a, end, stamp=None, cy=None, lr=False):
    """开场票据竖列（叠加层，人物保持全屏，贴在右侧）：items=[(图, 宽高比, 金额, 标签, 锚点[, 章字[, 章时刻]])]；
    金额留空 = 不画金额牌；stamp=(字, 锚点)；cy = 大卡中心 y（默认 430）"""
    its = [{"src": it[0], "ar": it[1], "amt": it[2], "tag": it[3], "at": _at(it[4]),
            **({"seal": it[5]} if len(it) > 5 else {}), **({"sealAt": _at(it[6])} if len(it) > 6 else {})} for it in items]
    return {"start": _at(a), "end": round(end, 3), "items": its,
            "stamp": {"t": stamp[0], "at": _at(stamp[1])} if stamp else None, **({"cy": cy} if cy else {}), **({"lr": True} if lr else {})}
def rate_counter(a, end, label, lock, lock_to, roll, roll_to, finale, x=1570, y=350, finale_y=500, finale_x=1575):
    """日薪计数器（叠加层）：a 起数位乱跳，lock 锚点逐位锁成 lock_to，roll 锚点滚到 roll_to，finale 锚点变金章落到 finale_y"""
    return {"start": _at(a), "end": round(end, 3), "x": x, "y": y, "label": label,
            "lockAt": _at(lock), "lockTo": lock_to, "rollAt": _at(roll), "rollTo": roll_to, "finaleAt": _at(finale), "finaleY": finale_y, "finaleX": finale_x}
def skill_grid(title, items, a, pop, end, dim=None, bar=None, bar_label="Codex 能力"):
    """开场技能宫格：items=[(图标, 名字)] 6 个；pop 锚点起依次弹入；dim 锚点起压暗；bar 锚点起进度条滑到 1/10"""
    return {"start": _at(a), "end": round(end, 3), "popAt": _at(pop), "title": title, "barLabel": bar_label,
            "items": [{"src": s_, "label": l} for s_, l in items],
            **({"dimAt": _at(dim)} if dim else {}), **({"barAt": _at(bar)} if bar else {})}
def partner_column(cards, a, end, callout=None, note=None, notes=None):
    """合作平台列（叠加层，人物保持全屏）：cards=[("logo"|"image", 图, 宽高比, 标题, 副标题, 锚点[, (小牌字, 锚点)])]；callout / note=(字, 锚点)；notes=[(字, 锚点)…]"""
    return {"start": round(_at(a), 3), "end": round(end, 3),
            "cards": [{"kind": c[0], "src": c[1], "ar": c[2], "title": c[3], "sub": c[4], "at": _at(c[5]),
                       **({"tag": {"t": c[6][0], "at": _at(c[6][1])}} if len(c) > 6 else {})} for c in cards],
            "notes": [{"t": t_, "at": _at(a_)} for t_, a_ in (notes or [])],
            "callout": {"t": callout[0], "at": round(A(callout[1]) - LEAD, 3)} if callout else None,
            "note": {"t": note[0], "at": round(A(note[1]) - LEAD, 3)} if note else None}
def numpop(num, label, anchor, end, suffix="%", x=1590, y=250):
    """数字弹窗：压在纯录屏演示段上（那里没有人物），说到数字时弹出、从 0 滚到位"""
    return {"num": num, "label": label, "suffix": suffix, "x": x, "y": y,
            "start": round(A(anchor) - LEAD, 3), "end": round(end, 3)}
def term(title, lines, a, b, w=1060):
    """终端打字卡：lines=[("cmd"|"out", 文本, 锚点)]；cmd 逐字打出，out 整行弹出、数字描金；当大图算（人物缩圆窗）"""
    return {"type": "term", "title": title, "w": w, "ar": w / (86 + 62 * len(lines) + 40),
            "lines": [{"kind": k, "t": t, "at": round(A(x) - LEAD, 3)} for k, t, x in lines],
            "start": A(a), "end": AE(b) + 0.9}

# ---- max 档招牌时刻（全部台词锚点）----
def hook_editor(title, ui, badge, steps, boom, stamp=None, end=None):
    """开场剪辑器：ui 界面组装 / badge=(字, 锚点) 徽章砸落 / steps=[(字, 锚点)]×1–4 步骤灯 /
    stamp=(字, 锚点) 右上红章（可选）/ boom 炸开的锚点 / end 收尾锚点（默认炸开后 0.93s）"""
    o = {"title": title, "ui": A(ui), "badge": {"t": badge[0], "at": A(badge[1])},
         "steps": [{"t": t, "at": A(x)} for t, x in steps], "boom": A(boom),
         "stamp": {"t": stamp[0], "at": A(stamp[1])} if stamp else None}
    o["end"] = round(AE(end) + 0.3 if end else o["boom"] + 0.93, 3)
    return o
def title(text, a, b, gold_from=None, stamp=None, pills=(), gold_to=None, gold_ranges=None, split=None, chunks=None, fs=None, y=None, jolt=False, cx=None, stamp_s0=None,
          fly=False, smooth=False, underline=None, ls=None):
    """大字标题：text 第 gold_from 个字符起变金（到 gold_to 前为止）/ stamp=(字, 锚点或秒) 小章 / pills=[(字, 锚点)] ≤2 个分列两侧
    10-18 钩子重做：chunks=[(起字符, 止字符, 锚点或秒), ...] 按台词分块砸进来（每块说到那个词那一帧才砸，只晚不早；没轮到的块位置先空着，整行不挪）；
    split=(第几个字符起, 锚点) 是旧写法，等于两块；fs = 中文字号（不给按 1560px / 字宽、上限 200）；y = 墨迹顶边（下巴 + 10 以下）；
    jolt = 块砸到位那一帧人物层轻震（只给开头钩子）
    10-18 钩子修正：chunks 每项可带第 4 个元素 dict(o=缩放原点, s0=起砸倍数) 覆盖默认（默认原点在块底边中间、起砸倍数按屏幕边和右下按钮区封顶）；
    只有「→」的块不砸，3 帧从左往右伸出来；stamp_s0 = 小章起砸倍数（默认 1.5，长章会扫到脸时调小）
    fly = 块里逐字飞入；smooth = 收场 8 帧下滑淡出；underline=(秒, 起字符, 止字符) 说到时那一块字下长出金线；ls = 中文字距 px"""
    st = round(A(a) - LEAD, 3)
    if split and not chunks:
        chunks = [(0, split[0], st), (split[0], len(text), _at(split[1]))]
    return {"text": text, "goldFrom": len(text) if gold_from is None else gold_from, **({"goldTo": gold_to} if gold_to is not None else {}), **({"goldRanges": gold_ranges} if gold_ranges else {}),
            **({"chunks": [{"a": c_[0], "b": c_[1], "at": _at0(c_[2]), **(c_[3] if len(c_) > 3 else {})} for c_ in chunks]} if chunks else {}),   # 块的锚点：台词（不提前）或秒
            **({"fs": fs} if fs else {}), **({"y": y} if y else {}), **({"cx": cx} if cx else {}), **({"jolt": True} if jolt else {}),   # cx = 整行中线 x
            **({"fly": True} if fly else {}), **({"smooth": True} if smooth else {}), **({"ls": ls} if ls is not None else {}),
            **({"underline": {"at": _at0(underline[0]), "from": underline[1], "to": underline[2]}} if underline else {}),
            "start": st, "end": round(AE(b) + 0.1, 3),
            # stamp=(字, 锚点) 或 (字, 锚点, 后半句, 锚点)：两拍的小章，说到后半句再把字接上
            "stamp": {"t": stamp[0], "at": _at(stamp[1]), **({"then": {"t": stamp[2], "at": _at(stamp[3])}} if len(stamp) > 3 else {}), **({"s0": stamp_s0} if stamp_s0 else {})} if stamp else None,
            "pills": [{"t": t, "at": round(A(x) - LEAD, 3)} for t, x in pills]}
def endcard(name, tagline, url, a, b, badge="已开源"):
    """结尾 CTA 卡：a 出现的锚点、b 收尾的锚点；url 打字机滚出（可空）"""
    return {"name": name, "tagline": tagline, "url": url, "badge": badge,
            "start": round(A(a) - LEAD, 3), "end": round(min(AE(b) - 0.1, dur - 0.3), 3)}

# ---- 执行结构文件 ----
ns = dict(A=A, AE=AE, A_after=A_after, N=N, SHOT=SHOT, g=g, chip=chip, link=link,
          show_img=show_img, show_scroll=show_scroll, show_video=show_video, stat=stat, dur=dur, dict=dict, min=min, max=max,
          hook_editor=hook_editor, title=title, endcard=endcard, SRC=SRC, rail=rail, fan=fan, term=term,
          prompt_sheet=prompt_sheet, numpop=numpop, P=P, H=H, rec=rec, cue=cue, logo_row=logo_row, stack=stack, pill=pill, brain_body=brain_body, receipt_stack=receipt_stack, partner_column=partner_column, rate_counter=rate_counter, skill_grid=skill_grid, duel=duel)
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
    inner = ([t['stamp']['at']] if t['stamp'] else []) + [p['at'] for p in t['pills']] + [c['at'] for c in t.get('chunks', [])] + ([t['underline']['at']] if t.get('underline') else [])
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
        an = n["_anchor"]   # None = 跟板一起；数字 = 直接给母版秒数；字符串 = 台词锚点
        rf = x["start"] - FADE if an is None else (float(an) if isinstance(an, (int, float)) else A(an))
        rf = min(max(rf, prev + 0.12), x["end"] - 0.8)
        n["rf"] = round(rf, 3); prev = n["rf"]; del n["_anchor"]
    if x["no"] in BOX: x["box"] = BOX[x["no"]]

# ---- 章节标签：首尾相接，全片无空窗 ----
chapters = [{"start": A(a), "end": AE(b), "text": t} for a, b, t in CH]
chapters[0]["start"] = max(0.5, chapters[0]["start"])   # 第一个角标锚在开头之后时照锚点出（10-18：开头大字 / 空表在屏时不重复出同一句）
for i in range(len(chapters) - 1):
    chapters[i]["end"] = chapters[i+1]["start"] = max(chapters[i+1]["start"], chapters[i]["start"] + 1.0)
chapters[-1]["end"] = dur
if OPENING:   # 开场剪辑器期间不出章节标签：推到它结束之后
    chapters = [c for c in chapters if c["end"] > OPENING["end"] + 1.0]
    if chapters: chapters[0]["start"] = max(chapters[0]["start"], OPENING["end"])

# ---- 词条 / 链 / 成对 / 徽章 ----
for c in CHIPS:
    c["start"] = round(min(c["items"][0]["rf"], c.get("titleAt", 1e9)) - 0.3, 3); c["end"] = round(c["end"], 3)   # titleAt：组标题先于第一条出现
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
    if _x["type"] == "stat" or _x.get("full") or _x.get("keep_start"): continue
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
    if sh["type"] not in ("image", "scroll", "video", "term"): continue
    # 真正落在板里面的才跳过；紧贴板尾开始的大图要单独算隐人区块（否则人物不缩圆窗，图压脸）
    if any(sh["start"] < gg["end"] - 0.05 and sh["end"] > gg["start"] + 0.05 for gg in G): continue
    items.append({"ref": sh, "start": sh["start"], "end": sh["end"], "pip": sh.get("pip", "bl")})
items.sort(key=lambda v: v["start"])
joined = []
FADE_REC = 0.4   # 全屏录屏进出：0.4s 渐显（10-18 审片：0.2s 太生硬）；人物 / 圆窗的先后顺序在 Video.tsx 里分段，不会叠出两张脸
def fade_of(v): return FADE_REC if v["ref"].get("full") else v["ref"].get("fade", FADE)   # 10-18 钩子修正：板可以自己给进出窗口（开头空表 0.5 秒）
def seq_cut(v, w, a_end, b_start):
    """录屏和板（或两段录屏）相接：先收前一个、再出后一个，不交叉叠化（10-18：板上的卡透过录屏占位叠出来）；整段 ≥ 0.8s"""
    mid = (a_end + b_start) / 2; W = max(0.8, b_start - a_end)
    w0, w1 = mid - W / 2, mid + W / 2
    cut = w0 + min(fade_of(v), W / 2)
    return [round(w0, 3), round(cut, 3)], [round(max(cut, w1 - fade_of(w)), 3), round(w1, 3)]
for i, v in enumerate(items):
    if i == 0: v["ref"]["fin"] = [round(v["start"] - fade_of(v), 3), v["start"]]
    if i == len(items) - 1: v["ref"]["fout"] = [v["end"], round(v["end"] + fade_of(v), 3)]
    else:
        fo, fi, merged = boundary(v["end"], items[i+1]["start"])
        if merged and (v["ref"].get("full") or items[i+1]["ref"].get("full")):
            fo, fi = seq_cut(v, items[i+1], v["end"], items[i+1]["start"])
        if not merged:
            fo = [round(v["end"], 3), round(v["end"] + fade_of(v), 3)]
            fi = [round(items[i+1]["start"] - fade_of(items[i+1]), 3), round(items[i+1]["start"], 3)]
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

def _open2_flashes(o):
    if not o: return []
    return [o['tut']['strike'], o['work']['done'], min(i['at'] for i in o['tools']['items'])] + ([o['rain']['burst']] if o.get('rain') else [])
spec = {"fps": FPS, "width": 1920, "height": 1080, "duration": round(dur, 3),
        "durationInFrames": int(math.floor(dur * FPS)),
        "cues": cues, "groups": G, "blocks": spec_blocks, "pipRuns": runs, "chapters": chapters,
        "chips": CHIPS, "chains": CHAINS, "pairs": PAIRS, "marks": MARKS, "shows": SHOWS,
        "subtitles": SUBS, "tier": TIER, "opening": OPENING, "titles": TITLES, "endcard": ENDCARD,
        "flashes": ([OPENING["boom"]] if OPENING else []) + ([0.0] if ns.get('PUNCH') else [])
                   + [round(t, 3) for r in ns.get('RECEIPTS', []) for t in
                      [i["at"] for i in r["items"][:3]]]
                   + [c["callout"]["at"] for c in ns.get('PARTNERS', []) if c.get("callout")]
                   + [d_["boostAt"] for d_ in ns.get('DUELS', [])]   # 对比柱窜高时的暖光
                   + [round(_at0(x), 3) for x in ns.get('PUNCHES', [])]   # 推一下：整帧变化，不当乱帧
                   + [round(_at0(t), 3) for t, _ in ns.get('ZOOMS', [])]      # 人物层推拉：同上
                   + [c["at"] for t in TITLES if t.get("jolt") or t.get("fly") for c in t.get("chunks", [])]   # 10-18：大字块砸下 + 人物小震；10-19：逐字飞入的块
                   + [round(t_, 3) for t_, *_ in ns.get('IMPACTS', [])]   # 10-19：每块落地那一下整屏冲击
                   + _open2_flashes(ns.get('OPEN2'))   # 10-30：开头堆叠钩子的红 / 金 / 白光
                   + ([ns['RATE_COUNTER'][k] for k in ('lockAt', 'rollAt')] + [ns['RATE_COUNTER']['finaleAt'] + 0.33] if ns.get('RATE_COUNTER') else []),   # 设计白闪 / 画面震：spike_scan 不当乱帧
        "rails": ns.get('RAILS', []), "fans": ns.get('FANS', []),
        "prompts": ns.get('PROMPTS', []), "numpops": ns.get('NUMS', []), "punch": ns.get('PUNCH'),
        "receipt_stacks": ns.get('RECEIPTS', []), "partner_cols": ns.get('PARTNERS', []), "rate_counter": ns.get('RATE_COUNTER'), "skill_grids": ns.get('SKILL_GRIDS', []), "duels": ns.get('DUELS', []),
        "hide_tags": [[round(a, 3), round(b, 3)] for a, b in ns.get('HIDE_TAGS', [])],
        "dividers": [{"at": round(float(A(a) if isinstance(a, str) else a), 3), "kicker": k, "t": tt} for a, k, tt in ns.get('DIVIDERS', [])],   # 章节过渡卡（10-10）
        "brain": ns.get('BRAIN'), "punches": [round(_at0(x), 3) for x in ns.get('PUNCHES', [])],
        "zooms": [[round(_at0(t), 3), z] for t, z in ns.get('ZOOMS', [])],   # 人物层推拉：(到位时刻, 倍数)，只推人物层，≥1.0
        "zoom_origin": ns.get('ZOOM_ORIGIN'),   # 10-18：推拉 / 小震的原点（不给 = 51% 40%，脸中间）；开头大字压在下巴下面时放在下巴高度，推近时下巴不往下走
        "impacts": ns.get('IMPACTS', []), "wall": ns.get('WALL'), "hook": ns.get('HOOK'), "counter": ns.get('COUNTER'), "pile": ns.get('PILE'), "biz": ns.get('BIZ'), "burst": ns.get('BURST'), "open2": ns.get('OPEN2'),   # 10-19：[(秒, 倍数)] 大字每块落地那一帧整屏冲击（Video.tsx）
        "hints": sorted(ns.get('CUES', []), key=lambda c: c["at"]), "logo_rows": ns.get('LOGO_ROWS', []), "rec_crops": ns.get('REC_CROPS', {}),   # 录屏段不出章节标签
        "sfx": [{"file": f_, "at": _at0(a_), "db": db_} for f_, a_, db_ in ns.get('SFX', [])]}   # 10-30：音效（render.py 交付时叠进音轨）
_h = spec["hints"]
for h in _h:   # 不同组（或单条）的提示不同时在场：上一条 / 上一组在下一条进场前收掉；同组的一起留着
    nxt = [n["at"] for n in _h if n["at"] > h["at"] and not (h.get("grp") is not None and n.get("grp") == h.get("grp"))]
    if nxt and h["end"] > min(nxt) - 0.12: h["end"] = round(min(nxt) - 0.12, 3)
os.makedirs('remotion/public', exist_ok=True)
for e in spec['sfx']:
    assert os.path.isfile(e['file']), f"音效文件不存在：{e['file']}（相对项目目录或写绝对路径）"
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
if ns.get('PROMPTS'):
    print("提示词卡: " + " | ".join(f"{p['start']:.0f}-{p['end']:.0f} {p['title']}（{len(p['sections'])} 段）" for p in ns['PROMPTS']))
if ns.get('NUMS'):
    print("数字弹窗: " + " | ".join(f"{n['start']:.0f}-{n['end']:.0f} {n['num']}{n['suffix']} {n['label']}" for n in ns['NUMS']))
if TIER == 'max':
    sig = ([f"开场剪辑器 0–{OPENING['end']:.1f}s"] if OPENING else []) + \
          [f"大字「{t['text']}」{t['start']:.1f}–{t['end']:.1f}s" for t in TITLES] + \
          ([f"结尾卡 {ENDCARD['start']:.1f}–{ENDCARD['end']:.1f}s"] if ENDCARD else [])
    print("招牌时刻: " + (" | ".join(sig) or "（没有——max 至少放一个，否则和 pro 只差微动效）"))
hidden = [x for x in G if x['pip'] == 'none']
print(f"图形覆盖 {tot:.1f}s / {dur:.1f}s = {tot/dur*100:.0f}%   板数 {len(G)}   " +
      f"最长连续隐身 {max([x['end']-x['start'] for x in hidden] or [0]):.1f}s")
warn = [f"板{x['no']}" for x in G if (x['end']-x['start']) < 6 and x.get('variant') != 'tier'] + \
       [f"板{x['no']}节点过密" for x in G if len(x['nodes']) > 7 and x.get('variant') != 'brainbody']   # 大脑板本来就是一句一个动作；排名图（tier）每次只落一张卡，4–6 秒是定好的，不报短
cap = {'lite': 1.01, 'pro': 0.60, 'max': 0.70}[TIER]
if tot/dur > cap: warn.append(f"覆盖 {tot/dur*100:.0f}% > {cap*100:.0f}%")
if CH and not chapters: warn.append("章节标签全被开场剪辑器吃掉了——CH 的锚点要落在开场之后")
for nm, a0, b0 in [(f"大字「{t['text']}」", t['start'], t['end']) for t in TITLES] + \
                  ([("结尾卡", ENDCARD['start'], ENDCARD['end'])] if ENDCARD else []):
    if any(a0 < b['fout'][1] and b0 > b['fin'][0] for b in spec_blocks):
        warn.append(f"{nm} 撞上隐人区块——招牌时刻要放在人物全屏段")
# 叠加层（提示词卡 / 数字弹窗）压在全屏画面上：撞上大图区块会和大图抢地方
for nm, a0, b0 in [(f"提示词卡「{p['title']}」", p['start'], p['end']) for p in ns.get('PROMPTS', [])] + \
                  [(f"数字弹窗 {n['num']}{n['suffix']}", n['start'], n['end']) for n in ns.get('NUMS', [])]:
    assert a0 < b0, f"{nm} 起止反了：{a0}s → {b0}s"
    if any(a0 < b['fout'][1] and b0 > b['fin'][0] for b in spec_blocks):
        warn.append(f"{nm} 撞上隐人区块——叠加层要放在人物 / 录屏全屏段")
for x in G:
    cids = {n['id'] for n in x['nodes'] if n.get('conclusion')}
    orphan = [n['id'] for n in x['nodes'] if n.get('parent') in cids]
    assert not orphan, f"板{x['no']}: 结论节点的子节点 {orphan} 不会被布局——父节点别设 concl，把结论挪到叶子"
    rfs = [n['rf'] for n in x['nodes']]
    if rfs != sorted(rfs):
        warn.append(f"板{x['no']}节点没按台词时序排（reveal 单调递增，早说的会被排后面的节点推迟入场）")
_left = [(f"词条组@{c['start']:.0f}s", c['start'], c['end']) for c in CHIPS] + [(f"logo排@{r['start']:.0f}s", r['start'], r['end']) for r in spec["logo_rows"]] + \
        [(f"卡片列@{c['start']:.0f}s", c['start'], c['end']) for c in spec["partner_cols"]] + [(f"对比柱@{d_['start']:.0f}s", d_['start'], d_['end']) for d_ in spec["duels"]] + \
        [(f"路线轨@{r['start']:.0f}s", r['start'], r['end']) for r in spec["rails"]] + \
        [(f"扇形@{r['start']:.0f}s", r['start'], r['end']) for r in spec["fans"]] + [(f"票据@{r['start']:.0f}s", r['start'], r['end']) for r in spec["receipt_stacks"]]
for h in _h:
    assert h["at"] < h["end"], f"提示「{h['t']}」起止反了：{h['at']} → {h['end']}"
    hit = [n for n, a0, b0 in _left if h["at"] < b0 and h["end"] > a0]
    if hit: warn.append(f"提示「{h['t']}」@{h['at']:.1f}s 和 {hit} 同时在左侧")
    if not h.get("rec") and any(h["at"] < b['fout'][1] and h["end"] > b['fin'][0] for b in spec_blocks): warn.append(f"提示「{h['t']}」@{h['at']:.1f}s 撞上隐人区块")
print("提示: " + " | ".join(f"{h['at']:.1f}-{h['end']:.1f} {h['t']}" for h in _h))
print("⚠ " + "；".join(warn) if warn else "✓ 结构体检通过")

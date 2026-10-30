# -*- coding: utf-8 -*-
"""改剪辑之后（加回 / 删掉句子、改 SPEED）把旧母版的秒数换算到新母版：按新旧两份剪辑表逐段对回源片段时间。
台词锚点会跟着新转写自动走；要换算的只有 structure.py 里写死的秒数，和改过错字的旧字幕（build/cues.json 也是旧母版时间）。
用法（项目目录里）：
  python3 remap.py snap          改 edl_rules 之前先存档当前剪辑表 + 倍速 → build/edl_prev.json，改过错字的字幕 → build/cues_prev.json
  （改 edl_rules → build_edl → build_recut → layers）
  python3 remap.py 12.3 45.6     打印旧秒 → 新秒，自查
structure.py 里：from remap import R, RL   # R(旧秒) → 新秒；RL(列表) 只换里面的数字
旧字幕：cues_prev.json 逐条过 R；新加回的句子从新转写 build/tm.json 里取。
再改第二次剪辑前，先把 structure.py 里的 R(...) 换成算出来的新秒数，再 `snap --force`（存档是上一版母版的时间）。"""
import bisect, json, math, os, shutil, sys

PREV, CUR, FPS = 'build/edl_prev.json', 'build/edl.json', 30
_cache = {}


def _speed():
    sys.path.insert(0, os.getcwd())
    try:
        from edl_rules import SPEED
    except ImportError:
        SPEED = 1.0
    return SPEED


def _cum(edl):
    c, out = 0.0, []
    for clip, a, b in edl:
        out.append((c, clip, a, b))
        # concat 每段按较长的那条流接：视频是整帧（trim 落在帧格上），音频按秒；只按秒累加到片尾会早约半秒
        c += max((math.ceil(b * FPS - 1e-6) - math.ceil(a * FPS - 1e-6)) / FPS, b - a)
    return out


def _load():
    if not _cache:
        if not os.path.exists(PREV):
            sys.exit(f'没有 {PREV}：改 edl_rules 之前要先跑 python3 remap.py snap')
        old = json.load(open(PREV))
        _cache.update(o=_cum(old['edl']), so=old['speed'], n=_cum(json.load(open(CUR))), sn=_speed())
    return _cache


def R(t):
    """旧母版秒 → 新母版秒；落在新剪辑表删掉的那一截里就贴到最近的边（离得远会提示）"""
    m = _load()
    p = t * m['so']
    i = max(0, bisect.bisect_right([x[0] for x in m['o']], p) - 1)
    c0, clip, a, b = m['o'][i]
    s = min(b, a + (p - c0))                       # 源片段时间
    best = None
    for c1, clip2, a2, b2 in m['n']:
        if clip2 != clip: continue
        if a2 - 1e-6 <= s <= b2 + 1e-6:
            return round((c1 + (s - a2)) / m['sn'], 3)
        d = min(abs(s - a2), abs(s - b2))
        if best is None or d < best[0]:
            best = (d, (c1 + (min(max(s, a2), b2) - a2)) / m['sn'])
    assert best, f'片段 {clip} 在新剪辑表里整段没了，{t}s 换算不了'
    if best[0] > 0.5:
        print(f'⚠ remap：{t}s 落在新剪辑删掉的那段里（离保留部分 {best[0]:.1f}s），贴到切点 {best[1]:.2f}s', file=sys.stderr)
    return round(best[1], 3)


def RL(xs):
    return [R(x) if isinstance(x, (int, float)) else x for x in xs]


if __name__ == '__main__':
    if sys.argv[1:2] == ['snap']:
        if os.path.exists(PREV) and '--force' not in sys.argv:
            sys.exit(f'{PREV} 已经有一份存档（上一版母版的时间）。structure.py 里的 R(...) 先换成新秒数，再 python3 remap.py snap --force')
        json.dump({'speed': _speed(), 'edl': json.load(open(CUR))}, open(PREV, 'w'))
        if os.path.exists('build/cues.json'): shutil.copy2('build/cues.json', 'build/cues_prev.json')
        print(f'已存档 {CUR}（{_speed()}×）→ {PREV}')
    else:
        for t in map(float, sys.argv[1:]):
            print(f'{t} → {R(t)}  Δ{R(t) - t:+.3f}')

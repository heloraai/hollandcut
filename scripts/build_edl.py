# -*- coding: utf-8 -*-
"""EDL：丢重录/口误/长空白，按静音谱压气口。规则在 edl_rules.py；保留判定基于语音区间中点。"""
import json, re

from edl_rules import PAD, MAXGAP, SECTGAP, SECT_MIN, MANUAL_KILL, MANUAL_KEEP
from tools import duration

norm = lambda t: re.sub(r'[\s，。、？！,.?!]', '', t)

def load(i):
    d = json.load(open(f'build/t{i}.json', encoding='utf-8'))
    return [(s['offsets']['from']/1000, s['offsets']['to']/1000, s['text'].strip())
            for s in d['transcription'] if s['text'].strip()]

def drop_retakes(segs):
    keep = [True]*len(segs)
    for i in range(len(segs)):
        if not keep[i]: continue
        ni = norm(segs[i][2])
        if len(ni) < 3: continue
        for j in range(i+1, min(i+8, len(segs))):
            nj = norm(segs[j][2])
            if nj.startswith(ni[:max(3, int(len(ni)*0.8))]) and len(nj) >= len(ni):
                keep[i] = False; break
            if segs[j][0] - segs[i][1] > 2.0: break
    return keep

edl, dropped, kept_txt = [], [], []
for i in [int(k) for k in json.load(open('sources.json'))]:
    segs  = load(i)
    spans = json.load(open(f'build/spans{i}.json'))
    dur   = duration(f'build/a{i}.wav')
    keep = drop_retakes(segs)
    for (a,b,t),k in zip(segs, keep):
        if not k: dropped.append((i,a,b,t,'重录'))
        elif any(a < hi and b > lo for c,lo,hi in MANUAL_KILL if c==i):
            dropped.append((i,a,b,t,'手工')); 
    # 每个语音区间按重叠时长最多的 ASR 段决定去留
    live = []
    for s,e in spans:
        best, bl = None, 0.0
        for idx,(a,b,t) in enumerate(segs):
            ov = min(e,b) - max(s,a)
            if ov > bl: bl, best = ov, idx
        if best is None: continue
        a,b,t = segs[best]
        # 用语音区间的中点判定，而不是 ASR 段范围——段比区间宽，会误伤相邻的好句
        mid = (s + e) / 2
        forced = any(lo <= mid <= hi for c,lo,hi in MANUAL_KEEP if c==i)
        if not keep[best] and not forced: continue
        if not forced and any(lo <= mid <= hi for c,lo,hi in MANUAL_KILL if c==i): continue
        live.append([max(0.0, s-PAD), min(dur, e+PAD)])
        kept_txt.append((i, s, e, t))
    if not live: continue
    merged = [live[0]]
    for s,e in live[1:]:
        g = s - merged[-1][1]
        tgt = SECTGAP if g + 2*PAD >= SECT_MIN else MAXGAP
        if g <= tgt:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged[-1][1] += tgt/2
            merged.append([s - tgt/2, e])
    for s,e in merged: edl.append((i, round(s,3), round(e,3)))

json.dump(edl, open('build/edl.json','w'))
tot = sum(e-s for _,s,e in edl)
print(f"保留 {len(edl)} 段拼接, 成片 {tot:.1f}s = {int(tot//60)}分{tot%60:04.1f}秒")
print(f"丢弃 {len(dropped)} 条 ASR 段（重录 {sum(1 for d in dropped if d[4]=='重录')} / 手工 {sum(1 for d in dropped if d[4]=='手工')}）")
print("\n=== 保留下来的口播全文（按成片顺序）===")
prev=None
for i,s,e,t in kept_txt:
    if t != prev: print(f"  clip{i} [{s:6.2f}] {t}")
    prev=t

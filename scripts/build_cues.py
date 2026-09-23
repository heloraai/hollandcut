# -*- coding: utf-8 -*-
import json, re

MAXCH = 16
from cue_rules import FIX, GOLD, PROT_EXTRA, DROP as DROP_RE
try:
    from cue_rules import ADD      # whisper 漏掉的句子：[(起, 止, 文字)]，母版时间，按音频手补
except ImportError:
    ADD = []

def fix(t):
    for a,b in FIX: t = t.replace(a,b)
    return re.sub(r'\s+',' ',t).strip()

def dlen(t):  # 显示宽度，中文算 1，西文算 0.55
    return sum(1 if ord(c)>0x2e80 else 0.55 for c in t)

DROP = re.compile(DROP_RE)
d = json.load(open('build/tm.json', encoding='utf-8'))
raw = [(s['offsets']['from']/1000, s['offsets']['to']/1000, fix(s['text']))
       for s in d['transcription'] if fix(s['text']) and not DROP.search(s['text'])]

# 不许从中间劈开的词
PROT = ['前沿部署工程师','部署工程师','工程师','聊天机器人','标准产品','自动化',
        '评论区','五位数','六位数','百分点','知识库','财务系统','业务规则','业务流程',
        '数据库','云部署','生产级','互联网','完整路线','产品政策',
        '客服','退款','账户','身份','系统','项目','企业','团队','数据','模型','架构',
        '边界','权限','责任','来电','人工','规则','测试','上线','部署','技术','收入',
        '障碍','阻碍','信任','政策','场景','用户','验证','读取','执行','批准','操作',
        '独立','解决','调整','比例','降低','产品','注册','账号','购买','私信','关注',
        '变现','玩法','案例','判断','交付','工作','流程','痛点','破局','技能','市面']
PROT = PROT + list(PROT_EXTRA)
BREAK = '，。、？！ 的了吗呢吧呀啊'

def spans_of(t):
    """所有受保护词在 t 里的占位区间"""
    out = []
    for w in PROT:
        i = t.find(w)
        while i >= 0:
            out.append((i, i + len(w)))
            i = t.find(w, i + 1)
    return out

def split_points(t, n):
    prot = spans_of(t)
    ok = lambda i: 0 < i < len(t) and not any(a < i < b for a, b in prot)
    per = len(t) / n
    pts, prev = [], 0
    for k in range(1, n):
        tgt = int(round(per * k))
        best = None
        for off in range(0, 7):            # 先找「落在自然停顿后」的合法点
            for j in (tgt - off, tgt + off):
                if j > prev and ok(j) and t[j-1] in BREAK:
                    best = j; break
            if best: break
        if best is None:                   # 退而求其次：最近的合法点
            for off in range(0, 7):
                for j in (tgt - off, tgt + off):
                    if j > prev and ok(j):
                        best = j; break
                if best: break
        if best is None: best = max(prev + 1, tgt)
        pts.append(best); prev = best
    return pts

# 过长的段按词语边界均衡切分，时间按字数比例分配
cues = []
for si,(a,b,t) in enumerate(raw):
    if dlen(t) <= MAXCH:
        cues.append([a,b,t,si]); continue
    n = int(dlen(t)//MAXCH)+1
    idx = [0] + split_points(t, n) + [len(t)]
    for k in range(len(idx)-1):
        s_, e_ = idx[k], idx[k+1]
        if e_ <= s_: continue
        cues.append([a+(b-a)*s_/len(t), a+(b-a)*e_/len(t), t[s_:e_], si])

# 同一 ASR 段内的孤字并回上一条
m = []
for s,e,t,si in cues:
    if m and m[-1][3]==si and dlen(t)<4.5 and dlen(m[-1][2])+dlen(t)<=MAXCH+4 and s-m[-1][1]<0.45:
        m[-1][1]=e; m[-1][2]+=t
    else: m.append([s,e,t,si])

# 去掉 whisper 的重复幻觉段（与上一条同文且极短）
m = [x for i,x in enumerate(m) if not (i and x[2]==m[i-1][2] and x[1]-x[0] < 0.45)]
out=[]
for s,e,t,_ in m:
    for g in GOLD: t = t.replace(g, f"【{g}】") if f"【{g}】" not in t else t
    t = re.sub(r'【([^】]*)】(?=[^】]*】)', lambda x:x.group(0), t)
    out.append({"start":round(s,3),"end":round(max(e,s+0.35),3),"text":t})
for s_, e_, t_ in ADD:
    for g in GOLD: t_ = t_.replace(g, f"【{g}】") if f"【{g}】" not in t_ else t_
    out.append({"start": round(s_, 3), "end": round(e_, 3), "text": t_})
out.sort(key=lambda c: c["start"])
# 去重叠
for i in range(1,len(out)):
    if out[i]["start"] < out[i-1]["end"]: out[i-1]["end"] = out[i]["start"]
json.dump(out, open('build/cues.json','w'), ensure_ascii=False)
print(f"字幕 {len(out)} 条")
bad=[c for c in out if dlen(c['text'].replace('【','').replace('】',''))>MAXCH+3]
print("超长:", len(bad))
for c in out[:14]: print(f"  [{c['start']:6.2f}-{c['end']:6.2f}] {c['text']}")

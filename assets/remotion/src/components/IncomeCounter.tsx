import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {FONT} from '../theme';

/**
 * 数字计数卡（突出位数变化）：左边一张深色卡（和锁卡同一个位置、同一套样式），卡里是机械计数器：
 *   卡滑进来从起点数一路往上滚（先慢后快再慢），停在四个 9 →
 *   说到关键词时四个转轮像老虎机一样转起来、最前面撑开第五位，逗号收掉 →
 *   大字落地那一帧从左到右依次停在「?」、变金、套上虚线格（和锁卡的五个空位一个样子，不出具体数字）。
 * 可选月历（cal）：同一张卡先当月历用，月份转轮翻到 month、停下变金；swapAt 卡里内容往上推走、换成计数器。
 * 扁平：纯色 + 硬投影，不发光。时间全是母版秒。
 */
export type CounterSpec = {
  start: number; end: number; x: number; y: number; title: string;
  climbAt: number; topAt: number; overAt: number; goldAt: number;   // 开始往上滚 / 滚到 9,999 / 开始转 / 停在「?」变金（母版秒）
  cal?: {year: string; month: number; flipAt: number; landAt: number; swapAt: number};   // 先当月历：flipAt 起翻月份、landAt 停在 month、swapAt 推成计数器
};
const ROW = 188;   // 卡里内容区高：标题行 56 + 间距 16 + 数字行 116

const F = (s: number) => Math.round(s * 30);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const INK = '#15161B', GOLD = '#F6C453', CREAM = '#F5F0E6';
const SHADOW = '5px 6px 0 rgba(21,22,27,0.45)';
const NUMF = `"Arial Rounded MT Bold", ${FONT}`;
const FS = 116, DW = 0.6 * FS;   // 数字字号 / 每个转轮宽
const STRIP = [...'0123456789'.repeat(3).split(''), '?'];   // 转轮上的字：三圈数字 + 最后一格「?」
const Q = STRIP.length - 1;

const io = Easing.inOut(Easing.cubic);
const valueAt = (f: number, s: CounterSpec) => {
  if (f < F(s.climbAt)) return 1000;
  if (f < F(s.topAt)) return 1000 + 8999 * io((f - F(s.climbAt)) / (F(s.topAt) - F(s.climbAt)));
  return 9999;
};
/** 第 i 位转轮的位置（0–10）：个位连续转；高位只在低位全是 9 的最后一格里进位（里程表） */
const odo = (v: number, i: number) => {
  if (i === 0) return v % 10;
  const p = 10 ** i;
  return (Math.floor(v / p) % 10) + Math.max(0, (v % p) - (p - 1));
};
/** 撑开第五位之后：转轮 k（0 = 最左那位 … 4 = 个位）从 9 转两圈多停在「?」，从左到右依次停，最后一个正好停在变金那帧 */
const spinPos = (f: number, s: CounterSpec, k: number, from: number) => {
  const total = F(s.goldAt) - F(s.overAt);           // 10 帧
  const dur = total - 4, t = (f - F(s.overAt) - k) / dur;
  return from + (Q - from) * Easing.out(Easing.cubic)(Math.min(1, Math.max(0, t)));
};

const Reel: React.FC<{pos: number; blur: number; color: string; slot: number}> = ({pos, blur, color, slot}) => (
  <div style={{width: DW, height: FS, overflow: 'hidden', position: 'relative', flex: 'none'}}>
    {slot > 0 ? <div style={{position: 'absolute', left: 4, right: 4, top: 6, bottom: 6, borderRadius: 12, border: `3px dashed ${GOLD}`,
                             background: 'rgba(246,196,83,0.12)', opacity: slot}} /> : null}
    <div style={{position: 'absolute', left: 0, top: 0, width: DW, transform: `translateY(${-pos * FS}px)`, filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined}}>
      {STRIP.map((d, k) => (
        <div key={k} style={{height: FS, lineHeight: `${FS}px`, textAlign: 'center', color, fontSize: d === '?' ? FS * 0.78 : FS}}>{d}</div>
      ))}
    </div>
  </div>
);

const CalIcon: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="3" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" />
  </svg>
);

/** 月历：月份转轮（1…month）+「月」+ 12 格（过到哪个月亮到哪格），停下那帧变金、弹一下 */
const Calendar: React.FC<{f: number; c: NonNullable<CounterSpec['cal']>}> = ({f, c}) => {
  // 匀速翻（像翻日历），正好在 landAt（说到月份那帧）翻到 month —— 减速停的话数字会比说出来早 4 帧露出来
  const pos = interpolate(f, [F(c.flipAt), F(c.landAt)], [0, c.month - 1], CL);
  const pos1 = interpolate(f - 1, [F(c.flipAt), F(c.landAt)], [0, c.month - 1], CL);
  const landed = f >= F(c.landAt), dL = f - F(c.landAt);
  const pulse = dL >= 0 && dL < 10 ? 1 + 0.08 * Math.sin((Math.PI * dL) / 10) : 1;
  const color = landed ? GOLD : CREAM;
  const blur = Math.min(6, Math.max(0, (pos - pos1 - 0.35) * 6));
  return (
    <>
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        <CalIcon size={56} />
        <span style={{fontSize: 44, fontWeight: 900, color: '#FFFFFF', letterSpacing: 3, whiteSpace: 'nowrap'}}>{c.year} 年</span>
      </div>
      <div style={{marginTop: 16, height: FS, display: 'flex', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', transform: `scale(${pulse})`, transformOrigin: '0% 50%'}}>
          <div style={{width: DW, height: FS, overflow: 'hidden', position: 'relative', fontFamily: NUMF, fontSize: FS, fontWeight: 900}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: DW, transform: `translateY(${-pos * FS}px)`, filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined}}>
              {Array.from({length: c.month}).map((_, k) => <div key={k} style={{height: FS, lineHeight: `${FS}px`, textAlign: 'center', color}}>{k + 1}</div>)}
            </div>
          </div>
          <span style={{fontSize: 84, fontWeight: 900, color, marginLeft: 4}}>月</span>
        </div>
        <div style={{marginLeft: 36, display: 'flex', gap: 7, alignItems: 'center'}}>
          {Array.from({length: 12}).map((_, k) => (
            <div key={k} style={{width: 18, height: 76, borderRadius: 6, background: k < c.month && k <= Math.round(pos) ? GOLD : '#34363d'}} />
          ))}
        </div>
      </div>
    </>
  );
};

const TrendUp: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
  </svg>
);

export const IncomeCounter: React.FC<{s: CounterSpec | null}> = ({s}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!s || f < F(s.start) - 1 || f > F(s.end) + 10) return null;
  const enter = f < F(s.start) ? 0 : spring({frame: f - F(s.start), fps, config: {damping: 14, stiffness: 170, mass: 0.8}});
  const out = interpolate(f, [F(s.end), F(s.end) + 8], [0, 1], {...CL, easing: Easing.in(Easing.cubic)});
  const spinning = f >= F(s.overAt);
  const gold = f >= F(s.goldAt);
  const dG = f - F(s.goldAt);
  const pulse = dG >= 0 && dG < 10 ? 1 + 0.06 * Math.sin((Math.PI * dG) / 10) : 1;
  const slot = interpolate(f, [F(s.goldAt), F(s.goldAt) + 4], [0, 1], CL);
  const color = gold ? GOLD : CREAM;
  // 第五位：从无到有撑开（6 帧）；逗号同时收掉
  const lead = interpolate(f, [F(s.overAt), F(s.overAt) + 6], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
  const comma = 1 - lead;
  // 每个转轮的位置和模糊（转得越快越糊）
  const v = valueAt(f, s), v1 = valueAt(f - 1, s);
  const reel = (k: number) => {   // k：0 = 第五位（最左）… 4 = 个位
    const i = 4 - k;
    if (!spinning) return {pos: odo(v, i), blur: Math.min(7, Math.max(0, (Math.abs(v - v1) / 10 ** i - 0.35) * 5))};
    const from = k === 0 ? 0 : 9;
    const p = spinPos(f, s, k, from), p1 = spinPos(f - 1, s, k, from);
    return {pos: p, blur: Math.min(7, Math.max(0, (p - p1 - 0.6) * 1.6))};
  };
  const r = [0, 1, 2, 3, 4].map(reel);
  // 有月历：swapAt 起 8 帧把月历往上推走、计数器从下面推上来；没有月历就一直是计数器
  const swap = s.cal ? interpolate(f, [F(s.cal.swapAt), F(s.cal.swapAt) + 8], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)}) : 1;
  return (
    <div style={{position: 'absolute', left: s.x, top: s.y, width: 600, boxSizing: 'border-box', borderRadius: 30, background: INK, border: `5px solid ${GOLD}`,
                 boxShadow: SHADOW, padding: '24px 30px 22px', fontFamily: FONT, pointerEvents: 'none',
                 opacity: 1 - out, transform: `translateX(${(1 - enter) * -720 - 70 * out}px)`}}>
      <div style={{position: 'relative', height: ROW, overflow: 'hidden'}}>
        {s.cal && swap < 1 ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: ROW, transform: `translateY(${-swap * ROW}px)`, opacity: 1 - swap}}><Calendar f={f} c={s.cal} /></div> : null}
        {swap > 0 ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: ROW, transform: `translateY(${(1 - swap) * ROW}px)`, opacity: swap}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <TrendUp size={56} />
            <span style={{fontSize: 44, fontWeight: 900, color: '#FFFFFF', letterSpacing: 3, whiteSpace: 'nowrap'}}>{s.title}</span>
          </div>
          <div style={{marginTop: 16, display: 'flex', alignItems: 'center', fontFamily: NUMF, fontSize: FS, fontWeight: 900, lineHeight: 1,
                       transform: `scale(${pulse})`, transformOrigin: '50% 50%'}}>
            <span style={{fontSize: 72, color: GOLD, marginRight: 10, fontFamily: FONT, fontWeight: 900}}>¥</span>
            <div style={{width: DW * lead, height: FS, overflow: 'hidden', flex: 'none'}}>
              {lead > 0 ? <Reel pos={r[0].pos} blur={r[0].blur} color={color} slot={slot} /> : null}
            </div>
            <Reel pos={r[1].pos} blur={r[1].blur} color={color} slot={slot} />
            <span style={{width: 0.3 * FS * comma, overflow: 'hidden', textAlign: 'center', color, opacity: comma, flex: 'none'}}>,</span>
            <Reel pos={r[2].pos} blur={r[2].blur} color={color} slot={slot} />
            <Reel pos={r[3].pos} blur={r[3].blur} color={color} slot={slot} />
            <Reel pos={r[4].pos} blur={r[4].blur} color={color} slot={slot} />
          </div>
        </div> : null}
      </div>
    </div>
  );
};

import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, interpolateColors, spring, Easing} from 'remotion';
import {FONT} from '../theme';
import {Icon} from './Icons';

/**
 * 浅色气泡（全是黑色实体长条 = 全是重点 = 没有重点，所以默认浅色）。
 * 样子：纸色胶囊 + 2px 深金描边 + 左色条 + 0 模糊硬投影（让浅色气泡压在浅色墙面上也看得清）。
 * 不要呼吸光、扫光、外发光、白闪、打字机（扁平规矩）。
 *
 * 强调规则：
 * 1. 默认 cream。旧数据里的 'dark' / 'paper' / 不写，一律当 cream。
 * 2. 同一组（同时在场的一摞 / 一块板）最多 1 个 gold；gold 只给结论 / 行动 / 关键数字，不给标题。
 * 3. red（珊瑚底白字）= 警示，全片 1–2 处，不和 gold 同时在场。
 *    负面属性（劳动密集、天花板低）用 neg：仍是浅色底，只把左色条和图标换成珊瑚，不整块变红。
 * 4. 讲到才标黄：goldAt = 说到关键词那一秒，cream → gold 走 6 帧 + 一下 1.0→1.06→1.0；
 *    goldEnd 给了就再退回 cream（大脑板「金色跟着嘴走」，画面上永远只有一个金）。
 * 5. ✓ / ✕ 是词尾附件，不改底色；strike = 划掉（字变灰 + 珊瑚划线 + 自动挂 ✕ 章）。
 *
 * 用法：<Bubble t="差的只是信息差" tone="gold" icon="search" at={8.35} end={10.9} style={{position: 'absolute', left: BUB.LEFT, top: BUB.TOP}} />
 * 时间（at / end / goldAt / goldEnd / markAt）都是母版秒，和 spec 里的数据同一个口径；不给 at 就是静态全显（调用方自己管进出场）。
 * style 只用来定位（position / left / top / zIndex），透明度和 transform 归气泡自己管。
 */

const INK = '#15161B', PAPER = '#F5F0E6', GOLD = '#F6C453', CORAL = '#FF6B4A', GREEN = '#35B877', EDGE = '#8C6B21';
const NUMF = `"Arial Rounded MT Bold", ${FONT}`;
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type ToneSpec = {bg: string; fg: string; bd: string; bar: string; icon: string; idx: string};
type SizeSpec = {fs: number; min: number; padY: number; padR: number; padL: number; gap: number; bar: number;
                 icon: number; logo: number; mark: number; idx: number; strikeH: number; pitch: number};
export type BubbleAnim = {dx: number; dy: number; s0: number; damping: number; stiffness: number; mass: number; outF: number; outDx: number};

export const BUB = {
  LEFT: 30, TOP: 124,              // 和左上章节标签同一条左边线，紧贴其下
  MAX_RIGHT: 700,                  // 气泡右沿不越过 x=700（脸从 800 左右开始）；超了先缩字，缩到档位的 min 为止
  WEIGHT: 800, LETTER: 1.5, LINE: 1.15,
  BORDER: 2, RADIUS: 999,
  SHADOW: '3px 4px 0 rgba(21,22,27,0.45)',   // 硬投影：0 模糊，扁平贴纸感；不要就改 'none'，一处生效
  LOGO_BD: '1px solid rgba(21,22,27,0.14)',
  DONE_FG: 'rgba(21,22,27,0.42)',  // 被划掉的字
  STRIKE: CORAL, CHECK: GREEN, CROSS: CORAL,
  TONE_FADE: 6,                    // cream ↔ gold 换色帧数
  PULSE: 10, PULSE_S: 0.06,        // 标黄那一下的放大（帧数 / 幅度）
  ANIM: {dx: -40, dy: 0, s0: 0.86, damping: 13, stiffness: 190, mass: 0.75, outF: 7, outDx: -24} as BubbleAnim,
  // 档位：md = 叠加层默认；sm = 板上 / 图下的小标签；hero = 开场大号。pitch = 竖排一摞时的行距（气泡高 + 间隙）
  SIZE: {
    sm:   {fs: 26, min: 22, padY: 7,  padR: 20, padL: 12, gap: 9,  bar: 5, icon: 24, logo: 32, mark: 24, idx: 17, strikeH: 4, pitch: 60},
    md:   {fs: 34, min: 30, padY: 10, padR: 28, padL: 16, gap: 12, bar: 6, icon: 30, logo: 40, mark: 30, idx: 21, strikeH: 5, pitch: 78},
    hero: {fs: 60, min: 48, padY: 15, padR: 40, padL: 24, gap: 18, bar: 9, icon: 52, logo: 66, mark: 54, idx: 34, strikeH: 8, pitch: 120},
  } as Record<'sm' | 'md' | 'hero', SizeSpec>,
  tone: {
    cream: {bg: 'rgba(245,240,230,0.96)', fg: INK, bd: EDGE, bar: GOLD, icon: EDGE, idx: EDGE},
    gold:  {bg: GOLD, fg: INK, bd: EDGE, bar: INK, icon: INK, idx: 'rgba(21,22,27,0.6)'},
    red:   {bg: CORAL, fg: '#FFFFFF', bd: '#B8442C', bar: '#FFFFFF', icon: '#FFFFFF', idx: 'rgba(255,255,255,0.75)'},
    neg:   {bg: 'rgba(245,240,230,0.96)', fg: INK, bd: EDGE, bar: CORAL, icon: CORAL, idx: EDGE},
  } as Record<'cream' | 'gold' | 'red' | 'neg', ToneSpec>,
  COLOR: {INK, PAPER, GOLD, CORAL, GREEN, EDGE},
};

export type BubbleTone = keyof typeof BUB.tone;
export type BubbleSize = keyof typeof BUB.SIZE;
export const toneKey = (t?: string): BubbleTone => (t === 'gold' || t === 'red' || t === 'neg' ? t : 'cream');

/** 按字数缩字：整个气泡宽 ≤ maxW。CJK 记 1.02em、半角记 0.6em（粗体估算，偏保守）*/
export const bubbleFs = (t: string, size: BubbleSize = 'md', o: {icon?: boolean; img?: boolean; idx?: boolean; mark?: boolean; bar?: boolean; maxW?: number} = {}) => {
  const S = BUB.SIZE[size];
  const chars = [...t];
  const em = chars.reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 1.02 : 0.6), 0);
  const fixed = 2 * BUB.BORDER + S.padL + S.padR + BUB.LETTER * chars.length
    + (o.bar !== false ? S.bar + S.gap : 0) + (o.idx ? S.idx * 1.4 + S.gap : 0)
    + (o.icon ? S.icon + S.gap : 0) + (o.img ? S.logo + S.gap : 0) + (o.mark ? S.mark + S.gap : 0);
  const maxW = o.maxW ?? BUB.MAX_RIGHT - BUB.LEFT;
  return Math.round(Math.max(S.min, Math.min(S.fs, (maxW - fixed) / Math.max(1, em))));
};

const mixTone = (a: ToneSpec, b: ToneSpec, k: number): ToneSpec => {
  const m = (x: string, y: string) => interpolateColors(k, [0, 1], [x, y]);
  return {bg: m(a.bg, b.bg), fg: m(a.fg, b.fg), bd: m(a.bd, b.bd), bar: m(a.bar, b.bar), icon: m(a.icon, b.icon), idx: m(a.idx, b.idx)};
};

/** 词尾圆章：✓ 绿 / ✕ 珊瑚，白色线条 */
export const Mark: React.FC<{k?: number; sz?: number; cross?: boolean}> = ({k = 1, sz = 30, cross = false}) => (
  <span style={{width: sz, height: sz, borderRadius: '50%', background: cross ? BUB.CROSS : BUB.CHECK, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flex: 'none', transform: `scale(${k})`}}>
    <svg width={sz * 0.6} height={sz * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
      {cross ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <polyline points="20 6 9 17 4 12" />}
    </svg>
  </span>
);

export type BubbleProps = {
  t: string;
  tone?: string;                 // 'cream' | 'gold' | 'red' | 'neg'；其他值当 cream
  size?: BubbleSize;             // 'sm' | 'md'（默认）| 'hero'
  icon?: string;                 // Icons.tsx 里的线性图标名
  img?: string;                  // 真 logo（public 下路径），白底小方块；有 img 就不画 icon
  idx?: number;                  // 序号 01 02 03（整组都没有图标 / logo 时才用）
  strike?: boolean;              // 划掉：字变灰 + 珊瑚划线 + 自动挂 ✕
  mark?: string;                 // 'check' | 'cross'：词尾圆章
  markAt?: number;               // 圆章弹出的秒；不给 = 入场后 8 帧（划掉的是划线走完后 15 帧）
  at?: number;                   // 入场秒；不给 = 静态全显
  end?: number;                  // 退场开始的秒（outF 帧收完）；不给 = 不退场
  goldAt?: number;               // 讲到才标黄：这一秒起 cream → gold
  goldEnd?: number;              // 这一秒起 gold → cream
  anim?: Partial<BubbleAnim>;    // 入场 / 退场参数，覆盖 BUB.ANIM（如 {dx: 0, dy: 18} 改成从下往上）
  fs?: number;                   // 强制字号（不走自动缩字）
  maxW?: number;                 // 气泡最大宽，默认 MAX_RIGHT - LEFT = 670；放在 x=68 就传 632
  bar?: boolean;                 // 左色条，默认有
  style?: React.CSSProperties;   // 只放定位
};

export const Bubble: React.FC<BubbleProps> = (p) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const F = (s: number) => Math.round(s * fps);
  const S = BUB.SIZE[p.size ?? 'md'];
  const A = {...BUB.ANIM, ...p.anim};
  const live = p.at != null;
  const d = live ? f - F(p.at as number) : 0;
  if (live && d < 0) return null;
  if (p.end != null && f > F(p.end) + A.outF) return null;

  const e = live ? spring({frame: d, fps, config: {damping: A.damping, stiffness: A.stiffness, mass: A.mass}}) : 1;
  const out = p.end == null ? 1 : interpolate(f, [F(p.end), F(p.end) + A.outF], [1, 0], {...CL, easing: Easing.in(Easing.cubic)});
  const grow = live ? interpolate(d, [2, 11], [0, 1], {...CL, easing: Easing.out(Easing.cubic)}) : 1;

  // 讲到才标黄（goldEnd 给了就再退回 cream）
  let c = BUB.tone[toneKey(p.tone)];
  let pulse = 1;
  if (p.goldAt != null) {
    const g0 = F(p.goldAt);
    const up = interpolate(f, [g0, g0 + BUB.TONE_FADE], [0, 1], CL);
    const down = p.goldEnd == null ? 1 : interpolate(f, [F(p.goldEnd), F(p.goldEnd) + BUB.TONE_FADE], [1, 0], CL);
    c = mixTone(BUB.tone.cream, BUB.tone.gold, up * down);
    pulse = 1 + BUB.PULSE_S * Math.sin(Math.PI * interpolate(f, [g0, g0 + BUB.PULSE], [0, 1], CL));
  }

  const strikeK = p.strike ? (live ? interpolate(d, [7, 16], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)}) : 1) : 0;
  const mk = p.strike ? 'cross' : p.mark;
  const markD = p.markAt != null ? f - F(p.markAt) : live ? d - (p.strike ? 15 : 8) : null;
  const markK = !mk ? 0 : markD == null ? 1 : markD < 0 ? 0 : spring({frame: markD, fps, config: {damping: 10, stiffness: 230, mass: 0.6}});

  const fs = p.fs ?? bubbleFs(p.t, p.size ?? 'md', {icon: !!p.icon && !p.img, img: !!p.img, idx: p.idx != null, mark: !!mk, bar: p.bar, maxW: p.maxW});
  const fg = p.strike ? BUB.DONE_FG : c.fg;
  const svg = p.img?.endsWith('.svg');

  return (
    <div style={{...p.style, display: 'inline-flex', alignItems: 'center', gap: S.gap, whiteSpace: 'nowrap', boxSizing: 'border-box',
                 background: c.bg, color: fg, border: `${BUB.BORDER}px solid ${c.bd}`, borderRadius: BUB.RADIUS,
                 padding: `${S.padY}px ${S.padR}px ${S.padY + 1}px ${S.padL}px`, boxShadow: BUB.SHADOW,
                 fontFamily: FONT, fontSize: fs, fontWeight: BUB.WEIGHT, letterSpacing: BUB.LETTER, lineHeight: BUB.LINE,
                 opacity: Math.min(1, e * 2) * out,
                 transform: `translate(${(1 - e) * A.dx + (1 - out) * A.outDx}px, ${(1 - e) * A.dy}px) scale(${(A.s0 + (1 - A.s0) * e) * pulse})`,
                 transformOrigin: 'left center'}}>
      {p.bar !== false ? <span style={{width: S.bar, height: fs * 0.95 * grow, borderRadius: S.bar / 2, background: p.strike ? BUB.DONE_FG : c.bar, flex: 'none'}} /> : null}
      {p.idx != null ? (
        <span style={{fontSize: S.idx, fontFamily: NUMF, fontWeight: 800, letterSpacing: 0, color: p.strike ? BUB.DONE_FG : c.idx}}>{String(p.idx).padStart(2, '0')}</span>
      ) : null}
      {p.img ? (
        <span style={{width: S.logo, height: S.logo, borderRadius: Math.round(S.logo * 0.25), background: '#fff', border: BUB.LOGO_BD, boxSizing: 'border-box',
                      overflow: 'hidden', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Img src={staticFile(p.img)} style={{width: svg ? '64%' : '100%', height: svg ? '64%' : '100%', objectFit: 'contain'}} />
        </span>
      ) : p.icon ? (
        <Icon name={p.icon} size={S.icon} color={p.strike ? BUB.DONE_FG : c.icon} stroke={2.4} />
      ) : null}
      <span style={{position: 'relative'}}>
        {p.t}
        {p.strike ? (
          <span style={{position: 'absolute', left: -4, top: '52%', height: S.strikeH, marginTop: -S.strikeH / 2, borderRadius: S.strikeH,
                        width: `calc(${strikeK * 100}% + ${8 * strikeK}px)`, background: BUB.STRIKE}} />
        ) : null}
      </span>
      {mk && markK > 0 ? (
        <span style={{width: S.mark * Math.min(1, markK), height: S.mark, flex: 'none', display: 'flex', alignItems: 'center', overflow: 'visible'}}>
          <Mark k={markK} sz={S.mark} cross={mk === 'cross'} />
        </span>
      ) : null}
    </div>
  );
};

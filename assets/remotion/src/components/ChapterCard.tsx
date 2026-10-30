import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Easing} from 'remotion';
import {FONT} from '../theme';

/**
 * 章节过渡卡（讲到新章节时加个渐显，衔接不突兀）：
 * 上一段 5 帧盖住 → 深色底（同脑图板的磨砂底）+ 大字章节名停一下 → 10 帧淡出，底下人物 / 板子渐显。
 * at = 说到章节第一句的那一刻（母版秒）：卡 at−0.15 起淡入，满屏留到 at+0.45。
 * 不推拉、不缩放（10-09：推拉只给开头）；只有字往上落 24px + 下面一道金线长出来。
 */
const FPS = 30;
const F = (s: number) => Math.round(s * FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const GOLD = '#F6C453', PAPER = '#F5F0E6';
const NUMF = `"Arial Rounded MT Bold", ${FONT}`;
export const CARD = {pre: 0.15, hold: 0.45, inF: 5, outF: 10};
export type Divider = {at: number; kicker: string; t: string};
/** 卡在屏上的母版秒窗口（章节标签在这段里不出，卡收掉再滑入） */
export const cardWindow = (d: Divider) => [d.at - CARD.pre, d.at + CARD.hold + CARD.outF / FPS];

export const ChapterCards: React.FC<{cards: Divider[]; Bg: React.FC}> = ({cards, Bg}) => {
  const f = useCurrentFrame();
  const c = cards.find((x) => f >= F(x.at - CARD.pre) && f < F(x.at + CARD.hold) + CARD.outF);
  if (!c) return null;
  const a = F(c.at - CARD.pre), b = F(c.at + CARD.hold);
  const op = interpolate(f, [a, a + CARD.inF, b, b + CARD.outF], [0, 1, 1, 0], CL);
  const e = interpolate(f, [a, a + 14], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
  return (
    <AbsoluteFill style={{opacity: op}}>
      <Bg />
      <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 40, transform: `translateY(${(1 - e) * 24}px)`, opacity: Math.min(1, e * 1.6)}}>
          <span style={{fontFamily: NUMF, fontSize: 112, fontWeight: 900, color: GOLD, letterSpacing: 2}}>{c.kicker}</span>
          <span style={{fontFamily: FONT, fontSize: 120, fontWeight: 900, color: PAPER, letterSpacing: 10}}>{c.t}</span>
        </div>
        <div style={{marginTop: 30, height: 6, width: 560 * e, background: GOLD, borderRadius: 3}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

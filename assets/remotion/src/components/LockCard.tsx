import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {FONT} from '../theme';

/**
 * 锁卡（留悬念用）：放在左边（人物全屏，让开脸）：
 *   ① 一枚金章砸下、飞走 →
 *   ② 一张深色锁卡从左边滑进来：挂锁 + 标题、下面五个空位（不出任何具体数字）、右下一行小字 →
 *   ③ 挂锁晃、五个空位依次跳一下（悬念，不揭晓）→ 整张卡快速收放一下。扁平：纯色 + 硬投影，不发光。时间全是母版秒。
 */
export type LockSpec = {
  start: number; end: number; x: number; y: number;
  stamp: {t: string; at: number; outAt: number};
  card: {at: number; title: string; slots: number; tag: string; shakeAt: number; pulseAt: number};
};

const F = (s: number) => Math.round(s * 30);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const INK = '#15161B', GOLD = '#F6C453', GREEN = '#35B877', EDGE = '#8C6B21';
const SHADOW = '5px 6px 0 rgba(21,22,27,0.45)';

const Padlock: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="11" x="4" y="11" rx="2.5" fill={color} fillOpacity={0.18} />
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    <circle cx="12" cy="16.2" r="1.4" fill={color} />
  </svg>
);

export const LockCard: React.FC<{s: LockSpec | null}> = ({s}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!s || f < F(s.start) - 1 || f > F(s.end) + 10) return null;
  const sp = (at: number, damping = 12, stiffness = 200, mass = 0.7) => (f < F(at) ? 0 : spring({frame: f - F(at), fps, config: {damping, stiffness, mass}}));
  const out = interpolate(f, [F(s.end), F(s.end) + 8], [0, 1], {...CL, easing: Easing.in(Easing.cubic)});
  const {x, y, stamp, card} = s;
  // ① 金章
  const se = sp(stamp.at, 13, 230, 0.7);
  const sOut = interpolate(f, [F(stamp.outAt), F(stamp.outAt) + 7], [0, 1], {...CL, easing: Easing.in(Easing.cubic)});
  const ck = sp(stamp.at + 0.3, 10, 220, 0.6);
  // ② 锁卡
  const ce = sp(card.at, 14, 170, 0.8);
  const dS = f - F(card.shakeAt);
  const shake = dS >= 0 && dS < 16 ? 14 * Math.sin((2 * Math.PI * dS) / 6) * (1 - dS / 16) : 0;
  const dP = f - F(card.pulseAt);
  const pulse = dP >= 0 && dP < 10 ? 1 + 0.06 * Math.sin((Math.PI * dP) / 10) : 1;

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', fontFamily: FONT, opacity: 1 - out, transform: `translateX(${-70 * out}px)`}}>
      {se > 0 && sOut < 1 ? (
        <div style={{position: 'absolute', left: x + 20, top: y + 40, display: 'flex', alignItems: 'center', gap: 18, whiteSpace: 'nowrap',
                     background: GOLD, border: `5px solid ${INK}`, borderRadius: 24, padding: '14px 34px', boxShadow: SHADOW,
                     transformOrigin: '30% 50%', opacity: Math.min(1, se * 3) * (1 - sOut),
                     transform: `translateY(${-140 * sOut}px) rotate(-6deg) scale(${(1.9 - 0.9 * se) * (1 - 0.3 * sOut)})`}}>
          <span style={{fontSize: 100, fontWeight: 900, color: INK, letterSpacing: 8}}>{stamp.t}</span>
          {ck > 0 ? (
            <div style={{width: 76, height: 76, borderRadius: '50%', background: GREEN, border: `4px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         transform: `scale(${ck})`}}>
              <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
          ) : null}
        </div>
      ) : null}

      {ce > 0 ? (
        <div style={{position: 'absolute', left: x, top: y, width: 600, boxSizing: 'border-box', borderRadius: 30, background: INK, border: `5px solid ${GOLD}`,
                     boxShadow: SHADOW, padding: '26px 30px 24px', transform: `translateX(${(1 - ce) * -720}px) scale(${pulse})`, transformOrigin: '30% 50%'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
            <div style={{transform: `rotate(${shake}deg)`, transformOrigin: '50% 30%', display: 'flex'}}><Padlock size={64} color={GOLD} /></div>
            <span style={{fontSize: 46, fontWeight: 900, color: '#FFFFFF', letterSpacing: 3, whiteSpace: 'nowrap'}}>{card.title}</span>
          </div>
          <div style={{marginTop: 24, display: 'flex', alignItems: 'center', gap: 12}}>
            <span style={{fontSize: 72, fontWeight: 900, color: GOLD, marginRight: 6}}>¥</span>
            {Array.from({length: card.slots}).map((_, i) => {
              const dB = f - F(card.shakeAt) - i * 2;
              const hop = dB >= 0 && dB < 8 ? -18 * Math.sin((Math.PI * dB) / 8) : 0;
              return (
                <div key={i} style={{width: 78, height: 96, borderRadius: 14, border: `4px dashed ${GOLD}`, background: 'rgba(246,196,83,0.12)', boxSizing: 'border-box',
                                     display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 62, fontWeight: 900, color: GOLD,
                                     transform: `translateY(${hop}px)`}}>?</div>
              );
            })}
          </div>
          <div style={{marginTop: 20, display: 'flex', justifyContent: 'flex-end'}}>
            <span style={{background: GOLD, color: INK, border: `3px solid ${EDGE}`, borderRadius: 999, padding: '4px 22px', fontSize: 34, fontWeight: 900, letterSpacing: 3}}>{card.tag}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

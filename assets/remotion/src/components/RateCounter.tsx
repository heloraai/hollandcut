import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 日薪计数器（开场叠加层，人物保持全屏）：深墨底金框牌，四段——
 * ① start 起数位老虎机乱跳（等它停）② lockAt 从左到右逐位锁成 lockTo ③ rollAt 真滚到 rollTo（第 4 位从右滑入）
 * ④ finaleAt 牌子淡出，在 (finaleX, finaleY) 砸出独立金章「日薪 · ¥lockTo – rollTo」。数字只用台词里说过的两个。
 */
export type CounterSpec = {start: number; end: number; x: number; y: number; label: string; lockAt: number; lockTo: number;
                           rollAt: number; rollTo: number; finaleAt: number; finaleY: number; finaleX?: number; prefix?: string; suffix?: string};
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const F = (s: number) => Math.round(s * T.FPS);

const Ring: React.FC<{f: number; at: number; x: number; y: number; size: number}> = ({f, at, x, y, size}) => {
  const d = f - at;
  if (d < 0 || d > 24) return null;
  const k = d / 24;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, height: size, translate: '-50% -50%', borderRadius: '50%',
                 border: `${6 * (1 - k) + 2}px solid ${GOLD_LITE}`, opacity: 0.4 * (1 - k),
                 transform: `scale(${0.5 + 1.1 * Easing.out(Easing.cubic)(k)})`}} />
  );
};

export const RateCounter: React.FC<{spec: CounterSpec; live?: boolean}> = ({spec: c, live = false}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s0 = F(c.start), lockF = F(c.lockAt), rollF = F(c.rollAt), finF = F(c.finaleAt), endF = F(c.end);
  if (f < s0 || f > endF + 10) return null;
  const enter = spring({frame: f - s0, fps, config: {damping: 18, stiffness: 120, mass: 1}});
  const out = interpolate(f, [endF, endF + 12], [1, 0], {...CL, easing: Easing.inOut(Easing.ease)});
  const lockDigits = String(c.lockTo).split('');           // "300"
  const rollDigits = String(c.rollTo).split('');           // "3000"
  const fin = f >= finF ? interpolate(f - finF, [0, 14], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)}) : 0;
  // 数字只做平滑滚动 ——① 牌子出现后 0 → lockTo 缓出滚到位，正好停在说到这个数的那一刻
  // ② 说到第二个数时 lockTo → rollTo 18 帧缓入缓出，第 4 位从右侧滑入
  const ROLL = 18;
  let v: number;
  if (f < rollF) v = Math.round(c.lockTo * Easing.out(Easing.cubic)(Math.min(1, Math.max(0, (f - s0) / Math.max(1, lockF - s0)))));
  else v = Math.round(c.lockTo + (c.rollTo - c.lockTo) * Easing.inOut(Easing.cubic)(Math.min(1, (f - rollF) / ROLL)));
  const nSlots = f < rollF ? lockDigits.length : rollDigits.length;
  const str = String(v).padStart(nSlots, ' ');
  const slideK = f >= rollF ? Easing.out(Easing.cubic)(Math.min(1, (f - rollF) / ROLL)) : 1;
  const digits: {ch: string; scale: number; op: number; dx: number; w: number}[] = str.split('').map((ch, i) => {
    const newSlot = f >= rollF && i === 0;   // 第 4 位：宽度跟着滑入进度展开，牌子不会一下变宽
    return {ch: ch === ' ' ? '' : ch, scale: 1, op: newSlot ? slideK : 1, dx: newSlot ? 60 * (1 - slideK) : 0, w: newSlot ? 112 * slideK : 112};
  });
  const lockedAll = f >= lockF;
  // 锁住 / 滚到位时整牌轻轻一鼓（正弦起落，不弹不抖）
  const bump = (at: number, len: number, amp: number) => (f >= at && f < at + len ? 1 + amp * Math.sin((Math.PI * (f - at)) / len) : 1);
  const kick = bump(lockF, 14, 0.05) * bump(rollF + ROLL - 4, 16, 0.07);
  const kick2 = 1;
  const breathe = live && lockedAll ? 1 + 0.01 * Math.sin(f / 9) : 1;
  const glow = fin > 0 ? 30 + 16 * Math.abs(Math.sin(f / 12)) : (lockedAll ? 20 + 6 * Math.abs(Math.sin(f / 10)) : 12);
  // 收尾：深墨牌淡出上移，原地淡入一枚独立金章（和其他金章同一套样式）
  const ink = GOLD_LITE;
  const plateOp = 1 - fin;
  const sE = f >= finF + 4 ? spring({frame: f - finF - 4, fps, config: {damping: 20, stiffness: 130, mass: 1}}) : 0;
  const sweep = interpolate(f - finF, [8, 30], [-30, 130], {...CL, easing: Easing.inOut(Easing.ease)});
  const sx = c.finaleX ?? c.x;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out, fontFamily: FONT, pointerEvents: 'none'}}>
      {f >= rollF + ROLL - 4 ? <Ring f={f} at={rollF + ROLL - 4} x={c.x} y={c.y} size={620} /> : null}
      {f >= finF + 6 ? <Ring f={f} at={finF + 6} x={sx} y={c.finaleY} size={560} /> : null}
      {plateOp > 0.01 ? (
        <div style={{position: 'absolute', left: c.x, top: c.y - 30 * fin, translate: '-50% -50%', whiteSpace: 'nowrap',
                     opacity: Math.min(1, enter * 1.5) * plateOp,
                     transform: `scale(${(0.85 + 0.15 * enter) * kick * breathe * (1 - 0.06 * fin)}) rotate(${(1 - enter) * -3}deg)`,
                     background: 'rgba(12,13,17,0.9)', border: `3px solid ${GOLD}`, borderRadius: 20, padding: '14px 40px 18px',
                     boxShadow: `0 18px 50px rgba(0,0,0,0.55), 0 0 ${glow}px rgba(201,162,74,0.6)`}}>
          <span style={{position: 'absolute', inset: 0, borderRadius: 20, background: '#fff', opacity: interpolate(f - s0, [0, 12], [0.35, 0], CL)}} />
          <div style={{fontSize: 44, fontWeight: 800, letterSpacing: 6, color: GOLD, marginBottom: 2}}>{c.label}</div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 6}}>
            {(c.prefix ?? '¥') ? <span style={{fontSize: 104, fontWeight: 900, color: ink}}>{c.prefix ?? '¥'}</span> : null}
            {digits.map((d, i) => (
              <span key={i} style={{display: 'inline-block', width: d.w, overflow: 'visible', textAlign: 'center', fontSize: 180, fontWeight: 900, color: ink,
                                    opacity: d.op, transform: `translateX(${d.dx}px) scale(${d.scale})`, fontVariantNumeric: 'tabular-nums'}}>{d.ch}</span>
            ))}
            {c.suffix ? <span style={{fontSize: 96, fontWeight: 900, color: ink, marginLeft: 10}}>{c.suffix}</span> : null}
          </div>
        </div>
      ) : null}
      {sE > 0 ? (
        <div style={{position: 'absolute', left: sx, top: c.finaleY, translate: '-50% -50%', whiteSpace: 'nowrap',
                     opacity: Math.min(1, sE * 1.6),
                     transform: `rotate(-3deg) scale(${(1.12 - 0.12 * Math.min(1, sE)) * kick2 * (live ? 1 + 0.008 * Math.sin(f / 10) : 1)})`}}>
          <div style={{position: 'relative', overflow: 'hidden', borderRadius: 22, border: '6px solid #fdfbf4',
                       background: 'linear-gradient(135deg, #f6e4ae 0%, #e2c677 45%, #c9a24a 100%)',
                       boxShadow: `10px 12px 0 rgba(20,15,5,0.42), 0 0 ${glow}px rgba(240,200,96,0.7)`,
                       padding: '14px 34px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
            {/* 内描线：让它像一枚章，而不是一块按钮 */}
            <span style={{position: 'absolute', inset: 7, borderRadius: 14, border: '2px solid rgba(23,19,10,0.32)'}} />
            {f - finF < 32 ? (
              <span style={{position: 'absolute', top: -60, bottom: -60, left: `${sweep}%`, width: 110,
                            background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.8), transparent)', transform: 'skewX(-16deg)'}} />
            ) : null}
            <span style={{position: 'relative', background: '#17130a', color: '#f3dea0', fontWeight: 800,
                          letterSpacing: 8, padding: '3px 12px 3px 20px', borderRadius: 999, fontSize: 28}}>{c.label}</span>
            <span style={{position: 'relative', display: 'flex', alignItems: 'baseline', color: '#17130a', fontWeight: 900,
                          fontVariantNumeric: 'tabular-nums', letterSpacing: -1}}>
              <span style={{fontSize: 46, marginRight: 4}}>¥</span>
              <span style={{fontSize: 88}}>{c.lockTo}</span>
              <span style={{fontSize: 60, margin: '0 12px', color: 'rgba(23,19,10,0.62)', transform: 'translateY(-8px)'}}>–</span>
              <span style={{fontSize: 88}}>{c.rollTo}</span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

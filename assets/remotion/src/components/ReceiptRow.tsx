import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill, Easing} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 票据排（脑图板 variant="receipts"）：三张真账单并排，金额从 0 滚到位，下面一行标签。
 * 节点用 SHOT()：cap 写成「金额|标签」，例如 "-99.00|会员费"。最后一张正数会描金。
 * 开头用它替掉纯文字标题（图片 + 数字动效）。
 */
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const F = (s: number) => Math.round(s * T.FPS);
const XS = [430, 1010, 1590];

export const ReceiptRow: React.FC<{group: any; io: number; live?: boolean}> = ({group, io, live = false}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t0 = F(group.fin[0]);
  const shots = (group.nodes as any[]).filter((n) => n.kind === 'shot');
  const hero = (group.nodes as any[]).find((n) => n.kind === 'hero');
  const rf = (n: any) => F(n.rf) - t0;
  const eH = hero && f >= rf(hero) ? spring({frame: f - rf(hero), fps, config: {damping: 13, stiffness: 150}}) : 0;

  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
      {hero && eH > 0 ? (
        <div style={{position: 'absolute', left: '50%', top: 74 + (1 - eH) * 16, translate: '-50%',
                     opacity: Math.min(1, eH * 1.5), fontSize: 50, fontWeight: 800, color: '#f3ede0',
                     letterSpacing: 4, whiteSpace: 'nowrap', textShadow: '0 3px 14px rgba(0,0,0,0.85)'}}>
          {hero.label}
          <div style={{height: 4, marginTop: 10, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`}} />
        </div>
      ) : null}

      {/* 三张都落位后砸下金章：开场的招牌一下 */}
      {(() => {
        if (!hero?.sub || !shots.length) return null;
        const at = Math.max(...shots.map(rf)) + 14;
        const e = f >= at ? spring({frame: f - at, fps, config: {damping: 9, stiffness: 210, mass: 0.7}}) : 0;
        if (e <= 0.001) return null;
        return (
          <div style={{position: 'absolute', left: '50%', top: 792, translate: '-50%', whiteSpace: 'nowrap',
                       background: 'linear-gradient(135deg, #e6cf92, #c9a24a)', color: '#17130a',
                       fontSize: 54, fontWeight: 900, letterSpacing: 6, padding: '14px 44px', borderRadius: 16,
                       border: '5px solid #fdfbf4', boxShadow: '8px 10px 0 rgba(20,15,5,0.42)',
                       transform: `rotate(-5deg) scale(${1.9 - 0.9 * Math.min(1, e)})`,
                       opacity: Math.min(1, e * 1.8)}}>
            {hero.sub}
          </div>
        );
      })()}

      {shots.slice(0, 3).map((n, i) => {
        const at = rf(n);
        const e = f >= at ? spring({frame: f - at, fps, config: {damping: 13, stiffness: 140, mass: 0.85}}) : 0;
        if (e <= 0.001) return null;
        const [amt, tag] = String(n.label || '').split('|');
        const neg = amt.trim().startsWith('-') || amt.trim().startsWith('−');
        const val = parseFloat(amt.replace(/[^\d.]/g, '')) || 0;
        const k = interpolate(f - at, [4, 30], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
        const shown = (val * k).toFixed(2);
        const w = n.w ?? 330;
        const h = Math.round(w / (n.ar || 1.07));
        const flash = interpolate(f - at, [0, 3, 10], [0.85, 0.5, 0], CL);
        return (
          <div key={n.id} style={{position: 'absolute', left: XS[i], top: 455, translate: '-50% -50%',
                                  opacity: Math.min(1, e * 1.5),
                                  transform: `translateY(${(1 - e) * 40}px) rotate(${(1 - e) * (i - 1) * 5}deg) scale(${0.85 + 0.15 * e})`}}>
            <div style={{position: 'relative', background: '#fff', border: `3px solid ${GOLD}`, borderRadius: 18,
                         overflow: 'hidden', boxShadow: '0 22px 55px rgba(0,0,0,0.6), 0 0 28px rgba(201,162,74,0.22)'}}>
              <Img src={staticFile(n.src)} style={{width: w, height: h, objectFit: 'cover', objectPosition: 'top', display: 'block'}} />
              <span style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash}} />
              {live ? (
                <span style={{position: 'absolute', top: -30, bottom: -30,
                              left: `${interpolate(f - at, [10, 34], [-40, 140], CL)}%`, width: 110,
                              background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.55), transparent)',
                              transform: 'skewX(-16deg)'}} />
              ) : null}
            </div>
            {/* 金额：从 0 滚到位 */}
            <div style={{marginTop: 14, textAlign: 'center', fontSize: 58, fontWeight: 900, letterSpacing: 1,
                         color: neg ? '#efe8d7' : GOLD_LITE, textShadow: '0 3px 14px rgba(0,0,0,0.9)'}}>
              {neg ? '−' : '+'}{shown}
            </div>
            <div style={{marginTop: 2, textAlign: 'center', fontSize: 26, fontWeight: 700, letterSpacing: 2,
                         color: neg ? 'rgba(239,232,215,0.7)' : GOLD, textShadow: '0 2px 8px rgba(0,0,0,0.9)'}}>
              {tag}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

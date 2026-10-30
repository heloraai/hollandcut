import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 平台 logo 卡（脑图板 variant="logos" / "clash"）：提到某个平台时，真 logo + 名字飞进来。
 * 节点用 SHOT()：src = logos/xxx.png，cap = 「名字|一句话」。
 * clash：卡片之间画红 ✕ ——「自营互不通」。
 */
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const F = (s: number) => Math.round(s * T.FPS);

export const LogoCards: React.FC<{group: any; io: number; live?: boolean; clash?: boolean}> =
({group, io, live = false, clash = false}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t0 = F(group.fin[0]);
  const shots = (group.nodes as any[]).filter((n) => n.kind === 'shot');
  const hero = (group.nodes as any[]).find((n) => n.kind === 'hero');
  const notes = (group.nodes as any[]).filter((n) => n.kind !== 'shot' && n.kind !== 'hero');
  const rf = (n: any) => F(n.rf) - t0;
  const n = Math.max(1, shots.length);
  const span = clash ? 900 : Math.min(900, n * 400);   // 最右卡收在 x≤1660，避开抖音横屏右侧按钮列
  const x0 = 1020 - span / 2;
  const xs = shots.map((_, i) => (n === 1 ? 1020 : x0 + (span * i) / (n - 1)));
  const eH = hero && f >= rf(hero) ? spring({frame: f - rf(hero), fps, config: {damping: 13, stiffness: 150}}) : 0;

  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
      {hero && eH > 0 ? (
        <div style={{position: 'absolute', left: 1020, top: 130 + (1 - eH) * 16, translate: '-50%',
                     opacity: Math.min(1, eH * 1.5), fontSize: 50, fontWeight: 800, color: '#f3ede0',
                     letterSpacing: 4, whiteSpace: 'nowrap', textShadow: '0 3px 14px rgba(0,0,0,0.85)'}}>
          {hero.label}
          <div style={{height: 4, marginTop: 10, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`}} />
        </div>
      ) : null}

      {/* 卡片之间的红 ✕ */}
      {clash
        ? shots.slice(0, -1).map((s, i) => {
            const at = Math.max(rf(shots[i]), rf(shots[i + 1]));
            const e = f >= at ? spring({frame: f - at, fps, config: {damping: 9, stiffness: 200, mass: 0.7}}) : 0;
            if (e <= 0.001) return null;
            return (
              <div key={'x' + i} style={{position: 'absolute', left: (xs[i] + xs[i + 1]) / 2, top: 470, translate: '-50% -50%',
                                         fontSize: 78, fontWeight: 900, color: '#d04a3b', opacity: Math.min(1, e * 1.6),
                                         transform: `rotate(${(1 - e) * 60}deg) scale(${0.5 + 0.5 * e})`,
                                         textShadow: '0 4px 16px rgba(0,0,0,0.85)'}}>✕</div>
            );
          })
        : null}

      {shots.map((s, i) => {
        const at = rf(s);
        const e = f >= at ? spring({frame: f - at, fps, config: {damping: 14, stiffness: 260, mass: 0.65}}) : 0;   // ≈10 帧落定
        if (e <= 0.001) return null;
        const [name, sub] = String(s.label || '').split('|');
        const idle = live ? 3 * Math.sin((f + i * 20) / 26) : 0;
        return (
          <div key={s.id} style={{position: 'absolute', left: xs[i], top: 470 + idle, translate: '-50% -50%',
                                  opacity: Math.min(1, e * 1.5),
                                  transform: `translateY(${(1 - e) * 46}px) scale(${0.8 + 0.2 * e})`}}>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                         background: 'rgba(14,15,20,0.92)', border: `2.8px solid ${GOLD}`, borderRadius: 26,
                         padding: '30px 34px 24px', minWidth: 250,
                         boxShadow: '0 22px 55px rgba(0,0,0,0.6), 0 0 30px rgba(201,162,74,0.22)'}}>
              <div style={{width: 96 * Math.min(2.8, Math.max(1, s.ar || 1)), height: 96, borderRadius: 22,
                           overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center',
                           justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.5)'}}>
                <Img src={staticFile(s.src)} style={{width: '100%', height: 96, objectFit: 'contain'}} />
              </div>
              <div style={{fontSize: 38, fontWeight: 800, color: GOLD_LITE, letterSpacing: 1.5, whiteSpace: 'nowrap'}}>{name}</div>
              {sub ? <div style={{fontSize: 24, color: 'rgba(239,232,215,0.75)', whiteSpace: 'nowrap'}}>{sub}</div> : null}
            </div>
          </div>
        );
      })}

      {/* 下方补充词条 */}
      {notes.map((nd: any, i: number) => {
        const at = rf(nd);
        const e = f >= at ? spring({frame: f - at, fps, config: {damping: 12, stiffness: 180, mass: 0.75}}) : 0;
        if (e <= 0.001) return null;
        return (
          <div key={nd.id} style={{position: 'absolute', left: 1020, top: 700 + i * 84, translate: '-50%',
                                   opacity: Math.min(1, e * 1.5), transform: `translateY(${(1 - e) * 20}px)`,
                                   background: nd.conclusion ? 'linear-gradient(135deg, #e6cf92, #c9a24a)' : '#fdfbf4',
                                   color: '#17130a', border: `2.4px solid ${GOLD}`, borderRadius: 999,
                                   padding: '12px 34px', fontSize: 34, fontWeight: 800, letterSpacing: 1.5,
                                   whiteSpace: 'nowrap', boxShadow: '4px 5px 0 rgba(20,15,5,0.45)'}}>
            {nd.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

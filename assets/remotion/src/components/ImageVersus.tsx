import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, GOLD, FONT} from '../theme';
import {PaperSweep} from './Ambient';

/**
 * 全屏图片对比（脑图板 variant="versus"）：米白纸面 + 中轴金线 + VS；
 * 两个 SHOT 节点各一张图卡从两侧 3D 倾斜入场，图下药丸写「主标签|小字」（用 | 分开）。节点 r = 标题。
 */
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const COLS = [500, 1420];
const IMG_TOP = 250;

export const ImageVersus: React.FC<{group: any; io: number; live?: boolean}> = ({group, io, live = false}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const F = (s: number) => Math.round(s * T.FPS);
  const t0 = F(group.fin[0]);
  const title = group.nodes.find((n: any) => n.id === 'r');
  const shots = group.nodes.filter((n: any) => n.kind === 'shot').slice(0, 2);
  const eR = title ? spring({frame: f - (F(title.rf) - t0), fps, config: {damping: 13, stiffness: 140, mass: 0.9}}) : 0;
  const line = title ? interpolate(f - (F(title.rf) - t0), [6, 34], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)}) : 0;
  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
      <AbsoluteFill style={{background: '#f6f0e1'}} />
      <AbsoluteFill style={{background: 'radial-gradient(120% 90% at 22% 10%, rgba(201,162,74,0.10) 0%, rgba(0,0,0,0) 55%)'}} />
      {live ? <PaperSweep io={io} /> : null}
      {title && f >= F(title.rf) - t0 ? (
        <div style={{position: 'absolute', left: '50%', top: 92 + (1 - eR) * 18, translate: '-50%', opacity: Math.min(1, eR * 1.5), fontSize: 50, fontWeight: 800, color: T.ink, letterSpacing: 3, whiteSpace: 'nowrap'}}>
          {title.label}
          <div style={{height: 4, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: 12}} />
        </div>
      ) : null}
      <div style={{position: 'absolute', left: '50%', top: 196, width: 3, height: 700 * line, background: `linear-gradient(180deg, ${GOLD}, rgba(201,162,74,0.25))`, borderRadius: 2}} />
      <div
        style={{
          position: 'absolute', left: '50%', top: 450, translate: '-50% -50%', width: 86, height: 86, borderRadius: '50%', background: '#f6f0e1',
          border: `2.6px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: T.goldDeep, opacity: line,
        }}
      >
        VS
      </div>
      {shots.map((s: any, i: number) => {
        const at = F(s.rf) - t0;
        if (f < at) return null;
        const e = spring({frame: f - at, fps, config: {damping: 14, stiffness: 110, mass: 0.9}});
        const flash = interpolate(f - at, [0, 3, 9], [0.9, 0.7, 0], CL);
        const side = i === 0 ? -1 : 1;
        const w = s.w ?? 700;
        const h = Math.round(w / (s.ar ?? 16 / 9));
        const [main, sub] = String(s.label ?? '').split('|');
        const push = live ? interpolate(f - at, [0, 300], [1, 1.05], CL) : 1;
        return (
          <div key={s.id} style={{position: 'absolute', left: COLS[i], top: IMG_TOP + (1 - e) * 30, translate: '-50%', opacity: Math.min(1, e * 1.4), textAlign: 'center'}}>
            <div
              style={{
                position: 'relative', width: w, height: h, borderRadius: 22, overflow: 'hidden', border: `3px solid ${GOLD}`,
                boxShadow: '0 22px 50px rgba(20,15,5,0.3)', transform: `perspective(1300px) rotateY(${(1 - e) * 14 * side}deg) scale(${0.9 + 0.1 * e})`,
              }}
            >
              <Img src={staticFile(s.src)} style={{width: w, height: h, objectFit: 'cover', transform: `scale(${push})`}} />
              <span style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash}} />
            </div>
            <div
              style={{
                display: 'inline-block', marginTop: 26, background: i === 0 ? T.goldDeep : '#8a8676', color: '#fdfbf4', fontSize: 40, fontWeight: 800,
                letterSpacing: 3, padding: '12px 40px', borderRadius: 999, boxShadow: '0 12px 30px rgba(20,15,5,0.22)',
                transform: `scale(${0.8 + 0.2 * spring({frame: f - at - 8, fps, config: {damping: 10, stiffness: 200, mass: 0.7}})})`,
              }}
            >
              {main}
            </div>
            {sub ? <div style={{marginTop: 12, fontSize: 26, fontWeight: 700, color: '#6f6a5e', letterSpacing: 1}}>{sub}</div> : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

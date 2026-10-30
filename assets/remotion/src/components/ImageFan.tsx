import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {T, GOLD} from '../theme';

/**
 * 三卡扇形发牌：人物左侧依次飞入、落成扇形（中间一张最上）；lift 时第一张抬到最前、微推近，
 * 其余两张压暗——用来交接到紧接着的录屏。人物保持全屏。
 */
export type FanSpec = {start: number; end: number; images: string[]; lift?: number | null; w?: number};

const FR = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const CX = 450;   // 最左那张不出画
const CY = 445;
const POS = [
  {dx: -80, dy: 44, rot: -8},
  {dx: 0, dy: -8, rot: 0},
  {dx: 80, dy: 54, rot: 8},
];

const Fan: React.FC<{s: FanSpec}> = ({s}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t0 = FR(s.start);
  const t1 = FR(s.end);
  const W = s.w ?? 500;
  const out = interpolate(f, [t1, t1 + 8], [1, 0], CL);
  const liftAt = s.lift != null ? FR(s.lift) : t1 - 14;
  const le = f >= liftAt ? spring({frame: f - liftAt, fps, config: {damping: 16, stiffness: 120}}) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out}}>
      {s.images.map((src, i) => {
        const at = t0 + i * 7;
        const e = f >= at ? spring({frame: f - at, fps, config: {damping: 13, stiffness: 150, mass: 0.9}}) : 0;
        const p = POS[i % 3];
        const L = i === 0 ? le : 0;
        const flash = interpolate(f - at, [0, 2, 8], [0.9, 0.7, 0], CL);
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: CX + p.dx * (1 - L), top: CY + p.dy * (1 - L) - 30 * L, translate: '-50% -50%',
              zIndex: i === 0 && le > 0.05 ? 10 : i === 1 ? 5 : 3,
              opacity: Math.min(1, e * 1.5) * (i === 0 ? 1 : 1 - 0.55 * le),
              transform: `translateX(${-(1 - e) * 520}px) rotate(${p.rot * (1 - L) - (1 - e) * 18}deg) scale(${(0.9 + 0.1 * e) * (1 + 0.14 * L)})`,
            }}
          >
            <div
              style={{
                position: 'relative', background: '#fff', border: `3px solid ${GOLD}`, borderRadius: 18, overflow: 'hidden',
                boxShadow: 'none',
              }}
            >
              <Img src={staticFile(src)} style={{width: W, display: 'block'}} />
              <span style={{position: 'absolute', inset: 0, background: '#fff', opacity: f >= at ? flash : 0}} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ImageFans: React.FC<{fans: FanSpec[]}> = ({fans}) => {
  const f = useCurrentFrame();
  const cur = fans.find((s) => f >= FR(s.start) && f <= FR(s.end) + 8);
  return cur ? <Fan key={cur.start} s={cur} /> : null;
};

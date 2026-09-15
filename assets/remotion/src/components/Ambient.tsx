import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

const FR = (s: number) => Math.round(s * T.FPS);
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** max：金色微粒，只在隐人（磨砂背景）段可见，缓慢上浮 + 闪烁。确定性伪随机（渲染可复现），不用 Math.random。 */
export const GoldDust: React.FC<{cover: number}> = ({cover}) => {
  const f = useCurrentFrame();
  if (cover <= 0.02) return null;
  const rnd = (i: number, k: number) => {
    const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return (
    <svg style={{position: 'absolute', inset: 0}} width={T.W} height={T.H}>
      {Array.from({length: 42}, (_, i) => {
        const speed = 0.25 + rnd(i, 1) * 0.5;
        const x = rnd(i, 2) * T.W + Math.sin(f / 90 + i * 2.1) * 26;
        const y = (((rnd(i, 3) * T.H - f * speed) % (T.H + 60)) + T.H + 60) % (T.H + 60) - 30;
        const r = 1.4 + rnd(i, 4) * 2.4;
        const tw = 0.5 + 0.5 * Math.sin(f / 14 + i * 1.7);
        return <circle key={i} cx={x} cy={y} r={r} fill={i % 3 ? GOLD : GOLD_LITE} opacity={cover * (0.08 + 0.22 * tw)} />;
      })}
    </svg>
  );
};

/** max：接管板纸面上的慢速斜向光带 */
export const PaperSweep: React.FC<{io: number}> = ({io}) => {
  const f = useCurrentFrame();
  const x = ((f * 0.55) % 260) - 60;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: io}}>
      <div
        style={{
          position: 'absolute', top: -100, bottom: -100, left: `${x - 20}%`, width: '34%',
          background: 'linear-gradient(105deg, transparent, rgba(201,162,74,0.05) 40%, rgba(255,255,255,0.07) 50%, rgba(201,162,74,0.05) 60%, transparent)',
          transform: 'skewX(-16deg)',
        }}
      />
    </div>
  );
};

/** max 招牌时刻 · 结尾 CTA 卡：右侧金框卡，名字 + 标语 + 章，打字机滚出链接。参数来自 structure.py 的 endcard(...) */
export type EndCardSpec = {name: string; tagline: string; url?: string; badge?: string; start: number; end: number};

export const EndCard: React.FC<{c: EndCardSpec}> = ({c}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tIn = FR(c.start);
  const tOut = FR(c.end);
  if (f < tIn || f > tOut + 8) return null;
  const e = spring({frame: f - tIn, fps, config: {damping: 13, stiffness: 120, mass: 0.9}});
  const out = interpolate(f, [tOut, tOut + 7], [1, 0], CLAMP);
  const url = c.url ?? '';
  const typed = Math.min(url.length, Math.max(0, Math.floor((f - tIn - 16) * 1.4)));
  const tagE = spring({frame: f - tIn - 10, fps, config: {damping: 11, stiffness: 180, mass: 0.7}});
  const sweep = interpolate(f - tIn, [8, 34], [-30, 130], CLAMP);
  return (
    <div
      style={{
        position: 'absolute', right: 96, top: 300, width: 640, fontFamily: FONT,
        background: 'rgba(12,13,18,0.9)', border: `2.6px solid ${GOLD}`, borderRadius: 26,
        padding: '38px 44px 34px', opacity: Math.min(1, e * 1.4) * out,
        transform: `translateX(${(1 - e) * 90}px) scale(${0.92 + 0.08 * e})`,
        boxShadow: '0 26px 70px rgba(0,0,0,0.7), 0 0 44px rgba(201,162,74,0.28)',
        overflow: 'hidden',
      }}
    >
      <span style={{position: 'absolute', top: 0, bottom: 0, left: `${sweep}%`, width: 90, background: 'linear-gradient(105deg, transparent, rgba(230,207,146,0.16), transparent)', transform: 'skewX(-18deg)', pointerEvents: 'none'}} />
      <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
        <span style={{width: 12, height: 52, background: `linear-gradient(180deg, ${GOLD_LITE}, ${GOLD})`, borderRadius: 4}} />
        <span style={{fontSize: 58, fontWeight: 800, letterSpacing: 3, color: '#f5efe0'}}>{c.name}</span>
        {c.badge ? (
          <span
            style={{
              marginLeft: 'auto', fontSize: 24, fontWeight: 700, color: '#17130a', background: GOLD,
              border: '2px solid #8c6b21', borderRadius: 999, padding: '6px 18px',
              transform: `scale(${0.6 + 0.4 * Math.min(1, Math.max(0, tagE))})`,
            }}
          >
            {c.badge}
          </span>
        ) : null}
      </div>
      <div style={{marginTop: 12, fontSize: 30, fontWeight: 700, letterSpacing: 2, color: GOLD_LITE}}>{c.tagline}</div>
      {url ? (
        <>
          <div style={{height: 2, background: 'linear-gradient(90deg, rgba(201,162,74,0.7), transparent)', margin: '22px 0 18px'}} />
          <div style={{fontFamily: '"SF Mono", Menlo, Consolas, monospace', fontSize: 29, fontWeight: 600, color: '#efe8d7', letterSpacing: 0.5}}>
            <span style={{color: GOLD_LITE}}>$ </span>
            {url.slice(0, typed)}
            <span style={{display: 'inline-block', width: 13, height: 32, background: GOLD_LITE, verticalAlign: -5, opacity: Math.sin(f / 5) > 0 ? 1 : 0}} />
          </div>
        </>
      ) : null}
    </div>
  );
};

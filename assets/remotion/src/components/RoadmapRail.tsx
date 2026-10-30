import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';
import {Icon} from './Icons';
import {BUB} from './Bubble';

/**
 * 路线图竖轨：左侧一列玻璃图标节点（文字在节点右边），金线串起（max 下能量点沿线流动），说到哪格亮哪格，
 * 下一格亮起时上一格打勾；done = 前几格随整轨进场并依次打勾（回扣用）；finale = 收尾金章。人物保持全屏。
 */
export type RailSpec = {
  start: number;
  end: number;
  done: number;
  nodes: {icon: string; label: string; at: number | null; then?: {t: string; at: number; ok: boolean}[]}[];   // 10-26：then = 说到时依次接在标签后面的短牌（优点绿 ✓ / 缺点珊瑚 ✕）
  finale?: {label: string; at: number} | null;
  hide?: [number, number];   // 10-22：这段时间整条淡出（中间插了全屏截图镜头），6 帧出、6 帧回
};

const FR = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const X = 30 + 56;   // 圆点左边线 x=30，和章节标签对齐
const D = 112;

const Rail: React.FC<{r: RailSpec; live: boolean}> = ({r, live}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = r.nodes.length;
  const TOP = 124;   // 10-18：第一个圆点顶边贴 y=124（和气泡同一条线，原来低了 56px）
  const GAP = n >= 4 ? 168 : 190;
  const t0 = FR(r.start);
  const t1 = FR(r.end);
  const alpha = interpolate(f, [t0, t0 + 10], [0, 1], CL) * interpolate(f, [t1, t1 + 10], [1, 0], CL);
  const hid = r.hide ? interpolate(f, [FR(r.hide[0]), FR(r.hide[0]) + 6], [0, 1], CL) * interpolate(f, [FR(r.hide[1]) - 6, FR(r.hide[1])], [1, 0], CL) : 0;
  const ats = r.nodes.map((nd, i) => (i < r.done ? t0 + i * 3 : FR(nd.at ?? r.start + 0.4 * i)));
  const lastOn = ats.reduce((m, a, i) => (f >= a ? i : m), -1);
  const grow = lastOn >= 1 ? Math.min(1, spring({frame: f - ats[lastOn], fps, config: {damping: 20, stiffness: 120}})) : 0;
  const lineH = lastOn <= 0 ? 0 : GAP * (lastOn - 1) + GAP * grow;
  const finAt = r.finale ? FR(r.finale.at) : 1e9;
  const fin = f >= finAt ? spring({frame: f - finAt, fps, config: {damping: 9, stiffness: 200, mass: 0.7}}) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: alpha * (1 - hid), fontFamily: FONT}}>
      <svg style={{position: 'absolute', inset: 0}} width={T.W} height={T.H}>
        <line x1={X} y1={TOP + D / 2} x2={X} y2={TOP + D / 2 + lineH} stroke={GOLD} strokeWidth={4} strokeLinecap="round" opacity={0.85} />
        {live && lineH > 20
          ? [0, 1, 2].map((k) => (
              <circle key={k} cx={X} cy={TOP + D / 2 + ((f * 2.4 + k * (lineH / 3)) % lineH)} r={5} fill={GOLD_LITE} opacity={0.9} />
            ))
          : null}
      </svg>
      {r.nodes.map((nd, i) => {
        const on = f >= ats[i];
        const e = on ? spring({frame: f - ats[i], fps, config: {damping: 11, stiffness: 170, mass: 0.8}}) : 0;
        const flash = interpolate(f - ats[i], [0, 2, 8], [0.9, 0.7, 0], CL);
        // 打勾时刻：done 格进场后依次打勾；其余格在下一格亮起时打勾；最后一格在 finale 时打勾
        const checkAt = i < r.done ? t0 + 10 + i * 6 : i + 1 < n ? ats[i + 1] : finAt;
        const ce = f >= checkAt ? spring({frame: f - checkAt, fps, config: {damping: 9, stiffness: 220, mass: 0.6}}) : 0;
        const active = on && f < checkAt;
        const lit = active || ce > 0;
        const glow = active ? 18 + (live ? 8 * Math.sin(f / 6) : 0) : 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: X - D / 2, top: TOP + i * GAP, width: D, height: D,
              opacity: Math.min(1, e * 1.5), transform: `scale(${0.6 + 0.4 * e})`,
            }}
          >
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(12,13,18,0.86)',
                border: `3px solid ${lit ? GOLD : 'rgba(201,162,74,0.55)'}`,
                boxShadow: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}
            >
              {nd.icon.includes('/') ? <Img src={staticFile(nd.icon)} style={{width: '64%', height: '64%', objectFit: 'contain'}} />   /* 10-26：节点可以放真 logo（路径） */
                : <Icon name={nd.icon} size={54} color={GOLD_LITE} stroke={1.8} />}
              <span style={{position: 'absolute', inset: 0, background: '#fff', opacity: on ? flash : 0}} />
            </div>
            {ce > 0 ? (
              <div
                style={{
                  position: 'absolute', right: -12, top: 0, width: 42, height: 42,   /* 10-18：top 0 —— 第一格贴 y=124 时勾不顶到章节角标 */ borderRadius: '50%', background: GOLD,
                  border: '3px solid #17130a', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${ce})`,
                }}
              >
                <Icon name="check" size={24} color="#17130a" stroke={3.2} />
              </div>
            ) : null}
            {/* 10-18：标签换成和浅色气泡同一套底牌（米白底、墨字、左侧一道金色条、硬投影）—— 原来白字直接压在海报 / 墙上看不清 */}
            <div
              style={{
                position: 'absolute', left: D + 18, top: '50%', translate: '0 -50%', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 12, boxSizing: 'border-box',
                background: BUB.tone.cream.bg, color: BUB.COLOR.INK, border: `${BUB.BORDER}px solid ${BUB.COLOR.EDGE}`, borderRadius: 999,
                padding: '9px 26px 10px 14px', boxShadow: BUB.SHADOW,
                fontSize: 36, fontWeight: 800, letterSpacing: 1.5, opacity: lit ? 1 : 0.8,
              }}
            >
              <span style={{width: 6, height: 34, borderRadius: 3, background: BUB.COLOR.GOLD, flex: 'none'}} />
              {nd.label}
              {(nd.then ?? []).filter((p) => f >= FR(p.at)).map((p) => (   /* 10-26：说到优点 / 缺点时依次接短牌 */
                <span key={p.t} style={{display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 14px 4px', borderRadius: 999,
                                        background: p.ok ? BUB.COLOR.GREEN : BUB.COLOR.CORAL, color: BUB.COLOR.INK, fontSize: 30, fontWeight: 900, transformOrigin: '0% 50%',
                                        transform: `scale(${Math.min(1, spring({frame: f - FR(p.at), fps, config: {damping: 12, stiffness: 220, mass: 0.6}}))})`}}>
                  {p.t} {p.ok ? '✓' : '✕'}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {r.finale && fin > 0 ? (
        <div
          style={{
            position: 'absolute', left: X - D / 2 - 10, top: TOP + (n - 1) * GAP + D + 36, whiteSpace: 'nowrap',
            background: '#F6C453', color: '#15161B', fontSize: 36, fontWeight: 900, letterSpacing: 4,
            padding: '10px 28px', borderRadius: 14,
            transform: `scale(${1.7 - 0.7 * Math.min(1, fin)})`, opacity: Math.min(1, fin * 1.6),
          }}
        >
          {r.finale.label}
        </div>
      ) : null}
    </div>
  );
};

export const RoadmapRails: React.FC<{rails: RailSpec[]; live: boolean}> = ({rails, live}) => {
  const f = useCurrentFrame();
  const cur = rails.find((r) => f >= FR(r.start) && f <= FR(r.end) + 10);
  return cur ? <Rail key={cur.start} r={cur} live={live} /> : null;
};

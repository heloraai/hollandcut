import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 闭环概念图（脑图板 variant="loop"）：钱在生态里绕一圈又回到原点。
 * 四个节点按顺时针落位，弧线一段段画过去，最后一段接上后金色能量点沿环流动，中心落一句结论。
 * 节点约定：r = 中心结论(hero)；a/b/c/d = 环上四站（顺时针，从正上方开始）。
 */
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const F = (s: number) => Math.round(s * T.FPS);
const CX = 1040, CY = 520, R = 330;
const angles = (n: number) => Array.from({length: n}, (_, i) => -90 + (i * 360) / n);
const rad = (d: number) => (d * Math.PI) / 180;
const pos = (d: number, r = R) => [CX + r * Math.cos(rad(d)), CY + r * Math.sin(rad(d))];

export const LoopCycle: React.FC<{group: any; io: number; live?: boolean}> = ({group, io, live = false}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t0 = F(group.fin[0]);
  const node = (id: string) => group.nodes.find((n: any) => n.id === id);
  const rf = (id: string) => (node(id) ? F(node(id).rf) - t0 : 1e9);
  const ids = ['a', 'b', 'c', 'd', 'e'].filter((i) => node(i));
  const ANG = angles(Math.max(1, ids.length));
  const C = 2 * Math.PI * R;

  // 每段弧：从第 i 个节点出现起画到第 i+1 个节点（最后一段回到起点）
  const segP = ids.map((id, i) => {
    const at = rf(id) + 4;
    return interpolate(f, [at, at + 16], [0, 1], CL);
  });
  const drawn = segP.reduce((a, b) => a + b, 0) / Math.max(1, ids.length);
  const closed = drawn > 0.995;
  const eR = f >= rf('r') ? spring({frame: f - rf('r'), fps, config: {damping: 13, stiffness: 150}}) : 0;
  const dotA = -90 + ((f * 1.6) % 360);
  const [dx, dy] = pos(dotA);

  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
      <svg style={{position: 'absolute', inset: 0}} width={T.W} height={T.H}>
        {/* 底环 */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(201,162,74,0.16)" strokeWidth={10} />
        {/* 逐段画出的金环 */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={GOLD} strokeWidth={7} strokeLinecap="round"
                strokeDasharray={`${C * drawn} ${C}`} transform={`rotate(-90 ${CX} ${CY})`} />
        {/* 段中点箭头 */}
        {ids.map((id, i) => {
          if (segP[i] < 0.55) return null;
          const a = ANG[i] + 180 / Math.max(1, ids.length);
          const [ax, ay] = pos(a);
          return (
            <polygon key={'ar' + i} points="0,-13 22,0 0,13" fill={GOLD}
                     transform={`translate(${ax} ${ay}) rotate(${a + 90})`} opacity={Math.min(1, (segP[i] - 0.55) * 4)} />
          );
        })}
        {/* 闭环后的能量点 */}
        {closed && live ? (
          <>
            <circle cx={dx} cy={dy} r={19} fill="rgba(230,207,146,0.35)" />
            <circle cx={dx} cy={dy} r={9} fill={GOLD_LITE} />
          </>
        ) : null}
      </svg>

      {/* 四站 */}
      {ids.map((id, i) => {
        const n = node(id);
        const at = rf(id);
        const e = f >= at ? spring({frame: f - at, fps, config: {damping: 12, stiffness: 165, mass: 0.8}}) : 0;
        if (e <= 0.001) return null;
        const [x, y] = pos(ANG[i]);
        return (
          <div key={id} style={{position: 'absolute', left: x, top: y, translate: '-50% -50%',
                                opacity: Math.min(1, e * 1.5), transform: `scale(${0.7 + 0.3 * e})`}}>
            <div style={{background: '#fdfbf4', border: `3px solid ${GOLD}`, borderRadius: 999, padding: '14px 30px',
                         whiteSpace: 'nowrap', boxShadow: '5px 6px 0 rgba(20,15,5,0.4), 0 0 26px rgba(201,162,74,0.25)',
                         fontSize: 36, fontWeight: 800, color: '#17130a', letterSpacing: 1.5}}>
              {n.label}
            </div>
            {n.sub ? (
              <div style={{marginTop: 7, textAlign: 'center', fontSize: 23, color: 'rgba(239,232,215,0.8)',
                           textShadow: '0 2px 8px rgba(0,0,0,0.9)'}}>{n.sub}</div>
            ) : null}
          </div>
        );
      })}

      {/* 中心结论 */}
      {eR > 0 ? (
        <div style={{position: 'absolute', left: CX, top: CY, translate: '-50% -50%', textAlign: 'center',
                     opacity: Math.min(1, eR * 1.5), transform: `scale(${0.85 + 0.15 * eR})`}}>
          <div style={{fontSize: 40, fontWeight: 900, color: GOLD_LITE, letterSpacing: 3, whiteSpace: 'nowrap',
                       textShadow: '0 4px 16px rgba(0,0,0,0.9)'}}>
            {node('r')?.label}
          </div>
          {node('r')?.sub ? (
            <div style={{marginTop: 10, fontSize: 26, color: '#efe8d7', letterSpacing: 1.5, whiteSpace: 'nowrap',
                         textShadow: '0 2px 10px rgba(0,0,0,0.9)'}}>{node('r')?.sub}</div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing, AbsoluteFill} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 差距演示（脑图板 variant="gap"）：两根「出片效果」条——懂行的长、不懂行的短，中间拉出差距箭头；
 * 讲到「平台帮新手」时，短条一口气长到和长条齐平，差距箭头收掉，打勾。
 * 节点：r 标题 / a 长条（懂行）/ b 短条（不懂行）/ c 差距标签 / d 补齐后的短条标签
 */
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const F = (s: number) => Math.round(s * T.FPS);
const X0 = 470, TRACK = 1180, BH = 78;
const YA = 380, YB = 640;
const PA = 0.92, PB = 0.24, PB2 = 0.88;

export const GapBars: React.FC<{group: any; io: number; live?: boolean}> = ({group, io, live = false}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t0 = F(group.fin[0]);
  const node = (id: string) => group.nodes.find((n: any) => n.id === id);
  const rf = (id: string) => (node(id) ? F(node(id).rf) - t0 : 1e9);
  const sp = (at: number, cfg = {damping: 14, stiffness: 120, mass: 0.9}) => (f >= at ? spring({frame: f - at, fps, config: cfg}) : 0);

  const eR = sp(rf('r'));
  const eA = sp(rf('a'));
  const eB = sp(rf('b'));
  const eC = sp(rf('c'), {damping: 11, stiffness: 170, mass: 0.8});
  const eD = sp(rf('d'), {damping: 13, stiffness: 90, mass: 1});
  const wA = TRACK * PA * eA;
  const pb = PB * eB + (PB2 - PB) * eD;
  const wB = TRACK * pb;
  const gapShow = Math.min(eC, 1 - eD);
  const bGold = eD > 0.05;
  const checkE = sp(rf('d') + 14, {damping: 9, stiffness: 220, mass: 0.6});
  const pulse = live ? 0.5 + 0.5 * Math.sin(f / 6) : 1;

  const Bar: React.FC<{y: number; w: number; label: string; gold: boolean; e: number}> = ({y, w, label, gold, e}) => (
    <>
      <div style={{position: 'absolute', left: X0, top: y - 58, fontSize: 40, fontWeight: 800, letterSpacing: 2,
                   color: gold ? GOLD_LITE : '#c9c3b4', opacity: Math.min(1, e * 1.6), whiteSpace: 'nowrap'}}>{label}</div>
      <div style={{position: 'absolute', left: X0, top: y, width: TRACK, height: BH, borderRadius: BH / 2,
                   background: 'rgba(255,255,255,0.07)', border: '2px solid rgba(201,162,74,0.28)'}} />
      <div style={{position: 'absolute', left: X0, top: y, width: Math.max(0, w), height: BH, borderRadius: BH / 2,
                   background: gold ? 'linear-gradient(90deg, #a8842f, #e6cf92)' : 'linear-gradient(90deg, #5a574f, #8a8676)',
                   boxShadow: gold ? `0 0 ${18 + 10 * pulse}px rgba(230,207,146,0.55)` : 'none'}} />
    </>
  );

  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
      {eR > 0 ? (
        <div style={{position: 'absolute', left: '50%', top: 110 + (1 - eR) * 16, translate: '-50%', opacity: Math.min(1, eR * 1.5),
                     textAlign: 'center', whiteSpace: 'nowrap'}}>
          <div style={{fontSize: 58, fontWeight: 900, color: '#f3ede0', letterSpacing: 4, textShadow: '0 3px 14px rgba(0,0,0,0.8)'}}>{node('r')?.label}</div>
          <div style={{marginTop: 10, fontSize: 28, color: 'rgba(239,232,215,0.7)', letterSpacing: 3}}>同一个模型 · 出片效果</div>
        </div>
      ) : null}

      {eA > 0 ? <Bar y={YA} w={wA} label={node('a')?.label ?? ''} gold e={eA} /> : null}
      {eB > 0 ? <Bar y={YB} w={wB} label={bGold ? (node('d')?.label ?? '') : (node('b')?.label ?? '')} gold={bGold} e={eB} /> : null}

      {/* 差距箭头：从短条尾巴到长条尾巴，夹在两根条中间 */}
      {gapShow > 0.01 ? (() => {
        const x1 = X0 + TRACK * PB, x2 = X0 + TRACK * PA, y = (YA + BH + YB) / 2;
        const draw = interpolate(f - rf('c'), [0, 12], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
        const xe = x1 + (x2 - x1) * draw;
        return (
          <>
            <svg style={{position: 'absolute', inset: 0}} width={T.W} height={T.H} opacity={gapShow}>
              <line x1={x1} y1={y} x2={xe} y2={y} stroke="#e0331c" strokeWidth={5} strokeDasharray="14 10" />
              <line x1={x1} y1={YB - 8} x2={x1} y2={YA + BH + 8} stroke="rgba(224,51,28,0.55)" strokeWidth={3} />
              <line x1={x2} y1={YB - 8} x2={x2} y2={YA + BH + 8} stroke="rgba(224,51,28,0.55)" strokeWidth={3} />
              {draw > 0.95 ? <polygon points={`${x2},${y} ${x2 - 22},${y - 13} ${x2 - 22},${y + 13}`} fill="#e0331c" /> : null}
              <polygon points={`${x1},${y} ${x1 + 22},${y - 13} ${x1 + 22},${y + 13}`} fill="#e0331c" />
            </svg>
            <div style={{position: 'absolute', left: (x1 + x2) / 2, top: y, translate: '-50% -50%', whiteSpace: 'nowrap',
                         background: '#e0331c', color: '#fff4ef', fontSize: 42, fontWeight: 900, letterSpacing: 6,
                         padding: '8px 30px', borderRadius: 14, border: '4px solid #fdfbf4', opacity: gapShow,
                         boxShadow: '6px 7px 0 rgba(0,0,0,0.45)',
                         transform: `rotate(-3deg) scale(${1.6 - 0.6 * Math.min(1, eC)})`}}>
              {node('c')?.label}
            </div>
          </>
        );
      })() : null}

      {checkE > 0 ? (
        <div style={{position: 'absolute', left: X0 + TRACK * PB2 + 30, top: YB + BH / 2, translate: '0 -50%',
                     width: 76, height: 76, borderRadius: '50%', background: GOLD, border: '4px solid #fdfbf4',
                     display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 900, color: '#17130a',
                     transform: `scale(${checkE})`, boxShadow: '4px 5px 0 rgba(0,0,0,0.4)'}}>✓</div>
      ) : null}
    </AbsoluteFill>
  );
};

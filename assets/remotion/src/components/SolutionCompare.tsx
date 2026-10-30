import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, GOLD, FONT} from '../theme';
import {Icon} from './Icons';
import {PaperSweep} from './Ambient';

/**
 * 全屏纯图标对比（脑图板 variant="solution"）：同一个任务卡——
 * 左「原本」：方案卡扇开（b）→ 互相连线比较、左边 token 条一路涨（c）；
 * 右「Ponytail」（d）：只发一张卡，打勾 + 「够用就停」金章（e），其余虚影卡淡出。
 * 节点：r 标题 / a 左标题 / b 方案扇开 / c 开始比较 / d 右标题 / e 够用就停（label 即屏上字）
 */
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const LX = 560;
const RX = 1420;
const TASK_Y = 330;
const SOLS = [
  {icon: 'code', dx: -190, dy: 250, rot: -8},
  {icon: 'database', dx: 190, dy: 240, rot: 6},
  {icon: 'network', dx: -170, dy: 440, rot: 5},
  {icon: 'cloud', dx: 180, dy: 450, rot: -6},
];
const PAIRS = [[0, 1], [2, 3], [0, 3], [1, 2], [0, 2]];

const Card: React.FC<{icon: string; w: number; h: number; tone?: string; children?: React.ReactNode}> = ({icon, w, h, tone = '#fdfbf4', children}) => (
  <div
    style={{
      position: 'relative', width: w, height: h, background: tone, borderRadius: 20, border: `2.4px solid ${GOLD}`,
      boxShadow: '5px 7px 0 rgba(20,15,5,0.22), 0 14px 30px rgba(20,15,5,0.14)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <Icon name={icon} size={Math.round(h * 0.52)} color="#2a2418" stroke={1.8} />
    {children}
  </div>
);

export const SolutionCompare: React.FC<{group: any; io: number; live?: boolean}> = ({group, io, live = false}) => {
  const f = useCurrentFrame(); // 相对 Sequence 起点
  const {fps} = useVideoConfig();
  const F = (s: number) => Math.round(s * T.FPS);
  const t0 = F(group.fin[0]);
  const node = (id: string) => group.nodes.find((n: any) => n.id === id);
  const rf = (id: string) => (node(id) ? F(node(id).rf) - t0 : 1e9);
  const sp = (at: number, cfg = {damping: 12, stiffness: 150, mass: 0.85}) => (f >= at ? spring({frame: f - at, fps, config: cfg}) : 0);
  const pill = (id: string, x: number, bg: string, e: number) =>
    e > 0 ? (
      <div
        style={{
          position: 'absolute', left: x, top: 196 + (1 - e) * 20, translate: '-50%', opacity: Math.min(1, e * 1.5),
          background: bg, color: '#fdfbf4', fontSize: 42, fontWeight: 800, letterSpacing: 3, padding: '12px 40px',
          borderRadius: 999, boxShadow: '0 12px 30px rgba(20,15,5,0.22)', whiteSpace: 'nowrap',
        }}
      >
        {node(id)?.label}
      </div>
    ) : null;

  const eR = sp(rf('r'));
  const line = interpolate(f - rf('r'), [6, 34], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)});
  const eA = sp(rf('a'));
  const eD = sp(rf('d'));
  const cmpT = f - rf('c');
  const bStart = rf('b');
  const endF = F(group.end) - t0;
  // token 条：从开始搜方案一路涨到板结束，颜色金 → 红
  const tok = interpolate(f, [bStart, endF], [0, 1], CL);
  const eE = sp(rf('e'), {damping: 13, stiffness: 140, mass: 0.9});
  const checkE = sp(rf('e') + 10, {damping: 9, stiffness: 220, mass: 0.6});
  const stampE = sp(rf('e') + 16, {damping: 9, stiffness: 210, mass: 0.7});

  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
      <AbsoluteFill style={{background: '#f6f0e1'}} />
      <AbsoluteFill style={{background: 'radial-gradient(120% 90% at 22% 10%, rgba(201,162,74,0.10) 0%, rgba(0,0,0,0) 55%)'}} />
      {live ? <PaperSweep io={io} /> : null}

      {eR > 0 ? (
        <div style={{position: 'absolute', left: '50%', top: 92 + (1 - eR) * 18, translate: '-50%', opacity: Math.min(1, eR * 1.5), fontSize: 50, fontWeight: 800, color: T.ink, letterSpacing: 3, whiteSpace: 'nowrap'}}>
          {node('r')?.label}
          <div style={{height: 4, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: 12}} />
        </div>
      ) : null}

      {/* 中轴金线 + VS */}
      <div style={{position: 'absolute', left: '50%', top: 196, width: 3, height: 720 * line, background: `linear-gradient(180deg, ${GOLD}, rgba(201,162,74,0.25))`, borderRadius: 2}} />
      <div
        style={{
          position: 'absolute', left: '50%', top: 560, translate: '-50% -50%', width: 86, height: 86, borderRadius: '50%', background: '#f6f0e1',
          border: `2.6px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: T.goldDeep, opacity: line,
        }}
      >
        VS
      </div>

      {/* ---------- 左：原本 ---------- */}
      {pill('a', LX, '#8a8676', eA)}
      {eA > 0 ? (
        <div style={{position: 'absolute', left: LX, top: TASK_Y, translate: '-50%', opacity: Math.min(1, eA * 1.5), transform: `scale(${0.85 + 0.15 * eA})`}}>
          <Card icon="mail" w={170} h={116} />
        </div>
      ) : null}
      <svg style={{position: 'absolute', inset: 0}} width={T.W} height={T.H}>
        {SOLS.map((s, i) => {
          const at = bStart + i * 5;
          const d = interpolate(f - at, [0, 12], [0, 1], CL);
          return f >= at ? (
            <line key={'l' + i} x1={LX} y1={TASK_Y + 116} x2={LX + s.dx} y2={TASK_Y + s.dy - 50} stroke="#8a8676" strokeWidth={2.4} strokeDasharray="8 8" opacity={0.7 * d} />
          ) : null;
        })}
        {cmpT >= 0
          ? PAIRS.map(([a, b], k) => {
              const pa = SOLS[a];
              const pb = SOLS[b];
              const at = k * 6;
              const d = interpolate(cmpT - at, [0, 14], [0, 1], CL);
              const pulse = live ? 0.55 + 0.35 * Math.sin((f + k * 9) / 5) : 0.8;
              const x1 = LX + pa.dx, y1 = TASK_Y + pa.dy, x2 = LX + pb.dx, y2 = TASK_Y + pb.dy;
              const mx = (x1 + x2) / 2 + (k % 2 ? 60 : -60);
              const my = (y1 + y2) / 2 - 40;
              return cmpT >= at ? (
                <path key={'c' + k} d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke="#c0392b" strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - d} opacity={pulse} />
              ) : null;
            })
          : null}
      </svg>
      {SOLS.map((s, i) => {
        const at = bStart + i * 5;
        const e = sp(at);
        return e > 0 ? (
          <div key={i} style={{position: 'absolute', left: LX + s.dx, top: TASK_Y + s.dy, translate: '-50% -50%', opacity: Math.min(1, e * 1.5), transform: `rotate(${s.rot * e}deg) scale(${0.7 + 0.3 * e})`}}>
            <Card icon={s.icon} w={150} h={112} />
          </div>
        ) : null;
      })}
      {/* token 条：一路涨 */}
      {tok > 0 ? (
        <div style={{position: 'absolute', left: 150, top: 262, width: 34, height: 360, borderRadius: 17, background: 'rgba(138,134,118,0.18)', border: '2px solid rgba(138,134,118,0.45)', overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${tok * 100}%`, background: `linear-gradient(0deg, ${GOLD}, ${tok > 0.6 ? '#c0392b' : GOLD})`, borderRadius: 17}} />
        </div>
      ) : null}
      {tok > 0 ? (
        <div style={{position: 'absolute', left: 167, top: 632, translate: '-50%', fontSize: 26, fontWeight: 800, color: '#8a8676', letterSpacing: 1}}>token</div>
      ) : null}

      {/* ---------- 右：Ponytail ---------- */}
      {pill('d', RX + 40, T.goldDeep, eD)}
      {eD > 0 ? (
        <div style={{position: 'absolute', left: RX - 175, top: 190 + (1 - eD) * 20, width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${GOLD}`, background: '#fff', opacity: Math.min(1, eD * 1.5)}}>
          <Img src={staticFile('ponytail_logo.png')} style={{width: 80, height: 80, objectFit: 'cover'}} />
        </div>
      ) : null}
      {eD > 0 ? (
        <div style={{position: 'absolute', left: RX, top: TASK_Y, translate: '-50%', opacity: Math.min(1, eD * 1.5), transform: `scale(${0.85 + 0.15 * eD})`}}>
          <Card icon="mail" w={170} h={116} />
        </div>
      ) : null}
      {/* 虚影卡：一闪而过，不去探索 */}
      {eE > 0
        ? [-170, 0, 170].map((dx, k) => (
            <div key={k} style={{position: 'absolute', left: RX + dx, top: TASK_Y + 330, translate: '-50% -50%', opacity: 0.3 * interpolate(f - rf('e'), [0, 4, 22], [0, 1, 0], CL)}}>
              <Card icon={SOLS[k + 1].icon} w={130} h={96} tone="#efe7d4" />
            </div>
          ))
        : null}
      {eE > 0 ? (
        <div style={{position: 'absolute', left: RX, top: TASK_Y + 250 + (1 - eE) * 40, translate: '-50%', opacity: Math.min(1, eE * 1.5), transform: `scale(${0.8 + 0.2 * eE})`}}>
          <Card icon="code" w={190} h={140}>
            {checkE > 0 ? (
              <div style={{position: 'absolute', right: -16, top: -16, width: 54, height: 54, borderRadius: '50%', background: GOLD, border: '3px solid #fdfbf4', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${checkE})`, boxShadow: '3px 4px 0 rgba(0,0,0,0.3)'}}>
                <Icon name="check" size={30} color="#17130a" stroke={3.4} />
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
      {stampE > 0 ? (
        <div
          style={{
            position: 'absolute', left: RX, top: TASK_Y + 440, translate: '-50%', whiteSpace: 'nowrap',
            background: 'linear-gradient(135deg, #e6cf92, #c9a24a)', color: '#17130a', fontSize: 46, fontWeight: 900, letterSpacing: 6,
            padding: '12px 36px', borderRadius: 14, border: '4px solid #fdfbf4', boxShadow: '7px 9px 0 rgba(20,15,5,0.35)',
            transform: `rotate(-4deg) scale(${1.8 - 0.8 * Math.min(1, stampE)})`, opacity: Math.min(1, stampE * 1.8),
          }}
        >
          {node('e')?.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

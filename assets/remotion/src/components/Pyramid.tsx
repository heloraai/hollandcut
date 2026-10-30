import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing, AbsoluteFill} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 三层金字塔（脑图板 variant="pyramid"）：钱的流向图。
 * 三层一进场就全在（自下而上垒起来，都压暗），讲到第几层，第几层才亮 ——
 * 亮 = 变白 + 描边变粗 + 外发光 + 一道光带扫过 + 轻微放大，不是这时候才出现。
 * 节点约定：r = 板标题(hero)；L1/L2/L3 = 三层（label 层名、sub 一句话，anchor = 讲到它的时刻）；
 * 其余节点 = 右侧要点卡。active（1/2/3）由 structure.py 传入；不传 = 顺序模式，L1/L2/L3 各带锚点依次点亮。
 */
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const F = (s: number) => Math.round(s * T.FPS);
const CX = 1090;   // 塔身右移：右沿 1580，不进抖音右侧按钮区；要点卡放左
const TOP = 210;
const LH = 168;
const GAP = 16;
const W = [430, 700, 980];
const FLAT_GOLD = '#F6C453';

export const Pyramid: React.FC<{group: any; io: number; live?: boolean}> = ({group, io, live = false}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t0 = F(group.fin[0]);
  const node = (id: string) => group.nodes.find((n: any) => n.id === id);
  const rf = (id: string) => (node(id) ? F(node(id).rf) - t0 : 1e9);
  // 不传 active = 顺序模式：每层在自己的锚点点亮并保持亮着，最近点亮的那层最亮、连线指向它（一块板讲完三层）
  const seq = group.active == null;
  const litOf = (i: number) => (node(`L${i + 1}`)?.dim ? 1e9 : seq ? rf(`L${i + 1}`) : group.active === i + 1 ? rf(`L${i + 1}`) : 1e9);   // dim 的层只垒不亮
  const lits = [0, 1, 2].filter((i) => f >= litOf(i)).sort((a, b) => litOf(b) - litOf(a));
  const active = seq ? (lits[0] ?? -1) + 1 : group.active;
  const notes = (group.nodes as any[]).filter((n) => !['r', 'L1', 'L2', 'L3'].includes(n.id));
  const eR = f >= rf('r') ? spring({frame: f - rf('r'), fps, config: {damping: 13, stiffness: 150}}) : 0;

  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
      {eR > 0 ? (
        <div style={{position: 'absolute', left: CX, top: 96 + (1 - eR) * 16, translate: '-50%', opacity: Math.min(1, eR * 1.5),
                     fontSize: 52, fontWeight: 800, color: '#f3ede0', letterSpacing: 4, whiteSpace: 'nowrap',
                     }}>
          {node('r')?.label}
          <div style={{height: 5, width: 96, margin: '12px auto 0', borderRadius: 3, background: FLAT_GOLD}} />
        </div>
      ) : null}

      {[0, 1, 2].map((i) => {
        const n = node(`L${i + 1}`) ?? {label: '', sub: ''};   // 没给的层照样垒出来（压暗、无字）
        // 进场：整座塔自下而上垒起来，和讲到谁无关
        const at = 6 + (2 - i) * 6;
        const e = f >= at ? spring({frame: f - at, fps, config: {damping: 14, stiffness: 130, mass: 0.9}}) : 0;
        if (e <= 0.001) return null;
        const litAt = litOf(i);
        const on = active === i + 1;
        // 点亮：讲到这一层的瞬间；顺序模式里讲过的层留着亮，但收一点
        const lit = (f >= litAt ? spring({frame: f - litAt, fps, config: {damping: 11, stiffness: 150, mass: 0.8}}) : 0) * (on ? 1 : 0.6);
        const y = TOP + i * (LH + GAP);
        const wTop = i === 0 ? W[0] * 0.52 : W[i - 1];
        const wBot = W[i];
        return (
          <div key={i} style={{position: 'absolute', left: CX, top: y, translate: '-50%', width: wBot, height: LH,
                               opacity: Math.min(1, e * 1.5) * (0.5 + 0.5 * lit),
                               transform: `translateY(${(1 - e) * 26}px) scale(${(0.92 + 0.08 * e) * (1 + 0.035 * lit)})`}}>
            <div style={{position: 'absolute', inset: 0, overflow: 'hidden',
                         clipPath: `polygon(${(wBot - wTop) / 2}px 0, ${(wBot + wTop) / 2}px 0, ${wBot}px ${LH}px, 0 ${LH}px)`,
                         background: lit > 0.05 ? (on ? FLAT_GOLD : '#F5F0E6') : 'rgba(228,223,208,0.55)'}} />   {/* 扁平：纯色块 —— 正在讲的那层纯金，讲过的米白，没讲到的压暗 */}
            <svg style={{position: 'absolute', inset: 0}} width={wBot} height={LH}>
              <polygon points={`${(wBot - wTop) / 2},1 ${(wBot + wTop) / 2},1 ${wBot - 1},${LH - 1} 1,${LH - 1}`}
                       fill="none" stroke={lit > 0.05 ? '#15161B' : 'rgba(21,22,27,0.35)'} strokeWidth={2} />
            </svg>
            <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                         alignItems: 'center', justifyContent: 'center', gap: 6}}>
              <span style={{fontSize: (i === 0 ? 30 : 38) + (i === 0 ? 3 : 6) * lit, fontWeight: 800, letterSpacing: i === 0 ? 1 : 2, whiteSpace: 'nowrap',   /* 顶层梯形窄，字小一号免得被裁 */
                            color: lit > 0.05 ? '#17130a' : '#2b2619'}}>
                {n.label}
              </span>
              {n.sub ? (
                <span style={{fontSize: 25, letterSpacing: 1, whiteSpace: 'nowrap',
                              color: lit > 0.05 ? '#6b6455' : '#3e382c'}}>{n.sub}</span>
              ) : null}
            </div>
          </div>
        );
      })}

      {seq ? (
        // 顺序模式：每层一张要点卡，讲到哪层换哪张，卡片停在那一层旁边（id 里带 L1/L2/L3 指定层）
        notes.map((n: any, k: number) => {
          const at = rf(n.id) + (k > 0 ? 7 : 0);   // 上一张先退 7 帧再进，不在同一位置叠字
          if (f < at) return null;
          const tier = Number((String(n.id).match(/L(\d)/) || [0, 3])[1]);
          const nxtNote = k + 1 < notes.length ? rf(notes[k + 1].id) : 1e9;
          const nxtTier = Math.min(...[0, 1, 2].filter((i) => i + 1 !== tier).map((i) => litOf(i)).filter((x) => x > at), 1e9);   // 讲到别的层：这张卡也退
          const nxt = Math.min(nxtNote, nxtTier);
          const eIn = spring({frame: f - at, fps, config: {damping: 16, stiffness: 140, mass: 0.9}});
          const eOut = f >= nxt ? interpolate(f - nxt, [0, 7], [0, 1], {...CL, easing: Easing.inOut(Easing.ease)}) : 0;
          if (eOut >= 1) return null;
          const yc = TOP + (tier - 1) * (LH + GAP) + LH / 2;
          const yn = Math.min(yc, 612);   // 要点卡不压到左下人物圆窗（圆窗顶 ≈ 700）
          const op = Math.min(1, eIn * 1.5) * (1 - eOut);
          return (
            <React.Fragment key={n.id}>
              <svg style={{position: 'absolute', inset: 0, opacity: op}} width={T.W} height={T.H}>
                <line x1={474} y1={yn} x2={474 + ((CX - W[tier - 1] / 2 - 18) - 474) * Math.min(1, eIn)} y2={yc}
                      stroke={FLAT_GOLD} strokeWidth={3} strokeDasharray="8 7" />
              </svg>
              <div style={{position: 'absolute', left: 30, top: yn, translate: '0 -50%', width: 440, opacity: op,
                           transform: `translateX(${-(1 - eIn) * 50 + eOut * 30}px)`}}>
                <div style={{background: '#15161B', borderLeft: `8px solid ${FLAT_GOLD}`, borderRadius: 18,
                             padding: '18px 22px'}}>
                  <div style={{fontSize: 38, fontWeight: 800, color: FLAT_GOLD, letterSpacing: 1}}>{n.label}</div>
                  {n.sub ? <div style={{marginTop: 8, fontSize: 25, color: 'rgba(239,232,215,0.8)'}}>{n.sub}</div> : null}
                </div>
              </div>
            </React.Fragment>
          );
        })
      ) : (
        <>
      {notes.map((n: any, k: number) => {
          const at = rf(n.id);
          const e = f >= at ? spring({frame: f - at, fps, config: {damping: 13, stiffness: 165, mass: 0.8}}) : 0;
          if (e <= 0.001) return null;
          return (
            <div key={n.id} style={{position: 'absolute', left: 56, top: 250 + k * 150, width: 440,
                                    opacity: Math.min(1, e * 1.5), transform: `translateX(${-(1 - e) * 60}px)`}}>
              <div style={{background: 'rgba(12,13,17,0.9)', border: `2.4px solid ${GOLD}`, borderRadius: 18,
                           padding: '16px 20px', boxShadow: '5px 6px 0 rgba(0,0,0,0.55)'}}>
                <div style={{fontSize: 32, fontWeight: 800, color: GOLD_LITE, letterSpacing: 1}}>{n.label}</div>
                {n.sub ? <div style={{marginTop: 6, fontSize: 22, color: 'rgba(239,232,215,0.75)'}}>{n.sub}</div> : null}
              </div>
            </div>
          );
        })}
  
        {notes.length && active >= 1 && f >= rf(notes[0].id) ? (
          <svg style={{position: 'absolute', inset: 0}} width={T.W} height={T.H}>
            <line x1={500} y1={330} x2={CX - W[active - 1] / 2 - 20} y2={TOP + (active - 1) * (LH + GAP) + LH / 2}
                  stroke="rgba(201,162,74,0.45)" strokeWidth={2} strokeDasharray="7 7" />
          </svg>
        ) : null}
        </>
      )}
    </AbsoluteFill>
  );
};

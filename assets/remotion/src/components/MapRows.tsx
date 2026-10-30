import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {FONT} from '../theme';
import {Icon} from './Icons';

/**
 * 需求 → 找谁 对照板（g(variant="maprows")，人物缩左下圆窗）。
 * 顶上一张「企业 AI 化 · 需要什么」标题卡，下面三行：左边需求卡 → 金箭头画出来 → 右边外包卡，说到哪行出哪行：
 *   AI 客服 → 客服开发公司 / AI 搜索优化 → GEO 公司 / 改官网 → 网站设计团队。
 * 节点：r = 标题卡；n1–n3 = 三张需求卡（label = 需求，sub = 图标名）；v1–v3 = 三张外包卡（label，sub = 图标名），时间全来自 N(…, 锚点)。
 * 扁平：纸色卡 + 金色左条 + 硬投影；外包卡金边（这是答案）。禁区：左下圆窗、x>1665、图形最低 y≈860。
 */
const F = (s: number) => Math.round(s * 30);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const INK = '#15161B', PAPER = '#F5F0E6', GOLD = '#F6C453', EDGE = '#8C6B21';
const NX = 470, NW = 420, VX = 1110, VW = 540, H = 120;   // 右卡 470 → 540（长工具名放得下），右沿 1650
// 行数不写死（3 行 400/570/740；4 行 340/485/630/775）
const rowsY = (n: number) => (n <= 3 ? [400, 570, 740] : n === 4 ? Array.from({length: 4}, (_, i) => 340 + i * 145) : Array.from({length: n}, (_, i) => 330 + i * 118));   // 5 行：卡高 100

const Card: React.FC<{x: number; y: number; w: number; icon: string; t: string; s: number; gold?: boolean; h?: number}> = ({x, y, w, icon, t, s, gold, h = H}) => (
  <div style={{position: 'absolute', left: x, top: y - h / 2, width: w, height: h, boxSizing: 'border-box', borderRadius: 22, background: PAPER,
               border: `${gold ? 5 : 3}px solid ${gold ? GOLD : EDGE}`, boxShadow: '4px 5px 0 rgba(21,22,27,0.45)', display: 'flex', alignItems: 'center',
               gap: 16, overflow: 'hidden', transform: `scale(${s})`, transformOrigin: '50% 50%', opacity: Math.min(1, s * 1.5)}}>
    <div style={{width: 12, alignSelf: 'stretch', background: GOLD, flex: 'none'}} />
    {icon.includes('/') ? icon.split('|').map((src) => (   /* 10-26：sub 写 logo 路径 = 放真 logo（多个用 | 分开） */
      <div key={src} style={{width: 66, height: 66, borderRadius: 16, overflow: 'hidden', background: '#FFFFFF', border: `2px solid ${INK}`, flex: 'none',
                             display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Img src={staticFile(src)} style={{width: '86%', height: '86%', objectFit: 'contain'}} />
      </div>
    )) : <Icon name={icon} size={54} color={INK} stroke={2.2} />}
    <span style={{fontFamily: FONT, fontSize: h < H ? 40 : 46, fontWeight: 900, color: INK, whiteSpace: 'nowrap', letterSpacing: 1}}>{t}</span>
  </div>
);

export const MapRows: React.FC<{group: any; io: number}> = ({group, io}) => {
  const f0 = F(group.fin[0]);
  const f = useCurrentFrame() + f0;
  const {fps} = useVideoConfig();
  const node = (id: string) => (group.nodes as any[]).find((x) => x.id === id);
  const at = (id: string) => (node(id) ? (node(id).rf as number) : 1e9);
  const pop = (s: number) => (f >= F(s) ? spring({frame: f - F(s), fps, config: {damping: 12, stiffness: 210, mass: 0.65}}) : 0);
  const t0 = group.fin[0] + 0.6 * (group.fin[1] - group.fin[0]);
  const head = pop(Math.max(t0, at('r')));
  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
      {/* 标题卡 */}
      <div style={{position: 'absolute', left: NX, top: 160, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 30px', borderRadius: 20,
                   background: INK, border: `4px solid ${GOLD}`, boxShadow: '4px 5px 0 rgba(0,0,0,0.45)', transform: `scale(${head})`, transformOrigin: '0% 50%'}}>
        <Icon name="building" size={52} color={GOLD} stroke={2.2} />
        <span style={{fontSize: 48, fontWeight: 900, color: PAPER, letterSpacing: 2, whiteSpace: 'nowrap'}}>{node('r')?.label ?? '企业 AI 化'}</span>
        <span style={{fontSize: 38, fontWeight: 900, color: GOLD, whiteSpace: 'nowrap'}}>{group.extra?.tail ?? '需要什么 → 找谁'}</span>
      </div>
      {(() => { const K = [1, 2, 3, 4, 5].filter((k) => node(`n${k}`)); const YS = rowsY(K.length); return K.map((k, i) => {
        const n = node(`n${k}`), v = node(`v${k}`);
        if (!n) return null;
        const y = YS[i];
        const sn = pop(at(`n${k}`)), sv = pop(at(`v${k}`));
        const arrow = interpolate(f - F(at(`v${k}`)), [-8, 0], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
        const x0 = NX + NW + 24, x1 = VX - 24;
        return (
          <React.Fragment key={k}>
            <Card x={NX} y={y} w={NW} icon={n.sub ?? 'bulb'} t={n.label} s={sn} h={K.length >= 5 ? 100 : H} />
            {arrow > 0 ? (
              <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
                <line x1={x0} y1={y} x2={x0 + (x1 - x0 - 18) * arrow} y2={y} stroke={GOLD} strokeWidth={9} strokeLinecap="round" />
                {arrow > 0.95 ? <polygon points={`${x1},${y} ${x1 - 30},${y - 20} ${x1 - 30},${y + 20}`} fill={GOLD} /> : null}
              </svg>
            ) : null}
            {v ? <Card x={VX} y={y} w={VW} icon={v.sub ?? 'users'} t={v.label} s={sv} gold h={K.length >= 5 ? 100 : H} /> : null}
          </React.Fragment>
        );
      }); })()}
    </AbsoluteFill>
  );
};

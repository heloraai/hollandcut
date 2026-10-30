import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, FONT} from '../theme';
import {Icon} from './Icons';
import {BUB} from './Bubble';

/**
 * 对比柱状图 · 扁平版（叠加层，人物保持全屏，两根柱子分列人物左右）：落差用高度讲。
 * 两根柱子都从 0 长出来：
 * 说到左边那个数，左柱从底座长到 h0、数字从 0 滚到位；说到右边那个数，右柱从 0 长到 h1（主角，金色），左柱同时变灰；
 * 右柱到位后拉出落差：h1 > h0 画一支向上的箭头（从左柱顶的高度到右柱顶）；h1 < h0 画一个 h0 高的虚线轮廓 + 向下的绿箭头（省下来的那一截）。
 * 全部纯色块，没有渐变、发光、立体阴影。右柱收在 x≤1600、不进抖音横屏右下按钮区。
 * 数值牌和浅色气泡同一套 —— 纸底墨字 + 2px 深金描边 + 0 模糊硬投影，
 * 右边的结论数字（DeepSeek 200+）用金底，全组只这一个金；「不到 1/3」也改浅色；柱顶的墨色圆图标换成产品真 logo（img）；
 * 左柱不再用五色以外的灰：纸色 + 深金描边。
 */
export type DuelSide = {x: number; icon: string; img?: string; t: string; count?: number; sub?: string; at: number; size?: number; mw?: number};
export type DuelSpec = {start: number; end: number; h0: number; h1: number; l: DuelSide; r: DuelSide; boostAt?: number;
                        badge?: {t: string; at: number} | null; gap?: string; base?: number};
// 10-18：mw = 数值牌最小宽（两根都收进左栏时用 250），base = 底线 y（默认 905；要让底边 ≤ 880 就传 878）

const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const BASE0 = 905, BW = 168, IC = 92;
const GOLD = '#F6C453', INK = '#15161B', PAPER = '#F5F0E6', CORAL = '#FF6B4A', GREEN = '#35B877', EDGE = BUB.COLOR.EDGE;

const Duel: React.FC<{s: DuelSpec}> = ({s}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t0 = F(s.start), t1 = F(s.end);
  const BASE = s.base ?? BASE0;
  const out = interpolate(f, [t1, t1 + 9], [1, 0], {...CL, easing: Easing.inOut(Easing.ease)});
  const base = spring({frame: f - t0, fps, config: {damping: 15, stiffness: 160, mass: 0.85}});
  const up = s.h1 >= s.h0;
  const dr = f - F(s.r.at);                       // 右柱开始长的那一帧起
  const growFrames = (h: number) => 16 + h / 26;   // 越高长得越久：矮柱 ~0.75s，高柱 ~1.15s
  const rk = interpolate(dr, [0, growFrames(s.h1)], [0, 1], CL);

  const side = (p: DuelSide, isR: boolean) => {
    const H = isR ? s.h1 : s.h0;
    const la = f - F(p.at);
    if (la < 0) return null;
    const n = growFrames(H);
    const g = interpolate(la, [0, n], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
    const bump = la >= n ? 1 + 0.025 * Math.exp(-(la - n) / 4) * Math.cos((la - n) / 2.2) : 1;   // 到顶轻轻一弹
    const h = Math.max(6, H * g * bump);
    const le = spring({frame: la, fps, config: {damping: 12, stiffness: 210, mass: 0.7}});
    const tone = isR ? GOLD : PAPER;   // 主角金、对照纸色（不再变成五色以外的灰；也不压暗 —— 半透明的牌子压在墙上看不清数字）
    const cnt = p.count != null ? Math.round(p.count * g) : null;
    const big = 1;   // 左右两块一样大，只用颜色区分主次
    const top = BASE - h;   // 牌子和 logo 一律贴着自己的柱顶
    return (
      <div>
        {/* 柱体：纯色，随高度露出刻度 */}
        <div style={{position: 'absolute', left: p.x - BW / 2, top: BASE - h, width: BW, height: h, borderRadius: '20px 20px 0 0', overflow: 'hidden', background: tone,
                     border: `3px solid ${EDGE}`, borderBottom: 'none', boxSizing: 'border-box'}}>
          {Array.from({length: Math.max(0, Math.floor((h - 30) / 52))}).map((_, k) => (
            <span key={k} style={{position: 'absolute', left: 0, width: 38, bottom: 46 + k * 52, height: 4, background: 'rgba(21,22,27,0.16)'}} />
          ))}
        </div>
        {/* 柱顶：产品真 logo（白底圆角方块 + 深金描边），跟着柱子往上走；没给 img 才退回线性图标 */}
        <div style={{position: 'absolute', left: p.x - IC / 2, top: top - IC - 14, width: IC, height: IC, borderRadius: 22, boxSizing: 'border-box',
                     background: '#fff', border: `${BUB.BORDER}px solid ${EDGE}`, boxShadow: BUB.SHADOW, overflow: 'hidden',
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     transform: `scale(${0.5 + 0.5 * Math.min(1, le)})`, opacity: Math.min(1, le * 2)}}>
          {p.img ? <Img src={staticFile(p.img)} style={{width: '82%', height: '82%', objectFit: 'contain'}} /> : <Icon name={p.icon} size={50} color={INK} stroke={2.4} />}
        </div>
        {/* 标签：浅色气泡同款数值牌（纸底墨字 / 结论那张金底），小字在上、数字在下（数字跟着柱子从 0 滚到位）*/}
        <div style={{position: 'absolute', left: p.x, top: top - IC - 30, translate: '-50% -100%', textAlign: 'center', whiteSpace: 'nowrap',
                     background: isR ? GOLD : PAPER, color: INK, borderRadius: 26, minWidth: p.mw ?? 330, boxSizing: 'border-box', padding: `${14 * big}px ${30 * big}px ${16 * big}px`,
                     border: `${BUB.BORDER}px solid ${EDGE}`, boxShadow: BUB.SHADOW, opacity: Math.min(1, le * 2),
                     transform: `scale(${0.7 + 0.3 * Math.min(1, le)})`, transformOrigin: '50% 100%'}}>
          {p.sub ? <div style={{fontSize: 30, fontWeight: 800, letterSpacing: 3, color: 'rgba(21,22,27,0.68)', marginBottom: 6}}>{p.sub}</div> : null}
          <div style={{fontSize: (p.size ?? 84) * big, fontWeight: 900, lineHeight: 1, letterSpacing: 1, fontFamily: `"Arial Rounded MT Bold", ${FONT}`, color: INK}}>
            {cnt != null ? cnt : p.t}{cnt != null && p.t ? p.t : ''}
          </div>
        </div>
      </div>
    );
  };

  // 落差：右柱长到位后才画
  const late = Math.min(dr - growFrames(s.h1), f - F(s.l.at) - growFrames(s.h0));   // 两根都长到位之后才拉落差
  const gk = interpolate(late, [-4, 10], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
  const gx = up ? s.r.x - BW / 2 - 64 : s.r.x;
  const yL = BASE - s.h0, yR = BASE - s.h1;
  const tip = yL + (yR - yL) * gk;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out, fontFamily: FONT}}>
      {/* 两根柱子各自的底座线（不横穿人物）：一开场就在，柱子从它上面长出来 */}
      {[s.l.x, s.r.x].map((x, k) => (
        <div key={k} style={{position: 'absolute', left: x - (BW / 2 + 30) * Math.min(1, base), width: (BW + 60) * Math.min(1, base), top: BASE, height: 6, borderRadius: 3, background: INK}} />
      ))}
      {side(s.l, false)}
      {side(s.r, true)}
      {gk > 0.02 ? (
        <svg style={{position: 'absolute', inset: 0}} width={T.W} height={T.H}>
          {up ? (
            <>
              <line x1={gx - 22} y1={yL} x2={gx + 22} y2={yL} stroke={CORAL} strokeWidth={6} strokeLinecap="round" />
              <line x1={gx} y1={yL} x2={gx} y2={tip + 20} stroke={CORAL} strokeWidth={6} strokeLinecap="round" />
              <polygon points={`${gx},${tip} ${gx - 17},${tip + 28} ${gx + 17},${tip + 28}`} fill={CORAL} />
            </>
          ) : null}
        </svg>
      ) : null}
      {s.gap && gk > 0.5 ? (
        <div style={{position: 'absolute', left: up ? gx - 22 : gx, top: (yL + yR) / 2, translate: up ? '-100% -50%' : '-50% -50%', whiteSpace: 'nowrap',
                     background: up ? CORAL : GREEN, color: '#fff', fontSize: 34, fontWeight: 900, letterSpacing: 2, padding: '6px 18px 8px', borderRadius: 12,
                     transform: `scale(${0.6 + 0.4 * gk})`, transformOrigin: up ? '100% 50%' : '50% 50%'}}>{s.gap}</div>
      ) : null}
      {s.badge && f >= F(s.badge.at) ? (() => {
        const e = spring({frame: f - F(s.badge.at), fps, config: {damping: 12, stiffness: 210, mass: 0.7}});
        return (
          <div style={{position: 'absolute', left: '50%', top: 846, translate: '-50% -50%', whiteSpace: 'nowrap',
                       background: 'rgba(245,240,230,0.96)', color: INK, fontSize: 40, fontWeight: 900, letterSpacing: 6,
                       padding: '12px 38px 14px', borderRadius: 999, border: `${BUB.BORDER}px solid ${EDGE}`, boxShadow: BUB.SHADOW,
                       transform: `scale(${1.5 - 0.5 * Math.min(1, e)})`, opacity: Math.min(1, e * 1.8)}}>
            {s.badge.t}
          </div>
        );
      })() : null}
    </div>
  );
};

export const DuelBars: React.FC<{duels: DuelSpec[]; live?: boolean}> = ({duels}) => {
  const f = useCurrentFrame();
  const cur = duels.find((s) => f >= F(s.start) && f <= F(s.end) + 9);
  return cur ? <Duel key={cur.start} s={cur} /> : null;
};

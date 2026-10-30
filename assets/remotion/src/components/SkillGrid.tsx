import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing, Img, staticFile} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 开场「6 个神级 skill」宫格（叠加层，人物保持全屏，贴左侧：右侧会被抖音横屏的按钮列挡住）：
 * popAt 起 6 个图标卡按 2×3 依次弹入（每张隔 4 帧、弹簧落位、金色描边）；标题「6 个神级 skill」先砸下；
 * dimAt（「如果你没装这些」）起卡片压暗成灰；barAt（「只解锁了十分之一」）进度条从 0 滑到 1/10，右侧锁图标排开。
 */
export type SkillGridSpec = {start: number; end: number; popAt: number; dimAt?: number; barAt?: number; title: string;
                             barLabel?: string; items: {src: string; label: string}[]};
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const F = (s: number) => Math.round(s * T.FPS);
const X0 = 70, TW = 262, TH = 176, GX = 22, GY = 20, Y0 = 246;   // 标题 top 134：让开左上章节标签（底边约 y=114）

const Lock: React.FC<{on: boolean}> = ({on}) => (
  <svg width={26} height={30} viewBox="0 0 24 28" style={{opacity: on ? 1 : 0.35}}>
    <rect x="3" y="12" width="18" height="14" rx="3" fill={on ? GOLD_LITE : '#8d8778'} />
    <path d="M7 12V8a5 5 0 0 1 10 0v4" fill="none" stroke={on ? GOLD_LITE : '#8d8778'} strokeWidth="2.6" />
  </svg>
);

export const SkillGrid: React.FC<{spec: SkillGridSpec; live?: boolean}> = ({spec: s, live = false}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s0 = F(s.start), e0 = F(s.end), pop = F(s.popAt);
  if (f < s0 || f > e0 + 12) return null;
  const out = interpolate(f, [e0, e0 + 12], [1, 0], {...CL, easing: Easing.inOut(Easing.ease)});
  const tE = spring({frame: f - s0, fps, config: {damping: 16, stiffness: 150, mass: 0.9}});
  const dim = s.dimAt != null ? interpolate(f, [F(s.dimAt), F(s.dimAt) + 12], [0, 1], CL) : 0;
  const barF = s.barAt != null ? F(s.barAt) : 1e9;
  const barE = f >= barF ? spring({frame: f - barF, fps, config: {damping: 18, stiffness: 120}}) : 0;
  const fill = interpolate(f - barF, [4, 26], [0, 0.1], {...CL, easing: Easing.out(Easing.cubic)});
  const W = TW * 2 + GX;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out, fontFamily: FONT, pointerEvents: 'none'}}>
      {/* 标题：大数字 6 + 字 */}
      <div style={{position: 'absolute', left: X0, top: 134, width: W, display: 'flex', alignItems: 'baseline', gap: 16,
                   opacity: Math.min(1, tE * 1.5), transform: `translateY(${(1 - tE) * 24}px)`}}>
        <span style={{fontSize: 92, fontWeight: 900, color: GOLD_LITE, lineHeight: 1, textShadow: '0 6px 22px rgba(0,0,0,0.7)'}}>6</span>
        <span style={{fontSize: 44, fontWeight: 900, color: '#f6efdc', letterSpacing: 2, whiteSpace: 'nowrap', textShadow: '0 3px 12px rgba(0,0,0,0.9)'}}>{s.title}</span>
      </div>
      {s.items.slice(0, 6).map((it, i) => {
        const at = pop + i * 4;
        const e = f >= at ? spring({frame: f - at, fps, config: {damping: 15, stiffness: 170, mass: 0.8}}) : 0;
        if (e <= 0.001) return null;
        const col = i % 2, row = Math.floor(i / 2);
        const x = X0 + col * (TW + GX), y = Y0 + row * (TH + GY);
        const flash = interpolate(f - at, [0, 3, 12], [0.5, 0.25, 0], CL);
        const glow = live && dim < 0.5 ? 10 + 6 * Math.abs(Math.sin((f + i * 7) / 12)) : 10;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: TW, height: TH, borderRadius: 22,
                               background: 'rgba(12,13,17,0.9)', border: `2.4px solid ${dim > 0.5 ? 'rgba(141,135,120,0.6)' : GOLD}`,
                               boxShadow: `0 16px 40px rgba(0,0,0,0.55), 0 0 ${glow}px rgba(201,162,74,${0.45 * (1 - dim)})`,
                               opacity: Math.min(1, e * 1.6) * (1 - 0.45 * dim),
                               transform: `translateY(${(1 - e) * 36}px) scale(${0.86 + 0.14 * e})`,
                               filter: `grayscale(${dim})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden'}}>
            <span style={{position: 'absolute', left: 14, top: 10, fontSize: 20, fontWeight: 800, color: 'rgba(230,207,146,0.8)', letterSpacing: 1}}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <Img src={staticFile(it.src)} style={{width: 84, height: 84, borderRadius: 20, flex: 'none', marginTop: 6}} />
            <span style={{fontSize: 28, fontWeight: 800, color: '#f6efdc', lineHeight: 1.1, whiteSpace: 'nowrap'}}>{it.label}</span>
            <span style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash, borderRadius: 22}} />
          </div>
        );
      })}
      {/* 解锁进度条：只解锁 1/10 */}
      {barE > 0 ? (
        <div style={{position: 'absolute', left: X0, top: Y0 + 3 * (TH + GY) + 6, width: W, opacity: Math.min(1, barE * 1.5),
                     transform: `translateY(${(1 - barE) * 20}px)`}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10}}>
            <span style={{fontSize: 30, fontWeight: 800, color: '#f6efdc', textShadow: '0 3px 10px rgba(0,0,0,0.9)'}}>{s.barLabel ?? 'Codex 能力'}</span>
            <span style={{fontSize: 44, fontWeight: 900, color: GOLD_LITE, textShadow: '0 3px 10px rgba(0,0,0,0.9)'}}>{Math.max(1, Math.round(fill * 100))}%</span>
          </div>
          <div style={{position: 'relative', height: 34, borderRadius: 17, background: 'rgba(12,13,17,0.85)', border: `2px solid ${GOLD}`, overflow: 'hidden'}}>
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: 'linear-gradient(90deg, #c9a24a, #f0dca0)'}} />
            <div style={{position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingLeft: '10%'}}>
              {Array.from({length: 9}).map((_, k) => <Lock key={k} on={false} />)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

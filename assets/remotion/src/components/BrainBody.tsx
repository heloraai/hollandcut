import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, FONT} from '../theme';
import {Icon} from './Icons';

/**
 * 「大脑 / 身体」示意图（叠加层，左上，人物保持全屏）。
 * 一个小人：头 = 大脑（DeepSeek），身子 = 身体（Codex），身子往右伸出两根线连到「工具调用」「Skill 调用」；
 * 讲到哪句长哪块：身体 → 大脑 → 两个标签 → 换脑（头上一圈箭头转一下 +「只换大脑」）→ 工具调用 → Skill 调用 → 虚线框「还是 Codex 那一套」。
 * 扁平纯色，左边线 x=30，和章节标签对齐。
 */
export type BrainSpec = {start: number; end: number; body: number; head: number; brainTag: number; bodyTag: number; swap: number;
                         tools: {t: string; icon: string; at: number}[]; bracket: {t: string; at: number}};

const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const GOLD = '#F6C453', INK = '#15161B', PAPER = '#F5F0E6';
const L = 30, TOP = 128;
const HD = 176;                                   // 头的直径
const BX = L, BY = TOP + HD + 34, BW = 360, BH = 188;   // 身子
const HX = BX + BW / 2, HY = TOP + HD / 2;        // 头的圆心
const TX = BX + BW + 60;                          // 工具卡左边

export const BrainBody: React.FC<{s: BrainSpec}> = ({s}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (f < F(s.start) || f > F(s.end) + 10) return null;
  const sp = (t: number, cfg = {damping: 13, stiffness: 190, mass: 0.75}) => (f >= F(t) ? spring({frame: f - F(t), fps, config: cfg}) : 0);
  const out = interpolate(f, [F(s.end), F(s.end) + 10], [1, 0], CL);
  const eBody = sp(s.body), eHead = sp(s.head), eBT = sp(s.brainTag), eBoT = sp(s.bodyTag), eSw = sp(s.swap), eBr = sp(s.bracket.at);
  const neck = interpolate(f - F(s.head), [0, 8], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
  const ring = interpolate(f - F(s.swap), [0, 22], [0, 360], {...CL, easing: Easing.inOut(Easing.cubic)});
  const toolY = (i: number) => BY + 46 + i * 96;
  const tag = (t: string, e: number, style: React.CSSProperties) =>
    e > 0 ? <div style={{position: 'absolute', background: GOLD, color: INK, fontSize: 38, fontWeight: 900, letterSpacing: 4, padding: '5px 18px 7px', borderRadius: 12,
                         whiteSpace: 'nowrap', opacity: Math.min(1, e * 2), transform: `scale(${1.6 - 0.6 * Math.min(1, e)})`, transformOrigin: 'left center', ...style}}>{t}</div> : null;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out, fontFamily: FONT}}>
      {/* 虚线框：身子 + 工具 =「还是 Codex 那一套」*/}
      {eBr > 0 ? (
        <>
          <div style={{position: 'absolute', left: BX - 14, top: BY - 14, width: TX + 300 - BX + 28, height: BH + 28 + 40, borderRadius: 26, boxSizing: 'border-box',
                       border: `4px dashed ${GOLD}`, opacity: Math.min(1, eBr * 2), transform: `scale(${1.04 - 0.04 * Math.min(1, eBr)})`, transformOrigin: 'left top'}} />
          <div style={{position: 'absolute', left: BX - 14, top: BY + BH + 42, background: INK, color: GOLD, fontSize: 38, fontWeight: 900, letterSpacing: 3,
                       padding: '8px 22px 10px', borderRadius: 14, whiteSpace: 'nowrap', opacity: Math.min(1, eBr * 2), transform: `translateY(${(1 - Math.min(1, eBr)) * 16}px)`}}>
            {s.bracket.t}
          </div>
        </>
      ) : null}
      {/* 脖子 */}
      {eHead > 0 ? <div style={{position: 'absolute', left: HX - 4, top: TOP + HD, width: 8, height: (BY - TOP - HD) * neck, background: GOLD, borderRadius: 4}} /> : null}
      {/* 身子：Codex */}
      {eBody > 0 ? (
        <div style={{position: 'absolute', left: BX, top: BY, width: BW, height: BH, borderRadius: 28, background: INK, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px',
                     boxSizing: 'border-box', opacity: Math.min(1, eBody * 2), transform: `translateY(${(1 - eBody) * 30}px) scale(${0.85 + 0.15 * eBody})`, transformOrigin: 'left bottom'}}>
          <div style={{width: 112, height: 112, borderRadius: 26, background: '#fff', overflow: 'hidden', flex: 'none'}}>
            <Img src={staticFile('logos/codex.png')} style={{width: 112, height: 112, objectFit: 'contain'}} />
          </div>
          <div style={{position: 'relative', height: 120}}>
            <div style={{fontSize: 58, fontWeight: 900, color: PAPER, letterSpacing: 1, lineHeight: '64px'}}>Codex</div>
            {tag('身体', eBoT, {left: 0, top: 70})}
          </div>
        </div>
      ) : null}
      {/* 头：先是虚线空圈，说到 DeepSeek 时装进去 */}
      {eBody > 0 ? (
        <div style={{position: 'absolute', left: HX - HD / 2, top: TOP, width: HD, height: HD, borderRadius: '50%', boxSizing: 'border-box',
                     background: eHead > 0.05 ? '#fff' : 'rgba(21,22,27,0.45)', border: eHead > 0.05 ? `6px solid ${GOLD}` : `4px dashed ${PAPER}`,
                     display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', opacity: Math.min(1, eBody * 2)}}>
          {eHead > 0.05 ? (
            <Img src={staticFile('logos/deepseek.png')} style={{width: HD * 0.8, height: HD * 0.8, objectFit: 'contain', transform: `scale(${0.4 + 0.6 * Math.min(1.1, eHead)})`}} />
          ) : <span style={{fontSize: 84, fontWeight: 900, color: PAPER, fontFamily: `"Arial Rounded MT Bold", ${FONT}`}}>?</span>}
        </div>
      ) : null}
      {/* 换脑：头外一圈箭头转一圈 */}
      {eSw > 0 ? (
        <svg style={{position: 'absolute', left: HX - HD / 2 - 26, top: TOP - 26, overflow: 'visible', transform: `rotate(${ring}deg)`, transformOrigin: `${HD / 2 + 26}px ${HD / 2 + 26}px`}}
             width={HD + 52} height={HD + 52} opacity={Math.min(1, eSw * 2)}>
          {[0, 180].map((a0) => {
            const r = HD / 2 + 18, c = HD / 2 + 26, a1 = ((a0 + 20) * Math.PI) / 180, a2 = ((a0 + 140) * Math.PI) / 180;
            const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1), x2 = c + r * Math.cos(a2), y2 = c + r * Math.sin(a2);
            const ax = c + r * Math.cos(a2), ay = c + r * Math.sin(a2), tdir = a2 + Math.PI / 2;
            return (
              <g key={a0}>
                <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke={GOLD} strokeWidth={7} strokeLinecap="round" />
                <polygon points={`${ax + 14 * Math.cos(tdir)},${ay + 14 * Math.sin(tdir)} ${ax + 11 * Math.cos(tdir - 2.3)},${ay + 11 * Math.sin(tdir - 2.3)} ${ax + 11 * Math.cos(tdir + 2.3)},${ay + 11 * Math.sin(tdir + 2.3)}`} fill={GOLD} />
              </g>
            );
          })}
        </svg>
      ) : null}
      {/* 头右边：DeepSeek /「大脑」/「只换大脑」*/}
      {eHead > 0 ? (
        <div style={{position: 'absolute', left: HX + HD / 2 + 44, top: TOP + 8, opacity: Math.min(1, eHead * 2), transform: `translateX(${(1 - Math.min(1, eHead)) * -24}px)`}}>
          <div style={{fontSize: 52, fontWeight: 900, color: PAPER, background: INK, padding: '6px 20px 8px', borderRadius: 14, whiteSpace: 'nowrap', display: 'inline-block'}}>DeepSeek</div>
        </div>
      ) : null}
      {tag('大脑', eBT, {left: HX + HD / 2 + 44, top: TOP + 96})}
      {eSw > 0 ? (
        <div style={{position: 'absolute', left: HX + HD / 2 + 44 + 120, top: TOP + 96, background: INK, color: GOLD, fontSize: 38, fontWeight: 900, letterSpacing: 2,
                     padding: '5px 18px 7px', borderRadius: 12, whiteSpace: 'nowrap', opacity: Math.min(1, eSw * 2), transform: `translateX(${(1 - Math.min(1, eSw)) * -20}px)`}}>
          只换大脑
        </div>
      ) : null}
      {/* 身体往右伸出去：工具调用 / Skill 调用 */}
      {s.tools.map((tl, i) => {
        const e = sp(tl.at);
        if (e <= 0) return null;
        const ln = interpolate(f - F(tl.at), [0, 7], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
        const y = toolY(i);
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: BX + BW, top: y - 4, width: (TX - BX - BW) * ln, height: 8, background: GOLD, borderRadius: 3}} />
            <div style={{position: 'absolute', left: TX, top: y - 40, height: 80, display: 'flex', alignItems: 'center', gap: 14, background: INK, borderRadius: 18,
                         padding: '0 28px 0 20px', whiteSpace: 'nowrap', opacity: Math.min(1, e * 2), transform: `translateX(${(1 - Math.min(1, e)) * -30}px) scale(${0.85 + 0.15 * Math.min(1, e)})`, transformOrigin: 'left center'}}>
              <Icon name={tl.icon} size={42} color={GOLD} stroke={2.6} />
              <span style={{fontSize: 44, fontWeight: 900, color: PAPER, letterSpacing: 1}}>{tl.t}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

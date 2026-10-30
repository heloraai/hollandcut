import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 合作平台列（叠加层，人物保持全屏）：左侧依次滑进真平台卡（logo 卡 / 截图卡），
 * 下面砸一个大号金色价签，再淡出一行补充。整列收在 x≤720（右侧会被抖音横屏的按钮列挡住）。
 */
export type PartnerCard = {kind: 'logo' | 'image'; src: string; ar: number; title: string; sub?: string; at: number; tag?: {t: string; at: number}};   // tag：卡片右侧弹一个金色小牌（「大脑」「身体」）
export type PartnerSpec = {start: number; end: number; cards: PartnerCard[];
  callout?: {t: string; at: number} | null; note?: {t: string; at: number} | null; notes?: {t: string; at: number}[]};   // notes：价签下面一排小牌，说到哪个弹哪个

const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const CX = 310;   // 卡片左边线 x=30，和章节标签对齐
const CW = 560;   // Boss 岗位卡要看得清薪资

export const calloutTimes = (s: PartnerSpec): number[] => (s.callout ? [s.callout.at] : []);

const Col: React.FC<{s: PartnerSpec; live: boolean}> = ({s, live}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const b = F(s.end);
  const out = interpolate(f, [b, b + 10], [1, 0], {...CL, easing: Easing.inOut(Easing.ease)});
  let y = 124;
  const slots = s.cards.map((c) => {
    const h = c.kind === 'logo' ? 132 : Math.round(CW / (c.ar || 2)) + 44;
    const top = y; y += h + 22; return {top, h};
  });
  const calloutTop = y + 8;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: out, fontFamily: FONT}}>
      {s.cards.map((c, i) => {
        const at = F(c.at);
        if (f < at) return null;
        const e = spring({frame: f - at, fps, config: {damping: 14, stiffness: 170, mass: 0.8}});
        const flash = interpolate(f - at, [0, 3, 10], [0.7, 0.4, 0], CL);
        const idle = live ? 2.5 * Math.sin((f + i * 25) / 28) : 0;
        const {top} = slots[i];
        return (
          <div key={i} style={{position: 'absolute', left: CX, top: top + idle, translate: '-50% 0', width: CW,
                               opacity: Math.min(1, e * 1.6), transform: `translateX(${-(1 - e) * 380}px) rotate(${-(1 - e) * 6}deg)`}}>
            <div style={{position: 'relative', overflow: 'hidden', borderRadius: 20, border: `2.6px solid ${GOLD}`,
                         background: '#15161B'}}>
              {c.kind === 'logo' ? (
                <div style={{display: 'flex', alignItems: 'center', gap: 24, padding: '18px 26px'}}>
                  <div style={{width: 96, height: 96, borderRadius: 22, overflow: 'hidden', background: '#fff', flex: 'none',
                               boxShadow: 'none'}}>
                    <Img src={staticFile(c.src)} style={{width: 96, height: 96, objectFit: 'contain'}} />
                  </div>
                  <div>
                    <div style={{fontSize: c.title.length > 10 ? 38 : 48, fontWeight: 900, color: GOLD_LITE, letterSpacing: c.title.length > 10 ? 0 : 1, whiteSpace: 'nowrap'}}>{c.title}</div>
                    {c.sub ? <div style={{marginTop: 4, fontSize: 25, color: 'rgba(239,232,215,0.78)', letterSpacing: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{c.sub}</div> : null}
                  </div>
                  {c.tag && f >= F(c.tag.at) ? (() => {
                    const te = spring({frame: f - F(c.tag!.at), fps, config: {damping: 9, stiffness: 220, mass: 0.7}});
                    return <div style={{marginLeft: 'auto', background: '#F6C453', color: '#15161B', fontSize: 34, fontWeight: 900, letterSpacing: 3, padding: '7px 16px 9px', borderRadius: 14, flex: 'none',
                                        whiteSpace: 'nowrap', opacity: Math.min(1, te * 2), transform: `scale(${1.7 - 0.7 * Math.min(1, te)})`}}>{c.tag!.t}</div>;
                  })() : null}
                </div>
              ) : (
                <div>
                  <Img src={staticFile(c.src)} style={{width: CW, height: Math.round(CW / (c.ar || 2)), objectFit: 'cover', display: 'block'}} />
                  <div style={{padding: '9px 16px', fontSize: 20, color: 'rgba(239,232,215,0.85)', letterSpacing: 0,
                               display: 'flex', justifyContent: 'space-between', gap: 12, whiteSpace: 'nowrap'}}>
                    <b style={{color: GOLD_LITE}}>{c.title}</b>{c.sub ? <span>{c.sub}</span> : null}
                  </div>
                </div>
              )}
              <span style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash, pointerEvents: 'none'}} />
            </div>
          </div>
        );
      })}

      {s.callout && f >= F(s.callout.at) ? (() => {
        const d = f - F(s.callout.at);
        const e = spring({frame: d, fps, config: {damping: 9, stiffness: 220, mass: 0.7}});
        const glow = live ? 14 + 10 * Math.abs(Math.sin(d / 7)) : 14;
        return (
          <div style={{position: 'absolute', left: CX - CW / 2, top: calloutTop, whiteSpace: 'nowrap',   /* 价签左对齐到 x=30，和卡片、章节标签一条线 */
                       textAlign: 'center', transformOrigin: 'left center', padding: '14px 34px 12px', borderRadius: 18,
                       background: '#F6C453', color: '#15161B',   /* 扁平：纯色金块，不倾斜、无描边无投影 */
                       fontSize: 52, fontWeight: 900, letterSpacing: 2,
                       transform: `scale(${1.5 - 0.5 * Math.min(1, e)})`, opacity: Math.min(1, e * 2)}}>
            {s.callout.t}
          </div>
        );
      })() : null}

      {/* 价签下面一排小牌（左对齐，放不下自动折行）：说到哪个弹哪个 */}
      <div style={{position: 'absolute', left: CX - CW / 2, top: calloutTop + (s.callout ? 116 : 0), width: CW + 80, display: 'flex', flexWrap: 'wrap', gap: 12}}>
        {[...(s.note ? [s.note] : []), ...(s.notes ?? [])].map((n, k) => {
          if (f < F(n.at)) return null;
          const e = spring({frame: f - F(n.at), fps, config: {damping: 12, stiffness: 210, mass: 0.7}});
          return (
            <div key={k} style={{fontSize: 32, fontWeight: 800, letterSpacing: 2, color: '#F5F0E6', whiteSpace: 'nowrap', background: '#15161B', borderRadius: 16,
                                 padding: '9px 24px 11px', opacity: Math.min(1, e * 2), transform: `translateY(${(1 - e) * 16}px) scale(${0.8 + 0.2 * e})`}}>
              {n.t}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const PartnerColumns: React.FC<{cols: PartnerSpec[]; live?: boolean}> = ({cols, live = false}) => {
  const f = useCurrentFrame();
  const cur = cols.find((s) => f >= F(s.start) - 30 && f < F(s.end) + 10);
  return cur ? <Col s={cur} live={live} /> : null;
};

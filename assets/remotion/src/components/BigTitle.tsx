import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * max 档招牌时刻 · 大字散射标题（照抖音参考片「长期资产」逐帧拆解）：
 * 每个字从不同方向、带旋转、从 1.8× 缩着飞进来，左→右依次落位小弹跳；goldFrom 之前米白、之后金色；
 * 实心硬偏移阴影；落定后每个字保留一点旋转 / 基线错落（贴纸感）。
 * 可选：金印章斜盖（stamp）+ 最多两个药丸分列金章两侧（pills）。参数来自 structure.py 的 title(...)。
 * 只放在人物全屏段（gen_spec 会查）；中英文都行，字号按字宽自动缩到 1500px 内。
 */
export type TitleSpec = {
  text: string;
  goldFrom: number;
  start: number;
  end: number;
  stamp?: {t: string; at: number} | null;
  pills?: {t: string; at: number}[];
};

const FR = (s: number) => Math.round(s * T.FPS);
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const isCJK = (c: string) => c.charCodeAt(0) > 0x2e80;
/** 估算宽度（em）：中文 ≈ 1.05，拉丁圆体粗 ≈ 0.6 */
const em = (s: string) => [...s].reduce((a, c) => a + (isCJK(c) ? 1.05 : 0.6), 0);

const Pill: React.FC<{at: number; side: 'l' | 'r'; children: React.ReactNode}> = ({at, side, children}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (f < at) return null;
  const e = spring({frame: f - at, fps, config: {damping: 10, stiffness: 210, mass: 0.7}});
  const k = side === 'r' ? 1 : -1;
  return (
    <div
      style={{
        background: 'rgba(14,15,20,0.92)', color: GOLD_LITE, border: `2.6px solid ${GOLD}`,
        borderRadius: 999, padding: '12px 34px', fontFamily: FONT, fontSize: 38, fontWeight: 800,
        letterSpacing: 2, boxShadow: '5px 6px 0 rgba(0,0,0,0.65)', whiteSpace: 'nowrap',
        opacity: Math.min(1, e * 1.5),
        transform: `translateX(${(1 - e) * 90 * k}px) scale(${0.7 + 0.3 * e}) rotate(${(1 - e) * 7 * k}deg)`,
      }}
    >
      {children}
    </div>
  );
};

const Title: React.FC<{t: TitleSpec}> = ({t}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tIn = FR(t.start);
  const tOut = FR(t.end);
  const chars = [...t.text];
  const n = chars.length;
  const fs = Math.min(200, 1500 / Math.max(1, em(t.text)));
  const gapF = Math.min(2.2, 22 / Math.max(1, n)); // 逐字间隔（帧）：长词整体入场也不超过 ~0.75s
  const out = interpolate(f, [tOut, tOut + 14], [1, 0], CLAMP);
  const stampAt = t.stamp ? FR(t.stamp.at) : 0;
  const stampE = t.stamp && f >= stampAt ? spring({frame: f - stampAt, fps, config: {damping: 9, stiffness: 220, mass: 0.7}}) : 0;
  const stampW = t.stamp ? em(t.stamp.t) * 52 + [...t.stamp.t].length * 8 + 100 : 0;
  const pills = t.pills ?? [];
  const solo = !t.stamp && pills.length === 1;
  const side = t.stamp ? stampW / 2 + 44 : 20; // 药丸离中线的距离
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out, transform: `scale(${1 - 0.05 * (1 - out)})`, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 470, display: 'flex', justifyContent: 'center', alignItems: 'baseline'}}>
        {chars.map((ch, i) => {
          // 没轮到的字也占位（透明），落位时整行不会左右挪
          const at = tIn + Math.round(i * gapF);
          const e = f >= at ? spring({frame: f - at, fps, config: {damping: 10.5, stiffness: 150, mass: 0.85}}) : 0;
          const sgn = i % 2 ? 1 : -1;
          const dx = -300 + (n > 1 ? (i * 780) / (n - 1) : 0);
          const dy = -(200 + ((i * 7) % 4) * 45);
          const rot = sgn * (18 + ((i * 5) % 13));
          const settleRot = sgn * (2 + (i % 3));
          const settleY = -sgn * (4 + ((i * 3) % 9));
          const gold = i >= t.goldFrom;
          const cjk = isCJK(ch);
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                whiteSpace: 'pre',
                fontFamily: cjk ? FONT : `"Arial Rounded MT Bold", ${FONT}`,
                fontSize: fs,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: cjk ? 8 : 4,
                color: gold ? '#e0b45c' : '#f6efdc',
                textShadow: gold
                  ? '7px 9px 0 rgba(20,12,2,0.92), 0 0 60px rgba(201,162,74,0.4)'
                  : '7px 9px 0 rgba(20,12,2,0.92), 0 0 46px rgba(246,239,220,0.25)',
                opacity: Math.min(1, e * 1.6),
                transform: `translate(${dx * (1 - e)}px, ${dy * (1 - e) + settleY * e}px) rotate(${rot * (1 - e) + settleRot * e}deg) scale(${1.8 - 0.8 * e})`,
                transformOrigin: '50% 80%',
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
      {t.stamp && f >= stampAt ? (
        <div
          style={{
            position: 'absolute', left: '50%', top: 706, translate: '-50%',
            background: 'linear-gradient(135deg, #e6cf92, #c9a24a)', color: '#17130a',
            fontSize: 52, fontWeight: 900, letterSpacing: 8, padding: '16px 46px', whiteSpace: 'nowrap',
            borderRadius: 16, border: '4px solid #fdfbf4',
            boxShadow: '8px 10px 0 rgba(0,0,0,0.6), 0 0 60px rgba(201,162,74,0.5)',
            transform: `rotate(-5deg) scale(${1.9 - 0.9 * Math.min(1, stampE)})`,
            opacity: Math.min(1, stampE * 1.8),
          }}
        >
          {t.stamp.t}
          <span style={{position: 'absolute', inset: -4, borderRadius: 16, background: '#fff', opacity: interpolate(f - stampAt, [0, 2, 8], [0.95, 0.8, 0], CLAMP), pointerEvents: 'none'}} />
        </div>
      ) : null}
      {pills[0] ? (
        <div style={solo ? {position: 'absolute', left: '50%', top: 722, translate: '-50%'} : {position: 'absolute', right: 960 + side, top: 722}}>
          <Pill at={FR(pills[0].at)} side="l">{pills[0].t}</Pill>
        </div>
      ) : null}
      {pills[1] ? (
        <div style={{position: 'absolute', left: 960 + side, top: 722}}>
          <Pill at={FR(pills[1].at)} side="r">{pills[1].t}</Pill>
        </div>
      ) : null}
    </div>
  );
};

/** 全片的大字标题（TITLES 列表），同一时刻只出一个 */
export const BigTitles: React.FC<{titles: TitleSpec[]}> = ({titles}) => {
  const f = useCurrentFrame();
  const cur = titles.find((t) => f >= FR(t.start) && f <= FR(t.end) + 14);
  return cur ? <Title key={cur.start} t={cur} /> : null;
};

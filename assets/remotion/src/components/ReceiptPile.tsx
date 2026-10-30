import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';

/**
 * 截图摞（证据截图放开头）：人物右边（人物右侧轮廓开头最远 x 1235）一摞截图，说到关键词一张接一张弹上来叠成一摞（下面每张露出一截），
 * 和左边的卡、下面的大字一起往右收。卡图 912×558（含 24px 边和硬投影）。
 * 弹出：从左边缘 1.35 倍、多转 10° 弹到位（原点在左边缘，放大只往右长，不扫到脸）。
 */
export type PileSpec = {end: number; items: {src: string; x: number; y: number; w: number; rot: number; at: number}[]};

const F = (s: number) => Math.round(s * 30);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const ReceiptPile: React.FC<{s: PileSpec | null}> = ({s}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!s || !s.items.length || f < F(s.items[0].at) || f > F(s.end) + 10) return null;
  const out = interpolate(f, [F(s.end), F(s.end) + 8], [0, 1], {...CL, easing: Easing.in(Easing.cubic)});
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 1 - out, transform: `translateX(${70 * out}px)`}}>
      {s.items.map((it, i) => {
        const d = f - F(it.at);
        if (d < 0) return null;
        const e = spring({frame: d, fps, config: {damping: 13, stiffness: 230, mass: 0.6}});
        return <Img key={i} src={staticFile(it.src)} style={{position: 'absolute', left: it.x, top: it.y, width: it.w, height: Math.round((it.w * 558) / 912),
                     opacity: Math.min(1, (d + 1) / 2), transformOrigin: '0% 50%', transform: `rotate(${it.rot + 10 * (1 - e)}deg) scale(${1.35 - 0.35 * e})`}} />;
      })}
    </div>
  );
};

import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';

/**
 * logo 环（开头第一秒）：
 *   一圈产品真 logo 绕着人头一个接一个原地弹出来（白底圆角方块 + 硬投影）；
 *   收的时候整圈原地缩没（从左到右错 1 帧，6 帧缩完），大字同时飞进来（往大字中心飞的话途中会扫过脸）。
 * 只在人物全屏时用；logo 都在下巴以上（大字墨迹顶 y=575），右边不进 x>1665。时间全是母版秒。
 */
export type BurstSpec = {
  start: number; gap: number; pullAt: number; to: [number, number];
  cx: number; cy: number; rx: number; ry: number; a0: number; a1: number;   // 椭圆中心 / 半径 / 起止角（度，0 = 正右，逆时针为正，屏幕 y 向下）
  size: number; logos: string[];
};

const F = (s: number) => Math.round(s * 30);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const LogoBurst: React.FC<{s: BurstSpec | null}> = ({s}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!s || f < F(s.start) - 1 || f > F(s.pullAt) + s.logos.length + 8) return null;
  const n = s.logos.length;
  return (
    <>
      {s.logos.map((src, k) => {
        const a = ((s.a0 + (s.a1 - s.a0) * (n === 1 ? 0.5 : k / (n - 1))) * Math.PI) / 180;
        const x = s.cx + s.rx * Math.cos(a), y = s.cy - s.ry * Math.sin(a);
        const t = s.start + k * s.gap;
        const e = f < F(t) ? 0 : spring({frame: f - F(t), fps, config: {damping: 11, stiffness: 230, mass: 0.6}});
        if (e <= 0.001) return null;
        // 10-26 自查：从人头中心往外蹦 / 往大字中心收，途中会扫过脸 → 原地弹出、原地缩没（收的时候从左到右错 1 帧）
        const pk = interpolate(f, [F(s.pullAt) + k, F(s.pullAt) + k + 6], [0, 1], {...CL, easing: Easing.in(Easing.cubic)});
        const qx = x, qy = y;
        const sc = Math.min(1.08, e) * (1 - pk);
        const rot = (1 - Math.min(1, e)) * (k % 2 ? 14 : -14);
        return (
          <div key={k} style={{position: 'absolute', left: qx - s.size / 2, top: qy - s.size / 2, width: s.size, height: s.size, borderRadius: s.size * 0.24,
                               background: '#FFFFFF', border: '3px solid #15161B', boxShadow: '4px 5px 0 rgba(21,22,27,0.45)', overflow: 'hidden',
                               display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1 - pk,
                               transform: `scale(${sc}) rotate(${rot}deg)`}}>
            <Img src={staticFile(src)} style={{width: '78%', height: '78%', objectFit: 'contain'}} />
          </div>
        );
      })}
    </>
  );
};

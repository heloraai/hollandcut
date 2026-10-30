import React from 'react';
import {AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate, Easing} from 'remotion';
import {T} from '../theme';

/**
 * 全屏真实录屏：
 * 所有操作步骤都是同一种画面 —— 录屏铺满全屏、人物缩左下圆窗。片段由 rec_clips.py 按母版时间拼好（敏感信息在那一步已经糊掉）。
 * cam：镜头推近（到位时刻, 中心x, 中心y, 倍数）—— 手机上看得清按钮；clicks：点击处一圈金色涟漪；marks：高亮框。
 */
const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const GOLD = '#F6C453', CORAL = '#FF6B4A';
const MOVE = 18;   // 镜头每次移动用的帧数（到位时刻之前的 0.6s）

const camAt = (cam: number[][], frame: number) => {
  let cur = [0, 960, 540, 1];
  for (const k of cam) {
    const t1 = F(k[0]);
    if (frame >= t1) { cur = k; continue; }
    const p = interpolate(frame, [t1 - MOVE, t1], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)});
    return [0, cur[1] + (k[1] - cur[1]) * p, cur[2] + (k[2] - cur[2]) * p, cur[3] + (k[3] - cur[3]) * p];
  }
  return cur;
};

export const ScreenRecs: React.FC<{shows: any[]}> = ({shows}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {shows.filter((x) => x.type === 'video' && x.full && x.fin).map((x, i) => {
        const op = interpolate(frame, [F(x.fin[0]), F(x.fin[1]), F(x.fout[0]), F(x.fout[1])], [0, 1, 1, 0], {...CL, easing: Easing.inOut(Easing.ease)});
        if (op <= 0.002) return null;
        const [, cx, cy, z] = camAt((x.cam ?? []) as number[][], frame);
        // 把 (cx, cy) 挪到画面中心再放大；贴边时夹住，不露出画外。free：左右不夹（录屏本身左侧是纯色留白时，让内容让到人物圆窗右边，露出的部分用 bg 补）
        const tx = x.free ? T.W / 2 - cx * z : Math.min(0, Math.max(T.W - T.W * z, T.W / 2 - cx * z));
        const ty = Math.min(0, Math.max(T.H - T.H * z, T.H / 2 - cy * z));
        return (
          <Sequence key={'rec' + i} from={Math.max(0, F(x.fin[0]))} layout="none">
            <AbsoluteFill style={{opacity: op, background: x.bg ?? '#0b0c10', overflow: 'hidden'}}>
              <div style={{position: 'absolute', left: 0, top: 0, width: T.W, height: T.H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})`}}>
                <OffthreadVideo src={staticFile(x.src)} muted style={{width: T.W, height: T.H, display: 'block'}} />
                {((x.marks ?? []) as number[][]).map((m, k) => {
                  if (frame < F(m[0]) || frame > F(m[1]) + 6) return null;
                  const e = interpolate(frame - F(m[0]), [0, 8], [0, 1], {...CL, easing: Easing.out(Easing.back(1.6))});
                  const o = interpolate(frame, [F(m[1]), F(m[1]) + 6], [1, 0], CL);
                  return <div key={'m' + k} style={{position: 'absolute', left: m[2], top: m[3], width: m[4], height: m[5], border: `${5 / z + 3}px solid ${CORAL}`, borderRadius: 14,
                                                    opacity: Math.min(1, e * 1.5) * o, transform: `scale(${1.25 - 0.25 * e})`}} />;
                })}
                {((x.clicks ?? []) as number[][]).map((c, k) => {
                  const d = frame - F(c[0]);
                  if (d < 0 || d > 16) return null;
                  const r = interpolate(d, [0, 16], [10, 62], {...CL, easing: Easing.out(Easing.cubic)}) / Math.sqrt(z);
                  return <div key={'c' + k} style={{position: 'absolute', left: c[1] - r, top: c[2] - r, width: r * 2, height: r * 2, borderRadius: '50%',
                                                    border: `${6 / Math.sqrt(z)}px solid ${GOLD}`, opacity: interpolate(d, [0, 3, 16], [0, 1, 0], CL), boxSizing: 'border-box'}} />;
                })}
              </div>
              {/* 字幕垫底：录屏底部一层暗渐变。10-18 审片：抖音页播放控制条 / 标题行正好横在字幕带里、像第二行字幕 → 从 76% 起、底部加深到 0.72 */}
              <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 76%, rgba(0,0,0,0.72) 100%)'}} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};

import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 数字弹窗：压在纯录屏演示段上（录屏里没有人物，不缩圆窗）。
 * 说到数字时从画面右上角弹出，数字从 0 滚到位，下面一行短标签 + 降幅箭头，几秒后收走。
 */
export type PopSpec = {
  start: number;
  end: number;
  num: number;
  suffix?: string;
  label: string;
  x?: number;
  y?: number;
};

const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Pop: React.FC<{p: PopSpec; live: boolean}> = ({p, live}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = F(p.start);
  const b = F(p.end);
  const e = spring({frame: f - a, fps, config: {damping: 12, stiffness: 165, mass: 0.8}});
  const out = interpolate(f, [b, b + 8], [1, 0], {...CL, easing: Easing.inOut(Easing.ease)});
  const dec = String(p.num).includes('.') ? 1 : 0;
  const k = interpolate(f - a, [3, 26], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
  const shown = (p.num * k).toFixed(dec);
  const breathe = live ? 1 + 0.02 * Math.sin((f - a) / 9) : 1;
  return (
    <div
      style={{
        position: 'absolute',
        left: p.x ?? 1590,
        top: p.y ?? 250,
        translate: '-50% -50%',
        fontFamily: FONT,
        opacity: Math.min(1, e * 1.6) * out,
        transform: `rotate(${(1 - e) * -6}deg) scale(${(0.6 + 0.4 * e) * breathe}) translateY(${(1 - out) * -26}px)`,
      }}
    >
      <div
        style={{
          // 深墨底：这几段录屏是近白网页，米白卡压上去几乎没有明暗差
          position: 'relative', display: 'flex', alignItems: 'center', gap: 20, whiteSpace: 'nowrap',
          background: 'rgba(12,13,17,0.93)', border: `3.4px solid ${GOLD}`, borderRadius: 22, padding: '16px 30px 16px 26px',
          boxShadow: '0 22px 60px rgba(0,0,0,0.55), 0 0 34px rgba(201,162,74,0.28)',
        }}
      >
        <span
          style={{
            position: 'absolute', inset: 0, borderRadius: 22, background: '#fff', pointerEvents: 'none',
            opacity: interpolate(f - a, [0, 3, 10], [0.9, 0.55, 0], CL),
          }}
        />
        {/* 下降箭头 */}
        <span
          style={{
            width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg, #e6cf92, #c9a24a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
            transform: `translateY(${live ? 3 * Math.sin((f - a) / 7) : 0}px)`,
          }}
        >
          <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#17130a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v15" />
            <path d="M5 13l7 7 7-7" />
          </svg>
        </span>
        <div>
          <div style={{fontSize: 82, fontWeight: 900, lineHeight: 1, color: GOLD_LITE, letterSpacing: 1}}>
            {shown}
            <span style={{fontSize: 46, marginLeft: 2}}>{p.suffix ?? ''}</span>
          </div>
          <div style={{marginTop: 6, fontSize: 27, fontWeight: 800, letterSpacing: 2, color: '#efe8d7'}}>{p.label}</div>
        </div>
      </div>
    </div>
  );
};

export const NumberPops: React.FC<{pops: PopSpec[]; live?: boolean}> = ({pops, live = false}) => {
  const f = useCurrentFrame();
  return (
    <>
      {pops
        .filter((p) => f >= F(p.start) && f < F(p.end) + 10)
        .map((p, i) => (
          <Pop key={i} p={p} live={live} />
        ))}
    </>
  );
};

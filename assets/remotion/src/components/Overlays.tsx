import React from 'react';
import {
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import {T, GOLD, GOLD_LITE, DARKRED, FONT} from '../theme';

const F = (s: number) => Math.round(s * T.FPS);

/** ① 左上章节标签：贯穿全片，切换时滑出滑入 */
export const ChapterTags: React.FC<{
  chapters: {start: number; end: number; text: string}[];
}> = ({chapters}) => {
  const frame = useCurrentFrame();
  const cur = chapters.find((c) => frame >= F(c.start) && frame < F(c.end));
  if (!cur) return null;
  const SLIDE = 12;
  const inn = interpolate(frame, [F(cur.start), F(cur.start) + SLIDE], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const out = interpolate(frame, [F(cur.end) - SLIDE, F(cur.end)], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const k = Math.min(inn, out);
  return (
    <div
      style={{
        position: 'absolute',
        left: 30,
        top: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'rgba(10,11,15,0.84)',
        border: `2px solid rgba(201,162,74,0.85)`,
        borderRadius: 999,
        padding: '14px 34px 14px 26px',
        fontFamily: FONT,
        fontSize: 40,
        fontWeight: 700,
        letterSpacing: 3,
        color: '#f3ede0',
        opacity: Math.min(1, k * 1.6),
        transform: `translateX(${(1 - k) * -18}px)`,
        clipPath: `inset(0 ${(1 - k) * 100}% 0 0 round 999px)`,
        boxShadow: '4px 5px 0 rgba(0,0,0,0.55)',
      }}
    >
      <span style={{width: 7, height: 32, background: GOLD, borderRadius: 2}} />
      {cur.text}
    </div>
  );
};

const chipColors = (style: string) =>
  style === 'gold'
    ? {bg: '#c9a24a', bd: '#8c6b21', fg: '#17130a'}
    : style === 'red'
    ? {bg: '#6b1f18', bd: '#b85a4c', fg: '#f6dcd6'}
    : {bg: '#f4e9d2', bd: '#8c6b21', fg: '#17130a'};

/** ② 章节标签下的步进词条：竖向金轨 + 圆点 + 序号，逐条弹入 */
const PITCH = 84; // 行距（词条单行高 + 间隙）
export const ChipStacks: React.FC<{
  chips: {start: number; end: number; top?: number; items: {t: string; rf: number; style?: string}[]}[];
}> = ({chips}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const grp = chips.find((c) => frame >= F(c.start) && frame < F(c.end) + 10);
  if (!grp) return null;
  const out = interpolate(frame, [F(grp.end), F(grp.end) + 6], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sprs = grp.items.map((it) =>
    frame >= F(it.rf)
      ? spring({frame: frame - F(it.rf), fps, config: {damping: 12, stiffness: 170, mass: 0.8}})
      : -1,
  );
  const lastIdx = sprs.reduce((m, e, i) => (e >= 0 ? i : m), -1);
  // 金轨随最新词条向下生长
  const railH =
    lastIdx <= 0
      ? 0
      : (lastIdx - 1) * PITCH + PITCH * Math.min(1, Math.max(0, sprs[lastIdx]));
  return (
    <div style={{position: 'absolute', left: 34, top: grp.top ?? 124, opacity: out}}>
      <div
        style={{
          position: 'absolute',
          left: 9,
          top: 34,
          width: 3,
          height: railH,
          background: `linear-gradient(180deg, ${GOLD}, rgba(201,162,74,0.25))`,
          borderRadius: 2,
        }}
      />
      {grp.items.map((it, i) => {
        const e = sprs[i];
        if (e < 0) return null;
        const local = frame - F(it.rf);
        const ap = interpolate(local, [0, 6], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const c = chipColors(it.style ?? 'dark');
        const gold = (it.style ?? 'dark') === 'gold';
        const flash = interpolate(local, [0, 2, 7], [0.95, 0.85, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: i * PITCH,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              opacity: ap,
            }}
          >
            {/* 轨上圆点 */}
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#0c0d12',
                border: `2.4px solid ${GOLD}`,
                boxShadow: `0 0 ${10 * e}px rgba(201,162,74,0.6)`,
                transform: `scale(${0.5 + 0.5 * e})`,
                flex: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                position: 'relative',
                background: c.bg,
                border: `2px solid ${c.bd}`,
                borderLeft: `6px solid ${gold ? '#8c6b21' : GOLD}`,
                borderRadius: 999,
                padding: '12px 30px 12px 22px',
                fontFamily: FONT,
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: 1,
                color: c.fg,
                whiteSpace: 'nowrap',
                boxShadow: '4px 5px 0 rgba(0,0,0,0.6)',
                transform: `translateX(${(1 - e) * -34}px) scale(${0.86 + 0.14 * e})`,
                transformOrigin: 'left center',
              }}
            >
              <span style={{position: 'absolute', inset: -2, borderRadius: 999, background: '#fff', opacity: flash, pointerEvents: 'none'}} />
              <span
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  color: gold ? 'rgba(23,19,10,0.6)' : (it.style === 'red' ? 'rgba(246,220,214,0.7)' : '#8c6b21'),
                  letterSpacing: 0,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              {it.t}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** ③④ 单独展示层：截图大图浮出 / 大字数据滚动 */
export const Shows: React.FC<{shows: any[]}> = ({shows}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {shows.map((x, i) => {
        const a = F(x.start);
        const b = F(x.end);
        if (frame < a || frame >= b + 10) return null;
        const e = spring({frame: frame - a, fps, config: {damping: 14, stiffness: 110, mass: 0.9}});
        const out = interpolate(frame, [b, b + 9], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.ease),
        });
        const flash = interpolate(frame - a, [0, 3, 9], [0.9, 0.75, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const scaleOut = 1;
        if (x.type === 'scroll') {
          // 长截图：卡内视口滚动上升——首尾各停 0.8s，中段缓入缓出滚完全图
          const dw = x.w;
          const ih = x.ih * (dw / x.iw);
          const dist = Math.max(0, ih - x.vh);
          const HOLD = 24;
          const scroll =
            dist *
            interpolate(frame, [a + HOLD, b - HOLD], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.inOut(Easing.cubic),
            });
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 1210,
                top: 465 + (1 - e) * 30,
                translate: '-50% -50%',
                background: T.card,
                border: `2.4px solid ${GOLD}`,
                borderRadius: 22,
                padding: 12,
                boxShadow: '0 26px 70px rgba(0,0,0,0.65), 0 0 34px rgba(201,162,74,0.22)',
                opacity: Math.min(e * 1.4, 1) * out,
                transform: `scale(${(0.9 + 0.1 * e) * scaleOut})`,
                fontFamily: FONT,
              }}
            >
              <span style={{position: 'absolute', inset: -2, borderRadius: 22, background: '#fff', opacity: flash, pointerEvents: 'none', zIndex: 3}} />
              <span
                style={{
                  position: 'absolute',
                  inset: 6,
                  border: '1px solid rgba(201,162,74,0.4)',
                  borderRadius: 16,
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
              <div style={{width: dw, height: x.vh, overflow: 'hidden', borderRadius: 12}}>
                <Img
                  src={staticFile(x.src)}
                  style={{
                    width: dw,
                    height: 'auto',
                    display: 'block',
                    transform: `translateY(${-scroll}px)`,
                  }}
                />
              </div>
              {x.cap ? (
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 400,
                    color: T.sub,
                    marginTop: 9,
                    textAlign: 'center',
                    letterSpacing: 0.5,
                  }}
                >
                  {x.cap}
                </div>
              ) : null}
            </div>
          );
        }
        if (x.type === 'video' && !x.full) {
          const vh = Math.round(x.w / x.ar);
          return (
            <Sequence key={i} from={a} layout="none">
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 1210,
                top: 465 + (1 - e) * 30,
                translate: '-50% -50%',
                background: T.card,
                border: `2.4px solid ${GOLD}`,
                borderRadius: 22,
                padding: 12,
                boxShadow: '0 26px 70px rgba(0,0,0,0.65), 0 0 34px rgba(201,162,74,0.22)',
                opacity: Math.min(e * 1.4, 1) * out,
                fontFamily: FONT,
              }}
            >
              <span style={{position: 'absolute', inset: -2, borderRadius: 22, background: '#fff', opacity: flash, pointerEvents: 'none', zIndex: 3}} />
              <div style={{width: x.w, height: vh, overflow: 'hidden', borderRadius: 12}}>
                <OffthreadVideo
                  src={staticFile(x.src)}
                  muted
                  style={{width: x.w, height: vh, objectFit: 'cover', display: 'block'}}
                />
              </div>
              {x.cap ? (
                <div style={{fontSize: 24, fontWeight: 400, color: T.sub, marginTop: 9, textAlign: 'center', letterSpacing: 0.5}}>
                  {x.cap}
                </div>
              ) : null}
            </div>
            </Sequence>
          );
        }
        if (x.type === 'video' && x.full) return null; // 全屏视频在 Video.tsx 底层渲
        if (x.type === 'image') {
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 1210,
                top: 465 + (1 - e) * 30,
                translate: '-50% -50%',
                background: T.card,
                border: `2.4px solid ${GOLD}`,
                borderRadius: 22,
                padding: 12,
                boxShadow: '0 26px 70px rgba(0,0,0,0.65), 0 0 34px rgba(201,162,74,0.22)',
                opacity: Math.min(e * 1.4, 1) * out,
                transform: `scale(${(0.9 + 0.1 * e) * scaleOut})`,
                fontFamily: FONT,
              }}
            >
              <span style={{position: 'absolute', inset: -2, borderRadius: 22, background: '#fff', opacity: flash, pointerEvents: 'none', zIndex: 3}} />
              <span
                style={{
                  position: 'absolute',
                  inset: 6,
                  border: '1px solid rgba(201,162,74,0.4)',
                  borderRadius: 16,
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
              <Img
                src={staticFile(x.src)}
                style={{width: x.w, height: 'auto', display: 'block', borderRadius: 12}}
              />
              {x.cap ? (
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 400,
                    color: T.sub,
                    marginTop: 9,
                    textAlign: 'center',
                    letterSpacing: 0.5,
                  }}
                >
                  {x.cap}
                </div>
              ) : null}
            </div>
          );
        }
        // 大字数据：金色大号数字从 0 滚到位
        const cnt = Math.round(
          x.num * interpolate(frame - a, [4, 30], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          }),
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 34,
              top: 130 + (1 - e) * 22,
              fontFamily: FONT,
              opacity: Math.min(e * 1.4, 1) * out,
            }}
          >
            <div
              style={{
                fontSize: 128,
                fontWeight: 700,
                lineHeight: 1.02,
                color: GOLD_LITE,
                letterSpacing: 2,
                textShadow:
                  '0 4px 18px rgba(0,0,0,0.85), 0 0 44px rgba(201,162,74,0.35)',
              }}
            >
              {x.prefix ?? ''}
              {cnt}
              <span style={{fontSize: 62}}>{x.suffix ?? ''}</span>
            </div>
            <div
              style={{
                height: 5,
                width: `${100 * interpolate(frame - a, [8, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)})}%`,
                background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LITE})`,
                borderRadius: 3,
                marginTop: 6,
                boxShadow: '2px 3px 0 rgba(0,0,0,0.55)',
              }}
            />
            <div
              style={{
                marginTop: 10,
                fontSize: 27,
                fontWeight: 700,
                color: '#efe8d7',
                letterSpacing: 1.5,
                textShadow: '0 2px 10px rgba(0,0,0,0.85)',
              }}
            >
              {x.label}
            </div>
          </div>
        );
      })}
    </>
  );
};

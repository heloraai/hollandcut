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
import {IconTiles} from './IconTiles';
import {T, GOLD, GOLD_LITE, DARKRED, FONT} from '../theme';

const F = (s: number) => Math.round(s * T.FPS);

/** ① 左上章节标签：贯穿全片，切换时滑出滑入 */
export const ChapterTags: React.FC<{
  chapters: {start: number; end: number; text: string}[];
  /** 这些窗口里不出标签（素材自带录屏段，左上是软件侧栏） */
  hide?: number[][];
}> = ({chapters, hide = []}) => {
  const frame = useCurrentFrame();
  const cur = chapters.find((c) => frame >= F(c.start) && frame < F(c.end));
  if (!cur || hide.some(([a, b]) => frame >= F(a) && frame < F(b))) return null;
  const SLIDE = 12;
  // 章节开头落在隐藏窗口（录屏段）里时，等录屏结束再从头滑入，别在录屏后露出半截
  const s0 = Math.max(F(cur.start), ...hide.filter(([a, b]) => F(cur.start) >= F(a) && F(cur.start) < F(b)).map(([, b]) => F(b)));
  const inn = interpolate(frame, [s0, s0 + SLIDE], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const out = cur === chapters[chapters.length - 1] ? 1 : interpolate(frame, [F(cur.end) - SLIDE, F(cur.end)], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const k = Math.min(inn, out);
  // 10-10：text =「前缀|标题|第几步/共几步」（不带 | 的照旧只有标题）。前缀「教程」金底实心，其余（原理 / 算账 / 对比）金边；
  // 进度点：做过的实心金、当前这步实心 + 奶油色外圈、还没到的空心 —— 看的人知道现在是讲解还是操作、教程走到第几步
  const [pre, title, prog] = cur.text.includes('|') ? cur.text.split('|') : ['', cur.text, ''];
  const [step, total] = prog ? prog.split('/').map(Number) : [0, 0];
  return (
    <div
      style={{
        position: 'absolute',
        left: 30,
        top: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: '#15161B',   /* 扁平：纯色不透明（压在录屏上时底下的字不透出来）*/
        border: `2px solid #F6C453`,
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
      }}
    >
      <span style={{width: 7, height: 32, background: '#F6C453', borderRadius: 2}} />
      {pre ? (
        <span style={{fontSize: 28, fontWeight: 900, letterSpacing: 3, lineHeight: 1, padding: '7px 14px 7px 17px', borderRadius: 999,
                      background: pre === '教程' ? '#F6C453' : 'transparent', color: pre === '教程' ? '#15161B' : '#F6C453',
                      border: '2px solid #F6C453'}}>{pre}</span>
      ) : null}
      {title}
      {total ? (
        <span style={{display: 'flex', alignItems: 'center', gap: 9, marginLeft: 2}}>
          {Array.from({length: total}).map((_, i) => (
            <span key={i} style={{width: 16, height: 16, borderRadius: '50%', boxSizing: 'border-box',
                                  background: i < step ? '#F6C453' : 'transparent', border: '2.5px solid #F6C453',
                                  boxShadow: i === step - 1 ? '0 0 0 3px #15161B, 0 0 0 5.5px #f3ede0' : 'none'}} />
          ))}
        </span>
      ) : null}
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
  /** max 档：打字机 / 最新一条呼吸光 / 轨点脉动 / 微浮动 / 落位扫光 */
  live?: boolean;
}> = ({chips, live = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const grp = chips.find((c) => frame >= F(c.start) && frame < F(c.end) + 10);
  if (!grp) return null;
  if (grp) return <IconTiles grp={grp as any} live={live} />;   // 并列观点列（信息类的提示走 Cues.tsx）
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
        // 落位后一道金光扫过词条
        const sweep = interpolate(local, [10, 26], [-40, 140], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.ease),
        });
        const typed = live ? it.t.slice(0, Math.max(1, Math.floor((local - 2) * 1.2))) : it.t;
        const active = live && i === lastIdx;
        const idle = live ? 2.2 * Math.sin(frame / 24 + i * 1.4) * Math.min(1, e) : 0;
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
              transform: `translateY(${idle}px)`,
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
                transform: `scale(${(0.5 + 0.5 * e) * (1 + (live ? 0.12 : 0) * Math.sin(frame / 7 + i * 2))})`,
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
                boxShadow: active
                  ? `4px 5px 0 rgba(0,0,0,0.6), 0 0 ${15 + 7 * Math.sin(frame / 6)}px rgba(201,162,74,0.75)`
                  : '4px 5px 0 rgba(0,0,0,0.6)',
                transform: `translateX(${(1 - e) * -34}px) scale(${0.86 + 0.14 * e})`,
                transformOrigin: 'left center',
                overflow: 'hidden',
              }}
            >
              <span style={{position: 'absolute', inset: -2, borderRadius: 999, background: '#fff', opacity: flash, pointerEvents: 'none'}} />
              {live ? (
                <span
                  style={{
                    position: 'absolute', top: -8, bottom: -8, left: `${sweep}%`, width: 46,
                    background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.45), transparent)',
                    transform: 'skewX(-18deg)', pointerEvents: 'none',
                  }}
                />
              ) : null}
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
              {typed}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** ③④ 单独展示层：截图大图浮出 / 大字数据滚动 */
// 大图中心 / 最大宽高：右边缘收在 x≤1665（抖音横屏右侧按钮列会挡住更右的部分），左边缘让开左下人物圆窗（x≤448）；
// 中心下移到 492 + 图高 ≤664：卡顶 ≥125 不碰左上章节标签，卡底 ≤857 不碰字幕
const SX = 1060, SY = 502, SW_MAX = 1180, SH_MAX = 640;   // 卡顶 ≥150：和左上章节标签留出空

export const Shows: React.FC<{shows: any[]; live?: boolean}> = ({shows, live = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {shows.map((x0, i) => {
        const x = x0.type === 'term' ? x0 : {...x0, w: Math.round(Math.min(x0.w, SW_MAX, x0.ar ? SH_MAX * x0.ar : Infinity))};
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
                left: SX,
                top: SY + (1 - e) * 30,
                translate: '-50% -50%',
                background: T.card,
                border: `2.4px solid ${GOLD}`,
                borderRadius: 22,
                padding: 12,
                boxShadow: 'none',   /* 扁平：不发光、不投影 */
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
                left: SX,
                top: SY + (1 - e) * 30,
                translate: '-50% -50%',
                background: T.card,
                border: `2.4px solid ${GOLD}`,
                borderRadius: 22,
                padding: 12,
                boxShadow: 'none',   /* 扁平：不发光、不投影 */
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
              {x.stamp && frame >= F(x.stamp.at) ? (
                <div
                  style={{
                    position: 'absolute', left: x.stamp.x ?? '62%', top: x.stamp.y ?? '70%', translate: '-50% -50%', zIndex: 4, whiteSpace: 'nowrap',
                    color: '#fff', background: '#FF6B4A', borderRadius: 16,
                    fontSize: x.stamp.size ?? 56, fontWeight: 900, letterSpacing: 4, padding: '10px 32px 12px', fontFamily: FONT,
                    transform: `scale(${2 - Math.min(1, spring({frame: frame - F(x.stamp.at), fps, config: {damping: 9, stiffness: 220, mass: 0.7}}))})`,
                    opacity: interpolate(frame - F(x.stamp.at), [0, 4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                  }}
                >
                  {x.stamp.t}
                </div>
              ) : null}
            </div>
            </Sequence>
          );
        }
        if (x.type === 'video' && x.full) return null; // 全屏视频在 Video.tsx 底层渲
        if (x.type === 'term') {
          // 终端打字卡：cmd 行逐字打出，out 行整行弹出、数字描金；最后一行带闪烁光标
          const lines = x.lines as {kind: string; t: string; at: number}[];
          const lastShown = lines.reduce((m: number, l, k) => (frame >= F(l.at) ? k : m), -1);
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: SX, top: SY + (1 - e) * 30, translate: '-50% -50%', width: x.w,
                background: '#0f1115', border: `2.4px solid ${GOLD}`, borderRadius: 22, overflow: 'hidden',
                boxShadow: 'none',   /* 扁平：不发光、不投影 */
                opacity: Math.min(e * 1.4, 1) * out,
                transform: e > 0.995 ? 'none' : `perspective(1300px) rotateY(${(1 - e) * (live ? -10 : 0)}deg) scale(${0.9 + 0.1 * e})`,
              }}
            >
              <div style={{height: 56, background: '#1b1e25', display: 'flex', alignItems: 'center', gap: 11, padding: '0 22px', borderBottom: '1px solid #2a2e38'}}>
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{width: 15, height: 15, borderRadius: '50%', background: c}} />)}
                <span style={{marginLeft: 16, fontSize: 24, color: '#9aa0ad', fontFamily: FONT, letterSpacing: 1}}>{x.title}</span>
              </div>
              <div style={{padding: '26px 34px 34px', fontFamily: '"SF Mono", Menlo, Consolas, monospace', fontSize: 34, lineHeight: '62px'}}>
                {lines.map((l, k) => {
                  if (frame < F(l.at)) return null;
                  const local = frame - F(l.at);
                  const text = l.kind === 'cmd' ? l.t.slice(0, Math.max(1, Math.floor(local * 1.5))) : l.t;
                  const ap = l.kind === 'cmd' ? 1 : interpolate(local, [0, 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
                  const parts = text.split(/(\d[\d,.]*%?)/g);
                  return (
                    <div key={k} style={{whiteSpace: 'pre', opacity: ap, color: l.kind === 'cmd' ? '#e8e6df' : '#9fd8a8'}}>
                      {l.kind === 'cmd' ? <span style={{color: GOLD_LITE}}>$ </span> : null}
                      {parts.map((p, j) => (/^\d/.test(p) && l.kind === 'out' ? <span key={j} style={{color: GOLD_LITE, fontWeight: 700}}>{p}</span> : <span key={j}>{p}</span>))}
                      {k === lastShown ? <span style={{display: 'inline-block', width: 16, height: 36, background: GOLD_LITE, verticalAlign: -6, marginLeft: 6, opacity: Math.sin(frame / 5) > 0 ? 1 : 0}} /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }
        if (x.type === 'image') {
          // 缓推镜头：整个展示时长里画面从 1.0 缓慢推近到 1.05
          const kb = !live ? 1 : interpolate(frame, [a, b], [1, 1.05], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          // 落位后一道金光扫过卡面
          const sweep = interpolate(frame - a, [9, 30], [-35, 135], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.inOut(Easing.ease),
          });
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: SX,
                top: SY + (1 - e) * 30,
                translate: '-50% -50%',
                background: T.card,
                border: `2.4px solid ${GOLD}`,
                borderRadius: 22,
                padding: 12,
                boxShadow: 'none',   /* 扁平：不发光、不投影 */
                opacity: Math.min(e * 1.4, 1) * out,
                // 入场落定后撤掉 3D 变换：残留的 perspective + 小数缩放会让 Chrome 分块合成漏出 1px 竖缝（v3 113.3s 闪黑线）
                transform: e > 0.995 ? 'none' : `perspective(1300px) rotateY(${(1 - e) * (live ? -10 : 0)}deg) scale(${(0.9 + 0.1 * e) * scaleOut})`,
                fontFamily: FONT,
                overflow: 'hidden',
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
              {live ? (
                <span
                  style={{
                    position: 'absolute', top: -30, bottom: -30, left: `${sweep}%`, width: 110,
                    background: 'transparent',   /* 扁平：不扫光 */
                    transform: 'skewX(-18deg)', pointerEvents: 'none', zIndex: 3,
                  }}
                />
              ) : null}
              {x.stamp && frame >= F(x.stamp.at) ? (
                <div
                  style={{
                    position: 'absolute', left: x.stamp.x ?? '62%', top: x.stamp.y ?? '70%', translate: '-50% -50%', zIndex: 4, whiteSpace: 'nowrap',
                    color: '#fff', background: '#FF6B4A', borderRadius: 16,
                    fontSize: x.stamp.size ?? 56, fontWeight: 900, letterSpacing: 4, padding: '10px 32px 12px', fontFamily: FONT,
                    transform: `scale(${2 - Math.min(1, spring({frame: frame - F(x.stamp.at), fps, config: {damping: 9, stiffness: 220, mass: 0.7}}))})`,
                    opacity: interpolate(frame - F(x.stamp.at), [0, 4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                  }}
                >
                  {x.stamp.t}
                </div>
              ) : null}
              {x.box && frame >= F(x.box.at) ? (() => {
                const be = spring({frame: frame - F(x.box.at), fps, config: {damping: 11, stiffness: 200, mass: 0.7}});
                const H = Math.round(x.w / x.ar);
                return (
                  <div style={{position: 'absolute', zIndex: 4, left: 12 + x.box.x * x.w, top: 12 + x.box.y * H, width: x.box.w * x.w, height: x.box.h * H,
                               border: '6px solid #FF6B4A', borderRadius: 12,
                               opacity: Math.min(1, be * 2), transform: `scale(${1.6 - 0.6 * Math.min(1, be)})`}} />
                );
              })() : null}
              <div style={{width: x.w, height: Math.round(x.w / x.ar), overflow: 'hidden', borderRadius: 12}}>
                {/* 缓推用布局放大（改宽度 + 负边距居中），不用 transform:scale —— 同一个分块接缝问题 */}
                <Img
                  src={staticFile(x.src)}
                  style={{width: x.w * kb, height: 'auto', display: 'block',
                          marginLeft: -(x.w * (kb - 1)) / 2, marginTop: -(x.w / x.ar * (kb - 1)) / 2}}
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
        // 大字数据：金色大号数字从 0 滚到位
        const cnt = Math.round(
          x.num * interpolate(frame - a, [4, 30], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          }),
        );
        if (x.gauge) {
          // 圆环仪表盘：深色底板压住任何背景；弧线画出 + 端点亮珠；右侧容量条把「只有 N%」讲清楚
          const R = 92, SW = 17, C = 2 * Math.PI * R;
          const p = (x.num / 100) * interpolate(frame - a, [6, 40], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
          });
          const ang = -Math.PI / 2 + p * 2 * Math.PI;
          const dotX = 122 + R * Math.cos(ang), dotY = 122 + R * Math.sin(ang);
          const pulse = 1 + (live ? 0.07 : 0) * Math.sin((frame - a) / 7);
          const sweep = interpolate(frame - a, [10, 36], [-35, 135], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease),
          });
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: 34, top: 112 + (1 - e) * 26, fontFamily: FONT,
                opacity: Math.min(e * 1.4, 1) * out,
                transform: `scale(${0.93 + 0.07 * e})`, transformOrigin: 'left top',
              }}
            >
              <div
                style={{
                  position: 'relative', display: 'flex', alignItems: 'center', gap: 24,
                  background: 'rgba(10,11,15,0.88)', border: `2.4px solid ${GOLD}`, borderRadius: 24,
                  padding: '18px 36px 18px 16px', overflow: 'hidden',
                  boxShadow: '0 22px 60px rgba(0,0,0,0.65), 0 0 34px rgba(201,162,74,0.24)',
                }}
              >
                {live ? <span style={{position: 'absolute', top: -30, bottom: -30, left: `${sweep}%`, width: 100, background: 'linear-gradient(105deg, transparent, rgba(230,207,146,0.14), transparent)', transform: 'skewX(-18deg)', pointerEvents: 'none'}} /> : null}
                <svg width={244} height={244}>
                  <circle cx={122} cy={122} r={R} fill="none" stroke="rgba(201,162,74,0.18)" strokeWidth={SW} />
                  <circle cx={122} cy={122} r={R} fill="none" stroke="rgba(230,207,146,0.25)" strokeWidth={SW + 10} strokeLinecap="round" strokeDasharray={`${C * p} ${C}`} transform="rotate(-90 122 122)" />
                  <circle cx={122} cy={122} r={R} fill="none" stroke="url(#gaugeGrad)" strokeWidth={SW} strokeLinecap="round" strokeDasharray={`${C * p} ${C}`} transform="rotate(-90 122 122)" />
                  <defs>
                    <linearGradient id="gaugeGrad" gradientUnits="userSpaceOnUse" x1="30" y1="30" x2="214" y2="214">
                      <stop offset="0%" stopColor="#e6cf92" />
                      <stop offset="100%" stopColor="#a8842f" />
                    </linearGradient>
                  </defs>
                  <circle cx={dotX} cy={dotY} r={19 * pulse} fill="rgba(230,207,146,0.3)" />
                  <circle cx={dotX} cy={dotY} r={10 * pulse} fill="#e6cf92" />
                  <text x={116} y={140} textAnchor="middle" fontFamily={FONT} fontSize={86} fontWeight={700} fill={GOLD_LITE}>
                    {x.prefix ?? ''}{cnt}<tspan fontSize={40} dy={-4}>{x.suffix ?? ''}</tspan>
                  </text>
                </svg>
                <div style={{width: 370}}>
                  <div style={{fontSize: 29, fontWeight: 700, color: '#efe8d7', letterSpacing: 1.2, lineHeight: 1.4}}>
                    {x.label}
                  </div>
                  <div style={{position: 'relative', marginTop: 18, height: 13, borderRadius: 8, background: 'rgba(201,162,74,0.16)'}}>
                    <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(p * 100, 1.4)}%`, borderRadius: 8, background: 'linear-gradient(90deg, #e6cf92, #c9a24a)'}} />
                    <span style={{position: 'absolute', left: `${Math.max(p * 100, 1.4)}%`, top: '50%', translate: '-50% -50%', width: 21 * pulse, height: 21 * pulse, borderRadius: '50%', background: '#e6cf92', boxShadow: '0 0 0 4px rgba(230,207,146,0.25)'}} />
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 19, color: 'rgba(239,232,215,0.55)', letterSpacing: 1}}>
                    <span>0</span><span>全部额度 100%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }
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

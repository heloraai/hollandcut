import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, Easing} from 'remotion';

/**
 * 开头：人物正后方一块软件大屏，人物抠像盖在屏前：
 *   - 形状：以人为中心左右对称的倒梯形（上沿宽、下沿略窄 = 上沿朝镜头倾一点，只绕 X 轴倾，不斜放），四个角在 spec.wall.quad；
 *     用四角投影（homography → CSS matrix3d）把整块屏（边框 + 界面）精确映射到这四个角，框和高亮都在同一个透视里。
 *   - 快速变大：从人物头后面 s0 倍的小梯形（头两侧露得出来），grow 帧内朝镜头飞到位（大小 = 1 / 距离，先慢后快 + 运动模糊），落定那一帧 Video.tsx 整屏冲击。
 *   - 边框两个方案（spec.wall.frame）：A = 约 14px 黑色玻璃边 + 约 6px 香槟金金属细边；B = 约 8px 香槟金拉丝金属细边。
 *     金色只在 #E9D3A0–#C9A45C 之间很克制地过渡、上沿一道细高光、柔和投影；不要粗倒角、不要多层描边、不要橙棕。
 *   - 屏里是软件真界面（录屏原帧，私人内容先糊掉）；人站在屏前，头和身体挡住中间和底部，
 *     所以高亮要放在两侧露得出来的地方（左栏的行、菜单入口逐个亮金框）。
 * 叠放：原画面（房间）→ 投影 → 这块大屏 → 抠出来的人（person_alpha.webm）→ 大字 / 字幕；三层在 Video.tsx 同一个容器（同一个机位）。
 */
const F = (s: number) => Math.round(s * 30);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const GOLD = '#F6C453';

export type WallSpec = {
  start: number; grow: number; s0: number; from: number[];   // 开始冲出来的秒 / 用的帧数 / 起始倍数 / 起点中心 [x, y]（人物头后面）
  src: string; src2?: string; swapAt?: number; img?: number[];   // 界面图 / 中途换的第二张（可不给）/ 界面图尺寸 [宽, 高]（默认 1920×1080）
  pages?: {src: string; at: number; dur?: number}[];   // 10-20：往后跳转的页（at 秒起 dur 帧（默认 8）整页往左推走、新页从右边推进来，像点进下一页）
  quad: number[];                // 落定时外框四个角 [左上x, 左上y, 右上x, 右上y, 右下x, 右下y, 左下x, 左下y]（画面像素）
  frame: 'A' | 'B';
  chatAt?: number; chat?: number[]; pulseAt?: number;   // 可选：屏上某一行描金框 [x, y, w, h]（界面像素）
  entries: {box: number[]; at: number}[];
  stickers?: Stick[];   // 10-21：贴纸 at 秒弹到屏上 [x, y, w, h]（界面像素），弹完不走；10-22 排名表的卡也走这个（不转、从上方落下）
  outAt: number; outF: number;   // 退场：缩回人物头后面（outF 帧）
};

/** 单位正方形 → 四边形的投影矩阵（Heckbert），再并上 w×h → 单位正方形；返回 CSS matrix3d（transform-origin 0 0） */
const quadMatrix = (w: number, h: number, q: number[]) => {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, hh;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0; b = x2 - x1; c = x0; d = y1 - y0; e = y2 - y1; f = y0; g = 0; hh = 0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    hh = (dx1 * dy3 - dx3 * dy1) / det;
    a = x1 - x0 + g * x1; b = x3 - x0 + hh * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + hh * y3; f = y0;
  }
  // (u, v) = (x / w, y / h)
  const A = a / w, B = b / h, D = d / w, E = e / h, G = g / w, H = hh / h;
  return `matrix3d(${A}, ${D}, 0, ${G}, ${B}, ${E}, 0, ${H}, 0, 0, 1, 0, ${c}, ${f}, 0, 1)`;
};

/** 四边形绕中心缩放、挪到 (cx, cy) */
const shrinkQuad = (q: number[], k: number, cx: number, cy: number) => {
  const mx = (q[0] + q[2] + q[4] + q[6]) / 4, my = (q[1] + q[3] + q[5] + q[7]) / 4;
  return q.map((v, i) => (i % 2 === 0 ? cx + (v - mx) * k : cy + (v - my) * k));
};

/** 金框一笔画出来：圆角矩形描边从 0 走满（10 帧缓出）；pulse 时线宽弹一下 */
const DrawRect: React.FC<{b: number[]; at: number; pulse?: number; sw: number; r: number}> = ({b, at, pulse, sw, r}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [F(at), F(at) + 10], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
  if (p <= 0) return null;
  const pk = pulse != null ? Math.sin(Math.PI * interpolate(f, [F(pulse), F(pulse) + 10], [0, 1], CL)) : 0;
  const [x, y, w, h] = b;
  return (
    <svg style={{position: 'absolute', left: x - sw, top: y - sw, overflow: 'visible'}} width={w + 2 * sw} height={h + 2 * sw}>
      <rect x={sw} y={sw} width={w} height={h} rx={r} ry={r} fill="rgba(246,196,83,0.14)" fillOpacity={p} stroke={GOLD} strokeWidth={sw * (1 + 0.6 * pk)}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - p)} strokeLinecap="round" />
    </svg>
  );
};

/** 菜单项亮金框：从 1.12 倍缩回原位（6 帧缓出）、金色圆角框 + 很淡的金底，亮了不灭 */
const EntryLit: React.FC<{b: number[]; at: number; sw: number}> = ({b, at, sw}) => {
  const f = useCurrentFrame();
  const d = f - F(at);
  if (d < 0) return null;
  const e = interpolate(d, [0, 6], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
  const [x, y, w, h] = b;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 12, boxSizing: 'border-box',
                 border: `${sw}px solid ${GOLD}`, background: 'rgba(246,196,83,0.18)', opacity: Math.min(1, e * 1.5),
                 transform: `scale(${1.12 - 0.12 * e})`}} />
  );
};

/** 贴纸弹上屏：s0 倍（默认 1.5）、多转 spin°（默认 10）、从 dy px 处（默认 0）弹到位（弹簧过冲一点），2 帧淡入 */
type Stick = {src: string; box: number[]; rot?: number; at: number; s0?: number; spin?: number; dy?: number};
const Sticker: React.FC<{s: Stick}> = ({s}) => {
  const f = useCurrentFrame();
  const d = f - F(s.at);
  if (d < 0) return null;
  const e = spring({frame: d, fps: 30, config: {damping: 13, stiffness: 230, mass: 0.6}});
  const [x, y, w, h] = s.box;
  const s0 = s.s0 ?? 1.5;
  return <Img src={staticFile(s.src)} style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: Math.min(1, (d + 1) / 2),
               transform: `translateY(${(s.dy ?? 0) * (1 - e)}px) rotate(${(s.rot ?? 0) + (s.spin ?? 10) * (1 - e)}deg) scale(${s0 - (s0 - 1) * e})`}} />;
};

// 香槟金：浅 → 稍深，克制（#E9D3A0–#C9A45C）
const CHAMPAGNE = 'linear-gradient(180deg, #EFDDB0 0%, #E6CF99 30%, #D6BB7E 68%, #C9A45C 100%)';
const BRUSHED = 'repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 1px, rgba(0,0,0,0.035) 1px, rgba(0,0,0,0.035) 3px)';
// 外框（局部像素）：A = 金边 8 + 黑玻璃 18；B = 金边 11（映射到画面上，上沿约 6 + 14 / 8 px）
const FRAMES = {A: {gold: 8, glass: 18, rOut: 34, rIn: 26}, B: {gold: 11, glass: 0, rOut: 26, rIn: 16}};

export const CodexWall: React.FC<{w: WallSpec | null}> = ({w}) => {
  const f = useCurrentFrame();
  if (!w) return null;
  if (f < F(w.start) || f > F(w.outAt) + w.outF + 1) return null;
  const fr = FRAMES[w.frame ?? 'A'];
  const pad = fr.gold + fr.glass;
  const [IW, IH] = w.img ?? [1920, 1080];
  const OW = IW + 2 * pad, OH = IH + 2 * pad;
  // 冲出来（10 帧缓出的话第 1 帧就跳到四成大、小的时候整块藏在头后面，看着像突然出现）：
  //   所以从人物身后朝镜头匀速飞过来：画面上的大小 = 1 / 距离，先慢后快（小屏先在头两侧露出来，越近越快），落定那一帧 Video.tsx 整屏冲击；
  //   前 3 帧淡入；运动模糊跟着速度走（快的最后几帧最多 6px），落定那帧清楚；退场照旧缩回人物头后面
  const t = interpolate(f, [F(w.start), F(w.start) + w.grow], [0, 1], CL);
  const z0 = 1 / w.s0;
  const sc = 1 / (z0 + (1 - z0) * t);
  const g = (sc - w.s0) / (1 - w.s0);
  const fadeIn = interpolate(f, [F(w.start), F(w.start) + 3], [0, 1], CL);
  const o = interpolate(f, [F(w.outAt), F(w.outAt) + w.outF], [0, 1], {...CL, easing: Easing.in(Easing.cubic)});
  const small = shrinkQuad(w.quad, w.s0, w.from[0], w.from[1]);
  const k = g * (1 - o);
  const q = w.quad.map((v, i) => small[i] + (v - small[i]) * k);
  const blur = Math.max(t < 1 ? 6 * sc ** 4 : 0, 14 * o);
  const swapK = w.src2 && w.swapAt != null ? interpolate(f, [F(w.swapAt), F(w.swapAt) + 4], [0, 1], CL) : 0;
  const lw = 7;   // 屏上金框线宽（界面像素；落到画面上 ≈5px）
  // 投影：梯形往下挪一点、放大一圈，高斯模糊（画在屏后面、墙上）
  const sq = q.map((v, i) => (i % 2 === 1 ? v + 22 : v));
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: fadeIn * (1 - o)}}>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <defs><filter id="wallShadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={22} /></filter></defs>
        <polygon points={`${sq[0]},${sq[1]} ${sq[2]},${sq[3]} ${sq[4]},${sq[5]} ${sq[6]},${sq[7]}`} fill="rgba(0,0,0,0.42)" filter="url(#wallShadow)" />
      </svg>
      <div style={{position: 'absolute', left: 0, top: 0, width: OW, height: OH, transformOrigin: '0 0', transform: quadMatrix(OW, OH, q),
                   filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined}}>
        {/* 香槟金金属边（A：细金边；B：拉丝细金边）：只有浅 → 稍深的过渡 + 上沿一道细高光 */}
        <div style={{position: 'absolute', inset: 0, borderRadius: fr.rOut, background: w.frame === 'B' ? `${BRUSHED}, ${CHAMPAGNE}` : CHAMPAGNE,
                     boxShadow: 'inset 0 3px 0 rgba(255,251,238,0.85), inset 0 -2px 0 rgba(150,118,60,0.35)'}} />
        {/* A：黑色玻璃边（很淡的一层玻璃反光） */}
        {fr.glass > 0 ? (
          <div style={{position: 'absolute', inset: fr.gold, borderRadius: fr.rIn + fr.glass * 0.4, background: 'linear-gradient(180deg, #1c1d22 0%, #0b0b0e 40%, #08080a 100%)'}} />
        ) : null}
        {/* 屏幕：1920×1080 真界面 + 高亮（都在同一个透视里） */}
        <div style={{position: 'absolute', left: pad, top: pad, width: IW, height: IH, borderRadius: fr.rIn, overflow: 'hidden', background: '#fff'}}>
          {/* src → pages 依次推页，不一直卡在同一页 */}
          {[{src: w.src, at: -1, dur: 8}, ...(w.pages ?? [])].map((pg, i, arr) => {
            const pin = i === 0 ? 1 : interpolate(f, [F(pg.at), F(pg.at) + (pg.dur ?? 8)], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)});
            const nx = arr[i + 1];
            const pout = nx ? interpolate(f, [F(nx.at), F(nx.at) + (nx.dur ?? 8)], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)}) : 0;
            if (pin <= 0 || pout >= 1) return null;
            const moving = (pin > 0 && pin < 1) || (pout > 0 && pout < 1);
            return <Img key={i} src={staticFile(pg.src)} style={{position: 'absolute', inset: 0, width: IW, height: IH,
                         transform: `translateX(${((1 - pin) - pout) * IW}px)`, filter: moving ? 'blur(2px)' : undefined}} />;
          })}
          {swapK > 0 && w.src2 ? <Img src={staticFile(w.src2)} style={{position: 'absolute', inset: 0, width: IW, height: IH, opacity: swapK}} /> : null}
          {w.chat && w.chatAt != null ? <DrawRect b={w.chat} at={w.chatAt} pulse={w.pulseAt} sw={lw} r={14} /> : null}
          {w.entries.map((e, i) => <EntryLit key={i} b={e.box} at={e.at} sw={lw} />)}
          {(w.stickers ?? []).map((s, i) => <Sticker key={i} s={s} />)}
          {/* 玻璃：左上一道很淡的斜反光，不压暗界面 */}
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 30%)'}} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

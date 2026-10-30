import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, GOLD_LITE, FONT} from '../theme';

/**
 * max 档招牌时刻 · 大字标题。参数来自 structure.py 的 title(...)，只放在人物全屏段（gen_spec 会查）。
 * 基本写法（一行大字，按台词分块砸）：
 *  - 字要大：中文字号默认 min(200, 1560 / 字宽)，可用 fs 直接给；数字 / 西文放大 DIG 倍，墨迹顶边和中文齐平；
 *  - 按台词分块砸进来（chunks）：每块在说到那个词的那一帧（只晚不早）整块从 1.5 倍 4 帧砸到 1.0、轻轻压一下再回弹；
 *    没轮到的块透明占位，整行不挪。不再逐字从四处散射飞进来（静帧里是一堆散落的字母，很乱）；
 *  - 扁平：米白 #F5F0E6 + 金 #F6C453，实心硬偏移阴影；不发光、不渐变、不倾斜；
 *  - y = 墨迹顶边（下巴 + 10 以下），底边含阴影 ≤ 925：字幕带（950–1020）照常出，不再 nosub；
 *  - stamp = 小章（金块深字，52 号），压在大字左端上方（下巴左边的空处），不放在大字正下方（那里是字幕）；
 *  - 「→」画成实心粗箭头（字体里的箭头太细，撑不住这个字号）。
 * 10-18 钩子修正（审片）：
 *  - 块不再绕自己的中心砸：默认原点在块底边中间（只往上、往两边长，不扫进字幕带），起砸倍数按屏幕边和右下按钮区（x > 1665）封顶；
 *    chunk 可以自己给 o（原点）/ s0（起砸倍数），最右那块用「右下角」原点往左上长，右沿始终不动；
 *  - 只有「→」的块不砸：3 帧从左往右伸出来（原来箭头跟着后一块一起 1.5 倍放大，头三帧压在前一块的末字上）；
 *  - 箭头 2.1em → 1.4em：字号从 174 提到 195 后整行仍在画面 77% 以内，实心字占比更高；
 *  - 小章可给 s0（长章从 1.5 倍砸会扫到脸）。
 * 逐字飞入版：
 *  - fly：块里逐字飞入（每字从 2 倍大、左右交替带一点旋转和运动模糊飞来，阻尼弹簧落定，字间隔 1.5 帧 ≈ 50 ms；
 *    整行两头的字朝里放大，飞的过程也不出画）。字形照旧走本文件的 glyph（数字 / 西文 DIG 倍、「→」实心箭头），空格不占飞入序号；
 *  - smooth：收场 8 帧往下滑 40px 淡出；underline：说到 at 时第 [from, to) 块字下长出金线；
 *  - 每块最后一个字落地那一帧的整屏冲击在 Video.tsx（spec.impacts），这里不震人物层。
 */
export type TitleSpec = {
  text: string;
  goldFrom: number;
  goldTo?: number;
  goldRanges?: number[][];   // 多段金色 [[起, 止), …]
  y?: number;                // 墨迹顶边（默认 760）
  cx?: number;               // 整行中线 x（默认 960）：行太宽时往左挪，右沿不进右下抖音按钮区（x > 1665）
  fs?: number;               // 中文字号（不给按字宽算，上限 200）
  chunks?: {a: number; b: number; at: number; o?: string; s0?: number}[];   // 分块 [起字符, 止字符) + 砸下的母版秒（+ 可选缩放原点 / 起砸倍数）
  jolt?: boolean;            // 块砸到位那一帧人物层轻震（Video.tsx 用 titleJoltFrames 取）
  fly?: boolean;             // 10-19：块里逐字飞入（见上）
  smooth?: boolean;          // 10-19：收场下滑 40px 淡出 8 帧
  underline?: {at: number; from: number; to: number};   // 10-19：说到 at 时从第 from 个字起的那一块下面长出金线
  ls?: number;               // 10-19：中文字距（px，默认 LS_C）
  start: number;
  end: number;
  stamp?: {t: string; at: number; then?: {t: string; at: number}; s0?: number} | null;   // then：说到后半句再把字接上（小章往右长，轻弹一下）
  pills?: {t: string; at: number}[];
};

const FR = (s: number) => Math.round(s * T.FPS);
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const CREAM = '#F5F0E6', GOLD = '#F6C453', INK = '#15161B', SHADOW = 'rgba(20,12,2,0.92)';
const SH = {x: 7, y: 8};             // 实心硬偏移阴影（0 模糊）
const DIG = 1.16;                    // 数字 / 西文字号 = 中文 × 1.16：Arial Rounded 大写高 0.742em × 1.16 ≈ 冬青黑体中文墨迹顶 0.86em
const ARROW = {w: 1.4, h: 0.62, m: 0.27, bar: 0.17, head: 0.46};   // 箭头：宽 / 高 / 左右留白 / 杆粗 / 箭头长（em）；10-18 修正：推近原点挪到底边后字号能到 195，箭头缩回 1.4em
const X_MIN = 16, X_MAX = 1665 - SH.x;   // 砸下那几帧也不出画、不进右下按钮区（阴影算在内）
// 逐字飞入：起始倍数 / 旋转（左右交替）/ 运动模糊（px）/ 字间隔（帧）/ 弹簧（阻尼比 ≈0.65：过冲 ≈7%，落地的冲击只在字上）
const FLY = {s0: 2.0, rot: 12, blur: 8, step: 1.5, damping: 14, stiffness: 190, mass: 0.6};
// 冬青黑体 W6（中文）/ Arial Rounded MT Bold（数字）在 line-height 1 时量出来的：基线离行顶 0.88em / 0.865em，中文墨迹顶在基线上 0.86em、底在基线下 0.095em
const M = {ascC: 0.88, ascL: 0.865, inkC: 0.86, descC: 0.095, inkL: 0.742};

type Kind = 'cjk' | 'latin' | 'arrow' | 'space';
const LS_C = 12;   // 中文字距（px）
const kind = (c: string): Kind => (c === '→' ? 'arrow' : c === ' ' ? 'space' : c.charCodeAt(0) > 0x2e80 || c === '·' ? 'cjk' : 'latin');
const emOf = (s: string) => [...s].reduce((a, c) => {
  const k = kind(c);
  return a + (k === 'cjk' ? 1.05 : k === 'latin' ? 0.62 * DIG : k === 'arrow' ? ARROW.w + 2 * ARROW.m : 0.3);
}, 0);

/** 块砸下的缩放：0→4 帧 s0（默认 1.5）→ 1.0（越砸越快），4→9 帧轻轻压到 0.955 再回到 1.0 */
export const slam = (d: number, s0 = 1.5) => (d < 4 ? 1 + (s0 - 1) * Math.pow(1 - Math.max(0, d) / 4, 2) : d < 9 ? 1 - 0.045 * Math.sin((Math.PI * (d - 4)) / 5) : 1);
/** 「→」块：3 帧从左往右伸出来（ease-out），不放大 */
const draw = (d: number) => (d < 0 ? 0 : 1 - Math.pow(1 - Math.min(1, (d + 1) / 3), 2));
/** 块砸到位那一帧（人物层小震，和 hero 气泡的 ✓ / ✕ 章同一套 3 帧 jolt）*/
export const titleJoltFrames = (titles: TitleSpec[]) =>
  titles.filter((t) => t.jolt).flatMap((t) => (t.chunks ?? []).map((c) => FR(c.at) + 4));

const Arrow: React.FC<{fs: number; color: string}> = ({fs, color}) => {
  const w = ARROW.w * fs, h = ARROW.h * fs, b = ARROW.bar * fs, hl = ARROW.head * fs;
  const d = `M0 ${h / 2 - b / 2} H${w - hl} V0 L${w} ${h / 2} L${w - hl} ${h} V${h / 2 + b / 2} H0 Z`;
  const sw = 0.05 * fs;   // 同色描边 + 圆角：箭头角不扎眼
  return (
    // 替换元素在 baseline 对齐里底边落在基线上：往上挪 0.0725em，箭头中线对齐中文墨迹中线（基线上 0.3825em）
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
         style={{overflow: 'visible', flex: 'none', marginLeft: ARROW.m * fs, marginRight: ARROW.m * fs, position: 'relative', top: -0.0725 * fs}}>
      <path d={d} transform={`translate(${SH.x},${SH.y})`} fill={SHADOW} stroke={SHADOW} strokeWidth={sw} strokeLinejoin="round" />
      <path d={d} fill={color} stroke={color} strokeWidth={sw} strokeLinejoin="round" />
    </svg>
  );
};

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
        borderRadius: 999, padding: '10px 28px', fontFamily: FONT, fontSize: 32, fontWeight: 800,
        letterSpacing: 2, boxShadow: '5px 6px 0 rgba(0,0,0,0.65)', whiteSpace: 'nowrap',
        opacity: Math.min(1, e * 1.5),
        transform: `translateX(${(1 - e) * 90 * k}px) scale(${0.7 + 0.3 * e})`,
      }}
    >
      {children}
    </div>
  );
};

const Title: React.FC<{t: TitleSpec}> = ({t}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chars = [...t.text];
  const n = chars.length;
  const fs = t.fs ?? Math.min(200, 1560 / Math.max(1, emOf(t.text)));
  const chunks: NonNullable<TitleSpec['chunks']> = t.chunks?.length ? t.chunks : [{a: 0, b: n, at: t.start + 0.3}];
  // 每块的大致水平范围（按 emOf 估，误差十来 px）：默认原点在块底边中间，起砸倍数按 X_MIN / X_MAX 封顶
  const W = emOf(t.text) * fs;
  let acc = (t.cx ?? 960) - W / 2;
  const geo = chunks.map((c) => {
    const w = emOf(chars.slice(c.a, c.b).join('')) * fs, L = acc;
    acc += w;
    const mid = L + w / 2, arrowOnly = chars.slice(c.a, c.b).every((ch) => kind(ch) === 'arrow' || kind(ch) === 'space');
    const s0 = c.s0 ?? Math.max(1, Math.min(1.5, (X_MAX - mid) / (w / 2), (mid - X_MIN) / (w / 2)));
    return {arrowOnly, s0, o: c.o ?? '50% 100%'};
  });
  const hasC = chars.some((c) => kind(c) === 'cjk'), hasL = chars.some((c) => kind(c) === 'latin');
  const asc = Math.max(hasC ? M.ascC * fs : 0, hasL ? M.ascL * DIG * fs : 0);
  const inkTop = asc - (hasC ? M.inkC * fs : M.inkL * DIG * fs);   // 行顶到墨迹顶
  const lineTop = (t.y ?? 760) - inkTop;
  const tOut = FR(t.end);
  const out = t.smooth ? interpolate(f, [tOut, tOut + 8], [1, 0], {...CLAMP, easing: Easing.in(Easing.quad)}) : interpolate(f, [tOut, tOut + 10], [1, 0], CLAMP);
  const gold = (i: number) => (t.goldRanges ? t.goldRanges.some(([a, b]) => i >= a && i < b) : i >= t.goldFrom && i < (t.goldTo ?? n));
  const glyph = (ch: string, i: number) => {
    const k = kind(ch);
    const color = gold(i) ? GOLD : CREAM;
    if (k === 'arrow') return <Arrow key={i} fs={fs} color={color} />;
    if (k === 'space') return <span key={i} style={{width: 0.3 * fs, flex: 'none'}} />;
    return (
      <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', lineHeight: 1, fontWeight: 900, color,
                            fontFamily: k === 'cjk' ? FONT : `"Arial Rounded MT Bold", ${FONT}`,
                            fontSize: k === 'cjk' ? fs : fs * DIG, letterSpacing: k === 'cjk' ? (t.ls ?? LS_C) : 4,
                            textShadow: `${SH.x}px ${SH.y}px 0 ${SHADOW}`}}>
        {ch}
      </span>
    );
  };
  const st = t.stamp;
  const sd = st ? f - FR(st.at) : -1;
  const th = st?.then && f >= FR(st.then.at) ? st.then : null;
  const td = th ? f - FR(th.at) : -1;   // 后半句接上那一下：1.08 → 1.0
  const pills = t.pills ?? [];
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out, fontFamily: FONT, ...(t.smooth ? {transform: `translateY(${(1 - out) * 40}px)`} : {})}}>
      <div style={{position: 'absolute', left: (t.cx ?? 960) - 960, width: 1920, top: lineTop, display: 'flex', justifyContent: 'center'}}>
        <div style={{position: 'relative', display: 'flex', alignItems: 'baseline'}}>
          {chunks.map((c, ci) => {
            const d = f - FR(c.at), g = geo[ci];
            if (t.fly) {
              // 块里逐字飞入 —— 第 jj 个字晚 jj × step 帧起飞，弹簧 fe 过 1 那一下 = 落地冲击（只在字上）
              let jj = -1;
              const ul = t.underline && t.underline.from === c.a ? interpolate(f - FR(t.underline.at), [0, 9], [0, 1], {...CLAMP, easing: Easing.out(Easing.cubic)}) : 0;
              return (
                <span key={ci} style={{position: 'relative', display: 'inline-flex', alignItems: 'baseline', opacity: d < 0 ? 0 : 1}}>
                  {chars.slice(c.a, c.b).map((ch, j) => {
                    const i = c.a + j;
                    if (kind(ch) === 'space') return glyph(ch, i);
                    jj += 1;
                    const dc = d - jj * FLY.step;
                    const fe = dc < 0 ? 0 : spring({frame: dc, fps, config: {damping: FLY.damping, stiffness: FLY.stiffness, mass: FLY.mass}});
                    return (
                      <span key={i} style={{display: 'inline-flex', alignItems: 'baseline', flex: 'none',
                                            opacity: dc < 0 ? 0 : interpolate(dc, [0, 3], [0, 1], CLAMP),
                                            filter: fe < 0.98 ? `blur(${(FLY.blur * (1 - Math.min(1, fe))).toFixed(2)}px)` : undefined,
                                            transform: `rotate(${(jj % 2 ? 1 : -1) * FLY.rot * Math.max(0, 1 - fe)}deg) scale(${FLY.s0 - (FLY.s0 - 1) * fe})`,
                                            // 整行两头的字朝里放大（原点在外沿），飞的过程也不出画
                                            transformOrigin: i === 0 ? '0% 60%' : i === n - 1 ? '100% 60%' : '50% 60%'}}>
                        {glyph(ch, i)}
                      </span>
                    );
                  })}
                  {ul > 0 ? <span style={{position: 'absolute', left: '3%', bottom: -Math.round(fs * 0.16), height: Math.round(fs * 0.07), width: `${94 * ul}%`,
                                          background: GOLD, borderRadius: 6, boxShadow: '4px 5px 0 rgba(20,12,2,0.85)'}} /> : null}
                </span>
              );
            }
            return (
              // 没轮到的块也占位（透明），砸下来时整行不挪；原点 / 起砸倍数见上面 geo；「→」块从左往右伸出来
              <span key={ci} style={{display: 'inline-flex', alignItems: 'baseline', opacity: d < 0 ? 0 : g.arrowOnly ? 1 : d === 0 ? 0.9 : 1,
                                     transform: g.arrowOnly ? `scaleX(${draw(d)})` : `scale(${d < 0 ? 1 : slam(d, g.s0)})`,
                                     transformOrigin: g.arrowOnly ? '0% 50%' : g.o}}>
                {chars.slice(c.a, c.b).map((ch, j) => glyph(ch, c.a + j))}
              </span>
            );
          })}
          {st && sd >= 0 ? (
            // 小章：底边在大字墨迹顶上 12px，左端和大字左端对齐；说到那个词时从 1.5 倍砸下
            <div style={{position: 'absolute', left: 4, top: inkTop - 12, transformOrigin: 'left bottom',
                         transform: `translateY(-100%) scale(${slam(sd, st.s0 ?? 1.5) * (td >= 0 && td < 6 ? 1 + 0.08 * Math.sin((Math.PI * td) / 6) : 1)})`, opacity: sd === 0 ? 0.9 : 1,
                         background: GOLD, color: INK, fontFamily: FONT, fontSize: 52, fontWeight: 900, letterSpacing: 2, lineHeight: 1.15,
                         padding: '7px 22px 9px', borderRadius: 12, whiteSpace: 'nowrap', boxShadow: `5px 6px 0 ${SHADOW}`}}>
              {st.t}{th ? th.t : ''}
            </div>
          ) : null}
        </div>
      </div>
      {pills[0] ? (
        <div style={{position: 'absolute', right: 980, top: lineTop + asc + M.descC * fs + 30}}>
          <Pill at={FR(pills[0].at)} side="l">{pills[0].t}</Pill>
        </div>
      ) : null}
      {pills[1] ? (
        <div style={{position: 'absolute', left: 980, top: lineTop + asc + M.descC * fs + 30}}>
          <Pill at={FR(pills[1].at)} side="r">{pills[1].t}</Pill>
        </div>
      ) : null}
    </div>
  );
};

/** 全片的大字标题（TITLES 列表），同一时刻只出一个 */
export const BigTitles: React.FC<{titles: TitleSpec[]}> = ({titles}) => {
  const f = useCurrentFrame();
  const cur = titles.find((t) => f >= FR(t.start) && f <= FR(t.end) + 10);
  return cur ? <Title key={cur.start} t={cur} /> : null;
};

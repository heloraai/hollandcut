import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, FONT} from '../theme';
import {Icon} from './Icons';
import {Bubble, BUB, toneKey} from './Bubble';

/**
 * 动效提示（左上，和章节标签同一条左边线、紧贴其下）：
 * - 单条：说到那个词时从左侧弹进来、停一两秒、自己收掉。
 * - 一组（grp）：同一个话题里连着说的几句，逐条往下叠、一起收掉。
 * 2026-10-08 起每条都是浅色气泡（Bubble.tsx：纸色胶囊 + 深金描边 + 0 模糊硬投影），默认 cream，一组最多一个 gold；
 * strike = 划掉（「不需要 xx」）；mark = check 词尾绿勾；count = 数字卡（大数字从 0 滚到位）；size = 'hero' 开场大号（从 1.7 倍砸下来）。
 */
export type Hint = {t: string; at: number; end: number; tone?: string; icon?: string; img?: string; grp?: number; idx?: number;
                    strike?: boolean; mark?: string; count?: number; mask?: string; pre?: string; suf?: string; label?: string; y?: number; size?: string;
                    goldAt?: number;   // 10-18 钩子修正：先米白、说到这一秒再变金（Bubble 自带的换色 + 轻弹）
                    shot?: {src: string; w: number; h: number; box: number[]; boxAt: number}};
export type LogoPill = {t: string; at?: number; img?: string; icon?: string; mark?: string; tone?: string};
export type LogoRowSpec = {title?: string; titleAt: number; start: number; end: number; y?: number;
                           badge?: {t: string; at: number} | null;
                           items: {img: string; label?: string; at: number}[];
                           rows?: {at: number; pills: LogoPill[]}[];      // logo 下面那一行：一组一组地换
                           pick?: {i: number; at: number} | null};        // 第 i 个 logo 圈出来

const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const GOLD = '#F6C453', INK = '#15161B', PAPER = '#F5F0E6', CORAL = '#FF6B4A', GREEN = '#35B877';
const LEFT = 30, TOP = 124;   // 和左上章节标签同一条左边线，紧贴在它下面
const NUMF = `"Arial Rounded MT Bold", ${FONT}`;

const Check: React.FC<{k: number; bg?: string; cross?: boolean; sz?: number}> = ({k, bg = GREEN, cross = false, sz = 40}) => (
  <span style={{width: sz, height: sz, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', transform: `scale(${k})`}}>
    <svg width={sz * 0.6} height={sz * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
      {cross ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <polyline points="20 6 9 17 4 12" />}
    </svg>
  </span>
);

/** 数字卡（两行：小字标签 + 大数字从 0 滚到位）：浅色气泡同一套描边 / 硬投影，关键数字用 gold（金底墨字），其余 cream */
const NUM = {fs: 64, label: 22, radius: 26, pitch: 128};
const NumCard: React.FC<{h: Hint}> = ({h}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const d = f - F(h.at);
  const A = BUB.ANIM;
  const e = spring({frame: d, fps, config: {damping: A.damping, stiffness: A.stiffness, mass: A.mass}});
  const out = interpolate(f, [F(h.end), F(h.end) + A.outF], [1, 0], {...CL, easing: Easing.in(Easing.cubic)});
  const c = BUB.tone[toneKey(h.tone)];
  const bar = interpolate(d, [2, 11], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
  const n = Math.round((h.count as number) * interpolate(d, [1, 9], [0, 1], {...CL, easing: Easing.out(Easing.cubic)}));   // 8 帧数到位（原来 18 帧，最终数字只停 0.4 秒）
  return (
    <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap', background: c.bg, color: c.fg,
                 border: `${BUB.BORDER}px solid ${c.bd}`, borderRadius: NUM.radius, padding: '10px 30px 12px 16px', boxShadow: BUB.SHADOW, fontFamily: FONT,
                 opacity: Math.min(1, e * 2) * out, transform: `translate(${(1 - e) * A.dx + (1 - out) * A.outDx}px, 0) scale(${A.s0 + (1 - A.s0) * e})`, transformOrigin: 'left center'}}>
      <span style={{width: 6, height: 84 * bar, borderRadius: 3, background: c.bar, flex: 'none'}} />
      <div>
        {h.label ? <div style={{fontSize: NUM.label, fontWeight: 800, letterSpacing: 2, color: c.fg, opacity: 0.7, marginBottom: 2}}>{h.label}</div> : null}
        <div style={{fontSize: NUM.fs, fontWeight: 900, lineHeight: 1, fontFamily: NUMF, letterSpacing: 1}}>
          {h.pre ?? ''}{h.mask ?? n}{h.suf ?? ''}
          {h.t ? <span style={{fontSize: 30, fontFamily: FONT, fontWeight: 800, marginLeft: 10}}>{h.t}</span> : null}
        </div>
      </div>
    </div>
  );
};

/** 截图卡（证据图）：浅色卡（纸底 + 深金描边 + 硬投影，和气泡同一套），说到那个数时在图上画一圈珊瑚框（和录屏高亮框同款）*/
const SHOT = {pad: 8, radius: 18, gap: 18};
const ShotCard: React.FC<{h: Hint}> = ({h}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = h.shot!;
  const A = BUB.ANIM;
  const e = spring({frame: f - F(h.at), fps, config: {damping: A.damping, stiffness: A.stiffness, mass: A.mass}});
  const out = interpolate(f, [F(h.end), F(h.end) + A.outF], [1, 0], {...CL, easing: Easing.in(Easing.cubic)});
  const bk = interpolate(f - F(s.boxAt), [0, 8], [0, 1], {...CL, easing: Easing.out(Easing.back(1.6))});
  const [bx, by, bw, bh] = s.box;
  return (
    <div style={{width: s.w + 2 * (SHOT.pad + BUB.BORDER), boxSizing: 'border-box', padding: SHOT.pad, background: PAPER, border: `${BUB.BORDER}px solid ${BUB.COLOR.EDGE}`,
                 borderRadius: SHOT.radius, boxShadow: BUB.SHADOW, opacity: Math.min(1, e * 2) * out,
                 transform: `translate(${(1 - e) * A.dx + (1 - out) * A.outDx}px, 0) scale(${A.s0 + (1 - A.s0) * e})`, transformOrigin: 'left center'}}>
      <div style={{position: 'relative', width: s.w, height: s.h, borderRadius: SHOT.radius - SHOT.pad, overflow: 'hidden', background: '#fff'}}>
        <Img src={staticFile(s.src)} style={{width: s.w, height: s.h, display: 'block'}} />
        {f >= F(s.boxAt) ? (
          <div style={{position: 'absolute', left: bx * s.w, top: by * s.h, width: bw * s.w, height: bh * s.h, boxSizing: 'border-box', border: `5px solid ${CORAL}`,
                       borderRadius: 10, opacity: Math.min(1, bk * 1.5), transform: `scale(${1.25 - 0.25 * bk})`}} />
        ) : null}
      </div>
    </div>
  );
};

// 开场 hero 卡：从 1.7 倍砸下来（2026-10-09 审片：原来前几帧透明度只有 1/3、1.7 倍只停 2–3 帧，像淡入后轻弹，没有「砸」的感觉）
// → 第 1 帧就整张不透明（气泡自己的入场提前 1 帧、弹簧拉到几乎瞬时，只管透明度）；1.7 倍先停 SLAM.hold 帧，再用软一点的弹簧落下来（回落多走几帧）。
// 缩放原点在卡片左上角：放大只往右下长，不压到上面的章节标签。
const SLAM = {hold: 2, s0: 1.7, damping: 12, stiffness: 160, mass: 0.7};
const SLAM_IN = {dx: 0, dy: 0, s0: 1, damping: 30, stiffness: 900, mass: 0.3};
const slamScale = (d: number, fps: number, s0: number = SLAM.s0) =>
  d < SLAM.hold ? s0 : s0 - (s0 - 1) * spring({frame: d - SLAM.hold, fps, config: {damping: SLAM.damping, stiffness: SLAM.stiffness, mass: SLAM.mass}});
/** hero 卡的 ✕ / ✓ 章落下的那一帧（Video.tsx 用它给人物层一下小震）：和 Bubble 里的时序一致 —— 划掉的 15 帧后挂 ✕，其余 8 帧后挂章（入场提前了 1 帧）*/
export const heroMarkFrames = (hints: Hint[]) =>
  hints.filter((h) => h.size === 'hero' && (h.strike || h.mark)).map((h) => F(h.at) - 1 + (h.strike ? 15 : 8));
// 2026-10-09 返工：砸下来停稳后整段保持大号 —— 字号锁 60（不走自动缩字），上下内边距收紧到气泡高 ≈ 92，竖排行距 110。
// Bubble.tsx 两个项目共用不改：内边距在这里用一条局部样式覆盖（只作用于 .hero-cue 里的气泡）。
const HERO = {fs: 60, pitch: 110, padT: 9, padB: 10};
// 10-18 钩子重做：长的 hero 气泡从 1.7 倍砸下来，头两三帧右沿会盖到脸上（这条片子开头人往前凑时脸从 x≈760 起）→
// 起砸倍数按气泡宽度封顶：砸下那一帧右沿也不过 FACE_X；短的照旧 1.7 倍
const FACE_X = 750;
const heroW = (h: Hint) => {
  const S = BUB.SIZE.hero, chars = [...h.t];
  const em = chars.reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 1.02 : 0.6), 0);
  return 2 * BUB.BORDER + S.padL + S.padR + BUB.LETTER * chars.length + S.bar + S.gap + em * HERO.fs
    + (h.icon || h.img ? S.icon + S.gap : 0) + (h.strike || h.mark ? S.mark + S.gap : 0);
};
const heroS0 = (h: Hint) => Math.min(SLAM.s0, (FACE_X - BUB.LEFT) / heroW(h));
const HERO_CSS = `.hero-cue > div { padding-top: ${HERO.padT}px !important; padding-bottom: ${HERO.padB}px !important; }`;
const pitchOf = (h: Hint) => (h.shot ? h.shot.h + 2 * (SHOT.pad + BUB.BORDER) + SHOT.gap : h.count != null ? NUM.pitch : h.size === 'hero' ? HERO.pitch : BUB.SIZE.md.pitch);

/** 全片的动效提示（2026-10-08 改浅色气泡 Bubble.tsx）；同组的逐条往下叠。
 *  停住的元素不半透明、不压暗别的元素：hero 组里 gold 那条进场时上面几条不再降到 0.55，一直 100% 不透明。 */
export const Hints: React.FC<{hints: Hint[]}> = ({hints}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dyOf = (h: Hint) => (h.grp == null ? 0 : hints.filter((x) => x.grp === h.grp && (x.idx ?? 0) < (h.idx ?? 0)).reduce((a, x) => a + pitchOf(x), 0));
  const live = hints.filter((h) => f >= F(h.at) && f <= F(h.end) + 7);
  return (
    <>
      {live.some((h) => h.size === 'hero') ? <style>{HERO_CSS}</style> : null}
      {live.map((h) => {
        const hero = h.size === 'hero';
        return (
          <div key={`${h.at}-${h.idx ?? 0}`} className={hero ? 'hero-cue' : undefined}
               style={{position: 'absolute', left: BUB.LEFT, top: (h.y ?? BUB.TOP) + dyOf(h),
                       ...(hero ? {transform: `scale(${slamScale(f - F(h.at), fps, heroS0(h))})`, transformOrigin: 'left top'} : {})}}>
            {h.shot ? <ShotCard h={h} /> : h.count != null ? <NumCard h={h} /> : (
              <Bubble t={h.t} tone={h.tone} size={hero ? 'hero' : 'md'} fs={hero ? HERO.fs : undefined} icon={h.icon} img={h.img} strike={h.strike} mark={h.mark}
                      at={hero ? h.at - 1 / T.FPS : h.at} end={h.end} anim={hero ? SLAM_IN : undefined} goldAt={h.goldAt} />
            )}
          </div>
        );
      })}
    </>
  );
};

/** 一排真 logo 逐个弹出（并列的品牌 / 模型）：上面一句观点（可带一个小金牌），下面一行短词一组一组地换 */
const SZ = 112, GAP = 16;   // 10-26：88 → 112（品牌 logo 要大）   // 只放 logo，不配字（名字台词里在念）
const Pill: React.FC<{p: LogoPill; at: number}> = ({p, at}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const d = f - at;
  if (d < 0) return null;
  const e = spring({frame: d, fps, config: {damping: 12, stiffness: 210, mass: 0.7}});
  const gold = p.tone === 'gold';
  const mkE = p.mark && d >= 6 ? spring({frame: d - 6, fps, config: {damping: 10, stiffness: 230, mass: 0.6}}) : 0;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 10, background: INK, color: gold ? GOLD : PAPER, borderRadius: 14, padding: '8px 18px 9px 14px',
                 fontSize: 30, fontWeight: 900, letterSpacing: 2, whiteSpace: 'nowrap', opacity: Math.min(1, e * 2), transform: `translateY(${(1 - e) * 18}px) scale(${0.8 + 0.2 * e})`}}>
      {p.img ? (
        <span style={{width: 38, height: 38, borderRadius: 9, background: '#fff', overflow: 'hidden', flex: 'none', display: 'flex'}}>
          <Img src={staticFile(p.img)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
        </span>
      ) : p.icon ? <Icon name={p.icon} size={30} color={GOLD} stroke={2.6} /> : null}
      {p.t}
      {mkE > 0 ? <Check k={mkE} sz={28} /> : null}
    </div>
  );
};

// 同一时刻可以有两排（上下两排一起在屏）；原来 rows.find 只出第一排
export const LogoRows: React.FC<{rows: LogoRowSpec[]}> = ({rows}) => {
  const f = useCurrentFrame();
  return <>{rows.filter((x) => f >= F(x.start) && f <= F(x.end) + 7).map((r, i) => <LogoRow key={i} r={r} />)}</>;
};
const LogoRow: React.FC<{r: LogoRowSpec}> = ({r}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const out = interpolate(f, [F(r.end), F(r.end) + 7], [1, 0], CL);
  const te = spring({frame: f - F(r.titleAt), fps, config: {damping: 13, stiffness: 190, mass: 0.75}});
  const be = r.badge && f >= F(r.badge.at) ? spring({frame: f - F(r.badge.at), fps, config: {damping: 10, stiffness: 220, mass: 0.7}}) : 0;
  const pe = r.pick && f >= F(r.pick.at) ? spring({frame: f - F(r.pick.at), fps, config: {damping: 11, stiffness: 200, mass: 0.7}}) : 0;
  const sub = r.rows ?? [];
  const curI = sub.reduce((m, x, i) => (f >= F(x.at) ? i : m), -1);
  return (
    <div style={{position: 'absolute', left: LEFT, top: r.y ?? TOP, opacity: out, fontFamily: FONT}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 12, height: 56}}>
        {r.title && f >= F(r.titleAt) ? (
          <div style={{background: INK, color: PAPER, fontSize: 34, fontWeight: 900, letterSpacing: 3, padding: '8px 22px 10px', borderLeft: `5px solid ${GOLD}`,
                       borderRadius: 16, whiteSpace: 'nowrap', opacity: Math.min(1, te * 2), transform: `translateX(${(1 - te) * -60}px)`}}>{r.title}</div>
        ) : null}
        {r.badge && be > 0 ? (
          <div style={{display: 'flex', alignItems: 'center', gap: 8, background: INK, color: GOLD, fontSize: 30, fontWeight: 900, letterSpacing: 2, padding: '8px 18px 10px 14px',
                       borderRadius: 16, whiteSpace: 'nowrap', opacity: Math.min(1, be * 2), transform: `scale(${1.5 - 0.5 * Math.min(1, be)})`, transformOrigin: 'left center'}}>
            <Icon name="trending" size={30} color={GOLD} stroke={2.8} />{r.badge.t}
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, top: 70, display: 'flex', gap: GAP}}>
        {r.items.map((it, i) => {
          const d = f - F(it.at);
          if (d < 0) return <div key={i} style={{width: SZ}} />;
          const e = spring({frame: d, fps, config: {damping: 10, stiffness: 210, mass: 0.7}});
          const pk = r.pick && r.pick.i === i ? pe : 0;
          return (
            <div key={i} style={{width: SZ, height: SZ, borderRadius: 20, background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                 boxSizing: 'border-box', border: pk > 0.02 ? `${7 * Math.min(1, pk)}px solid ${GOLD}` : 'none',
                                 opacity: Math.min(1, e * 2), transform: `translateY(${(1 - e) * 36}px) scale(${(0.6 + 0.4 * e) * (1 + 0.1 * Math.min(1.15, pk))})`}}>
              <Img src={staticFile(it.img)} style={{width: it.img.endsWith('.svg') ? '62%' : '100%', height: it.img.endsWith('.svg') ? '62%' : '100%', objectFit: 'contain'}} />
            </div>
          );
        })}
      </div>
      {curI >= 0 ? (
        <div key={curI} style={{position: 'absolute', left: 0, top: 70 + SZ + 16, display: 'flex', gap: 10}}>
          {sub[curI].pills.map((p, k) => <Pill key={k} p={p} at={F(p.at ?? sub[curI].at) + (p.at == null ? k * 5 : 0)} />)}
        </div>
      ) : null}
    </div>
  );
};

import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, interpolateColors, spring, Easing} from 'remotion';
import {FONT} from '../theme';
import {Icon} from './Icons';
import {Bubble, BUB} from './Bubble';

/**
 * 大脑 / 身体接管板：人头小窗 + 深色底，演示大脑和身体的关系，两只手对应工具调用（skill 调用）；
 * 国产模型接在同一张板上：大脑是能拔下来的槽位，各家模型是一排能插进去的大脑。
 * 深色底 / 左下人头小窗由 gen_spec 的 pip="to" 现成逻辑出（Video.tsx 的 Stage + PersonCircle 'to'），这里只画人形和标注。
 * 时间全是母版秒（板不进 Sequence，直接用绝对帧）。扁平：纯色块 + 纯色线。
 * 金色跟着嘴走：任何时刻画面上只有一处金字。
 *
 * 版式：
 * - 人形中轴 = 屏幕正中；讲到国产模型时整个人形往左让一段，右边放大脑架。
 * - 人形全部不透明（颜色取原来半透明叠在深底上的结果），胳膊画在躯干后面，肩膀根部被躯干盖住。
 * - 「大脑 / 只换大脑 / 身体 / 身体没换」改成示意图标注：字 + 一根指引线，不用胶囊；当前模型名作为大脑标注的第二行。
 * - 两只手各握一张卡（工具调用 / Skill 调用），卡里一行一项；虚线大框和底下的结论气泡去掉，
 *   「身体没换」时整个身体（躯干 + 脖子 + 胳膊 + 手 + 两张卡）描边变金，头不变。
 */
const F = (s: number) => Math.round(s * 30);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const {PAPER, GOLD, EDGE, INK} = BUB.COLOR;
const NUMF = `"Arial Rounded MT Bold", ${FONT}`;

// 整板放大 K 倍（外层一个 scale），下面全是放大前的「设计坐标」，屏幕坐标 = 设计坐标 × K。
// 禁区：左下人头小窗（屏幕 x 64–304、y 690–940）；右侧抖音按钮列（屏幕 x>1670）。
const K = 1.3;
const CX = 960 / K;                               // 人形中轴 = 屏幕正中
const SHIFT = CX - 623;                           // 讲到国产模型时往左让的距离（大脑架坐标按让位后的人形写）
const HEAD = {cy: 198, d: 200};                   // 头 = 大脑槽
const TORSO = {x: CX - 128, y: 346, w: 256, h: 266};
const LS = {x: CX - 110, y: 406}, RS = {x: CX + 110, y: 406};   // 肩（藏在躯干后面）
const LH = {x: CX - 216, y: 369}, RH = {x: CX + 216, y: 369};   // 手
const HAND = 72;
const SHELF = {top: 88, y: 196, d: 80, xs: [810, 908, 1006, 1104, 1202]};
const CARD = {w: 256, top: 262, gap: 18};         // 卡和手之间留 gap 像素空隙，中间一根短连线；手、圆圈、图标和卡里的字一律不重叠
// 标注分两档（大脑、身体要比其他标注更突出，不同类别视觉上分开）：
// 部件名（大脑 / 只换大脑 / 国产大脑 / 身体 / 身体没换）= 金色大字 + 金色指引线，全板只有它们用金字；
// 模型名（GPT / DeepSeek …）和「行不行？」= 下面一行奶油色小字；卡片标题 = 白字（不变金）。
const LBL = {fs: 56, sub: 34, y: HEAD.cy - 42, gap: 52, bodyY: 560};   // 部件名字号 / 小字字号 / 大脑标注中线 / 字到部件边的距离 / 身体标注中线
// 不透明人形：原来「奶油色 14% 叠深底」的实际颜色；描边用实色，不留 alpha（叠在哪都一样，不会透出后面的线）
const FIG_FILL = '#3A3936', FIG_EDGE = '#DCD6CB', HOLLOW = '#1F1F22';
const GOLD_SEQ = ['brain', 'body', 'swap', 'tools', 'skills', 'same', 'strong', 'any', 'pick'];

type Model = [string, string];   // [名字, logo]

export const BrainBoard: React.FC<{group: any; io: number}> = ({group, io}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ex = group.extra as {origin: Model; models: Model[]; tools: [string, string][]; skills: [string, string][]; slow_at: number; perf_mark: number};
  const at = (id: string) => {
    const n = (group.nodes as any[]).find((x) => x.id === id);
    return n ? (n.rf as number) : 1e9;
  };
  const t = Object.fromEntries(['fig', 'ds', 'brain', 'body', 'swap', 'tools', 'skills', 'same', 'shelf', 'strong',
                                'm1', 'm2', 'perf', 'm3', 'm4', 'm5', 'any', 'plug', 'pick'].map((k) => [k, at(k)])) as Record<string, number>;
  const ms = [t.m1, t.m2, t.m3, t.m4, t.m5];
  const goldEnd = (id: string) => (id === 'strong' ? t.m1 : t[GOLD_SEQ[GOLD_SEQ.indexOf(id) + 1]] ?? undefined);
  const sp = (s: number, cfg = {damping: 13, stiffness: 190, mass: 0.75}) => (f >= F(s) ? spring({frame: f - F(s), fps, config: cfg}) : 0);
  const lin = (s: number, n: number) => interpolate(f - F(s), [0, n], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
  const goldMix = (a: number, b: number) => interpolate(f, [a, a + 6, b, b + 6], [0, 1, 1, 0], CL);   // 帧：a 起变金，b 起退回（只给「身体没换」的金描边用）

  // ---------- 人形拼出来：躯干 → 两臂 → 两手 → 头 ----------
  const eTorso = sp(t.fig);
  const arm = lin(t.fig + 6 / 30, 8);
  const eHand = sp(t.fig + 12 / 30, {damping: 11, stiffness: 220, mass: 0.6});
  const eHead = sp(t.fig + 16 / 30, {damping: 11, stiffness: 220, mass: 0.6});
  const panelsOut = interpolate(f, [F(t.shelf), F(t.shelf) + 8], [1, 0], CL);   // 讲到国产模型：两张卡淡出（手和胳膊留着）
  const dx = -SHIFT * interpolate(f, [F(t.shelf), F(t.shelf) + 14], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)});
  const hx = CX + dx;                                                         // 头的当前屏幕 x（飞行终点用）
  const bodyGold = goldMix(F(t.same), F(t.shelf));                           // 「身体没换」：整个身体描边变金
  const edge = interpolateColors(bodyGold, [0, 1], [FIG_EDGE, GOLD]);

  // ---------- 大脑槽里装的是谁 ----------
  const flights: {img: string; k: number; t0: number; dur: number; toHead: boolean}[] = [
    {img: ex.models[0][1], k: 0, t0: F(t.shelf), dur: 12, toHead: false},                                      // 大脑拔下来，落进第 1 个槽
    {img: ex.models[0][1], k: 0, t0: F(t.m1), dur: 10, toHead: true},                                         // DeepSeek 插回去
    ...ex.models.slice(1).map((m, i) => ({img: m[1], k: i + 1, t0: F(ms[i + 1]) + 6, dur: 10, toHead: true})), // 其余各家：槽里弹出 6 帧后飞进头
  ];
  const landed = (i: number) => flights[i].t0 + flights[i].dur;
  const step = f >= F(ex.slow_at) ? 10 : 5;                                  // 「哪个顺手换哪个」：老虎机轮换，后半句放慢
  let head: Model | null;
  let headSince = 0;                                                         // 头里这一家是哪一帧装上的（名字跟着弹）
  let inHead = -1;                                                           // 头里那个模型在架子上的槽号（它的槽留影子）
  if (f >= F(t.pick)) { head = ex.models[0]; headSince = F(t.pick); }
  else if (f >= F(t.any)) { head = ex.models[Math.floor((f - F(t.any)) / step) % ex.models.length]; }
  else if (f >= F(t.shelf)) {
    head = null;
    for (let i = 1; i < flights.length; i++) if (f >= landed(i)) { head = ex.models[flights[i].k]; inHead = flights[i].k; headSince = landed(i); }
    for (let i = 1; i < flights.length; i++) if (f >= flights[i].t0 && f < landed(i)) inHead = flights[i].k;   // 正在飞的也留影子
  }
  else if (f >= F(t.ds) + 4) { head = ex.models[0]; headSince = F(t.ds) + 4; }
  else { head = ex.origin; headSince = F(t.fig + 16 / 30); }
  const cycling = f >= F(t.any) && f < F(t.pick);
  const flipAt = [F(t.ds), F(t.pick) - 4].find((x) => f >= x && f < x + 8);   // 翻牌：GPT → DeepSeek、停在 DeepSeek
  const flip = flipAt != null ? Math.abs(Math.cos((Math.PI * (f - flipAt)) / 8)) : 1;
  const flyingIn = flights.some((fl) => fl.toHead && f >= fl.t0 && f < fl.t0 + fl.dur);

  // ---------- 架子：5 个槽 ----------
  const slotOn = (k: number) => (k === 0 ? f >= landed(0) : f >= F(ms[k]));
  const plugK = f >= F(t.plug) ? interpolate(f, [F(t.plug), F(t.plug) + 20], [0, 1], CL) : 0;
  const pulse = (s: number, n: number) => (f >= F(s) && f < F(s) + n ? Math.sin((Math.PI * (f - F(s))) / n) : 0);
  const torsoPulse = 1 + 0.04 * pulse(t.plug, 12) + 0.03 * pulse(t.same, 12);
  const handRing = (s: number, e: number) => Math.max(f >= F(s) && f < F(e) ? lin(s, 6) : 0, pulse(t.plug, 12));   // 金圈只亮正在讲的那只手

  const bubbleAt = (id: string, extra: Partial<React.ComponentProps<typeof Bubble>> = {}) =>
    ({at: t[id], goldAt: GOLD_SEQ.includes(id) ? t[id] : undefined, goldEnd: GOLD_SEQ.includes(id) ? goldEnd(id) : undefined, ...extra});

  const Logo: React.FC<{src: string; sz: number; cover?: boolean}> = ({src, sz, cover}) => (
    <Img src={staticFile(src)} style={{width: sz, height: sz, objectFit: cover ? 'cover' : 'contain', display: 'block'}} />
  );

  // ---------- 标注：部件名（金色大字）+ 模型名（小字）+ 指引线；右对齐贴着部件 ----------
  // 部件名还没出来时，模型名单独占指引线那一行；部件名一出来，模型名退到下面一行
  type Seg = [number, string];   // [起始帧, 字]
  const cur = (segs: Seg[]) => segs.filter((s) => f >= s[0]).pop();
  const pop = (since: number) => spring({frame: f - since, fps, config: {damping: 14, stiffness: 210, mass: 0.7}});
  const label = (parts: Seg[], right: number, y: number, lineTo: number, name: Seg | null) => {
    const part = cur(parts);
    const first = Math.min(parts[0][0], name ? name[0] : 1e9);
    if (f < first) return null;
    const line = interpolate(f - first, [0, 8], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
    const ep = part ? pop(part[0]) : 0;
    const down = part ? pop(parts[0][0]) : 0;                                           // 部件名第一次出现：模型名往下让一行
    const en = name ? pop(name[0]) : 0;
    const nameTop = y - LBL.sub * 0.62 + down * (LBL.fs * 0.62 + 6 - (-LBL.sub * 0.62));
    const lineC = part ? GOLD : 'rgba(245,240,230,0.78)';
    return (
      <>
        <div style={{position: 'absolute', left: right + 12, top: y - 2.5, width: Math.max(0, (lineTo - right - 12) * line), height: 5, borderRadius: 3, background: lineC}} />
        {part ? (
          <div style={{position: 'absolute', right: 1920 - right, top: y - LBL.fs * 0.62, whiteSpace: 'nowrap', fontSize: LBL.fs, fontWeight: 900, letterSpacing: 3, color: GOLD, lineHeight: 1.2,
                       opacity: Math.min(1, ep * 1.6), transform: `translateX(${-(1 - ep) * 24}px) scale(${0.88 + 0.12 * ep})`, transformOrigin: '100% 50%'}}>
            {part[1]}
          </div>
        ) : null}
        {name ? (
          <div style={{position: 'absolute', right: 1920 - right, top: nameTop, whiteSpace: 'nowrap', fontSize: LBL.sub, fontWeight: 800, lineHeight: 1.2,
                       color: 'rgba(245,240,230,0.82)', fontFamily: NUMF, letterSpacing: 1, opacity: Math.min(1, en * 1.6), transform: `translateY(${-(1 - en) * 10}px)`}}>
            {name[1]}
          </div>
        ) : null}
      </>
    );
  };
  const headParts: Seg[] = [[F(t.brain), '大脑'], [F(t.swap), '只换大脑'], [F(t.shelf) + 8, '国产大脑']];
  // 头下面那行小字：当前大脑是谁（飞行 / 轮换时收起）；大脑拔下来、头空着时问「行不行？」，「越来越强」回答它
  const headName: Seg | null =
    f >= F(t.shelf) + 8 && f < F(t.m1) ? [F(t.shelf) + 8, '行不行？']
    : head && !flyingIn && !cycling && (f < F(t.shelf) || f >= F(t.m1)) ? [headSince, head[0]]
    : null;
  const bodyParts: Seg[] = [[F(t.body), '身体'], [F(t.same), '身体没换'], [F(t.shelf) + 8, '身体']];
  const headLineTo = CX - Math.sqrt((HEAD.d / 2) ** 2 - (HEAD.cy - LBL.y) ** 2) + 10;   // 指引线伸到头圈里一点，被头盖住

  // ---------- 两只手各连一张卡（手和卡之间留空隙 + 短连线，互不重叠）----------
  const card = (side: -1 | 1, title: string, icon: string, rows: [string, string][], img: boolean, s: number) => {
    if (f < F(s)) return null;
    const e = spring({frame: f - F(s), fps, config: {damping: 14, stiffness: 180, mass: 0.8}});
    const h = side < 0 ? LH : RH;
    const inner = h.x + side * (HAND / 2 + CARD.gap);                                     // 卡靠手那条边
    return (
      <>
        <div style={{position: 'absolute', left: Math.min(inner, h.x + side * HAND / 2) - 2, top: h.y - 2.5, width: CARD.gap + 4, height: 5, background: edge,
                     opacity: Math.min(1, e * 1.5) * panelsOut}} />
        <div style={{position: 'absolute', left: side < 0 ? inner - CARD.w : inner, top: CARD.top, width: CARD.w, boxSizing: 'border-box',
                     padding: '14px 18px 16px', borderRadius: 22, background: FIG_FILL, border: `3px solid ${edge}`,
                     opacity: Math.min(1, e * 1.5) * panelsOut, transform: `scale(${0.55 + 0.45 * e})`, transformOrigin: side < 0 ? '100% 40%' : '0% 40%'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, height: 40}}>
            <Icon name={icon} size={30} color={PAPER} stroke={2.4} />
            <span style={{fontSize: 32, fontWeight: 900, color: PAPER, letterSpacing: 1, whiteSpace: 'nowrap'}}>{title}</span>
          </div>
          <div style={{height: 2, background: 'rgba(245,240,230,0.22)', margin: '10px 0'}} />
          {rows.map(([tx, ic], k) => {
            const r = lin(s + (6 + 4 * k) / 30, 8);
            return (
              <div key={k} style={{display: 'flex', alignItems: 'center', gap: 12, height: 42, marginTop: k ? 6 : 0, opacity: r, transform: `translateX(${-side * (1 - r) * 22}px)`}}>
                <div style={{width: 40, height: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                             background: img ? '#fff' : 'rgba(245,240,230,0.12)'}}>
                  {img ? <Img src={staticFile(ic)} style={{width: 40, height: 40, objectFit: 'cover'}} /> : <Icon name={ic} size={24} color={PAPER} stroke={2.2} />}
                </div>
                <span style={{fontSize: 25, fontWeight: 800, color: PAPER, whiteSpace: 'nowrap', fontFamily: img ? NUMF : FONT}}>{tx}</span>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
     <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${K})`, transformOrigin: '0 0'}}>
      {/* ===== 人形（讲到国产模型时整组往左让 SHIFT）===== */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `translateX(${dx}px)`}}>
        {/* 胳膊：先画实色描边粗线，再画实色填充细线；肩膀那头伸进躯干，被躯干盖住 */}
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: arm > 0 ? 1 : 0}}>
          {[[LS, LH, -1], [RS, RH, 1]].map(([a, b, sg], i) => {
            const p = a as {x: number; y: number}, q = b as {x: number; y: number}, d = sg as number;
            const path = `M ${p.x} ${p.y} Q ${p.x + d * 70} ${p.y + 110} ${q.x} ${q.y}`;
            return (
              <g key={i}>
                <path d={path} fill="none" pathLength={1} stroke={edge} strokeWidth={30} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - arm} />
                <path d={path} fill="none" pathLength={1} stroke={FIG_FILL} strokeWidth={23} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - arm} />
              </g>
            );
          })}
        </svg>

        {/* 脖子：「接到 Codex 里」时变金 */}
        {eHead > 0 ? (
          <div style={{position: 'absolute', left: CX - 17, top: HEAD.cy + HEAD.d / 2 - 8, width: 34, height: TORSO.y - (HEAD.cy + HEAD.d / 2) + 16, boxSizing: 'border-box',
                       background: plugK > 0 ? interpolateColors(plugK, [0, 1], [FIG_FILL, GOLD]) : FIG_FILL, border: `3px solid ${edge}`}} />
        ) : null}

        {/* 身体标注（指引线先画，被躯干盖住线头）*/}
        {label(bodyParts, TORSO.x - LBL.gap, LBL.bodyY, TORSO.x + 10, null)}

        {/* 躯干 = 身体（Codex）*/}
        {eTorso > 0 ? (
          <div style={{position: 'absolute', left: TORSO.x, top: TORSO.y, width: TORSO.w, height: TORSO.h, borderRadius: '96px 96px 36px 36px', background: FIG_FILL, border: `3px solid ${edge}`, boxSizing: 'border-box',
                       opacity: Math.min(1, eTorso * 2), transform: `translateY(${(1 - eTorso) * 30}px) scale(${torsoPulse})`, transformOrigin: 'center bottom'}}>
            <div style={{position: 'absolute', left: TORSO.w / 2 - 56, top: 40}}><Logo src="logos/codex.png" sz={112} /></div>
            <div style={{position: 'absolute', left: 0, right: 0, top: 166, textAlign: 'center', fontSize: 46, fontWeight: 900, color: PAPER, letterSpacing: 1, fontFamily: NUMF}}>Codex</div>
          </div>
        ) : null}

        {/* 两张卡（和手之间一段短连线，互不重叠）*/}
        {card(-1, '工具调用', 'gear', ex.tools, false, t.tools)}
        {card(1, 'Skill 调用', 'puzzle', ex.skills, true, t.skills)}

        {/* 两只手：左 = 工具调用（齿轮），右 = Skill 调用（拼图）；讲到哪只亮哪只的金圈 */}
        {[[LH, 'gear', t.tools, t.skills], [RH, 'puzzle', t.skills, t.same]].map(([h, ic, s, e2], i) => {
          const p = h as {x: number; y: number};
          const ring = handRing(s as number, e2 as number);
          return eHand > 0 ? (
            <div key={i} style={{position: 'absolute', left: p.x - HAND / 2, top: p.y - HAND / 2, width: HAND, height: HAND, borderRadius: '50%', background: FIG_FILL, border: `3px solid ${edge}`,
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
                                 boxShadow: ring > 0 ? `0 0 0 ${6 * ring}px ${GOLD}` : 'none', transform: `scale(${Math.min(1.1, eHand)})`}}>
              <Icon name={ic as string} size={36} color={PAPER} stroke={2.4} />
            </div>
          ) : null;
        })}

        {/* 大脑标注（指引线先画，被头盖住线头）*/}
        {eHead > 0 ? label(headParts, CX - HEAD.d / 2 - LBL.gap, LBL.y, headLineTo, f >= F(t.fig + 16 / 30) ? headName : null) : null}

        {/* 头 = 大脑槽 */}
        {eHead > 0 ? (
          <div style={{position: 'absolute', left: CX - HEAD.d / 2, top: HEAD.cy - HEAD.d / 2, width: HEAD.d, height: HEAD.d, borderRadius: '50%', boxSizing: 'border-box',
                       background: head ? '#fff' : HOLLOW, border: head ? `8px solid ${GOLD}` : `4px dashed ${PAPER}`,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                       transform: `scale(${Math.min(1.08, eHead)}) scaleX(${flip})`}}>
            {head && !flyingIn ? <Logo src={head[1]} sz={HEAD.d - 16} cover /> : head ? null : <span style={{fontSize: 96, fontWeight: 900, color: PAPER, fontFamily: NUMF}}>?</span>}
          </div>
        ) : null}
        {/* 换脑：头外两段金色弧形箭头转一圈 */}
        {f >= F(t.swap) && f < F(t.swap) + 30 ? (() => {
          const ring = interpolate(f - F(t.swap), [0, 22], [0, 360], {...CL, easing: Easing.inOut(Easing.cubic)});
          const op = interpolate(f - F(t.swap), [0, 3, 24, 30], [0, 1, 1, 0], CL);
          const R = HEAD.d / 2 + 22, C = R + 12;
          return (
            <svg width={C * 2} height={C * 2} style={{position: 'absolute', left: CX - C, top: HEAD.cy - C, transform: `rotate(${ring}deg)`, opacity: op}}>
              {[0, 180].map((a0) => {
                const a1 = ((a0 + 20) * Math.PI) / 180, a2 = ((a0 + 140) * Math.PI) / 180, td = a2 + Math.PI / 2;
                const x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1), x2 = C + R * Math.cos(a2), y2 = C + R * Math.sin(a2);
                return (
                  <g key={a0}>
                    <path d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`} fill="none" stroke={GOLD} strokeWidth={8} strokeLinecap="round" />
                    <polygon points={`${x2 + 16 * Math.cos(td)},${y2 + 16 * Math.sin(td)} ${x2 + 13 * Math.cos(td - 2.3)},${y2 + 13 * Math.sin(td - 2.3)} ${x2 + 13 * Math.cos(td + 2.3)},${y2 + 13 * Math.sin(td + 2.3)}`} fill={GOLD} />
                  </g>
                );
              })}
            </svg>
          );
        })() : null}
        {/* 「接到 Codex 里」：金点沿脖子走进躯干 */}
        {f >= F(t.plug) && f < F(t.plug) + 14 ? (() => {
          const k = Easing.inOut(Easing.cubic)(interpolate(f - F(t.plug), [0, 10], [0, 1], CL));
          const y = HEAD.cy + HEAD.d / 2 - 10 + (TORSO.y + 40 - (HEAD.cy + HEAD.d / 2 - 10)) * k;
          return <div style={{position: 'absolute', left: CX - 13, top: y - 13, width: 26, height: 26, borderRadius: '50%', background: GOLD,
                              border: `3px solid ${INK}`, boxSizing: 'border-box', opacity: interpolate(f - F(t.plug), [0, 2, 11, 14], [0, 1, 1, 0], CL)}} />;
        })() : null}
      </div>

      {/* ===== 大脑架：国产模型（人形让位后右边）===== */}
      {f >= F(t.shelf) + 8 ? (
        <div style={{position: 'absolute', left: SHELF.xs[0] - SHELF.d / 2, top: SHELF.top, height: 58, display: 'flex', gap: 18, alignItems: 'center'}}>
          <span style={{fontSize: 36, fontWeight: 900, color: PAPER, letterSpacing: 2, whiteSpace: 'nowrap', opacity: Math.min(1, pop(F(t.shelf) + 8) * 1.6)}}>国产模型</span>
          {f >= F(t.strong) ? <Bubble t="越来越强" icon="trending" {...bubbleAt('strong')} /> : null}
        </div>
      ) : null}
      {SHELF.xs.map((x, k) => {
        const d0 = F(t.shelf) + 8 + 3 * k;
        if (f < d0) return null;
        const e = spring({frame: f - d0, fps, config: {damping: 11, stiffness: 220, mass: 0.6}});
        const on = slotOn(k);
        const eOn = on && k > 0 ? spring({frame: f - F(ms[k]), fps, config: {damping: 10, stiffness: 230, mass: 0.6}}) : 1;
        const picked = f >= F(t.pick);
        const ghost = !cycling && (picked ? k !== 0 : inHead === k);
        const ring = picked && k === 0 ? lin(t.pick, 6) : 0;
        return (
          <div key={k} style={{position: 'absolute', left: x - SHELF.d / 2, top: SHELF.y - SHELF.d / 2, width: SHELF.d, height: SHELF.d, borderRadius: '50%', boxSizing: 'border-box',
                               background: on ? '#fff' : 'rgba(245,240,230,0.55)', border: on ? `2px solid ${EDGE}` : `3px dashed ${EDGE}`,
                               boxShadow: ring > 0 ? `0 0 0 ${6 * ring}px ${GOLD}` : 'none',
                               display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                               opacity: Math.min(1, e * 2) * (ghost ? 0.35 : 1), transform: `scale(${(0.6 + 0.4 * e) * (on && k > 0 ? 0.7 + 0.3 * eOn : 1)})`}}>
            {on ? <Logo src={ex.models[k][1]} sz={SHELF.d - 4} cover /> : null}
          </div>
        );
      })}
      {/* 架子下面一个位置轮流换：性能 · 性价比都高 ✓ → 哪个顺手换哪个 → 今天用它演示 */}
      <div style={{position: 'absolute', left: SHELF.xs[0] - SHELF.d / 2, top: SHELF.y + SHELF.d / 2 + 14}}>
        {f >= F(t.perf) && f < F(t.any) + 4 ? <Bubble t="性能 · 性价比都高" mark="check" markAt={ex.perf_mark} at={t.perf} end={t.any} anim={{outF: 4}} /> : null}
        {f >= F(t.any) && f < F(t.pick) + 4 ? <Bubble t="哪个顺手换哪个" icon="loop" {...bubbleAt('any', {end: t.pick, anim: {outF: 4}})} /> : null}
        {f >= F(t.pick) ? <Bubble t="今天用它演示" img={ex.models[0][1]} {...bubbleAt('pick')} /> : null}
      </div>

      {/* 飞行中的大脑：槽 ↔ 头（ease-out；拔出来那一下往上走一道弧；头的位置跟着让位走）*/}
      {flights.map((fl, i) => {
        if (f < fl.t0 || f >= fl.t0 + fl.dur) return null;
        const k = Easing.out(Easing.cubic)(interpolate(f - fl.t0, [0, fl.dur], [0, 1], CL));
        const s = {x: SHELF.xs[fl.k], y: SHELF.y, sz: SHELF.d - 16}, h = {x: hx, y: HEAD.cy, sz: HEAD.d - 16};   // 落地 = 整个头
        const [a, b] = fl.toHead ? [s, h] : [h, s];
        const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k - (fl.toHead ? 0 : 40 * Math.sin(Math.PI * k)), sz = a.sz + (b.sz - a.sz) * k;
        return (
          <div key={i} style={{position: 'absolute', left: x - sz / 2 - 8, top: y - sz / 2 - 8, width: sz + 16, height: sz + 16, borderRadius: '50%', background: '#fff',
                               border: `${fl.toHead ? 8 * k + 3 * (1 - k) : 3}px solid ${GOLD}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
            <Logo src={fl.img} sz={sz} cover />
          </div>
        );
      })}
     </div>
    </AbsoluteFill>
  );
};

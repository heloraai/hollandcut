import React from 'react';
import {Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {FONT} from '../theme';

/**
 * 开头堆叠钩子（工具图标列清楚、快进 + 堆叠）。
 * 人物一直全屏，叠加层左右对称（脸中心 x≈1010；右边尽量不进 x>1665 抖音按钮列；字幕带 y≥945 不碰）：
 *  ① tut（负面的一句）：一批真素材卡左右交替、每 0.06 秒一张从 1.8 倍砸下来，堆成两大摞；
 *     strike 整屏红光一闪、两摞变灰、各压一个大红叉；收的时候整摞往下掉出画面（重力 + 打转）；
 *  ② work（正面的一句）：几张真界面卡（可放录屏快进），done 依次打金勾 + 整屏金光一闪；
 *  ③ rain：一堆产品真 logo 从天上砸下来、在人两边堆成两堆（落地压扁回弹）；burst 整堆炸开飞出画面 + 白光一闪；
 *  ④ tools 工具图标：分左右两列；从屏幕两边飞进来，跟大字落地同一帧落位闪现（整屏提亮 + 每个身后炸一圈金光）；
 *     hop 金框在各图标之间跳；heads 出两列标题；rows 说到哪一类那一列亮、另一列压暗；pops 说到名字那个放大 + 金框；end 收。
 * 时间全是母版秒。
 */
type Card = {src: string; video?: boolean; side: 'L' | 'R'; at: number; name?: string; logo?: string; rate?: number; from?: number};
type Tool = {logo: string; name: string; side: 'L' | 'R'; row: number; at: number};
export type Open2Spec = {
  tut: {cards: Card[]; strike: number; out: number};
  work: {cards: Card[]; done: number; out: number};
  rain?: {logos: string[]; at: number; step: number; burst: number};
  tools: {items: Tool[]; hop: [number, number]; heads: {at: number; L: string; R: string}; rows: [number, 'L' | 'R'][];
          pops: Record<string, number>; end: number};
};

const F = (s: number) => Math.round(s * 30);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const GOLD = '#F6C453', INK = '#15161B', RED = '#E5484D', CREAM = '#F5F0E6';
const SX = {L: 540, R: 1460};               // 左右两摞的中心 x（右边收一点，别压抖音按钮列）
const TUT_CX = {L: 520, R: 1510};           // 10-30 自查：教程卡摞散得开，右摞再往外挪一点，别压到脸
const SHADOW = '5px 6px 0 rgba(20,12,2,0.55)';

// 教程卡：每边最多 6 张，散开叠成一大摞（相对摞心的偏移 + 角度）
const TUT_POS = [[-40, -150, -11], [70, -105, 7], [-70, 5, -5], [55, 55, 10], [-25, 140, -8], [75, 170, 4]];
// 真界面卡：每边 2 张，上下错开
const WORK_POS = [[-10, -110, -4], [20, 120, 5]];

/** 一张卡：从 s0 倍砸下（弹簧）+ 落地几帧小抖；out = 收场进度，fall = 往下掉（重力 + 打转），否则往外飞 */
const StackCard: React.FC<{c: Card; pos: number[]; cx: number; cy: number; w: number; h: number; gray: number; out: number; fall?: boolean; s0?: number;
                          badge?: React.ReactNode}> =
  ({c, pos, cx, cy, w, h, gray, out, fall, s0 = 1.35, badge}) => {
    const f = useCurrentFrame(), {fps} = useVideoConfig();
    const d = f - F(c.at);
    if (d < 0 || out >= 1) return null;
    const e = spring({frame: d, fps, config: {damping: 12, stiffness: 280, mass: 0.55}});
    const sc = s0 - (s0 - 1) * Math.min(1.04, e);
    const shake = d < 8 ? Math.sin(d * 2.4) * 8 * (1 - d / 8) : 0;
    const dir = c.side === 'L' ? -1 : 1;
    const x = cx + pos[0] * (c.side === 'L' ? 1 : -1) + (fall ? dir * 120 * out : dir * 560 * out);
    const y = cy + pos[1] + (fall ? 1300 * out * out : 0);
    const rot = pos[2] * (c.side === 'L' ? 1 : -1) + (fall ? dir * 38 * out : 0);
    return (
      <div style={{position: 'absolute', left: x - w / 2 + shake, top: y - h / 2, width: w, height: h, borderRadius: 18, overflow: 'hidden',
                   background: '#fff', border: '4px solid #fff', boxShadow: SHADOW, opacity: Math.min(1, d / 2) * (fall ? 1 : 1 - out),
                   transform: `scale(${sc}) rotate(${rot}deg)`,
                   filter: gray > 0 ? `grayscale(${gray}) brightness(${1 - 0.35 * gray})` : undefined}}>
        {c.video ? (
          <Sequence from={F(c.at)} layout="none">
            <OffthreadVideo src={staticFile(c.src)} muted playbackRate={c.rate ?? 1} startFrom={Math.round((c.from ?? 0) * 30)}
                            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
          </Sequence>
        ) : (
          <Img src={staticFile(c.src)} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
        )}
        {c.name ? (
          <div style={{position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px 5px 6px',
                       borderRadius: 999, background: 'rgba(12,12,16,0.86)', border: '2px solid rgba(255,255,255,0.25)'}}>
            {c.logo ? <Img src={staticFile(c.logo)} style={{width: 30, height: 30, borderRadius: 8}} /> : null}
            <span style={{fontFamily: FONT, fontWeight: 800, fontSize: 24, color: '#fff'}}>{c.name}</span>
          </div>
        ) : null}
        {badge}
      </div>
    );
  };

/** 「学」：一摞上压一个大红叉（两笔各 5 帧画完），跟着整摞一起掉 */
const RedX: React.FC<{at: number; x: number; y: number; size: number; out: number}> = ({at, x, y, size, out}) => {
  const f = useCurrentFrame();
  const d = f - F(at);
  if (d < 0 || out >= 1) return null;
  const a = interpolate(d, [0, 4], [0, 1], CL), b = interpolate(d, [2, 6], [0, 1], CL);
  const pop = d < 8 ? 1 + 0.12 * Math.sin((Math.PI * d) / 8) : 1;
  const bar = (p: number, rot: number) => (
    <div style={{position: 'absolute', left: x - size / 2, top: y - 22 + 1300 * out * out, width: size * p, height: 44, borderRadius: 22, background: RED,
                 boxShadow: '5px 6px 0 rgba(60,0,0,0.55)', transformOrigin: `${size / 2}px 22px`, transform: `rotate(${rot}deg) scale(${pop})`}} />
  );
  return <div style={{position: 'absolute', inset: 0}}>{bar(a, 40)}{bar(b, -40)}</div>;
};

const Check: React.FC<{at: number}> = ({at}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const d = f - F(at);
  if (d < 0) return null;
  const e = spring({frame: d, fps, config: {damping: 10, stiffness: 240, mass: 0.6}});
  return (
    <div style={{position: 'absolute', right: 12, top: 12, width: 72, height: 72, borderRadius: 36, background: GOLD, border: `4px solid ${INK}`,
                 display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${e})`, boxShadow: '3px 4px 0 rgba(20,12,2,0.6)'}}>
      <svg width={40} height={40} viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke={INK} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
};

const FF: React.FC<{rate: number}> = ({rate}) => (
  <div style={{position: 'absolute', left: 10, top: 10, padding: '3px 10px', borderRadius: 8, background: 'rgba(12,12,16,0.82)',
               fontFamily: FONT, fontWeight: 800, fontSize: 22, color: GOLD, letterSpacing: 1}}>▶▶ 快进 ×{rate}</div>
);

/** 整屏一闪（颜色、峰值不透明度、帧数）；峰值 ≤ 0.5，不算白闪 */
const Flash: React.FC<{at: number; color: string; peak: number; len?: number}> = ({at, color, peak, len = 6}) => {
  const f = useCurrentFrame(), f0 = F(at);
  if (f < f0 || f >= f0 + len) return null;
  return <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, background: color,
                      opacity: interpolate(f, [f0, f0 + 1, f0 + len], [0, peak, 0], CL)}} />;
};

// ③ logo 雨：落点（两堆，在人头两边）
// 人头两边各摞一座塔，第 i 个落在 (i%2 边, 第 i//2 层)，越摞越高
const RAIN_AT = Array.from({length: 12}, (_, i) => {
  const side = i % 2 ? 1 : -1, lv = Math.floor(i / 2);
  return [1010 + side * (430 + (lv % 2 ? 26 : -18)), 600 - lv * 98];
});
const LOGO = 142;

const RainLogo: React.FC<{src: string; i: number; at: number; burst: number}> = ({src, i, at, burst}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const f0 = F(at), fb = F(burst);
  const d = f - f0;
  if (d < 0 || f > fb + 14) return null;
  const [tx, ty] = RAIN_AT[i % RAIN_AT.length];
  const fallT = 8;                                    // 8 帧从画外砸到落点
  const u = Math.min(1, d / fallT);
  let x = tx, y = -160 + (ty + 160) * u * u, rot = (i % 2 ? 1 : -1) * (30 - 30 * u), sx = 1, sy = 1;
  if (d >= fallT && d < fallT + 8) {                  // 落地压扁回弹
    const k = (d - fallT) / 8;
    sy = 1 - 0.28 * Math.sin(Math.PI * k) * (1 - k);
    sx = 1 + 0.2 * Math.sin(Math.PI * k) * (1 - k);
  }
  if (f >= fb) {                                      // 炸开：从头的方向往外飞 + 打转 + 缩小
    const k = Easing.in(Easing.quad)(Math.min(1, (f - fb) / 14));
    const ang = Math.atan2(ty - 400, tx - 1010);
    x = tx + Math.cos(ang) * 900 * k; y = ty + Math.sin(ang) * 900 * k - 200 * k;
    rot += (i % 2 ? 1 : -1) * 260 * k; sx = sy = 1 - 0.5 * k;
  }
  const breath = d >= fallT + 8 && f < fb ? 1 + 0.03 * Math.sin((d - fallT) / 3 + i) : 1;
  void fps;
  return (
    <div style={{position: 'absolute', left: x - LOGO / 2, top: y - LOGO / 2, width: LOGO, height: LOGO, borderRadius: LOGO * 0.24, background: '#fff',
                 border: `3px solid ${INK}`, boxShadow: SHADOW, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                 transform: `rotate(${rot}deg) scale(${sx * breath}, ${sy * breath})`}}>
      <Img src={staticFile(src)} style={{width: '80%', height: '80%', objectFit: 'contain'}} />
    </div>
  );
};

const ROW_Y = [300, 505, 710];
const IX = {L: 500, R: 1520};   // 六个图标两列再往外放一点，「6个AI工具」大字夹在中间不碰名字
const ICON = 128;
const FLY = 7;                  // 10-30：图标从屏幕两边飞进来的帧数（落位那一帧 = at）

const ToolIcon: React.FC<{t: Tool; tools: Open2Spec['tools']; k: number}> = ({t, tools, k}) => {
  const f = useCurrentFrame(), {fps} = useVideoConfig();
  const d = f - F(t.at);
  if (d < -FLY) return null;
  const end = F(tools.end);
  if (f > end + 8 + k) return null;
  // 同一帧落位：放大 1.45 → 0.94 → 1.04 → 1，身后炸一圈金光；落位前 7 帧从屏幕两边飞进来
  const pop = d < 0 ? 1.15 : interpolate(d, [0, 3, 6, 9], [1.45, 0.94, 1.04, 1], {...CL, easing: Easing.out(Easing.quad)});
  const flyK = d < 0 ? Easing.in(Easing.cubic)(1 + d / FLY) : 1;
  const dxFly = d < 0 ? (t.side === 'L' ? -1 : 1) * (1 - flyK) * (t.side === 'L' ? IX.L + 200 : 1920 - IX.R + 200) : 0;
  const tilt = d < 0 ? (t.side === 'L' ? -1 : 1) * 25 * (1 - flyK) : 0;
  const outK = interpolate(f, [end + k, end + k + 6], [0, 1], {...CL, easing: Easing.in(Easing.cubic)});
  const cur = tools.rows.filter(([at]) => f >= F(at)).slice(-1)[0];
  const prev = tools.rows.filter(([at]) => f >= F(at)).slice(-2, -1)[0];
  const dimOf = (r?: [number, 'L' | 'R']) => (r && r[1] !== t.side ? 0.62 : 0);
  const dim = cur ? dimOf(prev) + (dimOf(cur) - dimOf(prev)) * interpolate(f, [F(cur[0]), F(cur[0]) + 9], [0, 1], CL) : 0;
  const p = tools.pops[t.name];
  const pd = p != null ? f - F(p) : -1;
  const bump = pd >= 0 && pd < 12 ? 0.16 * Math.sin((Math.PI * pd) / 12) : 0;
  const ring = pd >= 0 && pd < 26;   // 框 0.8 秒就收，不拖到下一句
  const re = ring ? spring({frame: pd, fps, config: {damping: 12, stiffness: 220, mass: 0.6}}) : 0;
  const ro = ring ? interpolate(pd, [20, 26], [1, 0], CL) : 0;
  const x = IX[t.side], y = ROW_Y[t.row];
  const sc = pop * (1 + bump) * (1 - outK);
  return (
    <div style={{position: 'absolute', left: x - 110 + dxFly, top: y - ICON / 2, width: 220, height: ICON + 60, opacity: 1 - dim,
                 transform: `scale(${sc}) rotate(${tilt}deg)`}}>
      {d >= 0 && d < 12 ? <div style={{position: 'absolute', left: 110 - ICON * 0.75, top: ICON / 2 - ICON * 0.75, width: ICON * 1.5, height: ICON * 1.5,
                                       borderRadius: '50%', border: `10px solid ${GOLD}`, opacity: interpolate(d, [0, 12], [0.95, 0], CL),
                                       transform: `scale(${interpolate(d, [0, 12], [0.6, 1.9], CL)})`}} /> : null}
      <div style={{position: 'absolute', left: 110 - ICON / 2, top: 0, width: ICON, height: ICON, borderRadius: ICON * 0.24, background: '#fff',
                   border: `3px solid ${INK}`, boxShadow: SHADOW, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Img src={staticFile(t.logo)} style={{width: '80%', height: '80%', objectFit: 'contain'}} />
      </div>
      {ring ? <div style={{position: 'absolute', left: 110 - ICON / 2 - 14, top: -14, width: ICON + 28, height: ICON + 28, borderRadius: ICON * 0.3,
                           border: `7px solid ${GOLD}`, opacity: ro, transform: `scale(${1.25 - 0.25 * re})`}} /> : null}
      <div style={{position: 'absolute', left: -80, right: -80, top: ICON + 10, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 32,
                   whiteSpace: 'nowrap', color: CREAM, WebkitTextStroke: `7px ${INK}`, paintOrder: 'stroke fill', letterSpacing: 0.5,
                   opacity: d < 0 ? 0 : 1}}>{t.name}</div>
    </div>
  );
};

export const OpenStack: React.FC<{s: Open2Spec | null}> = ({s}) => {
  const f = useCurrentFrame();
  if (!s) return null;
  const parts: React.ReactNode[] = [];
  // ① 教程卡：两大摞；「学」红光一闪 + 变灰 + 大红叉；out 整摞往下掉
  if (f <= F(s.tut.out) + 14) {
    const gray = interpolate(f, [F(s.tut.strike), F(s.tut.strike) + 5], [0, 1], CL);
    const n = {L: 0, R: 0};
    s.tut.cards.forEach((c, i) => {
      const k = n[c.side]++;
      const out = interpolate(f, [F(s.tut.out) + k, F(s.tut.out) + k + 12], [0, 1], {...CL, easing: Easing.in(Easing.quad)});
      parts.push(<StackCard key={'t' + i} c={c} pos={TUT_POS[k % TUT_POS.length]} cx={TUT_CX[c.side]} cy={400} w={330} h={265} gray={gray} out={out} fall s0={1.8} />);
    });
    const outX = interpolate(f, [F(s.tut.out), F(s.tut.out) + 12], [0, 1], {...CL, easing: Easing.in(Easing.quad)});
    parts.push(<RedX key="xl" at={s.tut.strike} x={TUT_CX.L} y={400} size={430} out={outX} />);
    parts.push(<RedX key="xr" at={s.tut.strike + 0.04} x={TUT_CX.R} y={400} size={430} out={outX} />);
  }
  parts.push(<Flash key="fr" at={s.tut.strike} color="#E5484D" peak={0.32} len={7} />);
  // ② 干活的真界面卡：左右各两张（上下错开叠着），说到「干活」依次打金勾 + 金光一闪
  if (f >= F(s.work.cards[0]?.at ?? 1e9) - 1 && f <= F(s.work.out) + 10) {
    const out = interpolate(f, [F(s.work.out), F(s.work.out) + 9], [0, 1], {...CL, easing: Easing.in(Easing.cubic)});
    const n = {L: 0, R: 0};
    s.work.cards.forEach((c, i) => {
      const k = n[c.side]++;
      parts.push(<StackCard key={'w' + i} c={c} pos={WORK_POS[k % WORK_POS.length]} cx={SX[c.side]} cy={430} w={390} h={350} gray={0} out={out} s0={1.6}
                            badge={<>{c.video ? <FF rate={c.rate ?? 4} /> : null}<Check at={s.work.done + 0.06 * i} /></>} />);
    });
  }
  parts.push(<Flash key="fg" at={s.work.done} color={GOLD} peak={0.3} len={7} />);
  // ③ logo 雨：「研究AI的累活」砸下来堆两堆，「包在我身上」炸开 + 白光
  if (s.rain) {
    const R = s.rain;
    R.logos.forEach((src, i) => parts.push(<RainLogo key={'r' + i} src={src} i={i} at={R.at + R.step * i} burst={R.burst} />));
    parts.push(<Flash key="fb" at={R.burst} color="#fff" peak={0.45} len={6} />);
  }
  // ④ 六个工具（从两边飞进来，同一拍落位：整屏提亮一下，半透明白、两三帧，不算白闪）
  const T = s.tools;
  const fl = F(Math.min(...T.items.map((t) => t.at)));
  if (f >= fl && f < fl + 6) {
    parts.push(<div key="flash" style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, background: '#fff',
                                        opacity: interpolate(f, [fl, fl + 1, fl + 6], [0, 0.5, 0], CL)}} />);
  }
  T.items.forEach((t, i) => parts.push(<ToolIcon key={'i' + i} t={t} tools={T} k={i} />));
  // 「哪个更适合你」：金框在六个之间跳
  if (f >= F(T.hop[0]) && f < F(T.hop[1])) {
    const order = [...T.items].sort((a, b) => a.at - b.at);
    const it = order[Math.floor((f - F(T.hop[0])) / 4) % order.length];
    parts.push(<div key="hop" style={{position: 'absolute', left: IX[it.side] - ICON / 2 - 14, top: ROW_Y[it.row] - ICON / 2 - 14, width: ICON + 28,
                                      height: ICON + 28, borderRadius: ICON * 0.3, border: `7px solid ${GOLD}`}} />);
  }
  // 两列标题
  if (f >= F(T.heads.at) && f <= F(T.end) + 8) {
    const o = interpolate(f, [F(T.heads.at), F(T.heads.at) + 8], [0, 1], CL) * interpolate(f, [F(T.end), F(T.end) + 8], [1, 0], CL);
    const cur = T.rows.filter(([at]) => f >= F(at)).slice(-1)[0];
    (['L', 'R'] as const).forEach((side) => {
      const on = cur && cur[1] === side;
      parts.push(
        <div key={'h' + side} style={{position: 'absolute', left: IX[side] - 130, top: 150, width: 260, textAlign: 'center', opacity: o}}>
          <span style={{display: 'inline-block', padding: '8px 22px', borderRadius: 14, fontFamily: FONT, fontWeight: 900, fontSize: 34,
                        background: on ? GOLD : 'rgba(14,15,20,0.78)', color: on ? INK : CREAM, border: `3px solid ${on ? INK : 'rgba(255,255,255,0.35)'}`,
                        boxShadow: on ? '4px 5px 0 rgba(20,12,2,0.6)' : 'none'}}>{T.heads[side]}</span>
        </div>,
      );
    });
  }
  return <>{parts}</>;
};

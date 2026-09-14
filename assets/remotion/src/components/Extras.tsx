import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

const F = (s: number) => Math.round(s * T.FPS);

/** 贴纸：实色 + 细描边 + 硬阴影；入场先白闪再落到本色 */
export const Sticker: React.FC<{
  tone?: 'cream' | 'gold' | 'red' | 'dark';
  e: number;        // 弹性进度 0..1
  local: number;    // 入场后的帧数
  size?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({tone = 'cream', e, local, size = 34, children, style}) => {
  const c =
    tone === 'gold' ? {bg: '#c9a24a', bd: '#8c6b21', fg: '#17130a'}
    : tone === 'red' ? {bg: '#6b1f18', bd: '#b85a4c', fg: '#f6dcd6'}
    : tone === 'dark' ? {bg: '#171922', bd: 'rgba(201,162,74,0.6)', fg: '#efe8d7'}
    : {bg: '#f4e9d2', bd: '#8c6b21', fg: '#17130a'};
  const flash = interpolate(local, [0, 2, 7], [0.95, 0.85, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        background: c.bg,
        color: c.fg,
        border: `2px solid ${c.bd}`,
        borderRadius: 999,
        padding: `${Math.round(size * 0.34)}px ${Math.round(size * 0.8)}px`,
        fontFamily: FONT,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: 1,
        whiteSpace: 'nowrap',
        boxShadow: '4px 5px 0 rgba(0,0,0,0.62)',
        transform: `scale(${0.82 + 0.18 * e})`,
        ...style,
      }}
    >
      <span style={{position: 'absolute', inset: -2, borderRadius: 999, background: '#fff', opacity: flash, pointerEvents: 'none'}} />
      {children}
    </div>
  );
};

const POP = {damping: 12, stiffness: 170, mass: 0.8};

/** 徽章：? ! ✓ ✗ —— 弹跳放大 */
export const Badge: React.FC<{glyph: string; tone: 'gold' | 'red'; e: number; size?: number}> = ({glyph, tone, e, size = 54}) => (
  <div
    style={{
      width: size, height: size, borderRadius: '50%',
      background: tone === 'gold' ? '#c9a24a' : '#8f2b21',
      color: tone === 'gold' ? '#17130a' : '#fff',
      border: '3px solid #fff',
      boxShadow: '3px 4px 0 rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, fontSize: size * 0.62, fontWeight: 700,
      transform: `scale(${0.3 + 0.7 * e}) rotate(${(1 - e) * -18}deg)`,
    }}
  >
    {glyph}
  </div>
);

/** ⑦ 箭头链：横排 A → B → C ✓；竖排则是参考片的「流程卡」——方框 + 向下箭头逐级画出 */
export const Chains: React.FC<{chains: any[]}> = ({chains}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const g = chains.find((c) => frame >= F(c.start) && frame < F(c.end) + 6);
  if (!g) return null;
  const out = interpolate(frame, [F(g.end), F(g.end) + 6], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const vertical = g.dir === 'v';
  const ARROW = 9;
  return (
    <div
      style={{
        position: 'absolute', left: 34, top: g.top ?? 124,
        display: 'flex', flexDirection: vertical ? 'column' : 'row',
        alignItems: vertical ? 'flex-start' : 'center', gap: 0, opacity: out,
      }}
    >
      {g.items.map((it: any, i: number) => {
        const local = frame - F(it.rf);
        if (local < 0) return null;
        const e = spring({frame: local, fps, config: POP});
        const draw = i === 0 ? 1 : interpolate(local + ARROW, [0, ARROW], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              vertical ? (
                <svg width={40} height={44} style={{flex: 'none', marginLeft: 34}}>
                  <line x1={20} y1={4} x2={20} y2={4 + 26 * Math.min(1, draw * 1.2)} stroke={GOLD} strokeWidth={4} strokeLinecap="round" />
                  <path d="M11 28 L20 40 L29 28 Z" fill={GOLD} opacity={draw > 0.85 ? 1 : 0} />
                </svg>
              ) : (
                <svg width={62} height={30} style={{flex: 'none', margin: '0 8px'}}>
                  <line x1={4} y1={15} x2={4 + 44 * Math.min(1, draw * 1.2)} y2={15} stroke={GOLD} strokeWidth={4} strokeLinecap="round" />
                  <path d="M46 6 L58 15 L46 24 Z" fill={GOLD} opacity={draw > 0.85 ? 1 : 0} />
                </svg>
              )
            ) : null}
            <Sticker tone={it.tone ?? 'cream'} e={e} local={local} size={33}>
              {it.t}
            </Sticker>
          </React.Fragment>
        );
      })}
      {g.badge && frame >= F(g.badgeAt) ? (
        <div style={{marginLeft: vertical ? 0 : 16, marginTop: vertical ? 14 : 0}}>
          <Badge glyph={g.badge} tone={g.badgeTone ?? 'gold'} e={spring({frame: frame - F(g.badgeAt), fps, config: {damping: 9, stiffness: 200, mass: 0.7}})} />
        </div>
      ) : null}
    </div>
  );
};

/** ⑧ 脸侧成对贴纸：左手边 / 右手边各一组，贴着手势出现 */
export const Pairs: React.FC<{pairs: any[]}> = ({pairs}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const g = pairs.find((p) => frame >= F(p.start) && frame < F(p.end) + 6);
  if (!g) return null;
  const out = interpolate(frame, [F(g.end), F(g.end) + 6], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const side = (items: any[], right: boolean) => (
    <div style={{position: 'absolute', [right ? 'right' : 'left']: 110, top: g.y ?? 400, display: 'flex', flexDirection: 'column', alignItems: right ? 'flex-end' : 'flex-start', gap: 18, opacity: out}}>
      {items.map((it: any, i: number) => {
        const local = frame - F(it.rf);
        if (local < 0) return null;
        const e = spring({frame: local, fps, config: {damping: 13, stiffness: 240, mass: 0.7}});
        return (
          <div key={i} style={{transform: `translateX(${(1 - e) * (right ? 40 : -40)}px)`}}>
            <Sticker tone={it.tone ?? 'cream'} e={e} local={local} size={it.size ?? 42}>{it.t}</Sticker>
          </div>
        );
      })}
    </div>
  );
  return (<>{side(g.left ?? [], false)}{side(g.right ?? [], true)}</>);
};

/** ⑨ 标记徽章：独立弹在指定位置（如脸侧的「?」） */
export const Marks: React.FC<{marks: any[]}> = ({marks}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {marks.map((m, i) => {
        if (frame < F(m.start) || frame >= F(m.end) + 6) return null;
        const local = frame - F(m.start);
        const e = spring({frame: local, fps, config: {damping: 8, stiffness: 190, mass: 0.7}});
        const out = interpolate(frame, [F(m.end), F(m.end) + 6], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        // 落定后轻微摇摆，像贴上去的
        const wob = local > 20 ? Math.sin((local - 20) / 9) * 4 : 0;
        return (
          <div key={i} style={{position: 'absolute', left: m.x, top: m.y, opacity: out, transform: `rotate(${wob}deg)`}}>
            <Badge glyph={m.glyph} tone={m.tone ?? 'gold'} e={e} size={m.size ?? 96} />
          </div>
        );
      })}
    </>
  );
};

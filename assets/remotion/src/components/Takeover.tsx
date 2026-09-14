import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import {T, GOLD, FONT} from '../theme';

/** ⑤ 全屏接管对比图：米白纸面 + 中轴金线 + 左右两栏 + 对比截图 */
export const Takeover: React.FC<{group: any; io: number}> = ({group, io}) => {
  const frame = useCurrentFrame(); // 相对 Sequence 起点
  const {fps} = useVideoConfig();
  const F = (s: number) => Math.round(s * T.FPS);
  const t0 = F(group.fin[0]);
  const node = (id: string) => group.nodes.find((n: any) => n.id === id);
  // 缺节点（如没有 b1/b2/f1-f3 的接管板）→ 永不入场，保证 pop() 的 hook 数量恒定
  const rf = (id: string) => {
    const n = node(id);
    return n ? F(n.rf) - t0 : 10 ** 9;
  };

  const pop = (id: string, lead = 0) => {
    const local = frame - rf(id) - lead;
    const e = spring({frame: local, fps, config: {damping: 13, stiffness: 140, mass: 0.9}});
    const ap = interpolate(local, [0, 7], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return {e, ap, on: local >= 0};
  };

  // 中轴金线自上而下画出（跟主卡同刻开始）
  const line = interpolate(frame - rf('r'), [6, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const Col: React.FC<{
    x: number;
    id: string;
    accent: string;
    children?: React.ReactNode;
  }> = ({x, id, accent, children}) => {
    const {e, ap, on} = pop(id);
    if (!on) return null;
    const n = node(id);
    return (
      <div
        style={{
          position: 'absolute',
          left: x,
          top: 300 + (1 - e) * 26,
          translate: '-50%',
          textAlign: 'center',
          fontFamily: FONT,
          opacity: ap,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            background: accent,
            color: '#fdfbf4',
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: 3,
            borderRadius: 12,
            padding: '16px 52px',
            boxShadow: '0 14px 36px rgba(20,15,5,0.25)',
          }}
        >
          {n.label}
        </div>
        <div style={{fontSize: 25, color: '#6f6a5e', marginTop: 16, letterSpacing: 1}}>
          {n.sub}
        </div>
        {children}
      </div>
    );
  };

  const p1 = pop('b1');
  const p2 = pop('b2');
  // 三张岗位卡扇形：轻微倾斜错落，薪资贴纸随卡弹出
  const FAN = [
    {id: 'f1', src: 'job_c1.png', rot: -7, dx: -170, dy: 16, w: 470, tag: '20-40K', tone: '#8a8676', tagLeft: true},
    {id: 'f2', src: 'job_hi.png', rot: 0, dx: 0, dy: 0, w: 500, tag: '70-100K·15薪', tone: T.goldDeep, tagLeft: false},
    {id: 'f3', src: 'job_c3.png', rot: 7, dx: 170, dy: 20, w: 470, tag: '35-65K', tone: '#8a8676', tagLeft: false},
  ].filter((f) => node(f.id));

  return (
    <AbsoluteFill style={{opacity: io, fontFamily: FONT}}>
      {/* 米白纸面 */}
      <AbsoluteFill style={{background: '#f6f0e1'}} />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(120% 90% at 22% 10%, rgba(201,162,74,0.10) 0%, rgba(0,0,0,0) 55%)',
        }}
      />
      <div style={{position: 'absolute', inset: 0}}>
        {/* 标题 */}
        {pop('r').on ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 118 + (1 - pop('r').e) * 20,
              translate: '-50%',
              opacity: pop('r').ap,
              fontSize: 52,
              fontWeight: 700,
              color: T.ink,
              letterSpacing: 3,
            }}
          >
            {node('r').label}
            <div
              style={{
                height: 4,
                background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
                marginTop: 14,
              }}
            />
          </div>
        ) : null}

        {/* 中轴金线 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 264,
            width: 3,
            height: 640 * line,
            background: `linear-gradient(180deg, ${GOLD}, rgba(201,162,74,0.25))`,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 560,
            translate: '-50% -50%',
            width: 86,
            height: 86,
            borderRadius: '50%',
            background: '#f6f0e1',
            border: `2.6px solid ${GOLD}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            fontWeight: 700,
            color: T.goldDeep,
            opacity: line,
          }}
        >
          VS
        </div>

        {/* 左：五位数 */}
        <Col x={508} id="a" accent="#8a8676" />

        {/* 右：六位数以上 + 词条 + 对比截图 */}
        <Col x={1412} id="b" accent={T.goldDeep}>
          <div style={{display: 'flex', gap: 14, justifyContent: 'center', marginTop: 22}}>
            {[{p: p1, id: 'b1'}, {p: p2, id: 'b2'}].map(({p, id}) =>
              p.on ? (
                <div
                  key={id}
                  style={{
                    background: '#fdfbf4',
                    border: `1.6px solid ${GOLD}`,
                    borderRadius: 999,
                    padding: '10px 24px',
                    fontSize: 25,
                    fontWeight: 700,
                    color: T.ink,
                    whiteSpace: 'nowrap',
                    opacity: p.ap,
                    transform: `scale(${0.88 + 0.12 * p.e})`,
                    boxShadow: '0 8px 22px rgba(20,15,5,0.16)',
                  }}
                >
                  {node(id).label}
                </div>
              ) : null,
            )}
          </div>
        </Col>

        {/* 三卡扇形 + 薪资贴纸 */}
        {FAN.map((f) => {
          const pp = pop(f.id);
          if (!pp.on) return null;
          const local = frame - rf(f.id);
          const flash = interpolate(local, [0, 3, 9], [0.9, 0.7, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const tagE = spring({frame: local - 8, fps, config: {damping: 9, stiffness: 200, mass: 0.7}});
          return (
            <div
              key={f.id}
              style={{
                position: 'absolute',
                left: 1412 + f.dx,
                top: 562 + f.dy + (1 - pp.e) * 30,
                translate: '-50%',
                transform: `rotate(${f.rot * pp.e}deg) scale(${0.9 + 0.1 * pp.e})`,
                transformOrigin: '50% 100%',
                opacity: pp.ap,
                zIndex: f.id === 'f2' ? 3 : 2,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  background: '#fdfbf4',
                  border: `2.2px solid ${GOLD}`,
                  borderRadius: 10,
                  padding: 8,
                  boxShadow: '5px 7px 0 rgba(20,15,5,0.28)',
                }}
              >
                <span style={{position: 'absolute', inset: -2, borderRadius: 10, background: '#fff', opacity: flash, pointerEvents: 'none', zIndex: 3}} />
                <Img src={staticFile(f.src)} style={{width: f.w, height: 'auto', display: 'block', borderRadius: 5}} />
              </div>
              {local >= 8 ? (
                <div
                  style={{
                    position: 'absolute',
                    ...(f.tagLeft ? {left: -26} : {right: -26}),
                    top: -22,
                    background: f.tone,
                    color: '#fdfbf4',
                    fontSize: 27,
                    fontWeight: 700,
                    letterSpacing: 1,
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: '2px solid #fdfbf4',
                    boxShadow: '3px 4px 0 rgba(20,15,5,0.45)',
                    transform: `scale(${0.3 + 0.7 * tagE}) rotate(${(1 - tagE) * 12}deg)`,
                    transformOrigin: f.tagLeft ? '20% 80%' : '80% 80%',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.tag}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

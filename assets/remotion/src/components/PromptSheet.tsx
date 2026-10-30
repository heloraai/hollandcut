import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 提示词卡：观众要截图保存的那一段全局指令。
 * 压在录屏段右侧（左边留给素材自带的人物小窗和软件界面），整卡逐行落下；
 * 讲到第几条原则第几段就点亮、其余压暗，右上角「建议截图保存」小章一直呼吸。
 * 版心高度要收在字幕带上方（字幕在 bottom 62、字号 54）。
 */
export type PromptSpec = {
  start: number;
  end: number;
  title: string;
  hint?: string;
  x?: number;
  w?: number;
  sections: {h: string; at?: number | null; lines: string[]}[];
};

const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Sheet: React.FC<{s: PromptSpec; live: boolean}> = ({s, live}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = F(s.start);
  const b = F(s.end);
  const e = spring({frame: f - a, fps, config: {damping: 15, stiffness: 120, mass: 0.9}});
  const out = interpolate(f, [b, b + 9], [1, 0], {...CL, easing: Easing.inOut(Easing.ease)});
  // 还没讲到第一条之前整卡全亮（这段正是观众截图的时候），逐条讲的过程里只亮讲过的，讲完最后一条又整卡全亮
  const ats = s.sections.map((sec) => sec.at).filter((x): x is number => x != null);
  const started = ats.length > 0 && f >= F(Math.min(...ats));
  const done = ats.length > 0 && f >= F(Math.max(...ats));
  let li = 0; // 全卡逐行落下的序号

  return (
    <div
      style={{
        position: 'absolute',
        left: s.x ?? 1060,
        top: 120,          // 让出整条浏览器工具栏
        width: s.w ?? 800, // 收到正文实际需要的宽度，左边把录屏演示内容完整让出来
        boxSizing: 'border-box',
        background: '#fdfbf4',
        border: `3px solid ${GOLD}`,
        borderRadius: 22,
        padding: '16px 26px 18px',
        fontFamily: FONT,
        color: '#221d12',
        opacity: Math.min(1, e * 1.5) * out,
        transform: `translateX(${(1 - e) * 90}px) scale(${0.95 + 0.05 * e})`,
        boxShadow: '0 30px 80px rgba(0,0,0,0.62), 0 0 40px rgba(201,162,74,0.22)',
        overflow: 'hidden',
      }}
    >
      {/* 落位白闪 */}
      <span
        style={{
          position: 'absolute', inset: 0, background: '#fff', pointerEvents: 'none',
          opacity: interpolate(f - a, [0, 3, 10], [0.85, 0.6, 0], CL),
        }}
      />
      {/* 标题行 */}
      <div style={{display: 'flex', alignItems: 'center', gap: 11, borderBottom: `2px solid rgba(201,162,74,0.45)`, paddingBottom: 10}}>
        <span style={{fontSize: 26, fontWeight: 900, color: GOLD, letterSpacing: 2}}>#</span>
        <span style={{fontSize: 30, fontWeight: 800, letterSpacing: 2}}>{s.title}</span>
        {s.hint ? (
          <span
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
              background: 'linear-gradient(135deg, #e6cf92, #c9a24a)', color: '#17130a',
              fontSize: 20, fontWeight: 800, letterSpacing: 1, padding: '6px 15px', borderRadius: 999,
              border: '3px solid #fdfbf4', boxShadow: '4px 5px 0 rgba(20,15,5,0.3)',
              transform: `rotate(-2deg) scale(${1 + (live ? 0.035 : 0) * Math.sin(f / 9)})`,
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#17130a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {s.hint}
          </span>
        ) : null}
      </div>

      {s.sections.map((sec, i) => {
        // 没有锚点的段（如「默认原则」）跟着整卡走：逐条讲的过程里一起压暗，别在底部抢视线
        const on = sec.at == null ? !started || done : f >= F(sec.at);
        const dim = !started || on ? 1 : 0.5;
        const hitAt = sec.at != null ? F(sec.at) : -1e9;
        const hit = f >= hitAt && sec.at != null
          ? spring({frame: f - hitAt, fps, config: {damping: 13, stiffness: 190, mass: 0.7}})
          : 0;
        return (
          <div
            key={i}
            style={{
              marginTop: 7,
              paddingLeft: 12,
              borderLeft: `5px solid ${on ? GOLD : 'rgba(201,162,74,0.22)'}`,
              opacity: dim,
              transform: `translateX(${hit * 5}px)`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 9, height: 32}}>
              <span style={{fontSize: 20, fontWeight: 900, color: GOLD, letterSpacing: 1}}>##</span>
              <span style={{fontSize: 26, fontWeight: 800, letterSpacing: 2, color: on ? '#17130a' : '#5c5547'}}>{sec.h}</span>
              {on && sec.at != null ? (
                <span
                  style={{
                    width: 11, height: 11, borderRadius: '50%', background: GOLD, flex: 'none',
                    boxShadow: `0 0 ${8 + 6 * Math.abs(Math.sin(f / 8))}px rgba(201,162,74,0.85)`,
                    transform: `scale(${Math.min(1, hit * 1.4)})`,
                  }}
                />
              ) : null}
            </div>
            {sec.lines.map((ln, k) => {
              const at = a + 8 + li++ * 2; // 全卡逐行落下
              const le = interpolate(f, [at, at + 7], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
              return (
                <div
                  key={k}
                  style={{
                    display: 'flex', gap: 9, marginTop: 2, fontSize: 21, lineHeight: '26px', letterSpacing: 0.4,
                    color: on ? '#3b3527' : '#6b6455',
                    opacity: le, transform: `translateY(${(1 - le) * 7}px)`,
                  }}
                >
                  <span style={{color: GOLD_LITE, fontWeight: 800, flex: 'none'}}>–</span>
                  <span>{ln}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const PromptSheets: React.FC<{prompts: PromptSpec[]; live?: boolean}> = ({prompts, live = false}) => {
  const f = useCurrentFrame();
  const cur = prompts.find((p) => f >= F(p.start) && f < F(p.end) + 10);
  return cur ? <Sheet key={cur.start} s={cur} live={live} /> : null;
};

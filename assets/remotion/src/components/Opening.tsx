import React from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * max 档招牌时刻 · 开场剪辑器：整条片被「装进」一个假剪辑软件——人物缩进监视器，
 * 播放头扫过逐刀落切割标记，AI 徽章砸落，步骤灯逐个点亮，（可选）右上红章；
 * boom 时刻白闪炸开、界面飞散、人物弹回全屏。
 * 时刻全部来自 structure.py 的 hook_editor(...)（台词锚点，母版秒）；时间轴缩略图由 layers.py 抽到 public/thumbs/。
 */
export type OpeningSpec = {
  title: string;
  ui: number;
  badge: {t: string; at: number};
  steps: {t: string; at: number}[];
  stamp?: {t: string; at: number} | null;
  boom: number;
  end: number;
};

const FR = (s: number) => Math.round(s * T.FPS);
const SC = 0.52, TX = 32, TY = -168; // 监视器里视频的目标变换
const MON = {x: 493, y: 92, w: 998, h: 561}; // 监视器框
const CUT_X = [340, 560, 780, 1000, 1220, 1440];
const PLAY_X0 = 200, PLAY_X1 = 1560;
const WAVE = Array.from({length: 92}, (_, i) => 8 + 9 * Math.abs(Math.sin(i * 0.83)) + 7 * Math.abs(Math.sin(i * 0.31 + 2)));

const clamp = (f: number, a: number, b: number, lo = 0, hi = 1, ease?: (t: number) => number) =>
  interpolate(f, [a, b], [lo, hi], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

/** 界面碎片：boom 后 16 帧内按 dx/dy/rot 飞散淡出 */
const Fly: React.FC<{
  f: number;
  boom: number;
  dx: number;
  dy: number;
  rot: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({f, boom, dx, dy, rot, children, style}) => {
  const t = clamp(f, boom, boom + 16, 0, 1, Easing.in(Easing.cubic));
  return (
    <div
      style={{
        ...style,
        opacity: Number(style?.opacity ?? 1) * (1 - t),
        transform: `${style?.transform ?? ''} translate(${dx * t}px, ${dy * t}px) rotate(${rot * t}deg)`,
      }}
    >
      {children}
    </div>
  );
};

export const Opening: React.FC<{o: OpeningSpec}> = ({o}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const A_UI = FR(o.ui);
  const A_BADGE = FR(o.badge.at);
  const A_BOOM = FR(o.boom);
  const A_END = FR(o.end);
  const A_CUT0 = A_BADGE + 5;
  // 播放头一路扫到红章时刻；没有红章就扫到炸开前 1/3 秒
  const A_SWEEP = Math.max(A_CUT0 + 1, o.stamp ? FR(o.stamp.at) : A_BOOM - 10);
  const stampOn = !!o.stamp && f >= FR(o.stamp.at);

  // 人物：开场重拳 → 缩进监视器 → 炸开弹回全屏
  const punch = spring({frame: f, fps, config: {damping: 15, stiffness: 120, mass: 0.8}});
  const shrink = clamp(f, A_UI, A_UI + 20, 0, 1, Easing.inOut(Easing.cubic));
  const back = f >= A_BOOM ? spring({frame: f - A_BOOM, fps, config: {damping: 11, stiffness: 110, mass: 0.9}}) : 0;
  const inMon = shrink * (1 - back);
  const scale = (1.1 - 0.1 * punch) * (1 - inMon) + SC * inMon;
  const shake = f >= A_BOOM && f < A_BOOM + 9 ? Math.sin((f - A_BOOM) * 2.4) * 7 * (1 - (f - A_BOOM) / 9) : 0;
  const flashBoom = interpolate(f, [A_BOOM, A_BOOM + 2, A_BOOM + 7], [0, 0.9, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const uiIn = clamp(f, A_UI, A_UI + 14, 0, 1, Easing.out(Easing.cubic));
  const fadeAll = clamp(f, A_END, A_END + 8, 1, 0);
  const playX = clamp(f, A_CUT0, A_SWEEP, PLAY_X0, PLAY_X1, Easing.inOut(Easing.ease));
  const badgeE = f >= A_BADGE ? spring({frame: f - A_BADGE, fps, config: {damping: 10, stiffness: 160, mass: 0.8}}) : 0;
  const stampE = stampOn ? spring({frame: f - FR(o.stamp!.at), fps, config: {damping: 9, stiffness: 210, mass: 0.7}}) : 0;

  return (
    <AbsoluteFill style={{opacity: fadeAll, fontFamily: FONT}}>
      {/* 编辑器底色（炸开时让位给底层真人画面） */}
      <AbsoluteFill style={{background: '#101216', opacity: uiIn * (1 - clamp(f, A_BOOM + 4, A_BOOM + 15, 0, 1))}} />

      {/* 人物视频（自己这份，可自由变换；与底层 main_v 同源同刻，收尾无缝交接） */}
      <AbsoluteFill style={{transform: `translate(${TX * inMon + shake}px, ${TY * inMon}px) scale(${scale})`}}>
        <OffthreadVideo src={staticFile('main_v.mp4')} muted style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 * inMon}} />
      </AbsoluteFill>

      {/* 监视器金框 */}
      <Fly f={f} boom={A_BOOM} dx={60} dy={-220} rot={-3} style={{position: 'absolute', left: MON.x - 10, top: MON.y - 10, width: MON.w + 20, height: MON.h + 20, opacity: inMon}}>
        <div style={{width: '100%', height: '100%', borderRadius: 20, border: '3px solid rgba(201,162,74,0.75)', boxShadow: '0 0 40px rgba(201,162,74,0.18), 0 24px 70px rgba(0,0,0,0.6)'}} />
        <div style={{position: 'absolute', left: 18, top: 14, fontSize: 21, letterSpacing: 2, color: 'rgba(230,207,146,0.9)', textShadow: '0 2px 6px #000'}}>● REC · 预览</div>
      </Fly>

      {/* 顶栏 + 可选红章 */}
      <Fly f={f} boom={A_BOOM} dx={-140} dy={-260} rot={-6} style={{position: 'absolute', left: 0, top: 0, right: 0, height: 64, opacity: uiIn, transform: `translateY(${(1 - uiIn) * -64}px)`}}>
        <div style={{height: '100%', background: '#1a1c22', borderBottom: '1px solid #2c2f38', display: 'flex', alignItems: 'center', padding: '0 26px', gap: 12}}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} style={{width: 15, height: 15, borderRadius: '50%', background: c}} />
          ))}
          <span style={{marginLeft: 20, fontSize: 25, fontWeight: 700, letterSpacing: 2, color: '#d9dbe2'}}>{o.title}</span>
          {o.stamp ? (
            <span
              style={{
                marginLeft: 'auto', fontSize: 24, fontWeight: 700, letterSpacing: 1, padding: '7px 20px', borderRadius: 999,
                background: stampOn ? 'rgba(143,43,33,0.92)' : 'rgba(255,255,255,0.06)',
                color: stampOn ? '#ffd9d3' : '#8a8f9c',
                border: stampOn ? '2px solid #d4675a' : '1px solid #33363f',
                transform: `scale(${stampOn ? 0.8 + 0.2 * stampE : 1})`,
              }}
            >
              {o.stamp.t}
            </span>
          ) : null}
        </div>
      </Fly>

      {/* 左工具栏 */}
      <Fly f={f} boom={A_BOOM} dx={-320} dy={80} rot={-14} style={{position: 'absolute', left: 0, top: 64, width: 64, bottom: 150, opacity: uiIn, transform: `translateX(${(1 - uiIn) * -64}px)`}}>
        <div style={{width: '100%', height: '100%', background: '#16181d', borderRight: '1px solid #2c2f38', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 22, gap: 20}}>
          {['✂', '❐', 'T', '♪', '★'].map((g, i) => (
            <span key={i} style={{width: 40, height: 40, borderRadius: 10, background: i === 0 ? 'rgba(201,162,74,0.22)' : '#20232b', color: i === 0 ? GOLD_LITE : '#7c818d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21}}>{g}</span>
          ))}
        </div>
      </Fly>

      {/* AI 徽章：斜着砸在监视器右上角 */}
      <Fly f={f} boom={A_BOOM} dx={340} dy={-240} rot={16} style={{position: 'absolute', left: MON.x + MON.w - 300, top: MON.y + 26, opacity: badgeE > 0 ? 1 : 0}}>
        <div
          style={{
            position: 'relative',
            transform: `rotate(-7deg) scale(${1.7 - 0.7 * Math.min(1, badgeE)})`,
            background: 'linear-gradient(135deg, #e6cf92, #c9a24a)', color: '#17130a', fontSize: 34, fontWeight: 800,
            letterSpacing: 2, padding: '12px 26px', borderRadius: 14, border: '3px solid #fdfbf4',
            boxShadow: '6px 8px 0 rgba(0,0,0,0.55), 0 0 46px rgba(201,162,74,0.5)',
          }}
        >
          {o.badge.t}
          <span style={{position: 'absolute', inset: -3, borderRadius: 14, background: '#fff', opacity: clamp(f, A_BADGE, A_BADGE + 6, 0.95, 0)}} />
        </div>
      </Fly>

      {/* 步骤灯：监视器右侧竖列，说到哪步亮哪步 */}
      <Fly f={f} boom={A_BOOM} dx={380} dy={-80} rot={10} style={{position: 'absolute', right: 40, top: 170, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 18, opacity: uiIn}}>
        {o.steps.map((s, i) => {
          const on = f >= FR(s.at);
          const e = on ? spring({frame: f - FR(s.at), fps, config: {damping: 11, stiffness: 200, mass: 0.7}}) : 0;
          return (
            <span
              key={i}
              style={{
                fontSize: 26, fontWeight: 700, letterSpacing: 2, padding: '9px 22px', borderRadius: 999,
                background: on ? '#c9a24a' : 'rgba(255,255,255,0.05)', color: on ? '#17130a' : '#6d727e',
                border: on ? '2px solid #8c6b21' : '1px solid #33363f',
                boxShadow: on ? '3px 4px 0 rgba(0,0,0,0.5)' : 'none',
                transform: `scale(${on ? 0.82 + 0.18 * e : 1})`,
              }}
            >
              {on ? '✓ ' : '· '}
              {s.t}
            </span>
          );
        })}
      </Fly>

      {/* 时间轴面板 */}
      <Fly f={f} boom={A_BOOM} dx={180} dy={420} rot={7} style={{position: 'absolute', left: 0, right: 0, top: 690, height: 240, opacity: uiIn, transform: `translateY(${(1 - uiIn) * 240}px)`}}>
        <div style={{position: 'absolute', inset: 0, background: '#15171c', borderTop: '1px solid #2c2f38'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 26, background: '#1a1c22'}}>
          {Array.from({length: 24}, (_, i) => (
            <span key={i} style={{position: 'absolute', left: 120 + i * 72, bottom: 0, width: 1, height: i % 4 === 0 ? 14 : 7, background: '#4a4e59'}} />
          ))}
          {Array.from({length: 6}, (_, i) => (
            <span key={'t' + i} style={{position: 'absolute', left: 124 + i * 288, top: 1, fontSize: 15, color: '#767b87'}}>
              {`${Math.floor((i * 25) / 60)}:${String((i * 25) % 60).padStart(2, '0')}`}
            </span>
          ))}
        </div>
        <div style={{position: 'absolute', left: 24, top: 52, fontSize: 20, color: '#8a8f9c', fontWeight: 700}}>V1</div>
        <div style={{position: 'absolute', left: 24, top: 158, fontSize: 20, color: '#8a8f9c', fontWeight: 700}}>A1</div>
        <div style={{position: 'absolute', left: 90, top: 36, width: 1700, height: 100, borderRadius: 8, overflow: 'hidden', background: '#0d0e12', display: 'flex'}}>
          {Array.from({length: 10}, (_, i) => (
            <Img key={i} src={staticFile(`thumbs/t${i % 8}.jpg`)} style={{width: 172, height: 97, marginRight: 2, opacity: 0.92}} />
          ))}
        </div>
        <div style={{position: 'absolute', left: 90, top: 148, width: 1700, height: 56, borderRadius: 8, background: 'rgba(201,162,74,0.07)', overflow: 'hidden'}}>
          <svg width={1700} height={56}>
            {WAVE.map((h, i) => (
              <rect key={i} x={6 + i * 18.4} y={28 - h} width={7} height={h * 2} rx={3} fill="rgba(201,162,74,0.55)" />
            ))}
          </svg>
        </div>
        {/* 切割标记：播放头扫过就落刀 */}
        {CUT_X.map((x, i) => {
          const hit = playX >= x;
          const at = A_CUT0 + Math.round(((x - PLAY_X0) / (PLAY_X1 - PLAY_X0)) * (A_SWEEP - A_CUT0));
          const e = hit ? spring({frame: f - at, fps, config: {damping: 10, stiffness: 260, mass: 0.6}}) : 0;
          return (
            <React.Fragment key={i}>
              <span style={{position: 'absolute', left: x, top: 30, width: 4, height: 176, background: '#fff', borderRadius: 2, opacity: hit ? 0.95 * e : 0, boxShadow: '0 0 14px rgba(255,255,255,0.8)', transform: `scaleY(${e})`, transformOrigin: 'top'}} />
              <span style={{position: 'absolute', left: x - 15, top: 32, fontSize: 19, color: GOLD_LITE, opacity: hit ? e : 0, transform: `translateY(${(1 - e) * -10}px)`}}>✂</span>
            </React.Fragment>
          );
        })}
        {/* 播放头 */}
        <div style={{position: 'absolute', left: playX, top: 0, width: 3, height: 240, background: GOLD_LITE, boxShadow: `0 0 16px ${GOLD}`, opacity: f >= A_CUT0 ? 1 : 0}}>
          <span style={{position: 'absolute', left: -8, top: -1, width: 19, height: 14, background: GOLD_LITE, clipPath: 'polygon(0 0, 100% 0, 50% 100%)'}} />
        </div>
      </Fly>

      {/* 炸开白闪（gen_spec 登记在 spec.flashes，spike_scan 不会误报） */}
      <AbsoluteFill style={{background: '#fff', opacity: flashBoom, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

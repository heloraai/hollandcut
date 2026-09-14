import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import {T, GOLD, FONT} from './theme';
import {LogicGraph, GNode, Box} from './components/LogicGraph';
import {ChapterTags, ChipStacks, Shows} from './components/Overlays';
import {Chains, Pairs, Marks} from './components/Extras';
import {Takeover} from './components/Takeover';
import spec from '../public/spec.json';

const F = (s: number) => Math.round(s * T.FPS);

/** 暗色城市 / 科技质感背景 */
const Stage: React.FC = () => {
  const f = useCurrentFrame();
  const ax = 22 + 3 * Math.sin(f / 230);
  return (
    <AbsoluteFill style={{background: T.bg}}>
      {/* 磨砂玻璃：预渲染的柔化+颗粒房间画面 → 暗色玻璃 tint → 斜向反光 → 轻暗角 */}
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <OffthreadVideo
          src={staticFile('bg.mp4')}
          muted
          style={{width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.04)'}}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'rgba(8,9,12,0.52)'}} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(115deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) ${ax + 14}%, rgba(255,255,255,0.00) 60%, rgba(255,255,255,0.02) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(120% 100% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/** 圆形人物窗：bl = 左下 360，tl = 左上 300 */
/** 圆形人物窗：bl = 左下 360，to = 接管板小圆 230（淡入 + 轻微缩放，v9 验收形态） */
const PersonCircle: React.FC<{mode: 'bl' | 'tl' | 'to'; op: number}> = ({mode, op}) => {
  const D = mode === 'bl' ? 360 : mode === 'tl' ? 300 : 230;
  const left = mode === 'bl' ? 88 : mode === 'tl' ? 82 : 64;
  const top = mode === 'bl' ? T.H - D - 148 : mode === 'tl' ? 112 : T.H - D - 150;
  const g = mode === 'bl' ? 1 : 0.62;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: D,
        height: D,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `5px solid ${GOLD}`,
        boxShadow: `0 0 ${52 * g}px rgba(201,162,74,${0.34 * g}),
                    0 0 0 1px rgba(0,0,0,0.5), 0 18px 52px rgba(0,0,0,0.6)`,
        opacity: op,
        transform: `scale(${0.94 + 0.06 * op})`,
      }}
    >
      <OffthreadVideo
        src={staticFile('pip.mp4')}
        muted
        style={{
          width: D * 1.95,
          height: 'auto',
          marginLeft: -D * 0.5,
          marginTop: -D * 0.08,
        }}
      />
    </div>
  );
};

const Subtitle: React.FC<{text: string; local: number}> = ({text, local}) => {
  const parts = text.split(/(【[^】]*】)/g).filter(Boolean);
  // 关键词下方金线从左向右描出（0.33s）
  const uw = interpolate(local, [3, 13], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 62,
        textAlign: 'center',
        fontFamily: FONT,
        fontSize: 54,
        fontWeight: 700,
        letterSpacing: 1,
        color: '#fff',
        textShadow:
          '0 3px 12px rgba(0,0,0,0.92), 0 1px 3px rgba(0,0,0,1), 0 0 26px rgba(0,0,0,0.7)',
      }}
    >
      {parts.map((p, i) =>
        p.startsWith('【') ? (
          <span key={i} style={{color: '#f0c860', position: 'relative', display: 'inline-block'}}>
            {p.slice(1, -1)}
            <span
              style={{
                position: 'absolute',
                left: 2,
                bottom: -3,
                height: 5,
                width: `calc(${uw * 100}% - 4px)`,
                background: GOLD,
                borderRadius: 3,
                boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
              }}
            />
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </div>
  );
};

/** 有人物时逻辑图避开人物；无人物时整体落到 x=960 y≈490 */
const boxFor = (pip: string): Box =>
  pip === 'bl'
    ? {x0: 520, x1: 1868, y0: 120, y1: 862}
    : pip === 'tl'
    ? {x0: 440, x1: 1868, y0: 128, y1: 870}
    : {x0: 150, x1: 1780, y0: 110, y1: 870};

/** 溶解包络：窗口由 gen_spec.py 算好写在 spec 里，这里只做插值 */
const ramp = (frame: number, fin: number[], fout: number[]) =>
  interpolate(
    frame,
    [F(fin[0]), F(fin[1]), F(fout[0]), F(fout[1])],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)},
  );

export const ShenVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const groups = spec.groups as any[];

  // 人物全屏透明度：相接的组已在 spec 里并成区块，区块内不会闪回全屏
  const cover = Math.max(
    0,
    ...(spec.blocks as any[]).map((b) => ramp(frame, b.fin, b.fout)),
  );
  const fullOp = 1 - cover;

  const cue = spec.cues.find(
    (c: any) => frame >= F(c.start) && frame < F(c.end),
  );

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Stage />
      {fullOp > 0.002 ? (
        <AbsoluteFill style={{opacity: fullOp}}>
          <OffthreadVideo
            src={staticFile('main_v.mp4')}
            muted
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
          {/* 淡出过程同步压暗：叠黑色而不是 CSS filter（filter 作用在视频层会触发 Chromium 瓦片合成缺陷） */}
          <AbsoluteFill style={{background: `rgba(0,0,0,${(1 - fullOp) * 0.75})`}} />
        </AbsoluteFill>
      ) : null}

      {/* 全屏视频展示（如开场 B-roll）：压在人物层上、叠加层下 */}
      {(spec.shows as any[])
        .filter((x) => x.type === 'video' && x.full && x.fin)
        .map((x, i) => {
          const op = ramp(frame, x.fin, x.fout);
          if (op <= 0.002) return null;
          return (
            <Sequence key={'fv' + i} from={Math.max(0, F(x.fin[0]))} layout="none">
              <AbsoluteFill style={{opacity: op}}>
                <OffthreadVideo
                  src={staticFile(x.src)}
                  muted
                  style={{width: '100%', height: '100%', objectFit: 'cover'}}
                />
              </AbsoluteFill>
            </Sequence>
          );
        })}


      <Audio src={staticFile('main.mp4')} />

      {groups.map((g) => {
        const from = F(g.fin[0]);
        const to = F(g.fout[1]);
        if (to <= from) return null;
        return (
          <Sequence key={g.no} from={from} durationInFrames={to - from} layout="none">
            <GroupCanvas group={g} />
          </Sequence>
        );
      })}

      {(spec.pipRuns as any[]).map((r, i) => {
        const op = ramp(frame, r.fin, r.fout);
        return op > 0.002 ? <PersonCircle key={i} mode={r.mode as 'bl' | 'tl' | 'to'} op={op} /> : null;
      })}

      <ChapterTags chapters={spec.chapters as any[]} />
      <ChipStacks chips={spec.chips as any[]} />
      <Chains chains={(spec as any).chains ?? []} />
      <Pairs pairs={(spec as any).pairs ?? []} />
      <Marks marks={(spec as any).marks ?? []} />
      <Shows shows={spec.shows as any[]} />

      {(spec as any).subtitles !== false && cue ? (
        <Subtitle text={cue.text} local={frame - F(cue.start)} />
      ) : null}
    </AbsoluteFill>
  );
};

/** 单组画布：柔和进入 → 台词驱动生长 → 停留 → 柔和退出；整板全程缓慢漂浮 */
const GroupCanvas: React.FC<{group: any}> = ({group}) => {
  const frame = useCurrentFrame();
  const f0 = F(group.fin[0]);
  const io = interpolate(
    frame,
    [0, F(group.fin[1]) - f0, F(group.fout[0]) - f0, F(group.fout[1]) - f0],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)},
  );
  const push = interpolate(
    frame,
    [F(group.start) - f0, F(group.end) - f0],
    [1, 1.016],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  // 极缓漂浮：整板永远有一点点生命感
  const fy = 5 * Math.sin(frame / 52);
  const fx = 3 * Math.sin(frame / 87 + 2);
  const reveals = (group.nodes as any[]).map((n) => F(n.rf) - f0);
  if (group.pip === 'to') {
    return <Takeover group={group} io={io} />;
  }
  return (
    <AbsoluteFill
      style={{
        opacity: io,
        transform: `translate(${fx}px, ${(1 - io) * 14 + fy}px) scale(${push})`,
      }}
    >
      <LogicGraph
        nodes={group.nodes as GNode[]}
        box={{...boxFor(group.pip), ...(group.box ?? {})}}
        reveals={reveals}
      />
    </AbsoluteFill>
  );
};

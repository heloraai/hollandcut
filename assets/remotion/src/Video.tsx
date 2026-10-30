import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Audio,
  Freeze,
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
import {Opening} from './components/Opening';
import {GoldDust, EndCard} from './components/Ambient';
import {BigTitles, titleJoltFrames} from './components/BigTitle';
import {RoadmapRails} from './components/RoadmapRail';
import {DuelBars} from './components/DuelBars';
import {ImageFans} from './components/ImageFan';
import {PromptSheets} from './components/PromptSheet';
import {CodexWall} from './components/CodexWall';
import {LockCard} from './components/LockCard';
import {IncomeCounter} from './components/IncomeCounter';
import {LogoBurst} from './components/LogoBurst';
import {OpenStack} from './components/OpenStack';
import {MapRows} from './components/MapRows';
import {ReceiptPile} from './components/ReceiptPile';
import {NumberPops} from './components/NumberPops';
import {ReceiptStacks, slamTimes} from './components/ReceiptStack';
import {PartnerColumns, calloutTimes} from './components/PartnerColumn';
import {RateCounter} from './components/RateCounter';
import {SkillGrid} from './components/SkillGrid';
import {SolutionCompare} from './components/SolutionCompare';
import {ImageVersus} from './components/ImageVersus';
import {Pyramid} from './components/Pyramid';
import {LoopCycle} from './components/LoopCycle';
import {ReceiptRow} from './components/ReceiptRow';
import {LogoCards} from './components/LogoCards';
import {GapBars} from './components/GapBars';
import {ScreenRecs} from './components/ScreenRec';
import {Hints, LogoRows, heroMarkFrames} from './components/Cues';
import {BrainBody} from './components/BrainBody';
import {ChapterCards, cardWindow} from './components/ChapterCard';
import {BrainBoard} from './components/BrainBoard';
import {TierBoard} from './components/TierBoard';
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
  // 10-18：圆窗的透明度由 hide(…, 'pip') 给 —— 全屏人物完全退掉（或被录屏完全盖住）以后才出、全屏人物回来之前就收掉，任何一帧都不会两张脸
  const D = mode === 'bl' ? 360 : mode === 'tl' ? 300 : 230;
  const left = mode === 'bl' ? 88 : mode === 'tl' ? 82 : 64;
  const top = mode === 'bl' ? T.H - D - 180 : mode === 'tl' ? 112 : T.H - D - 150;   // 10-18：bl 底边收到 y=900（原来 932 压进字幕带）
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
        border: '5px solid #F6C453',   /* 扁平：只留一圈纯金边，不发光不投影 */
        opacity: op,
        transform: `scale(${0.86 + 0.14 * op})`,
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

/** 进出场分段：进场窗口的前一半先把全屏人物退掉（深色底盖上来），后一半再出圆窗 / 板上的内容；出场倒过来。
 *  seg(frame, fin, fout, a, b)：在进场窗口的 [a, b] 段从 0 升到 1，在出场窗口的 [1-b, 1-a] 段从 1 降回 0。按浮点帧插值，窗口再短也不会出现相等的节点。 */
const SPLIT = 0.5;
export const seg = (frame: number, fin: number[], fout: number[], a: number, b: number) => {
  const at = (w: number[], k: number) => (w[0] + (w[1] - w[0]) * k) * T.FPS;
  return interpolate(frame, [at(fin, a), at(fin, b), at(fout, 1 - b), at(fout, 1 - a)], [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)});
};

/** 避免进出录屏先暗一下（人物和白底网页同时半透明叠在深色底上）：隐人区块从全屏录屏开始 / 以全屏录屏结束的那一侧，
 *  人物不再先退到深色底 —— 录屏淡入的 0.4 秒里人物一直不透明垫在底下（直接交叉淡化），录屏完全盖住（fin[1]）那一帧才撤；
 *  出场倒过来：录屏开始淡出（fout[0]）那一帧人物已经在它底下回满。圆窗只在这两帧之间出（各 PIPF 帧），任何一帧都不会两张脸。
 *  板那一侧照旧用 seg 的分段。hide(…, 'person') 给全屏人物的遮盖量，hide(…, 'pip') 给圆窗透明度 */
const RECS = (spec.shows as any[]).filter((x) => x.type === 'video' && x.full && x.fin);
const PIPF = 6;
const EZ = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)} as const;
const hide = (frame: number, fin: number[], fout: number[], who: 'person' | 'pip') => {
  const recIn = RECS.some((x) => x.fin[0] === fin[0] && x.fin[1] === fin[1]);
  const recOut = RECS.some((x) => x.fout[0] === fout[0] && x.fout[1] === fout[1]);
  const [a, b] = who === 'person' ? [0, SPLIT] : [SPLIT, 1];
  const at = (w: number[], k: number) => (w[0] + (w[1] - w[0]) * k) * T.FPS;
  const up = !recIn ? interpolate(frame, [at(fin, a), at(fin, b)], [0, 1], EZ)
    : who === 'person' ? (frame >= F(fin[1]) ? 1 : 0) : interpolate(frame, [F(fin[1]), F(fin[1]) + PIPF], [0, 1], EZ);
  const down = !recOut ? interpolate(frame, [at(fout, 1 - b), at(fout, 1 - a)], [1, 0], EZ)
    : who === 'person' ? (frame < F(fout[0]) ? 1 : 0) : interpolate(frame, [F(fout[0]) - PIPF, F(fout[0])], [1, 0], EZ);
  return Math.min(up, down);
};

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
  const {fps} = useVideoConfig();
  const groups = spec.groups as any[];
  const S = spec as any;
  const live = S.tier === 'max'; // max 档：持续微动效 + 招牌时刻
  const opening = S.opening;

  // 人物全屏透明度：相接的组已在 spec 里并成区块，区块内不会闪回全屏
  const cover = Math.max(
    0,
    ...(spec.blocks as any[]).map((b) => hide(frame, b.fin, b.fout, 'person')),   // 板那一侧：全屏人物在窗口前一半退完；录屏那一侧：和录屏直接交叉淡化
  );
  const fullOp = 1 - cover;

  // 标了 nosub 的大字标题（开头「100 倍的 AI」：字幕和大字 + 章说的是同一句）在场时，和它重叠的字幕整条不出
  const muted = ((S.titles ?? []) as any[]).filter((t) => t.nosub);
  const cue = spec.cues.find(
    (c: any) => frame >= F(c.start) && frame < F(c.end) && !muted.some((t) => c.start < t.end && c.end > t.start),
  );

  // 素材自带的录屏段：源片比 16:9 略窄，左右各留 13px 黑边 —— 放大 1.6% 铺满，顺带给字幕垫一层淡压条
  const inRec = ((S.hide_tags ?? []) as number[][]).some(([a0, b0]) => frame >= F(a0) && frame < F(b0));
  const recZoom = inRec ? 1.016 : 1;

  // 票据砸下 / 价签砸下的一瞬：人物层轻推近 + 抖一下（像被砸中）
  const hits: number[] = [
    ...((S.receipt_stacks ?? []) as any[]).flatMap((r) => slamTimes(r)),
    ...((S.partner_cols ?? []) as any[]).flatMap((c) => calloutTimes(c)),
  ];
  // 开头要丝滑：不瞬间放大 + 抖，改成 16 帧正弦起落的轻推近
  const hit = hits.reduce((m, t) => {
    const d = frame - F(t) - 1;
    return d >= 0 && d < 16 ? Math.max(m, Math.sin((Math.PI * d) / 16)) : m;
  }, 0);
  const hitScale = 1 + 0.02 * hit;
  const shakeX = 0;
  const shakeY = 0;

  // 开场重拳：画面从放大缓缓落到 1.0（照宣传片开场那一下）
  // spring 会过冲 ~2%：1 - spring 截到 ≥ 0，否则缩到 1 以下，四边露出一两像素黑边
  const openScale =
    S.punch && frame <= 55
      ? 1 + (S.punch - 1) * Math.max(0, 1 - spring({frame, fps, config: {damping: 15, stiffness: 120, mass: 0.8}}))
      : 1;

  // 说到关键句时人物层轻轻推一下（照开场那一下，幅度小一半）
  // 10-09：4 帧快速推入（不是一下跳过去）→ 弹簧回落；截到 ≥ 0 防过冲露黑边
  const punchK = ((S.punches ?? []) as number[]).reduce((m, t) => {
    const d = frame - F(t);
    if (d < 0 || d > 45) return m;
    const k = d < 4 ? Easing.out(Easing.cubic)(d / 4) : Math.max(0, 1 - spring({frame: d - 4, fps, config: {damping: 15, stiffness: 120, mass: 0.8}}));
    return Math.max(m, k);
  }, 0);
  const punchScale = 1 + 0.07 * punchK;

  // 开场 hero 卡的 ✕ / ✓ 章落下的那一帧：人物层 3 帧小震 1.0 → 1.02 → 1.0（像被章砸了一下）
  // 10-18 钩子重做：开头大字每一块砸到位的那一帧也震一下（title.jolt）
  const jolt = [...heroMarkFrames((S.hints ?? []) as any[]), ...titleJoltFrames((S.titles ?? []) as any[])].reduce((m, f0) => {
    const d = frame - f0;
    return d >= 0 && d <= 3 ? Math.max(m, Math.sin((Math.PI * d) / 3)) : m;
  }, 0);
  const joltScale = 1 + 0.02 * jolt;

  // 人物层推拉：zooms = [(到位时刻, 倍数)]，
  // 逐段弹簧过去；overshootClamping 必开 —— 从 1.08 拉回 1.0 时不能冲到 1.0 以下（四边会露黑）
  const zoomScale = ((S.zooms ?? []) as number[][]).reduce((z, [t, s], i, arr) => {
    if (frame < F(t)) return z;
    const prev = i ? arr[i - 1][1] : 1;
    const k = spring({frame: frame - F(t), fps, config: {damping: 20, stiffness: 160, mass: 0.8, overshootClamping: true}});
    return prev + (s - prev) * k;
  }, 1);

  // 大字每块最后一个字落地那一刻，整个画面（人物 + 大字）一起冲击 ——
  //   第 0 帧推到 65%、第 1 帧到顶（×s），然后阻尼足的弹簧 ≈0.3 秒回到 1.0（夹住不到 1 以下：四边不露底）；同时 5 帧幅度递减的小震（±8 px 起，推近时才震，边不露）。
  //   人物层和大字层各套同一个变换（原点都是画面中心），等于整屏一起动；字幕、圆窗不动
  const IMP_DX = [8, -6, 4, -2, 0], IMP_DY = [-5, 4, -2.5, 1, 0];
  //   第三项 shake = 0 的只做快速收放 —— 3 帧缓出推到 ×s、7 帧缓入缓出回 1.0，不震
  const imp = ((S.impacts ?? []) as number[][]).reduce((acc, [t, s, shake = 1]) => {
    const d = frame - F(t);
    if (d < 0 || d > 24) return acc;
    if (!shake) {
      const k = d < 3 ? Easing.out(Easing.cubic)(d / 3) : 1 - Easing.inOut(Easing.cubic)(Math.min(1, (d - 3) / 7));
      return {...acc, s: acc.s * (1 + (s - 1) * k)};
    }
    const k = d === 0 ? 0.65 : Math.max(0, 1 - spring({frame: d - 1, fps, config: {damping: 22, stiffness: 260, mass: 0.5, overshootClamping: true}}));
    return {s: acc.s * (1 + (s - 1) * k), x: acc.x + (IMP_DX[d] ?? 0), y: acc.y + (IMP_DY[d] ?? 0)};
  }, {s: 1, x: 0, y: 0});
  const impStyle: React.CSSProperties = imp.s !== 1 || imp.x || imp.y ? {transformOrigin: '50% 50%', transform: `translate(${imp.x}px, ${imp.y}px) scale(${imp.s})`} : {};

  // 人物身后一块大屏（spec.wall，CodexWall.tsx），人物抠像层（person_alpha.webm，帧号 = 合成帧号，前 matteN 帧）盖在大屏上面；
  //   房间 → 大屏 → 人三层同一个容器（推拉 / 冲击一起动）；stackPush 给了就在 pushAt–pushEnd 三层一起轻推，大屏退场那几帧快速放回 1.0
  const W_ = S.wall as any;
  const MATTE_N = W_?.matteN ?? 240;
  const wallOn = !!W_ && frame >= F(W_.start) - 1 && frame <= F(W_.outAt) + (W_.outF ?? 8) + 2 && frame < MATTE_N;
  const wallPush = W_?.stackPush ? 1 + W_.stackPush * (interpolate(frame, [F(W_.pushAt), F(W_.pushEnd)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)})
                                                   - interpolate(frame, [F(W_.outAt), F(W_.outAt) + (W_.outF ?? 8) + 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)})) : 1;

  const tree = (
    <AbsoluteFill style={{background: '#000'}}>
      {/* 人物全屏时底下的磨砂层完全被盖住，不渲染（省一路视频解码） */}
      {cover > 0.002 ? <Stage /> : null}
      {live ? <GoldDust cover={cover} /> : null}
      {fullOp > 0.002 ? (
        <AbsoluteFill style={impStyle}>
        <AbsoluteFill style={{opacity: fullOp, transformOrigin: '51% 40%', transform: `translate(${shakeX}px, ${shakeY}px) scale(${openScale * recZoom * hitScale * punchScale})`}}>
          {/* 10-18 钩子重做：推拉 / 小震单独一层，原点可以放到下巴高度（spec.zoom_origin）—— 推近时脸往上长、下巴不往下走，下巴下面那行大字才不被脸压 */}
          <AbsoluteFill style={{transformOrigin: S.zoom_origin ?? '51% 40%', transform: `scale(${joltScale * Math.max(1, zoomScale)})`}}>
            <AbsoluteFill style={{transformOrigin: W_?.pushOrigin ?? '30% 40%', transform: `scale(${wallPush})`}}>
              <OffthreadVideo
                src={staticFile('main_v.mp4')}
                muted
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
              <CodexWall w={S.wall ?? null} />
              {wallOn ? <OffthreadVideo src={staticFile('person_alpha.webm')} transparent muted style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} /> : null}
            </AbsoluteFill>
          </AbsoluteFill>
          {/* 淡出过程同步压暗：叠黑色而不是 CSS filter（filter 作用在视频层会触发 Chromium 瓦片合成缺陷） */}
          <AbsoluteFill style={{background: `rgba(0,0,0,${(1 - fullOp) * 0.75})`}} />
        </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      {/* 开场：从偏白的画面快速过渡到真画面 + 一道暖金光扫过 */}
      {frame < 30 ? (
        <AbsoluteFill style={{pointerEvents: 'none'}}>
          <AbsoluteFill style={{background: '#fff', opacity: interpolate(frame, [0, 2, 10], [0.55, 0.32, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}} />
          <AbsoluteFill style={{background: `linear-gradient(105deg, transparent ${interpolate(frame, [3, 28], [-25, 110], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) - 12}%, rgba(255,232,180,0.34) ${interpolate(frame, [3, 28], [-25, 110], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}%, transparent ${interpolate(frame, [3, 28], [-25, 110], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) + 12}%)`}} />
        </AbsoluteFill>
      ) : null}

      {/* 录屏段是白底网页，字幕全靠描边撑：底部垫一层很淡的渐变，字幕和金色下划线才有干净底 */}
      {inRec ? (
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 82%, rgba(0,0,0,0.46) 100%)'}} />
      ) : null}

      {/* 全屏真实录屏（带镜头推近 / 点击涟漪）：压在人物层上、叠加层下 */}
      <ScreenRecs shows={spec.shows as any[]} />

      <Audio src={staticFile('main.mp4')} />

      {groups.map((g) => {
        const from = F(g.fin[0]);
        const to = F(g.fout[1]);
        if (to <= from) return null;
        // 大脑 / 身体接管板：不进 Sequence，板里的气泡直接按母版秒算
        if (g.variant === 'brainbody') return frame >= from && frame < to ? <BrainBoard key={g.no} group={g} io={ramp(frame, g.fin, g.fout)} /> : null;
        return (
          <Sequence key={g.no} from={from} durationInFrames={to - from} layout="none">
            <GroupCanvas group={g} live={live} />
          </Sequence>
        );
      })}

      {(spec.pipRuns as any[]).map((r, i) => {
        const op = hide(frame, r.fin, r.fout, 'pip');   // 人物退完才出圆窗；出场时圆窗先收、人物再回
        return op > 0.002 ? <PersonCircle key={i} mode={r.mode as 'bl' | 'tl' | 'to'} op={op} /> : null;
      })}

      {/* max 招牌：开场剪辑器（gen_spec 已把章节标签推到它结束之后） */}
      {opening && frame < F(opening.end) + 10 ? <Opening o={opening} /> : null}

      <ChapterTags chapters={spec.chapters as any[]} hide={[...(S.hide_tags ?? []), ...((S.dividers ?? []) as any[]).map(cardWindow), ...(S.endcard ? [[S.endcard.start, S.duration + 1]] : [])]} />   {/* 10-18：结尾卡在屏时角标不出（卡上已有名字 / 关注我）*/}   {/* 过渡卡在屏上时章节标签不出，卡收掉再滑入 */}
      {S.brain ? <BrainBody s={S.brain} /> : null}
      <ChipStacks chips={spec.chips as any[]} live={live} />
      <Hints hints={(S.hints ?? []) as any[]} />
      <LogoRows rows={(S.logo_rows ?? []) as any[]} />
      <Chains chains={S.chains ?? []} live={live} />
      <RoadmapRails rails={S.rails ?? []} live={live} />
      <DuelBars duels={S.duels ?? []} live={live} />
      <ImageFans fans={S.fans ?? []} />
      <Pairs pairs={(spec as any).pairs ?? []} />
      <Marks marks={(spec as any).marks ?? []} />
      <Shows shows={spec.shows as any[]} live={live} />
      <LockCard s={S.hook ?? null} />
      <PromptSheets prompts={S.prompts ?? []} live={live} />
      <NumberPops pops={S.numpops ?? []} live={live} />
      <ReceiptStacks stacks={S.receipt_stacks ?? []} live={live} />
      <PartnerColumns cols={S.partner_cols ?? []} live={live} />
      {S.rate_counter ? <RateCounter spec={S.rate_counter} live={live} /> : null}
      {((S.skill_grids ?? []) as any[]).map((g, i) => <SkillGrid key={i} spec={g} live={live} />)}
      <AbsoluteFill style={impStyle}><IncomeCounter s={S.counter ?? null} /><LogoBurst s={S.burst ?? null} /><OpenStack s={S.open2 ?? null} /><ReceiptPile s={S.pile ?? null} /><BigTitles titles={S.titles ?? []} /></AbsoluteFill>
      {S.endcard ? <EndCard c={S.endcard} /> : null}

      {/* 章节过渡卡（10-10）：盖在所有图形上、字幕下 */}
      <ChapterCards cards={(S.dividers ?? []) as any[]} Bg={Stage} />

      {(spec as any).subtitles !== false && cue ? (
        <Subtitle text={cue.text} local={frame - F(cue.start)} />
      ) : null}
    </AbsoluteFill>
  );
  // 结尾：最后一条字幕结束后原片还在动（常见是伸手关录制），定格在最后一帧干净画面
  const cs = S.cues as any[];
  const hold = F(cs[cs.length - 1].end) - 2;   // 最后一条字幕末帧的前一帧：手还没伸向镜头
  return frame > hold ? <Freeze frame={hold}>{tree}</Freeze> : tree;
};

/** 单组画布：柔和进入 → 台词驱动生长 → 停留 → 柔和退出；整板全程缓慢漂浮 */
const GroupCanvas: React.FC<{group: any; live: boolean}> = ({group, live}) => {
  const frame = useCurrentFrame();
  const f0 = F(group.fin[0]);
  // 10-18：深色底先盖住人物，板上的横条 / 卡片再出；出场先收板、人物再回。紧接在录屏后面的板（同一个隐人区块里，人物早就退了）不用等，整段窗口直接渐显
  const opens = (spec.blocks as any[]).some((b) => b.fin[0] === group.fin[0]);
  const closes = (spec.blocks as any[]).some((b) => b.fout[1] === group.fout[1]);
  const abs = frame + f0;
  const io = seg(abs, group.fin, group.fout, (abs < F(group.fout[0]) ? opens : closes) ? SPLIT : 0, 1);   // 进场看 opens、出场看 closes
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
  if (group.variant === 'maprows') return <MapRows group={group} io={io} />; // 10-26：场景 → 选哪个工具（总结）
  if (group.variant === 'gap') return <GapBars group={group} io={io} live={live} />;
  if (group.variant === 'receipts') return <ReceiptRow group={group} io={io} live={live} />;
  if (group.variant === 'logos') return <LogoCards group={group} io={io} live={live} />;
  if (group.variant === 'clash') return <LogoCards group={group} io={io} live={live} clash />;
  if (group.variant === 'pyramid') return <Pyramid group={group} io={io} live={live} />;
  if (group.variant === 'loop') return <LoopCycle group={group} io={io} live={live} />;
  if (group.variant === 'solution') return <SolutionCompare group={group} io={io} live={live} />;
  if (group.variant === 'versus') return <ImageVersus group={group} io={io} live={live} />;
  // 从夯到拉排名图（t0In = 板上内容开始出的那一帧，五行从这一帧起依次滑出）
  // 10-18 钩子修正（审片：说「夯」那 0.3 秒是黑场）：板上没有脸，和全屏人物交叉淡化 —— 整个进出窗口里渐显 / 渐隐，五行从窗口第一帧起滑出；
  // 圆窗照旧等人物退完才出（pipRuns 的 seg(…, SPLIT, 1)），任何一帧都不会两张脸
  if (group.variant === 'tier') return <TierBoard group={group} io={seg(abs, group.fin, group.fout, 0, 1)} t0In={F(group.fin[0])} />;
  if (group.pip === 'to') {
    return <Takeover group={group} io={io} live={live} />;
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

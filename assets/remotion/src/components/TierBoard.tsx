import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {T} from '../theme';

/**
 * 从夯到拉排名图（脑图板 variant="tier"，人物缩左下圆窗）。
 * 图 = 排名表 html 改页宽 1500 + 透明底，无头 Chrome 逐张出 tier_00、tier_01…（每张比上一张多落一张卡）；
 * 字体、颜色、卡片都在图里，屏上不再叠标题行、灰档名、自绘卡片。extra.meta = {w, h, title: [上, 下], rows: [[上, 下]×5]}：标题块 / 五行的上下沿（图片像素）；每张新卡的包围盒由前后两张做差得到。
 * 版面：整张图等比缩到 x 470–1620、y 118–946（左下让出人物圆窗，右沿不进抖音按钮区，底边不进字幕带）。
 * - 进场：标题块 + 五行从上到下依次滑出（0.6 秒内）；
 * - 落卡（extra = {meta, img, prev, at, box, hon}）：先摆上一张，at 那一刻新卡那块从上方落下、落地轻弹一下，其余 4 帧交叉淡化（上一张卡的金边退成普通边）；
 *   hon（最高一档）落得更重：从镜头方向 1.4 倍砸下来、落得更快、压得更扁，落地那下整块板往下一顿、那一行闪一下；
 * - 汇总（extra = {meta, img, lit: [{box, at}], dim: [box]}）：说到哪张给哪张套金色描边框；第一框出来起，没点到的卡压暗。
 */
const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const GOLD = '#F6C453', ROW_BG = '#1d1e21';
const X = 470, Y = 118;                             // 图片像素 → 屏幕：x = X + K·ix，y = Y + K·iy（K = 1150 / meta.w）
// 普通卡：8 帧从上方 90px（图片像素）落进格子、1.12 倍缩到 1（落得太高会斜穿上面几档已经落定的卡）
// 夯：那一档就在标题下面，从高处落会扫过标题和小字 → 改成「从镜头方向砸下来」：1.4 倍、只往下落 40px、6 帧到位，压得更扁 + 整块板一顿 + 那一行闪一下
const DROP = {f: 8, h: 90, s0: 1.12, amp: 0.07, oy: '100%'};
const HON = {f: 6, h: 40, s0: 1.4, amp: 0.16, oy: '70%'};
const LIT = {out: 7, bw: 6};   // 汇总金框：卡片包围盒外扩 / 描边（图片像素），相邻两张卡（间距 20）的框之间留 6px

type Box = number[];
type Meta = {w: number; h: number; title: number[]; rows: number[][]};
const Pic: React.FC<{src: string; meta: Meta; op?: number; dy?: number}> = ({src, meta, op = 1, dy = 0}) => (
  <Img src={staticFile(src)} style={{position: 'absolute', left: 0, top: -dy, width: meta.w, height: meta.h, opacity: op}} />
);

export const TierBoard: React.FC<{group: any; io: number; t0In: number}> = ({group, io, t0In}) => {
  const f = useCurrentFrame();                   // 相对板的 Sequence 起点（fin[0]）
  const {fps} = useVideoConfig();
  const abs = f + F(group.fin[0]);               // 母版帧
  const x = group.extra ?? {};
  const meta: Meta = x.meta;
  const K = 1150 / meta.w;
  const STRIPS = [[meta.title[0] - 8, meta.title[1] + 8], ...meta.rows.map(([a, b]) => [a - 2, b + 2])];
  const img: string = x.img, prev: string | undefined = x.prev;
  const A = x.at != null ? F(x.at) : 1e9;        // 新卡开始落下的帧
  const P = x.hon ? HON : DROP;
  const d = abs - A, land = d - P.f;             // 落下了几帧 / 落地后几帧
  const k = prev ? interpolate(abs, [A, A + 4], [0, 1], CL) : 1;   // 其余部分 4 帧交叉淡化

  // 夯落地那下：整块板往下一顿（6 帧）
  const thud = x.hon && land >= 0 && land < 6 ? 9 * Math.sin((Math.PI * land) / 6) : 0;
  const lit: {box: Box; at: number}[] = x.lit ?? [];
  const firstLit = lit.length ? Math.min(...lit.map((l) => F(l.at))) : 1e9;
  const dimK = interpolate(abs, [firstLit, firstLit + 8], [0, 0.62], CL);

  return (
    <AbsoluteFill style={{opacity: io}}>
      <div style={{position: 'absolute', left: X, top: Y, width: meta.w, height: meta.h, transform: `translateY(${thud}px) scale(${K})`, transformOrigin: '0 0'}}>
        {/* 标题块 + 五行：从上到下依次滑出 */}
        {STRIPS.map(([y0, y1], i) => {
          const e = spring({frame: abs - t0In - i * 2, fps, config: {damping: 16, stiffness: 260, mass: 0.6}});
          return (
            <div key={i} style={{position: 'absolute', left: 0, top: y0, width: meta.w, height: y1 - y0, overflow: 'hidden',
                                 opacity: Math.min(1, e * 1.6), transform: `translateX(${(1 - e) * -60}px)`}}>
              {prev && k < 1 ? <Pic src={prev} meta={meta} op={1} dy={y0} /> : null}
              {k > 0 ? <Pic src={img} meta={meta} op={k} dy={y0} /> : null}
            </div>
          );
        })}

        {/* 新卡：落地之前，下面那张图上它的位置先用空行底色盖住；落下时从图上切下这一块 */}
        {prev && x.box && d >= 0 && land < 0 ? (
          // 四边各多盖 3px：整张图缩小时卡片描边会被插值糊到包围盒外面一两像素，盖不全会留一圈淡框
          <div style={{position: 'absolute', left: x.box[0] - 3, top: x.box[1] - 3, width: x.box[2] + 6, height: x.box[3] + 6, background: ROW_BG}} />
        ) : null}
        {prev && x.box && d >= 0 ? (() => {
          const [bx, by, bw, bh] = x.box as Box;
          const p = Math.min(1, d / P.f);
          const fall = (1 - p * p) * P.h;                                   // 越落越快
          const sc = 1 + (P.s0 - 1) * (1 - p);
          const sq = land >= 0 && land < 14 ? Math.exp(-land / 3) * Math.cos(land / 1.6) : 0;   // 落地一压一弹
          return (
            <div style={{position: 'absolute', left: bx, top: by - fall, width: bw, height: bh, overflow: 'hidden',
                         opacity: Math.min(1, (d + 1) / 3), transformOrigin: `50% ${P.oy}`,
                         transform: `scale(${sc * (1 + 0.6 * P.amp * sq)}, ${sc * (1 - P.amp * sq)})`}}>
              <Img src={staticFile(img)} style={{position: 'absolute', left: -bx, top: -by, width: meta.w, height: meta.h}} />
            </div>
          );
        })() : null}
        {/* 夯落地：那一行闪一下（扁平：一层半透明金，10 帧退掉） */}
        {x.hon && land >= 0 && land < 12 ? (() => {
          const [r0, r1] = meta.rows[0];
          return <div style={{position: 'absolute', left: 316, top: r0, width: meta.w - 316 - 96, height: r1 - r0, background: GOLD, opacity: 0.32 * (1 - land / 12), borderRadius: '0 14px 14px 0'}} />;
        })() : null}

        {/* 汇总：没点到的卡压暗，点到的套金框 */}
        {(x.dim ?? []).map((b: Box, i: number) => (dimK > 0 ? (
          <div key={'d' + i} style={{position: 'absolute', left: b[0] - 2, top: b[1] - 2, width: b[2] + 4, height: b[3] + 4, background: ROW_BG, opacity: dimK, borderRadius: 14}} />
        ) : null))}
        {lit.map((l, i) => {
          const ld = abs - F(l.at);
          if (ld < 0) return null;
          const e = spring({frame: ld, fps, config: {damping: 11, stiffness: 220, mass: 0.6}});
          const [bx, by, bw, bh] = l.box;
          return (
            // 10-18 钩子修正：外扩 12 → 7、描边 8 → 6（图片像素）—— 相邻两张卡只隔 20px，中间留 6px 才不并成一条边
            <div key={'l' + i} style={{position: 'absolute', left: bx - LIT.out, top: by - LIT.out, width: bw + 2 * LIT.out, height: bh + 2 * LIT.out, boxSizing: 'border-box',
                                       border: `${LIT.bw}px solid ${GOLD}`, borderRadius: 16, opacity: Math.min(1, e * 2),
                                       transform: `scale(${1.25 - 0.25 * e})`}} />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

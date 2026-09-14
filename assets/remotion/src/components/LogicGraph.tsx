import React from 'react';
import {useCurrentFrame, useVideoConfig, spring, interpolate, Easing} from 'remotion';
import {Card, CardKind, PersonCard} from './Cards';
import {T, GOLD, DARKRED} from '../theme';

export type GNode = {
  id: string;
  parent?: string;
  label: string;
  sub?: string;
  kind?: CardKind;
  danger?: boolean;
  at: number;
  /** 结论节点：不与兄弟并列，单独落在最底行居中 */
  conclusion?: boolean;
  person?: {name: string; handle: string; role: string};
  /** kind === 'shot' 时的图片源、宽度、宽高比 */
  src?: string;
  w?: number;
  ar?: number;
  /** 节点入场时刻（影片绝对秒，gen_spec 按台词锚定） */
  rf?: number;
};

const MAX_PER_ROW = 3;
const GAP = 96;
const VGAP = 110; // 行间净空；实际行距按该行最高卡片自适应

const sizeOf = (n: GNode): {w: number; h: number} => {
  if (n.person) return {w: 560, h: 128};
  const k = n.kind ?? 'node';
  if (k === 'shot') {
    const w = n.w ?? 440;
    return {w: w + 20, h: w / (n.ar ?? 16 / 9) + 20 + (n.label ? 27 : 0)};
  }
  if (k === 'circle') return {w: 132, h: 132};
  const fs = k === 'hero' ? 38 : k === 'pill' ? 27 : 29;
  const pad = k === 'hero' ? 92 : k === 'pill' ? 56 : 52;
  const w = [...n.label].reduce(
    (a, c) => a + (c.charCodeAt(0) > 0x2e80 ? fs + 1 : fs * 0.55),
    0,
  );
  const sw = n.sub
    ? [...n.sub].reduce(
        (a, c) => a + (c.charCodeAt(0) > 0x2e80 ? 19 : 19 * 0.55),
        0,
      ) + pad
    : 0;
  const h =
    (k === 'hero' ? 84 : k === 'pill' ? 50 : 58) + (n.sub ? (k === 'hero' ? 28 : 24) : 0);
  return {w: Math.max(w + pad, sw), h};
};

type P = {x: number; y: number};
type Pos = Record<string, P>;

function rawLayout(nodes: GNode[], step: number): Pos {
  const on = nodes.filter((n) => n.at <= step);
  const ids = new Set(on.map((n) => n.id));
  // 结论节点不参与兄弟排布
  const kids = (id: string) =>
    on.filter((n) => n.parent === id && !n.conclusion);
  const px: Record<string, number> = {};
  const pr: Record<string, number> = {};
  let cursor = 0;
  const place = (n: GNode, row: number) => {
    const ch = kids(n.id);
    if (!ch.length) {
      const {w} = sizeOf(n);
      px[n.id] = cursor + w / 2;
      pr[n.id] = row;
      cursor += w + GAP;
      return;
    }
    const rows = Math.ceil(ch.length / MAX_PER_ROW);
    const per = Math.ceil(ch.length / rows);
    for (let i = 0; i < ch.length; i += per)
      ch.slice(i, i + per).forEach((c) => place(c, row + 1 + Math.floor(i / per)));
    const xs = ch.map((c) => px[c.id]);
    px[n.id] = (Math.min(...xs) + Math.max(...xs)) / 2;
    pr[n.id] = row;
  };
  on.filter((n) => (!n.parent || !ids.has(n.parent)) && !n.conclusion)
    .forEach((r) => place(r, 0));

  // 结论节点：逐个叠在整图最底行下方，水平居中
  let maxRow = Math.max(0, ...Object.values(pr));
  const concl = on.filter((n) => n.conclusion);
  if (concl.length) {
    const xs = Object.values(px);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    concl.forEach((n) => {
      maxRow += 1;
      px[n.id] = cx;
      pr[n.id] = maxRow;
    });
  }

  // 行距自适应：图片卡比文字卡高三四倍，固定行距会让上下两行叠在一起
  const rowH: Record<number, number> = {};
  on.forEach((n) => {
    const r = pr[n.id];
    if (r === undefined) return;
    rowH[r] = Math.max(rowH[r] ?? 0, sizeOf(n).h);
  });
  const rowY: Record<number, number> = {0: 0};
  for (let r = 1; r <= maxRow; r++)
    rowY[r] = rowY[r - 1] + ((rowH[r - 1] ?? 58) + (rowH[r] ?? 58)) / 2 + VGAP;

  const pos: Pos = {};
  Object.keys(px).forEach((id) => {
    pos[id] = {x: px[id], y: rowY[pr[id]] ?? 0};
  });
  return pos;
}

export type Box = {x0: number; x1: number; y0: number; y1: number};

function fit(nodes: GNode[], pos: Pos, box: Box): {pos: Pos; k: number} {
  const on = nodes.filter((n) => pos[n.id]);
  if (!on.length) return {pos, k: 1};
  const b = on.map((n) => ({p: pos[n.id], s: sizeOf(n)}));
  const x0 = Math.min(...b.map((v) => v.p.x - v.s.w / 2));
  const x1 = Math.max(...b.map((v) => v.p.x + v.s.w / 2));
  const y0 = Math.min(...b.map((v) => v.p.y - v.s.h / 2));
  const y1 = Math.max(...b.map((v) => v.p.y + v.s.h / 2));
  // 允许适度放大：节点少的板子若钳死在 1.0，在 1080p 上会显得很空
  const k = Math.min(1.18, (box.x1 - box.x0) / (x1 - x0), (box.y1 - box.y0) / (y1 - y0));
  const cxS = (x0 + x1) / 2;
  const cyS = (y0 + y1) / 2;
  const cxD = (box.x0 + box.x1) / 2;
  const cyD = (box.y0 + box.y1) / 2;
  const out: Pos = {};
  Object.keys(pos).forEach((id) => {
    out[id] = {x: cxD + (pos[id].x - cxS) * k, y: cyD + (pos[id].y - cyS) * k};
  });
  return {pos: out, k};
}

export const LogicGraph: React.FC<{
  nodes: GNode[];
  box: Box;
  /** 每个节点的入场帧（相对所在 Sequence 起点，与 nodes 一一对应） */
  reveals: number[];
}> = ({nodes, box, reveals}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const LEAD = 12; // 连线先画 0.4s，卡片随后弹入

  // 当前揭示到第几个节点
  let idx = -1;
  reveals.forEach((r, i) => {
    if (frame >= r) idx = i;
  });
  if (idx < 0) return null;
  const step = nodes[idx].at;

  // 布局滑移：新节点加入时整树用柔和弹簧平滑移动，不跳位
  const glide = spring({
    frame: frame - reveals[idx],
    fps,
    config: {damping: 26, stiffness: 46, mass: 1.1},
  });
  const A = fit(nodes, rawLayout(nodes, Math.max(0, step - 1)), box);
  const B = fit(nodes, rawLayout(nodes, step), box);
  const k = A.k + (B.k - A.k) * glide;
  const at = (id: string): P | null => {
    const a = A.pos[id];
    const b = B.pos[id];
    if (a && b) return {x: a.x + (b.x - a.x) * glide, y: a.y + (b.y - a.y) * glide};
    return b ?? a ?? null;
  };
  const vis = nodes.filter((_, i) => frame >= reveals[i]);
  const revOf = (id: string) => reveals[nodes.findIndex((n) => n.id === id)];

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <svg style={{position: 'absolute', inset: 0}} width={T.W} height={T.H}>
        <defs>
          {/* userSpaceOnUse：垂直连线的包围盒宽度为 0，objectBoundingBox 会让整条 path 不渲染 */}
          <linearGradient
            id="goldline"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={box.y0}
            x2="0"
            y2={box.y1}
          >
            <stop offset="0%" stopColor="#e6cf92" />
            <stop offset="100%" stopColor="#a8842f" />
          </linearGradient>
        </defs>
        {vis.map((n) => {
          if (!n.parent) return null;
          const c = at(n.id);
          if (!c) return null;
          let px: number;
          let y1: number;
          if (n.conclusion) {
            // 结论卡从紧邻上一行整体汇聚下来，不跨层直连穿卡
            const above = vis
              .map((m) => ({m, p: at(m.id)}))
              .filter((v) => v.p && v.p.y < c.y - 1) as {m: GNode; p: P}[];
            if (!above.length) return null;
            const rowY = Math.max(...above.map((v) => v.p.y));
            const row = above.filter((v) => v.p.y > rowY - 4);
            px =
              (Math.min(...row.map((v) => v.p.x)) +
                Math.max(...row.map((v) => v.p.x))) /
              2;
            y1 = rowY + (Math.max(...row.map((v) => sizeOf(v.m).h)) / 2) * k;
          } else {
            const p = at(n.parent);
            if (!p) return null;
            const pn = nodes.find((x) => x.id === n.parent)!;
            px = p.x;
            y1 = p.y + (sizeOf(pn).h / 2) * k;
          }
          const y2 = c.y - (sizeOf(n).h / 2) * k;
          const dy = Math.max(24, (y2 - y1) * 0.58);
          const d = `M ${px} ${y1} C ${px} ${y1 + dy}, ${c.x} ${y2 - dy}, ${c.x} ${y2}`;
          // 连线先行：从入场时刻起 0.53s 内沿路径描出
          const draw = interpolate(frame - revOf(n.id), [0, 16], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.inOut(Easing.cubic),
          });
          return (
            <path
              key={n.id}
              d={d}
              fill="none"
              stroke={n.danger ? DARKRED : 'url(#goldline)'}
              strokeWidth={2.2 * k}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - draw}
              opacity={0.92}
            />
          );
        })}
      </svg>

      {vis.map((n) => {
        const p = at(n.id);
        if (!p) return null;
        // 连线画到位后卡片再弹入：轻微过冲 + 上浮 + 淡入
        const local = frame - revOf(n.id) - (n.parent ? LEAD : 0);
        const e = spring({
          frame: local,
          fps,
          config: {damping: 12, stiffness: 150, mass: 0.9},
        });
        const ap = interpolate(local, [0, 7], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const rise = n.parent ? (1 - e) * 22 : 0;
        const sc = 0.85 + 0.15 * e;
        // 落位瞬间白闪一下再回到本色（贴纸感）
        const flash = n.parent ? interpolate(local, [0, 3, 10], [0.95, 0.8, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }) : 0;
        return (
          <div
            key={n.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              translate: '-50% -50%',
              opacity: ap,
              transform: `translateY(${rise}px) scale(${k * sc})`,
            }}
          >
            {n.person ? (
              <PersonCard {...n.person} />
            ) : (
              <Card
                kind={n.kind ?? 'node'}
                label={n.label}
                sub={n.sub}
                danger={n.danger}
                src={n.src}
                shotW={n.w}
                flash={flash}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring} from 'remotion';
import {T, FONT} from '../theme';
import {Bubble, BUB} from './Bubble';

/**
 * 并列观点列（左侧一列，人物保持全屏）：只放真正并列的观点 / 并列的几样东西，讲到哪条弹哪条、留在画面上。
 * 不是并列关系的别并到一块，只是信息的用动效提示。
 * 每条是浅色气泡（Bubble.tsx）：默认 cream，一组最多一个 gold；不再有组标题条（组标题交给左上章节标签）。
 *   整组都没有 logo 时出序号 01 02；badge = 顶行一个 gold 气泡 + 绿勾（「全免费」）；slots = 先摆虚线空位，说到哪样填哪样；
 *   then = 说到那里时同一个气泡追加「· 字」（tone gold 就整条在那一刻变金）；markAt = 这一条的勾等到那一刻再打。
 */
export type TileItem = {t: string; rf: number; style?: string; imgs?: string[]; mark?: string; markAt?: number;
                        then?: {t: string; at: number; tone?: string}};
export type TileGroup = {start: number; end: number; top?: number; title?: string; titleAt?: number; markAt?: number; items: TileItem[];
                         slots?: boolean;
                         size?: 'sm' | 'md' | 'hero';   // 10-22：整组的气泡档位（hero：logo 40 → 66px）
                         badge?: {t: string; at: number} | null};

const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const SLOT_H = 64;   // 和 md 气泡同高

export const IconTiles: React.FC<{grp: TileGroup; live?: boolean}> = ({grp}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const out = interpolate(f, [F(grp.end), F(grp.end) + 6], [1, 0], CL);
  const t0 = F(grp.titleAt ?? grp.items[0].rf);
  const P = BUB.SIZE[grp.size ?? 'md'].pitch;   // 行距跟着档位走
  const off = grp.badge ? P : 0;
  const numbered = false;   // 2026-10 硬规矩：并列列只留色条 + 短词，不要 01/02 编号（原来整组没 logo 时自动出序号）
  return (
    <div style={{position: 'absolute', left: BUB.LEFT, top: grp.top ?? BUB.TOP, opacity: out, fontFamily: FONT}}>
      {grp.badge ? (
        <div style={{position: 'absolute', left: 0, top: 0}}>
          <Bubble t={grp.badge.t} tone="gold" mark="check" at={grp.badge.at} />
        </div>
      ) : null}
      {/* 虚线空位：一开场就按数量摆好，对应的条目弹出时收掉 */}
      {grp.slots ? grp.items.map((it, i) => {
        const d = f - t0 - 4 - i * 3;
        if (d < 0 || f >= F(it.rf) + 4) return null;
        const e = spring({frame: d, fps, config: {damping: 13, stiffness: 200, mass: 0.75}});
        return (
          <div key={'s' + i} style={{position: 'absolute', left: 0, top: off + i * P, width: 300, height: SLOT_H, borderRadius: 999, boxSizing: 'border-box',
                                     border: `3px dashed ${BUB.COLOR.EDGE}`, background: 'rgba(245,240,230,0.55)', display: 'flex', alignItems: 'center', paddingLeft: 26,
                                     color: BUB.COLOR.EDGE, fontSize: 30, fontWeight: 900, fontFamily: `"Arial Rounded MT Bold", ${FONT}`,
                                     opacity: Math.min(1, e * 2) * interpolate(f, [F(it.rf), F(it.rf) + 4], [1, 0], CL), transform: `translateX(${(1 - e) * -40}px)`}}>
            {String(i + 1).padStart(2, '0')}
          </div>
        );
      }) : null}
      {grp.items.map((it, i) => {
        if (f < F(it.rf)) return null;
        const th = it.then && f >= F(it.then.at) ? it.then : null;
        const mk = it.mark === 'check' || it.mark === 'cross' ? it.mark : undefined;
        const mkAt = it.markAt ?? (grp.markAt != null ? Math.max(it.rf + 8 / 30, grp.markAt + (i * 4) / 30) : undefined);
        return (
          <div key={i} style={{position: 'absolute', left: 0, top: off + i * P}}>
            <Bubble t={th ? `${it.t} · ${th.t}` : it.t} tone={it.style} img={(it.imgs ?? [])[0]} idx={numbered ? i + 1 : undefined} size={grp.size}
                    mark={mk} markAt={mkAt} at={it.rf}
                    goldAt={it.then?.tone === 'gold' ? it.then.at : undefined} />
          </div>
        );
      })}
    </div>
  );
};

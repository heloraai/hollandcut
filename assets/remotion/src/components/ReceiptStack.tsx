import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
import {T, GOLD, GOLD_LITE, FONT} from '../theme';

/**
 * 开场票据砸入（叠加层，人物保持全屏）：每张真账单放大砸在人物右侧（lr = 两张一左一右对比） → 冲击波 + 盖章 →
 * 停一下缩进右上角战绩栏（金额一直留在屏上）；三张收完，正中砸金章。
 * 画面震一下由 Video.tsx 读同一份时间点做（人物层 punch + shake）。
 */
export type StackItem = {src: string; ar: number; amt: string; tag: string; at: number; seal?: string; sealAt?: number};
export type StackSpec = {start: number; end: number; items: StackItem[]; stamp?: {t: string; at: number} | null; cy?: number; lr?: boolean};

const F = (s: number) => Math.round(s * T.FPS);
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const CX = 1570, CY0 = 430;         // 大卡中心：人物右侧，不压脸（cy 可由 structure 传入）
const W = 600;                       // 大卡宽：账单里的金额、商户、授权都看得清
const HOLD = 30;                     // 落地后停多久再缩进战绩栏（帧）
const TALLY_Y = 92;
const TALLY_X = [1370, 1560, 1750];
const ROT = [-4, 3, -2];
// lr：两张卡一左一右对比（不缩进战绩栏，一直留在原位）；右卡收在 x≤1680、y≤450，避开抖音横屏右侧按钮列
const LR_X = [480, 1440], LR_W = 460, LR_CY = 280;
const isGold = (t?: string) => !!t && (t === '到账' || t.startsWith('金:'));
const sealText = (t?: string) => (t ?? '已报销').replace(/^金:/, '');

// 画面震动只跟票据砸下走；收尾那枚章正常出现，不震
export const slamTimes = (s: StackSpec): number[] => s.items.slice(0, 3).map((it) => it.at);
const stampTime = (s: StackSpec): number => {
  const its = s.items.slice(0, 3);
  return s.stamp && its.length ? Math.max(s.stamp.at, its[its.length - 1].at + (HOLD + 12) / T.FPS) : 1e9;
};

const Ring: React.FC<{f: number; at: number; x: number; y: number; color: string; sz?: number}> = ({f, at, x, y, color, sz = 520}) => {
  const d = f - at;
  if (d < 0 || d > 22) return null;
  const k = d / 22;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: sz, height: sz, translate: '-50% -50%',
                 borderRadius: '50%', border: `${10 * (1 - k) + 2}px solid ${color}`,
                 opacity: 0.4 * (1 - k), transform: `scale(${0.6 + 0.9 * Easing.out(Easing.cubic)(k)})`}} />
  );
};

const Stack: React.FC<{s: StackSpec; live: boolean}> = ({s, live}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const b = F(s.end);
  const out = interpolate(f, [b, b + 10], [1, 0], {...CL, easing: Easing.inOut(Easing.ease)});
  const items = s.items.slice(0, 3);
  const finalAt = F(stampTime(s));
  const lr = !!s.lr;
  const CY = lr ? LR_CY : s.cy ?? CY0;
  const CW = lr ? LR_W : W;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: out, fontFamily: FONT}}>
      {items.map((it, i) => {
        const at = F(it.at);
        if (f < at) return null;
        const d = f - at;
        const e = spring({frame: d, fps, config: {damping: 17, stiffness: 150, mass: 0.9}});
        // 砸下：从右上方 1.45 倍、带旋转扑下来
        const land = Math.min(1, e);
        const toTally = lr ? 0 : interpolate(d, [HOLD, HOLD + 18], [0, 1], {...CL, easing: Easing.inOut(Easing.cubic)});
        const cx = lr ? LR_X[i] ?? CX : CX;
        const neg = it.amt.trim().startsWith('-') || it.amt.trim().startsWith('−');
        const val = parseFloat(it.amt.replace(/[^\d.]/g, '')) || 0;
        const cnt = interpolate(d, [2, 20], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
        const h = Math.round(CW / (it.ar || 1.5));
        const x = cx + (TALLY_X[i] - cx) * toTally;
        const y = CY + (TALLY_Y - CY) * toTally;
        const sc = (1.18 - 0.18 * land) * (1 - 0.72 * toTally);
        const rot = (1 - land) * (lr && i === 0 ? -8 : 8) + ROT[i] * land * (1 - toTally);
        const flash = interpolate(d, [0, 3, 12], [0.35, 0.2, 0], CL);
        const sealF = it.sealAt != null ? F(it.sealAt) - at : 8;   // 章默认落地 +8 帧，也可钉到说到那个词的时刻
        const sealE = d >= sealF ? spring({frame: d - sealF, fps, config: {damping: 14, stiffness: 180, mass: 0.7}}) : 0;
        const big = toTally < 0.02;
        return (
          <React.Fragment key={i}>
            {big ? <Ring f={f} at={at + 2} x={cx} y={CY} color={GOLD_LITE} sz={lr ? 300 : 520} /> : null}   {/* lr：光环小一圈，不扫进右下按钮区 */}
            <div style={{position: 'absolute', left: x, top: y, translate: '-50% -50%', zIndex: 10 + i,
                         opacity: Math.min(1, e * 2), transform: `rotate(${rot}deg) scale(${sc})`}}>
              <div style={{position: 'relative', width: CW, height: h, borderRadius: 16, overflow: 'hidden', background: '#fff',
                           border: `3px solid ${GOLD}`,
                           boxShadow: 'none'}}>
                <Img src={staticFile(it.src)} style={{width: CW, height: h, objectFit: 'cover', objectPosition: 'top', display: 'block'}} />
                <span style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash}} />
                {sealE > 0 ? (
                  <div style={{position: 'absolute', right: lr ? 18 : 34, bottom: lr ? 8 : 22, whiteSpace: 'nowrap',
                               color: lr ? (isGold(it.seal) ? '#15161B' : '#fff') : isGold(it.seal) ? '#9a7324' : '#d4342a',
                               border: lr ? 'none' : `6px solid ${isGold(it.seal) ? '#c9a24a' : '#d4342a'}`, borderRadius: 14,
                               background: lr ? (isGold(it.seal) ? '#F6C453' : '#FF6B4A') : isGold(it.seal) ? 'rgba(255,248,226,0.85)' : 'rgba(255,240,238,0.82)',   /* lr：扁平纯色章 */
                               fontSize: lr ? 42 : 56, fontWeight: 900, letterSpacing: lr ? 4 : 6, padding: lr ? '2px 16px' : '4px 22px',
                               transform: `rotate(-12deg) scale(${1.5 - 0.5 * Math.min(1, sealE)})`,
                               opacity: Math.min(1, sealE * 2)}}>
                    {sealText(it.seal)}
                  </div>
                ) : null}
              </div>
              {/* 大金额：深色底板上的金字（墙是浅色的，不垫底看不清）；跟着卡缩进战绩栏，金额一直留在屏上；amt 空 = 不画牌 */}
              {it.amt ? <div style={{position: 'absolute', left: '50%', top: h + 14, translate: '-50% 0',
                           transform: `scale(${1 + 0.7 * toTally})`, transformOrigin: 'top center',
                           display: 'flex', alignItems: 'baseline', gap: 16, whiteSpace: 'nowrap',
                           background: 'rgba(12,13,17,0.88)', border: `2.4px solid ${GOLD}`, borderRadius: 16,
                           padding: '6px 26px 8px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)'}}>
                <span style={{fontSize: 74, fontWeight: 900, letterSpacing: 1, color: neg ? '#efe8d7' : GOLD_LITE}}>
                  {neg ? '−' : '+'}{(val * cnt).toFixed(2)}
                </span>
                {toTally < 0.5 ? (
                  <span style={{fontSize: 27, fontWeight: 800, letterSpacing: 2, color: '#efe8d7', opacity: 1 - 2 * toTally}}>{it.tag}</span>
                ) : null}
              </div> : null}
            </div>
          </React.Fragment>
        );
      })}

      {s.stamp && f >= finalAt ? (() => {
        const e = interpolate(f - finalAt, [0, 12], [0, 1], {...CL, easing: Easing.out(Easing.cubic)});
        const glow = live ? 14 + 8 * Math.abs(Math.sin((f - finalAt) / 9)) : 14;
        return (
          <div style={{position: 'absolute', left: lr ? 960 : CX, top: lr ? 800 : CY + 40, translate: '-50% -50%', whiteSpace: 'nowrap', zIndex: 20,   /* lr：章居中、压在下巴以下（人物近景时 y≈530 会盖住鼻子）*/
                       background: lr ? '#F6C453' : 'linear-gradient(135deg, #f0dca0, #c9a24a)', color: lr ? '#15161B' : '#17130a',
                       fontSize: lr ? 60 : 70, fontWeight: 900, letterSpacing: 4, padding: '16px 46px', borderRadius: 20,
                       border: lr ? 'none' : '6px solid #fdfbf4', boxShadow: lr ? 'none' : `10px 12px 0 rgba(20,15,5,0.4), 0 0 ${glow}px rgba(240,200,96,0.7)`,
                       transform: `translateY(${(1 - e) * 24}px) scale(${0.94 + 0.06 * e})`, opacity: e}}>
            {s.stamp.t}
          </div>
        );
      })() : null}
    </div>
  );
};

export const ReceiptStacks: React.FC<{stacks: StackSpec[]; live?: boolean}> = ({stacks, live = false}) => {
  const f = useCurrentFrame();
  const cur = stacks.find((s) => f >= F(s.start) - 30 && f < F(s.end) + 10);
  return cur ? <Stack s={cur} live={live} /> : null;
};

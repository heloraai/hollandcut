import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {T, GOLD, GOLD_LITE, DARKRED, FONT} from '../theme';

export type CardKind =
  | 'hero' // 顶部主卡 / 结论卡：完整花纹
  | 'node' // 普通子节点：简化金边长方形
  | 'pill' // 胶囊标签
  | 'circle' // 圆形节点
  | 'shot' // 真实截图：金框 + 图注
  | 'person'; // 人物主卡（横向）

/** 四角金色卷草花纹 —— 完整装饰只给主卡和结论卡 */
const Flourish: React.FC<{corner: 0 | 1 | 2 | 3; size?: number}> = ({
  corner,
  size = 30,
}) => {
  const rot = [0, 90, 180, 270][corner];
  const pos: React.CSSProperties =
    corner === 0
      ? {top: 7, left: 7}
      : corner === 1
      ? {top: 7, right: 7}
      : corner === 2
      ? {bottom: 7, right: 7}
      : {bottom: 7, left: 7};
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      style={{position: 'absolute', ...pos, transform: `rotate(${rot}deg)`}}
    >
      <g fill="none" stroke={GOLD} strokeWidth={1.4} strokeLinecap="round">
        <path d="M1 11 Q1 1 11 1" />
        <path d="M5 13 Q5 5 13 5" opacity={0.62} />
        <path d="M11 1 q6 0 7 4 q-4 1 -4 -1" opacity={0.85} />
        <path d="M1 11 q0 6 4 7 q1 -4 -1 -4" opacity={0.85} />
        <circle cx="15.5" cy="1.6" r="1.05" fill={GOLD} stroke="none" opacity={0.75} />
        <circle cx="1.6" cy="15.5" r="1.05" fill={GOLD} stroke="none" opacity={0.75} />
      </g>
    </svg>
  );
};

const glow = (strength = 1) =>
  `0 16px 46px rgba(0,0,0,0.55), 0 0 ${26 * strength}px rgba(201,162,74,${0.2 * strength})`;

/** 金色光效呼吸：周期 3.6s，柔和不抢戏；同时避免长时间静止画面 */
const useBreath = (amp = 0.3, period = 108, phase = 0) => {
  const f = useCurrentFrame();
  return 1 + amp * Math.sin(((f + phase) / period) * Math.PI * 2);
};

export const Card: React.FC<{
  kind: CardKind;
  label: string;
  sub?: string;
  danger?: boolean;
  /** 关键词轻微放大用 */
  emphasize?: number;
  /** shot 专用 */
  src?: string;
  shotW?: number;
  /** 入场白闪强度 0..1 */
  flash?: number;
}> = ({kind, label, sub, danger, emphasize = 0, src, shotW, flash = 0}) => {
  const edge = danger ? DARKRED : GOLD;
  const br = useBreath();
  const Flash = () => (
    <span style={{position: 'absolute', inset: -2, borderRadius: 'inherit', background: '#fff', opacity: flash, pointerEvents: 'none', zIndex: 5}} />
  );

  if (kind === 'shot' && src) {
    const w = shotW ?? 440;
    return (
      <div
        style={{
          position: 'relative',
          background: T.card,
          border: `2.4px solid ${GOLD}`,
          borderRadius: 22,
          padding: 10,
          boxShadow: glow(1.1 * br),
          fontFamily: FONT,
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 5,
            border: '1px solid rgba(201,162,74,0.38)',
            borderRadius: 16,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
        <Img
          src={staticFile(src)}
          style={{width: w, height: 'auto', display: 'block', borderRadius: 12}}
        />
        {label ? (
          <div
            style={{
              fontSize: 17,
              fontWeight: 400,
              color: T.sub,
              marginTop: 8,
              textAlign: 'center',
              letterSpacing: 0.4,
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    );
  }

  if (kind === 'circle') {
    return (
      <div
        style={{
          width: 132,
          height: 132,
          borderRadius: '50%',
          background: T.card,
          border: `2px solid ${edge}`,
          boxShadow: `${glow(0.8 * br)}, inset 0 0 0 5px rgba(201,162,74,0.16)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: 25,
          fontWeight: 700,
          color: danger ? DARKRED : T.ink,
          lineHeight: 1.24,
          padding: 12,
          position: 'relative',
        }}
      >
        <Flash />
        {label}
      </div>
    );
  }

  if (kind === 'pill') {
    return (
      <div
        style={{
          background: T.cardIvory,
          border: `1.6px solid ${edge}`,
          borderRadius: 999,
          padding: '11px 28px',
          fontFamily: FONT,
          fontSize: 27,
          fontWeight: 700,
          color: danger ? DARKRED : T.ink,
          boxShadow: `3px 4px 0 rgba(0,0,0,0.55), 0 0 ${18 * br}px rgba(201,162,74,${0.14 * br})`,
          whiteSpace: 'nowrap',
          position: 'relative',
        }}
      >
        <Flash />
        {label}
      </div>
    );
  }

  const hero = kind === 'hero';
  return (
    <div
      style={{
        position: 'relative',
        background: hero ? T.card : T.cardIvory,
        border: `${hero ? 2.4 : 1.6}px solid ${edge}`,
        borderRadius: hero ? 26 : 20,
        padding: hero ? '22px 46px' : '14px 26px',
        fontFamily: FONT,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        boxShadow: hero
          ? glow(1.15 * br)
          : `3px 4px 0 rgba(0,0,0,0.55), 0 0 ${18 * br}px rgba(201,162,74,${0.14 * br})`,
        transform: `scale(${1 + emphasize * 0.045})`,
      }}
    >
      <Flash />
      {hero ? (
        <>
          {/* 内描金线 */}
          <span
            style={{
              position: 'absolute',
              inset: 6,
              border: `1px solid rgba(201,162,74,0.42)`,
              borderRadius: 20,
              pointerEvents: 'none',
            }}
          />
          {[0, 1, 2, 3].map((c) => (
            <Flourish key={c} corner={c as 0 | 1 | 2 | 3} />
          ))}
        </>
      ) : null}
      <div
        style={{
          fontSize: hero ? 38 : 29,
          fontWeight: 700,
          color: danger ? DARKRED : T.ink,
          letterSpacing: 1,
          lineHeight: 1.24,
          position: 'relative',
        }}
      >
        {label}
      </div>
      {sub ? (
        <div
          style={{
            fontSize: hero ? 20 : 17,
            fontWeight: 400,
            color: danger ? 'rgba(143,43,33,0.7)' : T.sub,
            marginTop: 7,
            letterSpacing: 0.6,
            position: 'relative',
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** 横向人物主卡：头像 + 账号名 + 身份 */
export const PersonCard: React.FC<{
  name: string;
  handle: string;
  role: string;
}> = ({name, handle, role}) => {
  const br = useBreath();
  return (
  <div
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      background: T.card,
      border: `2.4px solid ${GOLD}`,
      borderRadius: 12,
      padding: '18px 40px 18px 22px',
      boxShadow: glow(1.25 * br),
      fontFamily: FONT,
    }}
  >
    <span
      style={{
        position: 'absolute',
        inset: 6,
        border: `1px solid rgba(201,162,74,0.42)`,
        borderRadius: 8,
        pointerEvents: 'none',
      }}
    />
    {[0, 1, 2, 3].map((c) => (
      <Flourish key={c} corner={c as 0 | 1 | 2 | 3} size={26} />
    ))}
    <div
      style={{
        width: 92,
        height: 92,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `2px solid ${GOLD}`,
        boxShadow: `0 0 20px rgba(201,162,74,0.3)`,
        flex: 'none',
        position: 'relative',
      }}
    >
      <Img
        src={staticFile('avatar.png')}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
    </div>
    <div style={{textAlign: 'left', position: 'relative'}}>
      <div style={{fontSize: 40, fontWeight: 700, color: T.ink, letterSpacing: 1}}>
        {name}
        <span
          style={{
            fontSize: 22,
            background: 'rgba(201,162,74,0.14)',
            border: `1px solid rgba(201,162,74,0.4)`,
            borderRadius: 5,
            padding: '4px 12px',
            marginLeft: 16,
            verticalAlign: 'middle',
            color: T.goldDeep,
          }}
        >
          {role}
        </span>
      </div>
      <div style={{fontSize: 20, color: T.sub, marginTop: 6}}>{handle}</div>
    </div>
  </div>
  );
};

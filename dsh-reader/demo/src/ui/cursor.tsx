import React from 'react';
import { C } from './theme';
import type { CursorState } from './motion';

/** macOS-style pointer, drawn in artboard coordinates. */
export const Cursor: React.FC<{ state: CursorState; zIndex?: number; opacity?: number }> = ({
  state,
  zIndex = 80,
  opacity = 1,
}) => {
  if (!state.visible) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: state.x,
        top: state.y,
        width: 0,
        height: 0,
        zIndex,
        pointerEvents: 'none',
        opacity,
      }}
    >
      {state.ripples.map((r) => (
        <div
          key={r.key}
          style={{
            position: 'absolute',
            left: -15,
            top: -15,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: `1.5px solid rgba(31,111,235,${0.55 * (1 - r.p)})`,
            transform: `scale(${0.4 + r.p * 1.15})`,
          }}
        />
      ))}
      <div
        style={{
          transform: `translate(-1.5px,-1.5px) scale(${state.pressed ? 0.86 : 1})`,
          transformOrigin: '2px 2px',
          filter: 'drop-shadow(0 2px 3px rgba(15,18,23,0.28))',
        }}
      >
        <svg width="17" height="23" viewBox="0 0 17 23" style={{ display: 'block' }}>
          <path
            d="M1.6 1.2 1.6 18.2 6 14.2 8.8 21.2 12 19.8 9.3 12.8 15.4 12.4Z"
            fill="#ffffff"
            stroke="#1f2329"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

/** Selection grow effect helper: blue wash that expands as the drag proceeds. */
export const SelectionWash: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  p: number;
  radius?: number;
}> = ({ x, y, w, h, p, radius = 2 }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w * p,
      height: h,
      background: 'rgba(31,111,235,0.25)',
      borderRadius: radius,
      zIndex: 60,
    }}
  />
);

/** Small white pill with pulsing dots, e.g. “正在解释…”. */
export const BusyPill: React.FC<{
  x: number;
  y: number;
  enter: number;
  label: string;
  frame: number;
  zIndex?: number;
}> = ({ x, y, enter, label, frame, zIndex = 65 }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      zIndex,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: '0 9px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.96)',
      border: `1px solid ${C.border}`,
      boxShadow: '0 6px 18px rgba(31,35,41,0.14)',
      opacity: enter,
      transform: `translateY(${(1 - enter) * 5}px) scale(${0.96 + enter * 0.04})`,
      transformOrigin: 'left center',
    }}
  >
    <span style={{ display: 'flex', gap: 2.5 }}>
      {[0, 1, 2].map((i) => {
        const t = ((frame - i * 3) % 18 + 18) % 18;
        const op = 0.25 + 0.75 * Math.max(0, 1 - Math.abs(t - 6) / 6);
        return <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: C.brand, opacity: op }} />;
      })}
    </span>
    <span style={{ fontSize: 9, color: C.ink2 }}>{label}</span>
  </div>
);

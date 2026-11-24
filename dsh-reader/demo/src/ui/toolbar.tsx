import React from 'react';
import { C, FONT } from './theme';

const BUTTONS = ['问 AI', '快捷追问', '解释', '译', '笔记', '高亮'];

/** Floating selection toolbar (mirrors `.rd-mini` in the real reader). */
export const MiniToolbar: React.FC<{
  x: number;
  y: number;
  enter: number;
  pressed?: string;
  hover?: string;
  frame: number;
  items?: string[];
}> = ({ x, y, enter, pressed, hover, frame, items = BUTTONS }) => {
  if (enter <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        padding: 3,
        borderRadius: 8,
        background: '#ffffff',
        border: `1px solid ${C.border}`,
        boxShadow: '0 10px 26px rgba(31,35,41,0.18), 0 2px 5px rgba(31,35,41,0.06)',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 7}px) scale(${0.94 + enter * 0.06})`,
        transformOrigin: '50% 100%',
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      {items.map((label) => {
        const isPressed = pressed === label;
        const isHover = hover === label;
        const isPrimary = label === '问 AI';
        return (
          <span
            key={label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              height: 21,
              padding: '0 6px',
              borderRadius: 5,
              fontSize: 9,
              color: isPrimary ? C.ink : C.ink2,
              fontWeight: isPrimary ? 600 : 500,
              background: isPressed ? C.brandSoft : isHover ? C.layer2 : 'transparent',
              border: isPressed ? `1px solid ${C.brandLine}` : '1px solid transparent',
              transform: isPressed ? 'scale(0.97)' : 'scale(1)',
            }}
          >
            {label}
            {label === '快捷追问' ? <span style={{ fontSize: 7, color: C.faint, marginLeft: 1 }}>▾</span> : null}
            {isPrimary ? <span style={{ fontSize: 7, color: C.faint, marginLeft: 1 }}>↵</span> : null}
          </span>
        );
      })}
      <span style={{ width: 1, height: 13, background: C.border, margin: '0 3px' }} />
      <span style={{ fontSize: 10, color: C.faint, padding: '0 3px', transform: `rotate(${frame * 0}deg)` }}>×</span>
    </div>
  );
};

import React from 'react';
import { C, MONO } from './theme';

/**
 * Small inline consistency diagram used by the Ask AI reel.
 *
 * The real product can turn a selected image/SVG into an attachment. Drawing
 * the figure in demo code keeps the reel reproducible and avoids shipping a
 * raster asset into git just for the GIF.
 */
export const ReplicaFigure: React.FC<{
  width?: number;
  height?: number;
  selection?: number;
  compact?: boolean;
}> = ({ width = 190, height = 78, selection = 0, compact = false }) => {
  const active = selection > 0.01;
  return (
    <div
      style={{
        width,
        height,
        boxSizing: 'border-box',
        position: 'relative',
        borderRadius: compact ? 6 : 8,
        border: `1px solid ${active ? C.brandLine : C.border}`,
        background: C.white,
        padding: compact ? '4px 5px' : '5px 7px 4px',
        overflow: 'hidden',
        boxShadow: active ? `0 0 0 3px rgba(31,111,235,${0.10 + selection * 0.08})` : '0 1px 2px rgba(31,35,41,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: compact ? 5.6 : 6.4,
          color: active ? C.brand : C.muted,
          lineHeight: 1.2,
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: active ? C.brand : C.faint }} />
        图 1 · 线性一致性
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: compact ? 5.2 : 5.8, color: C.faint }}>R1 R2 R3</span>
      </div>
      <svg
        width={width - (compact ? 10 : 14)}
        height={height - (compact ? 17 : 22)}
        viewBox="0 0 176 42"
        style={{ display: 'block', marginTop: compact ? 2 : 3, overflow: 'visible' }}
      >
        <defs>
          <marker id="rd-arrow" markerWidth="4" markerHeight="4" refX="3.2" refY="2" orient="auto">
            <path d="M0 0 4 2 0 4z" fill={C.muted} />
          </marker>
        </defs>
        <line x1="12" y1="22" x2="164" y2="22" stroke={C.border} strokeWidth="1" strokeDasharray="2 2" />
        {[0, 1, 2].map((index) => {
          const x = 20 + index * 56;
          return (
            <g key={index}>
              <rect x={x} y="9" width="38" height="20" rx="4" fill={index === 0 ? C.brandSoft : C.layer1} stroke={index === 0 ? C.brandLine : C.border} />
              <text x={x + 19} y="22.5" textAnchor="middle" fontSize="6.2" fill={index === 0 ? C.brand : C.ink2} fontFamily="ui-monospace, monospace">
                R{index + 1}
              </text>
              <line x1={x + 19} y1="29" x2={x + 19} y2="36" stroke={C.border} strokeWidth="1" markerEnd="url(#rd-arrow)" />
            </g>
          );
        })}
        <circle cx="164" cy="22" r="7" fill={C.white} stroke={C.border} />
        <path d="M164 18.4v3.8l2.4 1.6" fill="none" stroke={C.muted} strokeWidth="1" strokeLinecap="round" />
        <text x="12" y="40" fontSize="5.6" fill={C.faint}>同一时刻 · 同一个值</text>
      </svg>
      {active ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `rgba(31,111,235,${0.05 + selection * 0.06})`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
};

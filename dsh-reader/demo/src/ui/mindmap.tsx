import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C, MONO } from './theme';
import { IconGlyph, ICONS } from './atoms';
import { prog, useSpringIn } from './motion';

type NodeDef = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'root' | 'part' | 'chunk';
  delay: number;
};

/**
 * Labels follow the current reader map:
 * - root: document title without extension;
 * - parts: chapter groups;
 * - chunks: `（N）+ leading point`, not the repeated chapter title.
 */
const NODES: NodeDef[] = [
  { id: 'root', label: '示例-分布式系统阅读', x: 2, y: 148, w: 112, h: 28, kind: 'root', delay: 2 },
  { id: 'p1', label: '第一部分 · 一致性与 CAP', x: 142, y: 60, w: 128, h: 26, kind: 'part', delay: 8 },
  { id: 'p2', label: '第二部分 · 直觉', x: 142, y: 244, w: 128, h: 26, kind: 'part', delay: 12 },
  { id: 'c1', label: '（1）单副本直觉', x: 292, y: 30, w: 96, h: 23, kind: 'chunk', delay: 18 },
  { id: 'c2', label: '（2）CAP 取舍', x: 292, y: 82, w: 96, h: 23, kind: 'chunk', delay: 21 },
  { id: 'c3', label: '（1）银行柜台', x: 292, y: 184, w: 96, h: 23, kind: 'chunk', delay: 25 },
];

const EDGES: { from: string; to: string; delay: number }[] = [
  { from: 'root', to: 'p1', delay: 6 },
  { from: 'root', to: 'p2', delay: 10 },
  { from: 'p1', to: 'c1', delay: 16 },
  { from: 'p1', to: 'c2', delay: 19 },
  { from: 'p2', to: 'c3', delay: 23 },
];

const nodeById = (id: string) => NODES.find((node) => node.id === id)!;

const NodeBox: React.FC<{ node: NodeDef; start: number; active: boolean; press: number }> = ({
  node,
  start,
  active,
  press,
}) => {
  const enter = useSpringIn(start + node.delay, { damping: 19, stiffness: 200, mass: 0.7 });
  const isChunk = node.kind === 'chunk';
  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        borderRadius: node.kind === 'root' ? 7 : 6,
        border: `1px solid ${active ? C.brand : node.kind === 'root' ? '#cfd6df' : C.border}`,
        background: active ? C.brandSoft : node.kind === 'root' ? '#fbfcfd' : C.layer1,
        boxShadow: active ? '0 4px 12px rgba(31,111,235,0.16)' : '0 1px 2px rgba(31,35,41,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        fontSize: node.kind === 'root' ? 8.0 : isChunk ? 7.8 : 8.0,
        fontWeight: node.kind === 'chunk' ? 500 : 600,
        color: active ? C.brand : node.kind === 'root' ? C.ink2 : C.ink,
        opacity: enter,
        transform: `translateZ(${active ? 18 : 0}px) scale(${(0.9 + enter * 0.1) * (1 + press * 0.03)})`,
        transformOrigin: 'center',
        transformStyle: 'preserve-3d',
        boxSizing: 'border-box',
        padding: '0 4px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {node.kind === 'root' ? (
        <span style={{ display: 'flex', color: active ? C.brand : C.muted, flex: '0 0 auto' }}>
          <IconGlyph d={ICONS.book} size={7.5} />
        </span>
      ) : null}
      {node.label}
    </div>
  );
};

export const Mindmap: React.FC<{
  width: number;
  height: number;
  start: number;
  activeId?: string;
  pressAt?: number;
  exportAt?: number;
}> = ({ height, start, activeId, pressAt = -1, exportAt = -1 }) => {
  const frame = useCurrentFrame();
  const active = activeId ? nodeById(activeId) : null;
  const press = pressAt >= 0 ? Math.sin(prog(frame, pressAt, pressAt + 14) * Math.PI) : 0;
  const camera = prog(frame, start + 2, start + 40);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          flex: '0 0 auto',
          height: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '0 8px',
        }}
      >
        <span style={{ fontSize: 7.2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 5px' }}>
          −
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: C.muted, minWidth: 32, textAlign: 'center' }}>100%</span>
        <span style={{ fontSize: 7.2, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 5px' }}>
          +
        </span>
        <span style={{ fontSize: 7, color: C.faint }}>1:1</span>
        <span style={{ width: 1, height: 10, background: C.border, margin: '0 2px' }} />
        {['展开全部', '收起全部'].map((label) => (
          <span
            key={label}
            style={{
              fontSize: 7.2,
              color: C.muted,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: '2px 5px',
              background: C.white,
            }}
          >
            {label}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        {['SVG', 'PNG', 'MD'].map((label) => {
          const progress = exportAt < 0 ? 0 : prog(frame, exportAt, exportAt + 10);
          return (
            <span
              key={label}
              style={{
                fontSize: 7,
                padding: '2px 5px',
                borderRadius: 4,
                border: `1px solid ${progress > 0.1 ? C.brandLine : C.border}`,
                color: progress > 0.1 ? C.brand : C.muted,
                background: progress > 0.1 ? C.brandSoft : C.white,
                transform: `scale(${1 + progress * 0.05})`,
                opacity: 0.6 + progress * 0.4,
              }}
            >
              {label}
            </span>
          );
        })}
        <span
          style={{
            fontSize: 6.8,
            color: C.muted,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: '2px 5px',
            background: C.white,
          }}
        >
          全屏
        </span>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: '0 6px 6px',
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          background: '#fdfdfe',
          backgroundImage: 'radial-gradient(circle, #e9edf2 1px, rgba(233,237,242,0) 1px)',
          backgroundSize: '20px 20px',
          overflow: 'hidden',
          position: 'relative',
          transform: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 398,
            height: '100%',
            transform: `translateX(${-camera * 8}px) translateY(${camera * 2}px)`,
            transformOrigin: '30% 50%',
            transformStyle: 'preserve-3d',
          }}
        >
          <svg width="398" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {EDGES.map((edge) => {
              const a = nodeById(edge.from);
              const b = nodeById(edge.to);
              const x1 = a.x + a.w;
              const y1 = a.y + a.h / 2;
              const x2 = b.x;
              const y2 = b.y + b.h / 2;
              const mid = (x1 + x2) / 2;
              const progress = prog(frame, start + edge.delay, start + edge.delay + 9);
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={C.border}
                  strokeWidth={1.2}
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - progress}
                />
              );
            })}
          </svg>
          {NODES.map((node) => (
            <NodeBox
              key={node.id}
              node={node}
              start={start}
              active={Boolean(active && node.id === active.id)}
              press={active && node.id === active.id ? press : 0}
            />
          ))}
        </div>
        {active ? (
          <div
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              width: 122,
              background: 'rgba(255,255,255,0.97)',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              boxShadow: '0 6px 16px rgba(31,35,41,0.10)',
              padding: '4px 6px',
              opacity: prog(frame, start + 18, start + 26),
            }}
          >
            <div style={{ fontSize: 7.8, fontWeight: 600 }}>{active.label}</div>
            <div style={{ fontSize: 6.7, color: C.muted, lineHeight: 1.45, marginTop: 1 }}>
              点击跳回原文 · 第 2 部分
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

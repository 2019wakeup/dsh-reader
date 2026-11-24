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
  kind: 'root' | 'part' | 'sec';
  delay: number;
};

const NODES: NodeDef[] = [
  { id: 'root', label: '示例-分布式系统阅读.md', x: 4, y: 128, w: 104, h: 26, kind: 'root', delay: 2 },
  { id: 'p1', label: '第一部分 · 一致性与 CAP', x: 146, y: 56, w: 122, h: 24, kind: 'part', delay: 8 },
  { id: 'p2', label: '第二部分 · 直觉', x: 146, y: 194, w: 122, h: 24, kind: 'part', delay: 13 },
  { id: 's1', label: '一致性模型', x: 300, y: 24, w: 86, h: 21, kind: 'sec', delay: 19 },
  { id: 's2', label: 'CAP 定理', x: 300, y: 80, w: 86, h: 21, kind: 'sec', delay: 23 },
  { id: 's3', label: '一个直觉', x: 300, y: 186, w: 86, h: 21, kind: 'sec', delay: 28 },
];

const EDGES: { from: string; to: string; delay: number }[] = [
  { from: 'root', to: 'p1', delay: 6 },
  { from: 'root', to: 'p2', delay: 11 },
  { from: 'p1', to: 's1', delay: 17 },
  { from: 'p1', to: 's2', delay: 21 },
  { from: 'p2', to: 's3', delay: 26 },
];

const nodeById = (id: string) => NODES.find((n) => n.id === id)!;

const NodeBox: React.FC<{ node: NodeDef; start: number; active: boolean; press: number }> = ({
  node,
  start,
  active,
  press,
}) => {
  const enter = useSpringIn(start + node.delay, { damping: 19, stiffness: 200, mass: 0.7 });
  const activeP = active ? 1 : 0;
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
        boxShadow: active
          ? '0 4px 12px rgba(31,111,235,0.16)'
          : '0 1px 2px rgba(31,35,41,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        fontSize: node.kind === 'root' ? 7.6 : 7.4,
        fontWeight: node.kind === 'sec' ? 500 : 600,
        color: active ? C.brand : node.kind === 'root' ? C.ink2 : C.ink,
        opacity: enter,
        transform: `scale(${(0.9 + enter * 0.1) * (1 + press * 0.03)})`,
        transformOrigin: 'center',
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
}> = ({ width, height, start, activeId, pressAt = -1, exportAt = -1 }) => {
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
          const p = exportAt < 0 ? 0 : prog(frame, exportAt, exportAt + 10);
          return (
            <span
              key={label}
              style={{
                fontSize: 7,
                padding: '2px 5px',
                borderRadius: 4,
                border: `1px solid ${p > 0.1 ? C.brandLine : C.border}`,
                color: p > 0.1 ? C.brand : C.muted,
                background: p > 0.1 ? C.brandSoft : C.white,
                transform: `scale(${1 + p * 0.05})`,
                opacity: 0.6 + p * 0.4,
              }}
            >
              {label}
            </span>
          );
        })}
        <span style={{ color: C.muted, display: 'flex', marginLeft: 2 }}>
          <IconGlyph d={ICONS.expand} size={8} />
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
          backgroundImage: 'radial-gradient(circle, #eef1f5 1px, rgba(238,241,245,0) 1px)',
          backgroundSize: '12px 12px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 398,
            height: '100%',
            transform: `scale(${1 + camera * 0.06}) translateX(${-camera * 8}px) translateY(${camera * 2}px)`,
            transformOrigin: '30% 50%',
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
              const mx = (x1 + x2) / 2;
              const p = prog(frame, start + edge.delay, start + edge.delay + 9);
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={C.border}
                  strokeWidth={1.2}
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - p}
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
              width: 118,
              background: 'rgba(255,255,255,0.97)',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              boxShadow: '0 6px 16px rgba(31,35,41,0.10)',
              padding: '4px 6px',
              opacity: prog(frame, start + 18, start + 26),
            }}
          >
            <div style={{ fontSize: 7.8, fontWeight: 600 }}>{active.label}</div>
            <div style={{ fontSize: 6.8, color: C.muted, lineHeight: 1.45, marginTop: 1 }}>
              点击跳回原文 · 第 2 部分
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

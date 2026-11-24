import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C, MONO } from './theme';
import { caretOpacity, prog, useSpringIn } from './motion';
import { Chip, IconGlyph, ICONS } from './atoms';

const Row: React.FC<{ label: string; children: React.ReactNode; enter: number }> = ({ label, children, enter }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 4,
      marginTop: 5,
      fontSize: 10.5,
      lineHeight: 1.5,
      color: C.ink2,
      opacity: enter,
      transform: `translateY(${(1 - enter) * 3}px)`,
    }}
  >
    <span style={{ color: C.muted, fontWeight: 600, flex: '0 0 auto', fontSize: 10 }}>{label}</span>
    <span style={{ minWidth: 0 }}>{children}</span>
  </div>
);

export type ConceptFollowUp = {
  typed?: string;
  typing?: boolean;
  sent?: boolean;
  busy?: boolean;
  answerReveal?: number;
  active?: number;
  question?: string;
  caret?: number;
  highlightTerm?: number;
};

/** The concept card that floats over the page after an explanation is ready. */
export const ConceptCard: React.FC<{
  x: number;
  y: number;
  start: number;
  savedAt?: number;
  width?: number;
  exitAt?: number;
  followUp?: ConceptFollowUp;
  shiftX?: number;
  shiftY?: number;
  dim?: number;
}> = ({ x, y, start, savedAt = start + 26, width = 288, exitAt, followUp, shiftX = 0, shiftY = 0, dim = 0 }) => {
  const frame = useCurrentFrame();
  const enter = useSpringIn(start, { damping: 20, stiffness: 190, mass: 0.8 });
  const exit = exitAt === undefined ? 0 : prog(frame, exitAt, exitAt + 10);
  const r = (i: number) => prog(frame, start + 5 + i * 3, start + 15 + i * 3);
  const saved = prog(frame, savedAt, savedAt + 12);
  const actions = prog(frame, start + 20, start + 30);
  const follow = followUp || {};
  const followQuestion = follow.question || '它和最终一致性差在哪？';
  const typed = follow.typed || '';
  const sent = follow.sent === true;
  const answerReveal = follow.answerReveal ?? 0;
  const inputActive = follow.active ?? 0;
  const caret = follow.caret ?? caretOpacity(frame);
  const highlightTerm = follow.highlightTerm ?? 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        zIndex: 60,
        boxSizing: 'border-box',
        background: 'rgba(255,255,255,0.985)',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        boxShadow: '0 18px 48px rgba(15,18,23,0.20), 0 3px 10px rgba(15,18,23,0.07)',
        padding: '9px 11px 10px',
        opacity: Math.min(1, enter * 1.2) * (1 - exit) * (1 - dim * 0.04),
        transform: `translate(${shiftX}px, ${shiftY}px) translateY(${(1 - enter) * 10 - exit * 6}px) scale(${(0.94 + enter * 0.06) * (1 - exit * 0.04)})`,
        transformOrigin: '20% 0%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: 0.2 }}>线性一致性</span>
        <Chip tone="plain" style={{ fontSize: 7, padding: '2px 4px' }}>
          快速
        </Chip>
        <div style={{ flex: 1 }} />
        {saved > 0.2 ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 7,
              color: C.green,
              opacity: saved,
            }}
          >
            <IconGlyph d={ICONS.check} size={7.5} />
            已归档
          </span>
        ) : null}
        <span style={{ color: C.faint, display: 'flex', gap: 3 }}>
          <IconGlyph d={ICONS.pin} size={8.5} />
          <IconGlyph d={ICONS.close} size={8} />
        </span>
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.65, marginTop: 5, color: C.ink, opacity: r(0) }}>
        所有副本在同一时刻看到同一份历史，像系统只有一个副本。
      </div>
      <Row label="直觉" enter={r(1)}>
        写下即被所有人看到，没有中间窗口。
      </Row>
      <Row label="本书语境" enter={r(2)}>
        本书用它作为最强的一致性参考点。
      </Row>
      <Row label="例子" enter={r(3)}>
        单副本数据库
      </Row>
      <Row label="相关" enter={r(4)}>
        <span style={{ color: C.brand }}>CAP 定理</span>
      </Row>
      <div
        style={{
          marginTop: 6,
          fontSize: 9.5,
          color: C.muted,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          opacity: r(5),
        }}
      >
        <span style={{ fontSize: 7 }}>▸</span> 依据原文
      </div>
      <div
        style={{
          marginTop: 7,
          paddingTop: 6,
          borderTop: `1px dashed ${C.border}`,
          opacity: r(6),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8, color: C.muted, fontWeight: 600, letterSpacing: 0.3 }}>追问</span>
          <span
            style={{
              fontSize: 6.4,
              color: sent ? C.green : C.brand,
              background: sent ? C.greenSoft : C.brandSoft,
              border: `1px solid ${sent ? 'rgba(47,158,68,0.20)' : C.brandLine}`,
              borderRadius: 999,
              padding: '1px 5px',
              opacity: sent ? prog(frame, 214, 224) : 1,
            }}
          >
            {sent ? '卡内对话 · 1' : '留在卡内'}
          </span>
        </div>
        <div style={{ minHeight: 31, marginTop: 2 }}>
          <div style={{ fontSize: 9.5, lineHeight: 1.5, opacity: answerReveal, transform: `translateY(${(1 - answerReveal) * 3}px)` }}>
            问：{followQuestion}
          </div>
          <div
            style={{
              fontSize: 9.5,
              lineHeight: 1.5,
              color: C.muted,
              opacity: answerReveal,
              transform: `translateY(${(1 - answerReveal) * 3}px)`,
            }}
          >
            答：线性一致性要求实时顺序，<span style={{ backgroundImage: `linear-gradient(90deg, rgba(31,111,235,0.24) ${highlightTerm * 100}%, rgba(31,111,235,0) ${highlightTerm * 100}%)`, borderRadius: 2, padding: '0 1px' }}>最终一致性</span>只保证收敛。
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            border: `1px solid ${inputActive > 0.1 ? C.brandLine : C.border}`,
            background: inputActive > 0.1 ? C.brandSoft : C.white,
            borderRadius: 6,
            padding: '3px 5px',
          }}
        >
          <span
            style={{
              fontSize: 8.5,
              color: typed ? C.ink : C.faint,
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {typed ? (
              <>
                {typed}
                {follow.typing ? (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 1,
                      height: 9,
                      background: C.ink,
                      marginLeft: 1,
                      verticalAlign: '-1px',
                      opacity: caret,
                    }}
                  />
                ) : null}
              </>
            ) : sent ? (
              '继续追问…'
            ) : (
              '就这个概念再问一句…'
            )}
          </span>
          <span
            style={{
              fontSize: 7.5,
              color: follow.busy ? C.muted : C.brand,
              background: follow.busy ? C.layer1 : C.brandSoft,
              border: `1px solid ${follow.busy ? C.border : C.brandLine}`,
              borderRadius: 4,
              padding: '2px 4px',
            }}
          >
            {follow.busy ? '追问中…' : '追问'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 7, opacity: actions }}>
        {['概念库', '深入解释', '编辑', '删除'].map((label, i) => (
          <span
            key={label}
            style={{
              fontSize: 8.5,
              padding: '3px 6px',
              borderRadius: 5,
              border: `1px solid ${C.border}`,
              background: i === 0 ? C.layer1 : 'transparent',
              color: i === 3 ? C.muted : C.ink2,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 14,
          bottom: -7,
          width: 10,
          height: 10,
          background: '#fff',
          borderRight: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          transform: 'rotate(45deg)',
          opacity: enter,
        }}
      />
    </div>
  );
};


/** Second-level concept card, opened from a term inside the parent card. */
export const ChildConceptCard: React.FC<{
  x: number;
  y: number;
  start: number;
  exitAt?: number;
  term?: string;
  definition?: string;
}> = ({
  x,
  y,
  start,
  exitAt,
  term = '最终一致性',
  definition = '不保证立刻一致；没有新写入后，副本最终会收敛到同一个值。',
}) => {
  const frame = useCurrentFrame();
  const enter = useSpringIn(start, { damping: 20, stiffness: 190, mass: 0.8 });
  const exit = exitAt === undefined ? 0 : prog(frame, exitAt, exitAt + 10);
  const fade = prog(frame, start, start + 2);
  const rows = prog(frame, start + 4, start + 12);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 288,
        zIndex: 70,
        boxSizing: 'border-box',
        background: 'rgba(255,255,255,0.99)',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        boxShadow: '0 18px 48px rgba(15,18,23,0.20), 0 3px 10px rgba(15,18,23,0.07)',
        padding: '9px 11px 10px',
        opacity: fade * (1 - exit),
        transform: `translateY(${(1 - enter) * 8 - exit * 6}px) scale(${(0.96 + enter * 0.04) * (1 - exit * 0.04)})`,
        transformOrigin: '55% 60%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: 0.2 }}>{term}</span>
        <Chip tone="plain" style={{ fontSize: 7, padding: '2px 4px' }}>
          快速
        </Chip>
        <div style={{ flex: 1 }} />
        <span style={{ color: C.brand, display: 'flex' }}>
          <IconGlyph d={ICONS.pin} size={8.5} />
        </span>
        <span style={{ color: C.faint, display: 'flex' }}>
          <IconGlyph d={ICONS.close} size={8} />
        </span>
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.65, marginTop: 5, color: C.ink }}>{definition}</div>
      <div style={{ opacity: rows }}>
        <Row label="相关" enter={1}>
          <span style={{ color: C.brand }}>线性一致性</span>
        </Row>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, opacity: rows }}>
        <span style={{ fontSize: 7, color: C.muted, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <span style={{ width: 8, height: 8, border: `1px solid ${C.border}`, borderRadius: 2, display: 'inline-block' }} />
          联网
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '3px 5px',
            fontSize: 8.5,
            color: C.faint,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          就这个概念再问一句…
        </span>
        <span style={{ fontSize: 7.5, color: C.brand, background: C.brandSoft, border: `1px solid ${C.brandLine}`, borderRadius: 4, padding: '2px 4px' }}>
          追问
        </span>
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 7, opacity: rows }}>
        {['概念库', '深入解释', '编辑', '删除'].map((label, index) => (
          <span
            key={label}
            style={{
              fontSize: 8.5,
              padding: '3px 6px',
              borderRadius: 5,
              border: `1px solid ${C.border}`,
              background: index === 0 ? C.layer1 : 'transparent',
              color: index === 3 ? C.muted : C.ink2,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

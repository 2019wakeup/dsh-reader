import React from 'react';
import { C, MONO } from './theme';
import { caretOpacity, prog, typewriter, useSpringIn } from './motion';
import { Chip, IconGlyph, ICONS } from './atoms';

/** Right-hand drawer shell; width is animated by the scene. */
export const Drawer: React.FC<{
  width: number;
  innerWidth: number;
  title: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  contentOpacity?: number;
}> = ({ width, innerWidth, title, children, headerExtra, contentOpacity = 1 }) => (
  <div
    style={{
      width,
      flex: '0 0 auto',
      position: 'relative',
      overflow: 'hidden',
      borderLeft: width > 1 ? `1px solid ${C.border}` : 'none',
      background: C.white,
      boxShadow: width > 40 ? '-10px 0 26px rgba(15,18,23,0.07)' : 'none',
    }}
  >
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: innerWidth,
        opacity: contentOpacity,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          height: 26,
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '0 9px',
          borderBottom: `1px solid ${C.border}`,
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 600 }}>{title}</span>
        <div style={{ flex: 1 }} />
        {headerExtra}
        <span style={{ color: C.faint, display: 'flex' }}>
          <IconGlyph d={ICONS.close} size={8.5} />
        </span>
      </div>
      {children}
    </div>
  </div>
);

const TABS = ['显示全部', '过程'];

const UserMessage: React.FC<{ enter: number; question: string }> = ({ enter, question }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      marginBottom: 10,
      opacity: enter,
      transform: `translateY(${(1 - enter) * 8}px)`,
    }}
  >
    <span style={{ fontSize: 7.5, color: C.muted, margin: '0 2px 3px', fontWeight: 600 }}>你</span>
    <div
      style={{
        maxWidth: '92%',
        background: C.layer1,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '4px 6px',
      }}
    >
      <div style={{ fontSize: 7.2, color: C.muted, display: 'flex', gap: 3, alignItems: 'center' }}>
        <IconGlyph d={ICONS.book} size={7} />《示例-分布式系统阅读.md》· 一致性模型 · 第 3 段
      </div>
      <div style={{ fontSize: 9, lineHeight: 1.45, color: C.muted, marginTop: 2 }}>
        「把线性一致性想成银行只有一个柜台：所有客户的操作按叫号顺序立刻生效…」
      </div>
      <div style={{ fontSize: 9.5, lineHeight: 1.5, marginTop: 3 }}>{question}</div>
    </div>
  </div>
);

export const ChatPanel: React.FC<{
  width: number;
  userAt: number;
  streamAt: number;
  answer: string;
  processAt: number;
  openLinkAt: number;
  frame: number;
}> = ({ width, userAt, streamAt, answer, processAt, openLinkAt, frame }) => {
  const user = useSpringIn(userAt, { damping: 22, stiffness: 200 });
  const text = typewriter(answer, frame, streamAt, 2.1);
  const streaming = frame >= streamAt && text.length < answer.length;
  const process = prog(frame, processAt, processAt + 8);
  const openLink = prog(frame, openLinkAt, openLinkAt + 10);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          height: 22,
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '0 8px',
          borderBottom: `1px solid ${C.borderSoft}`,
          boxSizing: 'border-box',
        }}
      >
        {TABS.map((t, i) => (
          <span
            key={t}
            style={{
              fontSize: 7.8,
              padding: '2px 5px',
              borderRadius: 4,
              color: i === 0 ? C.brand : C.muted,
              background: i === 0 ? C.brandSoft : 'transparent',
              border: `1px solid ${i === 0 ? C.brandLine : 'transparent'}`,
            }}
          >
            {t}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 7.5,
            color: C.brand,
            padding: '2px 4px',
            borderRadius: 4,
            background: C.brandSoft,
            border: `1px solid ${C.brandLine}`,
            opacity: 0.55 + openLink * 0.45,
            transform: `scale(${1 + openLink * 0.03})`,
            whiteSpace: 'nowrap',
          }}
        >
          在对话页打开
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '8px 9px' }}>
        {frame < userAt ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              color: C.faint,
              opacity: 0.9,
            }}
          >
            <span style={{ display: 'flex', color: C.border }}>
              <IconGlyph d={ICONS.book} size={22} />
            </span>
            <span style={{ fontSize: 8.5 }}>引用已进入输入框</span>
            <span style={{ fontSize: 8.5 }}>补一句问题，回答会流到这里</span>
          </div>
        ) : (
          <UserMessage enter={user} question="它和最终一致性差在哪？" />
        )}
        <div
          style={{
            opacity: Math.min(1, user * 1.4),
            transform: `translateY(${(1 - user) * 8}px)`,
          }}
        >
          <span style={{ fontSize: 7.5, color: C.muted, fontWeight: 600, margin: '0 2px 3px', display: 'block' }}>
            助手
          </span>
          <div style={{ fontSize: 9.4, lineHeight: 1.62, color: C.ink }}>
            {text}
            {streaming ? (
              <span
                style={{
                  display: 'inline-block',
                  width: 4,
                  height: 8,
                  background: C.brand,
                  marginLeft: 1,
                  verticalAlign: '-1px',
                  opacity: caretOpacity(frame),
                }}
              />
            ) : null}
            {!streaming && text.length === 0 ? (
              <span style={{ display: 'inline-flex', gap: 2 }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 2.5,
                      height: 2.5,
                      borderRadius: '50%',
                      background: C.brand,
                      opacity: 0.35,
                    }}
                  />
                ))}
              </span>
            ) : null}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 8,
              color: C.muted,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              opacity: process,
            }}
          >
            <span style={{ fontSize: 6.5 }}>▸</span> 过程 · 2
            <Chip tone="plain" style={{ fontSize: 6.8, padding: '1.5px 4px' }}>
              已读取阅读窗口
            </Chip>
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              gap: 4,
              opacity: prog(frame, processAt + 10, processAt + 20),
            }}
          >
            {['解释这段', '举个例子', '和上文什么关系', '作者为什么这么说'].map((q, i) => (
              <span
                key={q}
                style={{
                  fontSize: 7.2,
                  color: C.muted,
                  border: `1px solid ${C.border}`,
                  background: i === 0 ? C.layer1 : 'transparent',
                  borderRadius: 5,
                  padding: '2px 4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {q}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          flex: '0 0 auto',
          borderTop: `1px solid ${C.borderSoft}`,
          padding: '5px 8px',
          fontSize: 7.5,
          color: C.faint,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 9, color: C.muted }}>↩</span> 继续追问，回答仍在同一个会话里
      </div>
    </div>
  );
};

/** Guide drawer: summary list first, then the mind map. */
export const GuidePanel: React.FC<{
  width: number;
  frame: number;
  start: number;
  mindmapAt: number;
  children: React.ReactNode;
}> = ({ width, frame, start, mindmapAt, children }) => {
  const list = 1 - prog(frame, mindmapAt, mindmapAt + 8);
  const tabs = ['列表', '导图'];
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 8px',
          borderBottom: `1px solid ${C.borderSoft}`,
        }}
      >
        {tabs.map((t, i) => {
          const on = i === (frame >= mindmapAt ? 1 : 0);
          return (
            <span
              key={t}
              style={{
                fontSize: 7.8,
                padding: '2px 6px',
                borderRadius: 4,
                color: on ? C.brand : C.muted,
                background: on ? C.brandSoft : 'transparent',
                border: `1px solid ${on ? C.brandLine : 'transparent'}`,
                fontWeight: on ? 600 : 500,
              }}
            >
              {t}
            </span>
          );
        })}
        <span
          style={{
            fontSize: 7.8,
            padding: '2px 6px',
            borderRadius: 4,
            color: C.muted,
            border: `1px solid ${C.border}`,
            background: C.white,
          }}
        >
          更新导读
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 6.5, color: C.faint }}>v1</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: '7px 9px',
            overflow: 'hidden',
            opacity: list,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Chip tone="green">
              <IconGlyph d={ICONS.check} size={7.5} /> 已生成
            </Chip>
            <span style={{ fontSize: 7.5, color: C.muted }}>3 章 · 2 篇 · 复用缓存</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 7.2, color: C.faint }}>≈ ¥0.02</span>
          </div>
          <div style={{ fontSize: 9.2, lineHeight: 1.62, color: C.ink2 }}>
            这本书用分布式系统的例子，示范如何边读边把不懂的概念变成可复用的卡片。
          </div>
          <div style={{ fontSize: 7.8, color: C.muted, fontWeight: 600, marginTop: 1 }}>核心问题</div>
          {['线性一致性和最终一致性差别在哪？', 'CAP 定理在工程上怎么取舍？'].map((q) => (
            <div key={q} style={{ display: 'flex', gap: 4, fontSize: 8.5, color: C.muted, lineHeight: 1.45 }}>
              <span style={{ color: C.brand }}>·</span>
              {q}
            </div>
          ))}
          {[
            { t: '第一部分 · 一致性与 CAP', s: '从强一致性出发，讨论 CAP 的取舍。', tags: ['线性一致性', '实时顺序'] },
            { t: '第二部分 · 直觉', s: '用日常直觉理解一致性窗口。', tags: ['直觉'] },
          ].map((part) => (
            <div
              key={part.t}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                padding: '5px 7px',
                background: C.white,
              }}
            >
              <div style={{ fontSize: 8.8, fontWeight: 600 }}>{part.t}</div>
              <div style={{ fontSize: 8, color: C.muted, lineHeight: 1.5, marginTop: 1 }}>{part.s}</div>
              <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                {part.tags.map((tag) => (
                  <Chip key={tag} tone="plain" style={{ fontSize: 6.6, padding: '1.5px 4px' }}>
                    {tag}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - list }}>{children}</div>
      </div>
    </div>
  );
};

import React from 'react';
import { C, MONO } from './theme';
import { caretOpacity, prog, typewriter, useSpringIn } from './motion';
import { Chip, IconGlyph, ICONS } from './atoms';
import { ReplicaFigure } from './figure';

/** Right-hand drawer shell; width is animated by the scene. */
export const Drawer: React.FC<{
  width: number;
  innerWidth: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  actions?: React.ReactNode;
  contentOpacity?: number;
}> = ({ width, innerWidth, title, subtitle, children, headerExtra, actions, contentOpacity = 1 }) => (
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
          height: 30,
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '0 9px',
          borderBottom: `1px solid ${C.border}`,
          boxSizing: 'border-box',
          background: C.white,
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 600 }}>{title}</span>
        {subtitle ? <span style={{ fontSize: 7.4, color: C.muted, whiteSpace: 'nowrap' }}>{subtitle}</span> : null}
        <div style={{ flex: 1 }} />
        {actions}
        {headerExtra}
        <span style={{ color: C.faint, display: 'flex', marginLeft: 2 }}>
          <IconGlyph d={ICONS.close} size={8.5} />
        </span>
      </div>
      {children}
    </div>
  </div>
);

/** Small header action group used by the chat drawer. */
export const ChatHeaderActions: React.FC<{ openLink?: number }> = ({ openLink = 0 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: openLink > 0.1 ? C.brand : C.muted }}>
    <IconGlyph d={ICONS.history} size={8.4} />
    <IconGlyph d={ICONS.external} size={8.4} />
  </div>
);

const ChatEmpty: React.FC<{ enter: number }> = ({ enter }) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      padding: '0 18px',
      opacity: enter,
      textAlign: 'center',
    }}
  >
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        background: C.brandSoft,
        color: C.brand,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconGlyph d={ICONS.spark} size={14} />
    </div>
    <div style={{ fontSize: 10.5, fontWeight: 600 }}>边读边问</div>
    <div style={{ fontSize: 8.0, lineHeight: 1.6, color: C.muted, maxWidth: 190 }}>
      选中正文里的图或段落，点「问 AI」；回答会留在这里，和原生对话页同源。
    </div>
  </div>
);

const UserBubble: React.FC<{
  enter: number;
  quote: number;
  figure: number;
  question: string;
}> = ({ enter, quote, figure, question }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 13,
      opacity: enter,
      transform: `translateY(${(1 - enter) * 8}px)`,
    }}
  >
    <div
      style={{
        maxWidth: '88%',
        minWidth: 0,
        background: `color-mix(in srgb, ${C.brand} 10%, ${C.white})`,
        borderRadius: 10,
        borderBottomRightRadius: 4,
        padding: '6px 8px 7px',
        boxShadow: '0 1px 2px rgba(31,35,41,0.04)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          maxWidth: '100%',
          padding: '2px 5px',
          marginBottom: 4,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.56)',
          color: C.muted,
          fontSize: 7.0,
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <IconGlyph d={ICONS.book} size={6.4} />
        《示例-分布式系统阅读》· 一致性模型 · 第 3 段
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', opacity: figure }}>
          <ReplicaFigure width={92} height={57} compact />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 7.6, color: C.ink2, fontWeight: 600 }}>图 1 已附加</div>
            <div style={{ fontSize: 7.0, lineHeight: 1.45, color: C.muted }}>选区内图形会随问题一起发送</div>
          </div>
        </div>
        <div
          style={{
            fontSize: 7.8,
            lineHeight: 1.5,
            color: C.muted,
            borderLeft: `2px solid ${C.brandLine}`,
            paddingLeft: 5,
            opacity: quote,
            transform: `translateY(${(1 - quote) * 4}px)`,
          }}
        >
          「把线性一致性想成银行只有一个柜台：所有客户的操作按叫号顺序立刻生效…」
        </div>
        <div style={{ fontSize: 9.2, lineHeight: 1.5, color: C.ink }}>{question}</div>
      </div>
    </div>
  </div>
);

const AssistantBubble: React.FC<{
  enter: number;
  text: string;
  streaming: boolean;
  process: number;
  showTool: number;
  showReasoning: number;
  caret: number;
}> = ({ enter, text, streaming, process, showTool, showReasoning, caret }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-start',
      opacity: enter,
      transform: `translateY(${(1 - enter) * 8}px)`,
    }}
  >
    <div
      style={{
        maxWidth: '93%',
        minWidth: 0,
        background: C.white,
        borderRadius: 10,
        borderTopLeftRadius: 4,
        padding: '7px 9px 8px',
        boxShadow: '0 1px 3px rgba(31,35,41,0.07)',
      }}
    >
      <div style={{ fontSize: 9.0, lineHeight: 1.62, color: C.ink }}>
        {text}
        {streaming ? (
          <span
            style={{
              display: 'inline-block',
              width: 3.5,
              height: 8,
              borderRadius: 1,
              background: C.brand,
              marginLeft: 1,
              verticalAlign: '-1px',
              opacity: caret,
            }}
          />
        ) : null}
      </div>
      <div
        style={{
          marginTop: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '2px 7px',
          borderRadius: 999,
          background: C.layer1,
          color: C.muted,
          fontSize: 7.4,
          opacity: process,
          transform: `translateY(${(1 - process) * 3}px)`,
        }}
      >
        <span style={{ fontSize: 6 }}>▸</span>
        过程 · 2
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4, opacity: showTool }}>
        <Chip tone="plain" style={{ fontSize: 6.8, padding: '1.5px 4px' }}>
          执行了命令
        </Chip>
        <Chip tone="plain" style={{ fontSize: 6.8, padding: '1.5px 4px' }}>
          已读取阅读窗口
        </Chip>
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 6.9,
          lineHeight: 1.45,
          color: C.faint,
          opacity: showReasoning,
          transform: `translateY(${(1 - showReasoning) * 3}px)`,
        }}
      >
        <span style={{ color: C.muted }}>思考过程</span> · 先判断这属于哪一类问题，再对照原文。
      </div>
    </div>
  </div>
);

export const ChatPanel: React.FC<{
  width: number;
  userAt: number;
  streamAt: number;
  answer: string;
  processAt: number;
  openLinkAt?: number;
  frame: number;
  attachmentAt?: number;
}> = ({ userAt, streamAt, answer, processAt, openLinkAt = 0, frame, attachmentAt = streamAt - 8 }) => {
  const user = useSpringIn(userAt, { damping: 22, stiffness: 200 });
  const text = typewriter(answer, frame, streamAt, 2.55);
  const streaming = frame >= streamAt && text.length < answer.length;
  const quote = prog(frame, attachmentAt + 4, attachmentAt + 14);
  const figure = prog(frame, attachmentAt, attachmentAt + 10);
  const process = prog(frame, processAt, processAt + 8);
  const showTool = prog(frame, processAt + 8, processAt + 16);
  const showReasoning = prog(frame, processAt + 14, processAt + 24);
  const openLink = prog(frame, openLinkAt, openLinkAt + 10);
  const caret = caretOpacity(frame);
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: C.layer1,
        position: 'relative',
      }}
    >
      {frame < userAt ? <ChatEmpty enter={prog(frame, userAt - 12, userAt)} /> : null}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '10px 9px 14px' }}>
        <UserBubble enter={user} quote={quote} figure={figure} question="它和最终一致性差在哪？" />
        {frame >= streamAt ? (
        <AssistantBubble
          enter={user}
          text={text}
          streaming={streaming}
          process={process}
          showTool={showTool}
          showReasoning={showReasoning}
          caret={caret}
        />
        ) : null}
      </div>
      <div style={{ display: 'none' }}>{openLink}</div>
    </div>
  );
};

export const GuidePanel: React.FC<{
  width: number;
  frame: number;
  start: number;
  mindmapAt: number;
  children: React.ReactNode;
}> = ({ frame, start, mindmapAt, children }) => {
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
        {tabs.map((tab, index) => {
          const on = index === (frame >= mindmapAt ? 1 : 0);
          return (
            <span
              key={tab}
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
              {tab}
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
          {['线性一致性和最终一致性差别在哪？', 'CAP 定理在工程上怎么取舍？'].map((question) => (
            <div key={question} style={{ display: 'flex', gap: 4, fontSize: 8.5, color: C.muted, lineHeight: 1.45 }}>
              <span style={{ color: C.brand }}>·</span>
              {question}
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


import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Backdrop, CaptionBar, Composer, FadeEdges, Stage, TopBar, TopStrip, Window } from '../ui/atoms';
import { Cursor } from '../ui/cursor';
import { Drawer, GuidePanel } from '../ui/drawer';
import { Mindmap } from '../ui/mindmap';
import { H1, H2, P, Page } from '../ui/page';
import { C, FONT } from '../ui/theme';
import { prog, useCursorAt, useSpringIn } from '../ui/motion';

export const GuideMindmap: React.FC = () => {
  const frame = useCurrentFrame();
  const windowIn = useSpringIn(4, { damping: 24, stiffness: 170 });

  const drawerW = 300 * prog(frame, 38, 54) + 110 * prog(frame, 106, 126);
  const contentOpacity = prog(frame, 46, 56);
  const pageW = Math.min(440, 740 - drawerW - 20);
  const scroll = -118 * prog(frame, 168, 188);
  const flash = prog(frame, 176, 188) * (1 - prog(frame, 204, 220));

  const activeNode = frame >= 150 ? 's2' : undefined;

  const cursor = useCursorAt(
    [
      { f: 16, x: 606, y: 72 },
      { f: 34, x: 698, y: 66 },
      { f: 92, x: 520, y: 118 },
      { f: 102, x: 520, y: 118 },
      { f: 140, x: 721, y: 247 },
      { f: 168, x: 721, y: 247 },
      { f: 194, x: 636, y: 410 },
    ],
    [38, 106, 168],
    236,
  );


  return (
    <Stage>
      <Backdrop />
      <TopStrip active={3} />
      <Window enter={windowIn}>
        <TopBar title="示例-分布式系统阅读.md" active={frame >= 38 ? '导读' : undefined} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Page width={pageW}>
            <div style={{ transform: `translateY(${scroll}px)` }}>
              <H1>分布式系统阅读示例</H1>
              <P>这是一份用来试读的示例文档。打开右侧「导读」，生成章节摘要、全书主旨与核心问题。</P>
              <H2>一致性模型</H2>
              <P>
                在分布式系统中，线性一致性是最强的一致性模型之一。它要求所有副本在同一时刻看到同一份历史，就像系统只有一个副本一样。
              </P>
              <div
                style={{
                  background: `rgba(242,201,76,${flash * 0.42})`,
                  borderRadius: 6,
                  boxShadow: flash > 0.05 ? `0 0 0 5px rgba(242,201,76,${flash * 0.18})` : 'none',
                  padding: '2px 0',
                }}
              >
                <H2>CAP 定理</H2>
                <P>
                  CAP 定理指出，一致性（Consistency）、可用性（Availability）和分区容错性（Partition tolerance）三者不可兼得。网络分区一旦发生，系统只能选择一致性或可用性。
                </P>
              </div>
              <H2>一个直觉</H2>
              <P>把线性一致性想成银行只有一个柜台：所有客户的操作按叫号顺序立刻生效，任何窗口查到的余额都一致。</P>
            </div>
          </Page>
          <Drawer width={drawerW} innerWidth={drawerW} title="导读" contentOpacity={contentOpacity}>
            <GuidePanel width={drawerW} frame={frame} start={56} mindmapAt={108}>
              <Mindmap width={drawerW} height={328} start={112} activeId={activeNode} pressAt={168} exportAt={206} />
            </GuidePanel>
          </Drawer>
        </div>
        <Composer height={38} mode="idle" frame={frame} />
      </Window>

      <Cursor state={cursor} opacity={prog(frame, 16, 24) * (1 - prog(frame, 236, 244))} />

      <CaptionBar
        step="03"
        phases={[
          { from: 0, text: '打开右侧「导读」：先拿到章节摘要与全书主旨' },
          { from: 54, text: '段 → 篇 → 全书，分层归约；长书有进度、可停止' },
          { from: 110, text: '切到「导图」：书 → 篇 → 节，一张图' },
          { from: 170, text: '点任意节点，直接跳回原文位置' },
          { from: 212, text: '导图可折叠、缩放，导出 SVG / PNG / Markdown' },
          { from: 232, text: '长书导读 · 先看全局，再读细节' },
        ]}
      />
      <FadeEdges />
    </Stage>
  );
};

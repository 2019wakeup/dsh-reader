import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Backdrop, CaptionBar, Composer, FadeEdges, Stage, TopBar, TopStrip, Window } from '../ui/atoms';
import { Cursor } from '../ui/cursor';
import { Drawer, GuidePanel } from '../ui/drawer';
import { Mindmap } from '../ui/mindmap';
import { H1, H2, P, Page } from '../ui/page';
import { Camera, GroundShadow, Layer, Vignette, type CameraKey } from '../ui/camera';
import { C } from '../ui/theme';
import { prog, useCursorAt, useSpringIn } from '../ui/motion';

const CAMERA: CameraKey[] = [
  { f: 0, fx: 400, fy: 270, zoom: 0.965, rx: 3.2, ry: -7.2 },
  { f: 24, fx: 400, fy: 270, zoom: 1.0, rx: 0, ry: 0 },
  { f: 34, fx: 400, fy: 270, zoom: 1.0, rx: 0, ry: 0 },
  { f: 46, fx: 480, fy: 250, zoom: 1.05, rx: 0.3, ry: -0.3 },
  { f: 66, fx: 480, fy: 250, zoom: 1.05, rx: 0, ry: 0 },
  { f: 90, fx: 480, fy: 250, zoom: 1.05, rx: 0, ry: 0 },
  { f: 108, fx: 480, fy: 240, zoom: 1.06, rx: 1.6, ry: -1.6 },
  { f: 144, fx: 480, fy: 240, zoom: 1.06, rx: 0, ry: 0 },
  { f: 190, fx: 480, fy: 240, zoom: 1.06, rx: 0, ry: 0 },
  { f: 206, fx: 400, fy: 300, zoom: 1.03, rx: 0.2, ry: 0 },
  { f: 220, fx: 400, fy: 300, zoom: 1.03, rx: 0, ry: 0 },
  { f: 250, fx: 400, fy: 270, zoom: 1.0, rx: 1.6, ry: -3 },
  { f: 282, fx: 400, fy: 270, zoom: 0.98, rx: 2.4, ry: -5 },
  { f: 300, fx: 400, fy: 270, zoom: 0.98, rx: 2.4, ry: -5 },
];

export const GuideMindmap: React.FC = () => {
  const frame = useCurrentFrame();
  const chromeOpacity = Math.max(0, Math.min(1, 1 - prog(frame, 46, 60) + prog(frame, 248, 268)));
  const windowIn = useSpringIn(4, { damping: 24, stiffness: 170 });

  const drawerW = 300 * prog(frame, 30, 46) + 120 * prog(frame, 72, 92);
  const contentOpacity = prog(frame, 38, 50);
  const pageW = Math.min(440, 740 - drawerW - 20);
  const scroll = -118 * prog(frame, 198, 216);
  const flash = prog(frame, 206, 218) * (1 - prog(frame, 232, 246));

  const activeNode = frame >= 190 ? 'c2' : undefined;

  const cursor = useCursorAt(
    [
      { f: 16, x: 606, y: 72 },
      { f: 30, x: 718, y: 66 },
      { f: 84, x: 405, y: 121 },
      { f: 96, x: 405, y: 121 },
      { f: 150, x: 680, y: 280 },
      { f: 190, x: 680, y: 280 },
      { f: 214, x: 636, y: 410 },
    ],
    [34, 90, 190],
    246,
  );

  return (
    <Stage>
      <Camera keys={CAMERA}>
        <Layer depth={-200} style={{ transform: 'translateZ(-200px) scale(1.35)' }}>
          <Backdrop />
        </Layer>
        <GroundShadow />
        <Layer depth={0}>
          <Window enter={windowIn}>
            <TopBar title="示例-分布式系统阅读.md" active={frame >= 30 ? '导读' : undefined} />
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
              <Drawer
                width={drawerW}
                innerWidth={drawerW}
                title="导读"
                subtitle={frame >= 72 ? '导图 · 书 → 篇 → 节' : ''}
                contentOpacity={contentOpacity}
              >
                <GuidePanel width={drawerW} frame={frame} start={56} mindmapAt={82}>
                  <Mindmap width={drawerW} height={328} start={88} activeId={activeNode} pressAt={190} exportAt={238} />
                </GuidePanel>
              </Drawer>
            </div>
            <Composer height={38} mode="idle" frame={frame} />
          </Window>
        </Layer>
        <Layer depth={115}>
          <Cursor state={cursor} opacity={prog(frame, 16, 24) * (1 - prog(frame, 236, 244))} />
        </Layer>
      </Camera>

      <Vignette />
      <TopStrip active={3} opacity={chromeOpacity} />
      <CaptionBar
        step="03"
        phases={[
          { from: 0, text: '打开右侧「导读」：先拿到章节摘要与全书主旨' },
          { from: 54, text: '段 → 篇 → 全书，分层归约；长书有进度、可停止' },
          { from: 104, text: '切到「导图」：书 → 篇 → 节，分块节点各有要点' },
          { from: 166, text: '点任意节点，直接跳回原文位置' },
          { from: 224, text: '导图可折叠、缩放，导出 SVG / PNG / Markdown' },
          { from: 262, text: '长书导读 · 先看全局，再读细节' },
        ]}
      />
      <FadeEdges />
    </Stage>
  );
};

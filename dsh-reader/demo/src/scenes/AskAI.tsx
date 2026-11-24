import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Backdrop, CaptionBar, Composer, FadeEdges, Stage, TopBar, TopStrip, Window } from '../ui/atoms';
import { Cursor } from '../ui/cursor';
import { ChatHeaderActions, ChatPanel, Drawer } from '../ui/drawer';
import { MiniToolbar } from '../ui/toolbar';
import { H1, H2, P, Page, Sel, Term } from '../ui/page';
import { ReplicaFigure } from '../ui/figure';
import { Camera, GroundShadow, Layer, Vignette, type CameraKey } from '../ui/camera';
import { prog, typewriter, useCursorAt, useSpringIn } from '../ui/motion';

const PAGE_W = 420;
const DRAWER_W = 320;
const ANSWER =
  '核心差别在有没有中间窗口：线性一致性要求所有副本按实时顺序生效，读到的永远是最新值；最终一致性允许短暂读到旧值，只保证没有新写入后最终收敛。工程上账务、库存这类要走强一致，点赞、计数可以最终一致。';
const QUESTION = '它和最终一致性差在哪？';

const CAMERA: CameraKey[] = [
  { f: 0, fx: 400, fy: 270, zoom: 0.965, rx: 3.2, ry: -7.2 },
  { f: 24, fx: 400, fy: 270, zoom: 1.0, rx: 0, ry: 0 },
  { f: 70, fx: 400, fy: 270, zoom: 1.0, rx: 0, ry: 0 },
  { f: 86, fx: 480, fy: 300, zoom: 1.08, rx: 0.4, ry: -0.4 },
  { f: 112, fx: 480, fy: 300, zoom: 1.08, rx: 0, ry: 0 },
  { f: 200, fx: 480, fy: 300, zoom: 1.08, rx: 0, ry: 0 },
  { f: 240, fx: 400, fy: 270, zoom: 1.01, rx: 1.6, ry: -2.8 },
  { f: 280, fx: 400, fy: 270, zoom: 0.98, rx: 2.2, ry: -4.6 },
  { f: 300, fx: 400, fy: 270, zoom: 0.98, rx: 2.2, ry: -4.6 },
];

export const AskAI: React.FC = () => {
  const frame = useCurrentFrame();
  const chromeOpacity = Math.max(0, Math.min(1, 1 - prog(frame, 82, 98) + prog(frame, 238, 256)));

  const windowIn = useSpringIn(4, { damping: 24, stiffness: 170 });
  const selection = prog(frame, 36, 52) * (1 - prog(frame, 84, 96));
  const figureSelection = prog(frame, 38, 54) * (1 - prog(frame, 84, 96));

  const tbIn = useSpringIn(52, { damping: 18, stiffness: 240 });
  const toolbar = tbIn * (1 - prog(frame, 70, 78));

  const drawerW = DRAWER_W * prog(frame, 82, 104);
  const composerH = 38 + 48 * prog(frame, 78, 96) - 48 * prog(frame, 124, 140);
  const quoteIn = prog(frame, 82, 94);
  const typed = typewriter(QUESTION, frame, 96, 1.2);
  const typing = frame >= 96 && frame < 114;
  const sent = frame >= 122;
  const contentOpacity = prog(frame, 96, 118);
  const openLink = prog(frame, 178, 190);

  const cursor = useCursorAt(
    [
      { f: 20, x: 620, y: 404 },
      { f: 36, x: 186, y: 318 },
      { f: 52, x: 410, y: 318 },
      { f: 64, x: 208, y: 258 },
      { f: 84, x: 208, y: 258 },
      { f: 100, x: 566, y: 472 },
      { f: 118, x: 735, y: 486 },
      { f: 170, x: 520, y: 180 },
    ],
    [66, 100],
    200,
  );
  const pressed = cursor.pressed || (frame >= 36 && frame < 52);

  return (
    <Stage>
      <Camera keys={CAMERA}>
        <Layer depth={-200} style={{ transform: 'translateZ(-200px) scale(1.35)' }}>
          <Backdrop />
        </Layer>
        <GroundShadow />
        <Layer depth={0}>
          <Window enter={windowIn}>
            <TopBar title="示例-分布式系统阅读.md" active={frame >= 84 ? '对话' : undefined} />
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <Page width={PAGE_W}>
                <H1>分布式系统阅读示例</H1>
                <P>这是一份用来试读的示例文档。选中下面任意一段，点「问 AI」，引用、图形和问题会一起进入同一个会话。</P>
                <H2>一致性模型</H2>
                <P>
                  在分布式系统中，
                  <Term show={prog(frame, 100, 112)}>线性一致性</Term>
                  是最强的一致性模型之一。它要求所有副本在同一时刻看到同一份历史。
                </P>
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <P style={{ flex: 1, marginRight: 0 }}>
                    <Sel p={selection}>把线性一致性想成银行只有一个柜台</Sel>：所有客户的操作按叫号顺序立刻生效，任何窗口查到的余额都一致。
                  </P>
                  <ReplicaFigure width={146} height={76} selection={figureSelection} />
                </div>
                <H2>CAP 定理</H2>
                <P>CAP 定理指出，一致性、可用性和分区容错性三者不可兼得。</P>
              </Page>
              <Drawer
                width={drawerW}
                innerWidth={DRAWER_W}
                title="对话"
                subtitle="与当前会话同步"
                actions={<ChatHeaderActions openLink={openLink} />}
                contentOpacity={contentOpacity}
              >
                <ChatPanel
                  width={DRAWER_W}
                  frame={frame}
                  userAt={116}
                  streamAt={126}
                  answer={ANSWER}
                  processAt={188}
                  openLinkAt={178}
                  attachmentAt={112}
                />
              </Drawer>
            </div>
            <Composer
              height={composerH}
              mode={sent ? 'idle' : 'quoted'}
              frame={frame}
              typed={sent ? '' : typed}
              typing={typing && !sent}
              quoteEnter={quoteIn}
              placeholder="继续追问，或选中正文再引用…"
              attachment={!sent ? { label: '图 1 · 线性一致性' } : null}
              quote={{
                source: '《示例-分布式系统阅读》· 一致性模型 · 第 3 段',
                text: '把线性一致性想成银行只有一个柜台：所有客户的操作按叫号顺序立刻生效…',
              }}
            />
          </Window>
        </Layer>

        <Layer depth={75}>
          <MiniToolbar
            x={180}
            y={246}
            enter={toolbar}
            frame={frame}
            pressed={frame >= 68 && frame < 74 ? '问 AI' : undefined}
            hover={frame >= 60 && frame < 68 ? '问 AI' : undefined}
          />
        </Layer>

        <Layer depth={115}>
          <Cursor state={{ ...cursor, pressed }} opacity={prog(frame, 20, 28) * (1 - prog(frame, 196, 204))} />
        </Layer>
      </Camera>

      <Vignette />
      <TopStrip active={2} opacity={chromeOpacity} />
      <CaptionBar
        step="02"
        phases={[
          { from: 0, text: '选中正文里的一段话，含一张小图' },
          { from: 52, text: '点「问 AI」：引用与图形一起进入输入框' },
          { from: 96, text: '补一句问题，回车发送' },
          { from: 128, text: '回答在右侧气泡里流式出现' },
          { from: 188, text: '工具步骤折叠成「过程」，同一个会话接着追问' },
          { from: 238, text: '边读边问 · 不用离开书页' },
        ]}
      />
      <FadeEdges />
    </Stage>
  );
};

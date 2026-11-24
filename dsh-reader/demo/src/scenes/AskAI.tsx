import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Backdrop, CaptionBar, Composer, FadeEdges, Stage, TopBar, TopStrip, Window } from '../ui/atoms';
import { Cursor } from '../ui/cursor';
import { MiniToolbar } from '../ui/toolbar';
import { ChatPanel, Drawer } from '../ui/drawer';
import { H1, H2, P, Page, Sel } from '../ui/page';
import { C } from '../ui/theme';
import { prog, typewriter, useCursorAt, useSpringIn } from '../ui/motion';

const PAGE_W = 440;
const ANSWER =
  '核心差别在有没有中间窗口：线性一致性要求所有副本按实时顺序生效，读到的永远是最新值；最终一致性允许短暂读到旧值，只保证没有新写入后最终收敛。工程上账务、库存这类要走强一致，点赞、计数可以最终一致。';
const QUESTION = '它和最终一致性差在哪？';

export const AskAI: React.FC = () => {
  const frame = useCurrentFrame();

  const windowIn = useSpringIn(4, { damping: 24, stiffness: 170 });
  const selection = prog(frame, 40, 58) * (1 - prog(frame, 78, 88));

  const tbIn = useSpringIn(60, { damping: 18, stiffness: 240 });
  const toolbar = tbIn * (1 - prog(frame, 74, 82));

  const drawerW = 272 * prog(frame, 82, 102);
  const composerH = 38 + 34 * prog(frame, 86, 104) - 34 * prog(frame, 118, 132);
  const quoteIn = prog(frame, 88, 98);
  const typed = typewriter(QUESTION, frame, 98, 1.1);
  const typing = frame >= 98 && frame < 114;
  const sent = frame >= 118;

  const cursor = useCursorAt(
    [
      { f: 22, x: 618, y: 402 },
      { f: 40, x: 186, y: 328 },
      { f: 58, x: 424, y: 328 },
      { f: 70, x: 206, y: 263 },
      { f: 90, x: 206, y: 263 },
      { f: 106, x: 600, y: 479 },
      { f: 120, x: 660, y: 470 },
    ],
    [72, 100],
    200,
  );
  const pressed = cursor.pressed || (frame >= 40 && frame < 58);

  return (
    <Stage>
      <Backdrop />
      <TopStrip active={2} />
      <Window enter={windowIn}>
        <TopBar title="示例-分布式系统阅读.md" active={frame >= 84 ? '对话' : undefined} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Page width={PAGE_W}>
            <H1>分布式系统阅读示例</H1>
            <P>
              这是一份用来试读的示例文档。选中下面任意一段，点「问 AI」，原文会带着书名、章节和位置进入底部输入框。
            </P>
            <H2>一致性模型</H2>
            <P>
              在分布式系统中，线性一致性是最强的一致性模型之一。它要求所有副本在同一时刻看到同一份历史。
            </P>
            <P>
              <Sel p={selection}>把线性一致性想成银行只有一个柜台</Sel>：所有客户的操作按叫号顺序立刻生效，任何窗口查到的余额都一致。最终一致性则像多个窗口各自记账，过一会儿再对账。
            </P>
            <H2>CAP 定理</H2>
            <P>CAP 定理指出，一致性、可用性和分区容错性三者不可兼得。</P>
          </Page>
          <Drawer width={drawerW} innerWidth={272} title="对话" contentOpacity={prog(drawerW, 90, 200)}>
            <ChatPanel
              width={272}
              frame={frame}
              userAt={116}
              streamAt={122}
              answer={ANSWER}
              processAt={174}
              openLinkAt={168}
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
          quote={{
            source: '《示例-分布式系统阅读.md》· 一致性模型 · 第 3 段',
            text: '把线性一致性想成银行只有一个柜台：所有客户的操作按叫号顺序立刻生效…',
          }}
        />
      </Window>

      <MiniToolbar
        x={180}
        y={250}
        enter={toolbar}
        frame={frame}
        pressed={frame >= 72 && frame < 78 ? '问 AI' : undefined}
        hover={frame >= 64 && frame < 72 ? '问 AI' : undefined}
      />

      <Cursor state={{ ...cursor, pressed }} opacity={prog(frame, 22, 30) * (1 - prog(frame, 196, 204))} />

      <CaptionBar
        step="02"
        phases={[
          { from: 0, text: '选中正文里的一段话' },
          { from: 60, text: '点「问 AI」：引用带书名、章节和位置进输入框' },
          { from: 98, text: '补一句问题，回车发送' },
          { from: 122, text: '回答逐字流进右侧「对话」页签' },
          { from: 166, text: '工具步骤折叠成「过程」，同一个会话接着追问' },
          { from: 190, text: '边读边问 · 不用离开书页' },
        ]}
      />
      <FadeEdges />
    </Stage>
  );
};

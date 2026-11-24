import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop, CaptionBar, Composer, FadeEdges, Stage, TopBar, TopStrip, Window } from '../ui/atoms';
import { BusyPill, Cursor } from '../ui/cursor';
import { ConceptCard } from '../ui/concept-card';
import { MiniToolbar } from '../ui/toolbar';
import { H1, H2, P, Page, Term } from '../ui/page';
import { C } from '../ui/theme';
import { prog, useCursorAt, useSpringIn } from '../ui/motion';

const PAGE_W = 440;

export const SelectExplain: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const windowIn = useSpringIn(4, { damping: 24, stiffness: 170 });
  const selection = prog(frame, 50, 64) * (1 - prog(frame, 112, 124));
  const showTerm1 = prog(frame, 126, 138);
  const showTerm2 = prog(frame, 134, 146);

  const tbIn = useSpringIn(66, { damping: 18, stiffness: 240 });
  const tbOut = prog(frame, 87, 95);
  const toolbar = tbIn * (1 - tbOut);

  const busy = prog(frame, 91, 99) * (1 - prog(frame, 104, 111));
  const cardStart = 104;

  const cursor = useCursorAt(
    [
      { f: 28, x: 636, y: 408 },
      { f: 48, x: 293, y: 273 },
      { f: 62, x: 370, y: 273 },
      { f: 76, x: 312, y: 241 },
      { f: 90, x: 312, y: 241 },
      { f: 118, x: 500, y: 350 },
      { f: 158, x: 300, y: 333 },
      { f: 188, x: 300, y: 333 },
    ],
    [84],
    206,
  );
  const pressed = cursor.pressed || (frame >= 50 && frame < 64);

  const hoverPill = prog(frame, 154, 164) * (1 - prog(frame, 190, 198));
  const preview = prog(frame, 158, 170);

  return (
    <Stage>
      <Backdrop />
      <TopStrip active={1} />
      <Window enter={windowIn}>
        <TopBar title="示例-分布式系统阅读.md" />
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Page width={PAGE_W}>
            <H1>分布式系统阅读示例</H1>
            <P>
              这是一份用来试读的示例文档。打开顶部「阅读」视图，选中下面任意一个词，点「解释」，之后回到正文把鼠标停在同一个词上，概念卡会原地浮出。
            </P>
            <H2>一致性模型</H2>
            <P>
              在分布式系统中，
              <Term show={showTerm1} selection={selection}>
                线性一致性
              </Term>
              是最强的一致性模型之一。它要求所有副本在同一时刻看到同一份历史，就像系统只有一个副本一样。
            </P>
            <P>
              与之相对的是
              <Term show={showTerm2}>最终一致性</Term>：系统不保证立刻一致，但只要没有新的写入，副本最终会收敛到同一个值。
            </P>
            <H2>CAP 定理</H2>
            <P>CAP 定理指出，一致性（Consistency）、可用性（Availability）和分区容错性（Partition tolerance）三者不可兼得。</P>
          </Page>
        </div>
        <Composer height={38} mode="idle" frame={frame} />
      </Window>

      <MiniToolbar x={207} y={232} enter={toolbar} frame={frame} pressed={frame >= 84 && frame < 90 ? '解释' : undefined} hover={frame >= 76 && frame < 84 ? '解释' : undefined} />

      <BusyPill x={286} y={246} enter={busy} label="正在解释…" frame={frame} />

      <ConceptCard x={384} y={142} start={cardStart} savedAt={128} exitAt={136} />

      <div
        style={{
          position: 'absolute',
          left: 352,
          top: 284,
          width: 208,
          zIndex: 60,
          background: 'rgba(255,255,255,0.985)',
          border: `1px solid ${C.border}`,
          borderRadius: 9,
          boxShadow: '0 14px 34px rgba(15,18,23,0.18)',
          padding: '7px 9px 8px',
          opacity: preview,
          transform: `translateY(${(1 - preview) * 8}px) scale(${0.96 + preview * 0.04})`,
          transformOrigin: '10% 0%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>最终一致性</span>
          <span style={{ fontSize: 6.8, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1.5px 4px' }}>
            已归档
          </span>
        </div>
        <div style={{ fontSize: 9.5, lineHeight: 1.55, color: C.ink2, marginTop: 3 }}>
          不保证立刻一致；没有新写入后，副本最终会收敛到同一个值。
        </div>
        <div style={{ fontSize: 7, color: C.faint, marginTop: 4 }}>悬停 150ms 浮出 · 点击打开完整卡片</div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 206,
          top: 300,
          zIndex: 68,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          height: 22,
          padding: '0 8px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.97)',
          border: `1px solid ${C.border}`,
          boxShadow: '0 5px 14px rgba(31,35,41,0.12)',
          opacity: hoverPill,
          transform: `translateY(${(1 - hoverPill) * 4}px)`,
          fontSize: 8.5,
          color: C.ink2,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green }} />
        已收录 · 悬停即可再看
      </div>

      <Cursor state={{ ...cursor, pressed }} opacity={prog(frame, 28, 36) * (1 - prog(frame, 202, 208))} />
      <CaptionBar
        step="01"
        phases={[
          { from: 0, text: '选中正文里的任意一个词' },
          { from: 66, text: '点「解释」，模型就地生成概念卡' },
          { from: 104, text: '定义、直觉、本书语境与例子，一次给全' },
          { from: 150, text: '已自动归档；之后悬停同一术语即可再看' },
          { from: 196, text: '划词即解释 · 概念随读随存' },
        ]}
      />
      <FadeEdges />
    </Stage>
  );
};

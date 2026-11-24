import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Backdrop, CaptionBar, Composer, FadeEdges, Stage, TopBar, TopStrip, Window } from '../ui/atoms';
import { BusyPill, Cursor } from '../ui/cursor';
import { ConceptCard } from '../ui/concept-card';
import { MiniToolbar } from '../ui/toolbar';
import { H1, H2, P, Page, Term } from '../ui/page';
import { Camera, GroundShadow, Layer, Vignette, type CameraKey } from '../ui/camera';
import { C } from '../ui/theme';
import { prog, useCursorAt, useSpringIn } from '../ui/motion';

const PAGE_W = 440;

const CAMERA: CameraKey[] = [
  { f: 0, fx: 400, fy: 270, zoom: 0.965, rx: 3.4, ry: -7.2 },
  { f: 24, fx: 400, fy: 270, zoom: 1.0, rx: 0, ry: 0 },
  { f: 82, fx: 400, fy: 270, zoom: 1.0, rx: 0, ry: 0 },
  { f: 100, fx: 480, fy: 300, zoom: 1.14, rx: 0.4, ry: -0.6 },
  { f: 124, fx: 480, fy: 300, zoom: 1.14, rx: 0, ry: 0 },
  { f: 190, fx: 480, fy: 300, zoom: 1.14, rx: 0, ry: 0 },
  { f: 226, fx: 400, fy: 270, zoom: 1.01, rx: 1.2, ry: -2.4 },
  { f: 258, fx: 400, fy: 270, zoom: 0.98, rx: 2.4, ry: -5.2 },
  { f: 270, fx: 400, fy: 270, zoom: 0.98, rx: 2.4, ry: -5.2 },
];

export const SelectExplain: React.FC = () => {
  const frame = useCurrentFrame();
  const chromeOpacity = Math.max(0, Math.min(1, 1 - prog(frame, 90, 108) + prog(frame, 226, 246)));

  const windowIn = useSpringIn(4, { damping: 24, stiffness: 170 });
  const selection = prog(frame, 44, 60) * (1 - prog(frame, 112, 124));
  const showTerm1 = prog(frame, 126, 138);
  const showTerm2 = prog(frame, 134, 146);

  const tbIn = useSpringIn(64, { damping: 18, stiffness: 240 });
  const tbOut = prog(frame, 86, 94);
  const toolbar = tbIn * (1 - tbOut);

  const busy = prog(frame, 90, 98) * (1 - prog(frame, 104, 111));
  const cardStart = 100;

  const cursor = useCursorAt(
    [
      { f: 26, x: 636, y: 408 },
      { f: 44, x: 293, y: 273 },
      { f: 58, x: 370, y: 273 },
      { f: 74, x: 312, y: 241 },
      { f: 88, x: 312, y: 241 },
      { f: 116, x: 500, y: 350 },
      { f: 154, x: 300, y: 333 },
      { f: 184, x: 300, y: 333 },
    ],
    [82],
    206,
  );
  const pressed = cursor.pressed || (frame >= 44 && frame < 60);

  const hoverPill = prog(frame, 150, 160) * (1 - prog(frame, 190, 198));
  const preview = prog(frame, 154, 166);

  return (
    <Stage>
      <Camera keys={CAMERA}>
        <Layer depth={-200} style={{ transform: 'translateZ(-200px) scale(1.35)' }}>
          <Backdrop />
        </Layer>
        <GroundShadow />
        <Layer depth={0}>
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
        </Layer>

        <Layer depth={75}>
          <MiniToolbar
            x={207}
            y={232}
            enter={toolbar}
            frame={frame}
            pressed={frame >= 82 && frame < 88 ? '解释' : undefined}
            hover={frame >= 74 && frame < 82 ? '解释' : undefined}
          />
        </Layer>
        <Layer depth={90}>
          <BusyPill x={286} y={246} enter={busy} label="正在解释…" frame={frame} />
        </Layer>
        <Layer depth={100}>
          <ConceptCard x={384} y={142} start={cardStart} savedAt={128} exitAt={146} />
        </Layer>

        <Layer depth={85}>
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
        </Layer>

        <Layer depth={88}>
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
        </Layer>

        <Layer depth={115}>
          <Cursor state={{ ...cursor, pressed }} opacity={prog(frame, 26, 34) * (1 - prog(frame, 202, 208))} />
        </Layer>
      </Camera>

      <Vignette />
      <TopStrip active={1} opacity={chromeOpacity} />
      <CaptionBar
        step="01"
        phases={[
          { from: 0, text: '选中正文里的任意一个词' },
          { from: 64, text: '点「解释」，模型就地生成概念卡' },
          { from: 100, text: '定义、直觉、本书语境与例子，一次给全' },
          { from: 148, text: '已自动归档；之后悬停同一术语即可再看' },
          { from: 198, text: '划词即解释 · 概念随读随存' },
        ]}
      />
      <FadeEdges />
    </Stage>
  );
};

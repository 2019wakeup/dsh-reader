import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Backdrop, CaptionBar, Composer, FadeEdges, Stage, TopBar, TopStrip, Window } from '../ui/atoms';
import { BusyPill, Cursor } from '../ui/cursor';
import { ChildConceptCard, ConceptCard } from '../ui/concept-card';
import { MiniToolbar } from '../ui/toolbar';
import { H1, H2, P, Page, Term } from '../ui/page';
import { Camera, GroundShadow, Layer, Vignette, type CameraKey } from '../ui/camera';
import { C } from '../ui/theme';
import { caretOpacity, prog, typewriter, useCursorAt, useSpringIn } from '../ui/motion';

const PAGE_W = 440;
const FQ = '它和最终一致性差在哪？';

const CAMERA: CameraKey[] = [
  { f: 0, fx: 400, fy: 270, zoom: 0.965, rx: 3.4, ry: -7.2 },
  { f: 24, fx: 400, fy: 270, zoom: 1.0, rx: 0, ry: 0 },
  { f: 82, fx: 400, fy: 270, zoom: 1.0, rx: 0, ry: 0 },
  { f: 100, fx: 480, fy: 300, zoom: 1.14, rx: 0.4, ry: -0.6 },
  { f: 124, fx: 480, fy: 300, zoom: 1.14, rx: 0, ry: 0 },
  { f: 330, fx: 480, fy: 300, zoom: 1.14, rx: 0, ry: 0 },
  { f: 385, fx: 480, fy: 300, zoom: 1.14, rx: 0, ry: 0 },
  { f: 410, fx: 400, fy: 270, zoom: 1.01, rx: 1.2, ry: -2.4 },
  { f: 420, fx: 400, fy: 270, zoom: 0.98, rx: 2.4, ry: -5.2 },
];

export const SelectExplain: React.FC = () => {
  const frame = useCurrentFrame();
  const chromeOpacity = Math.max(0, Math.min(1, 1 - prog(frame, 90, 108) + prog(frame, 400, 415)));

  const windowIn = useSpringIn(4, { damping: 24, stiffness: 170 });
  const selection = prog(frame, 44, 60) * (1 - prog(frame, 112, 124));
  const showTerm1 = prog(frame, 126, 138);
  const showTerm2 = prog(frame, 134, 146);

  const tbIn = useSpringIn(64, { damping: 18, stiffness: 240 });
  const tbOut = prog(frame, 86, 94);
  const toolbar = tbIn * (1 - tbOut);

  const busy = prog(frame, 90, 98) * (1 - prog(frame, 104, 111));
  const cardStart = 100;

  const followTyped = frame < 190 ? typewriter(FQ, frame, 158, 1.05) : '';
  const followSent = frame >= 190;
  const followBusy = frame >= 190 && frame < 212;
  const followReveal = prog(frame, 212, 226);
  const followActive = prog(frame, 150, 158) * (1 - prog(frame, 190, 198));
  const childMenu = prog(frame, 272, 282) * (1 - prog(frame, 300, 308));
  const parentDim = prog(frame, 300, 310);
  const highlightTerm = prog(frame, 250, 264);
  const selecting = frame >= 250 && frame < 266;

  const cursor = useCursorAt(
    [
      { f: 26, x: 636, y: 408 },
      { f: 44, x: 293, y: 273 },
      { f: 58, x: 370, y: 273 },
      { f: 74, x: 312, y: 241 },
      { f: 88, x: 312, y: 241 },
      { f: 116, x: 500, y: 350 },
      { f: 150, x: 500, y: 405 },
      { f: 160, x: 500, y: 405 },
      { f: 188, x: 650, y: 405 },
      { f: 240, x: 650, y: 405 },
      { f: 250, x: 500, y: 363 },
      { f: 264, x: 575, y: 363 },
      { f: 272, x: 575, y: 363 },
      { f: 285, x: 560, y: 374 },
      { f: 300, x: 560, y: 374 },
      { f: 335, x: 600, y: 340 },
    ],
    [82, 160, 190, 300],
    340,
  );
  const pressed = cursor.pressed || selecting || (frame >= 44 && frame < 60);

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
          <ConceptCard
            x={384}
            y={142}
            start={cardStart}
            savedAt={128}
            exitAt={400}
            shiftX={parentDim * -12}
            shiftY={parentDim * -12}
            dim={parentDim}
            followUp={{
              typed: followTyped,
              typing: frame >= 158 && frame < 190,
              sent: followSent,
              busy: followBusy,
              answerReveal: followReveal,
              active: followActive,
              question: FQ,
              caret: caretOpacity(frame),
              highlightTerm,
            }}
          />
        </Layer>

        <Layer depth={105} style={{ zIndex: 90 }}>
          <div
            style={{
              position: 'absolute',
              left: 500,
              top: 362,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 6px',
              borderRadius: 7,
              background: 'rgba(255,255,255,0.98)',
              border: `1px solid ${C.border}`,
              boxShadow: '0 8px 22px rgba(31,35,41,0.16)',
              opacity: childMenu,
              transform: `translateY(${(1 - childMenu) * 4}px)`,
              fontSize: 8.5,
              color: C.ink2,
              whiteSpace: 'nowrap',
            }}
          >
            <span>最终一致性</span>
            <span style={{ color: C.brand, background: C.brandSoft, border: `1px solid ${C.brandLine}`, borderRadius: 4, padding: '2px 4px', fontSize: 7.5 }}>再解释</span>
          </div>
        </Layer>
        <Layer depth={100}>
          <ChildConceptCard x={384} y={142} start={310} exitAt={400} />
        </Layer>
        <Layer depth={115} style={{ zIndex: 120 }}>
          <Cursor state={{ ...cursor, pressed }} opacity={prog(frame, 26, 34) * (1 - prog(frame, 410, 422))} />
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
          { from: 140, text: '在卡片里直接追问：不用离开书页' },
          { from: 190, text: '回答留在同一张悬浮卡里，形成卡内对话' },
          { from: 230, text: '拖动选中回答里的「最终一致性」' },
          { from: 272, text: '点「再解释」' },
          { from: 310, text: '第 2 层子卡从概念本身展开' },
          { from: 350, text: '父子卡层叠 · 父卡上移 12px' },
        ]}
      />
      <FadeEdges />
    </Stage>
  );
};

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ART, C, CAPTION_H, CAPTION_Y, COMPOSER_H, FONT, MONO, SHADOW, TOPBAR_H, WIN } from './theme';
import { caretOpacity, lerp, prog } from './motion';
import { ReplicaFigure } from './figure';
import { useVideoConfig } from 'remotion';
import { useCurrentFrame } from 'remotion';

/** The whole scene is authored on an 800x540 artboard and scaled 2x. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: C.paper }}>
    <div
      style={{
        position: 'relative',
        width: ART.w,
        height: ART.h,
        transform: 'scale(2)',
        transformOrigin: 'top left',
        overflow: 'hidden',
        fontFamily: FONT,
        color: C.ink,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

export const BrandMark: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.22,
      background: C.brand,
      flex: '0 0 auto',
      position: 'relative',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
    }}
  >
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
      <path d="M18 16h11a5 5 0 0 1 5 5v27a4 4 0 0 0-4-4H18z" fill="#fff" opacity="0.95" />
      <path d="M46 16H35a5 5 0 0 0-5 5v27a4 4 0 0 1 4-4h12z" fill="#fff" opacity="0.75" />
      <circle cx="46" cy="44" r="9" fill="#f2c94c" />
      <path
        d="M42.5 44l2.4 2.4 4.6-5"
        stroke="#1f3b66"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

export const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(820px 440px at 84% -10%, #fff7e2 0%, rgba(255,247,226,0) 62%), ' +
        'radial-gradient(760px 480px at -8% 114%, #e6efff 0%, rgba(230,239,255,0) 58%), ' +
        'linear-gradient(138deg, #f8f4eb 0%, #f1ebdf 52%, #eae2d2 100%)',
    }}
  >
    <div
      style={{
        position: 'absolute',
        right: 70,
        top: 74,
        width: 190,
        height: 190,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(242,201,76,0.18) 0%, rgba(242,201,76,0) 70%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: -40,
        bottom: 30,
        width: 220,
        height: 220,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(31,111,235,0.10) 0%, rgba(31,111,235,0) 70%)',
      }}
    />
  </AbsoluteFill>
);

const STEPS = ['划词解释', '边读边问', '长书导读'];

export const TopStrip: React.FC<{ active: number; opacity?: number }> = ({ active, opacity = 1 }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: ART.w,
      height: WIN.y,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 30px',
      boxSizing: 'border-box',
      opacity,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <BrandMark size={19} />
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>砚读</span>
      <span style={{ fontSize: 10, color: C.muted, letterSpacing: 0.4 }}>· DSH 阅读插件</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {STEPS.map((label, i) => {
        const on = i + 1 === active;
        return (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 20,
              padding: '0 8px',
              borderRadius: 999,
              border: `1px solid ${on ? 'transparent' : 'rgba(31,35,41,0.10)'}`,
              background: on ? C.ink : 'rgba(255,255,255,0.55)',
              color: on ? '#fff' : C.muted,
              fontSize: 9,
              letterSpacing: 0.2,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 8, opacity: on ? 0.72 : 0.62 }}>
              0{i + 1}
            </span>
            {label}
          </div>
        );
      })}
    </div>
  </div>
);

/** Window chrome around the reader. `enter` is a 0..1 intro progress. */
export const Window: React.FC<{ enter: number; children: React.ReactNode }> = ({ enter, children }) => (
  <div
    style={{
      position: 'absolute',
      left: WIN.x,
      top: WIN.y,
      width: WIN.w,
      height: WIN.h,
      borderRadius: 14,
      background: C.white,
      border: '1px solid rgba(31,35,41,0.09)',
      boxShadow: SHADOW,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      opacity: enter,
      transform: `translateY(${(1 - enter) * 16}px) scale(${0.985 + enter * 0.015})`,
    }}
  >
    {children}
  </div>
);

const Icon: React.FC<{ d: string; size?: number; style?: React.CSSProperties }> = ({ d, size = 10, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', ...style }}>
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICONS = {
  back: 'M10 3 5 8l5 5',
  undo: 'M6 3 3 6l3 3M3 6h6.2a3.8 3.8 0 0 1 0 7.6H7',
  redo: 'M10 3l3 3-3 3M13 6H6.8a3.8 3.8 0 0 0 0 7.6H9',
  search: 'M7 2.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2zM10.6 10.6 14 14',
  gear: 'M8 5.6A2.4 2.4 0 1 0 8 10.4 2.4 2.4 0 0 0 8 5.6zM8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1',
  plus: 'M8 3v10M3 8h10',
  send: 'M3 8h9M8.5 3.5 13 8l-4.5 4.5',
  pin: 'M8 1.8v8M4.6 5.4h6.8l-1.4 3H6z',
  close: 'M3.5 3.5l9 9M12.5 3.5l-9 9',
  check: 'M3 8.4l3.2 3.2L13 5',
  chevron: 'M5.5 3.5 10 8l-4.5 4.5',
  book: 'M3 2.8h4.2M3 2.8v10.4M3 13.2h4.2M12.2 2.8H8M12.2 2.8v10.4M12.2 13.2H8M8 4.4v7.2',
  spark: 'M8 1.8l1.5 4.3 4.3 1.5-4.3 1.5L8 13.4 6.5 9.1 2.2 7.6l4.3-1.5z',
  download: 'M8 2.6v7.2M4.8 6.6 8 9.8l3.2-3.2M3 13h10',
  link: 'M6.4 9.6 9.6 6.4M7.2 4.4l1.1-1.1a2.8 2.8 0 0 1 4 4l-1.1 1.1M8.8 11.6l-1.1 1.1a2.8 2.8 0 0 1-4-4l1.1-1.1',
  stop: 'M5 5h6v6H5z',
  layers: 'M8 2.6 2.6 5.8 8 9l5.4-3.2zM2.6 8.6 8 11.8l5.4-3.2M2.6 11.2 8 14.4l5.4-3.2',
  expand: 'M3 6V3h3M13 10v3h-3M3 10v3h3M13 6V3h-3',
  history: 'M2.8 8a5.2 5.2 0 1 0 1.5-3.7M2.4 3.2V6h2.8M8 5.2V8l2 1.4',
  external: 'M6.2 3H3.6A1.6 1.6 0 0 0 2 4.6v7.8A1.6 1.6 0 0 0 3.6 14h7.8a1.6 1.6 0 0 0 1.6-1.6V9.8M9 2h5v5M8.2 7.8 14 2',
  image: 'M2.5 3.5h11v9h-11zM2.5 10l3.2-3 2.8 2.6 2.2-2.2 2.8 2.6M5.2 6.1h.01',
  file: 'M4 2.5h5l3 3v8H4zM9 2.5v3h3',
  zoomIn: 'M7 2.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2zM10.6 10.6 14 14M5 7h4M7 5v4',
  zoomOut: 'M7 2.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2zM10.6 10.6 14 14M5 7h4',
  dots: 'M3 8h.01M8 8h.01M13 8h.01',
};

export const IconGlyph = Icon;
export { ICONS };

const TABS = ['目录', '标注', '概念', '对话', '译'];

export const TopBar: React.FC<{
  title: string;
  active?: string;
  onTab?: string;
}> = ({ title, active, onTab }) => {
  const tab = onTab ?? active;
  return (
    <div
      style={{
        height: TOPBAR_H,
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px',
        borderBottom: `1px solid ${C.border}`,
        background: '#fcfcfd',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ color: C.muted, display: 'flex' }}>
        <IconGlyph d={ICONS.back} size={11} />
      </span>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 600,
          color: C.ink,
          maxWidth: 150,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </span>
      <span style={{ display: 'flex', gap: 4, color: C.faint, marginLeft: 1 }}>
        <IconGlyph d={ICONS.undo} size={9.5} />
        <IconGlyph d={ICONS.redo} size={9.5} />
      </span>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, color: C.muted }}>
        {['A−', 'A+'].map((f) => (
          <span key={f} style={{ fontSize: 8.5, padding: '1px 3px', letterSpacing: 0.2 }}>
            {f}
          </span>
        ))}
        <span style={{ width: 1, height: 11, background: C.border, margin: '0 3px' }} />
        {TABS.map((t) => {
          const on = tab === t;
          return (
            <span
              key={t}
              style={{
                fontSize: 8.8,
                lineHeight: 1,
                padding: '3px 5px',
                borderRadius: 5,
                border: `1px solid ${on ? C.brandLine : 'transparent'}`,
                background: on ? C.brandSoft : 'transparent',
                color: on ? C.brand : C.muted,
                fontWeight: on ? 600 : 500,
                whiteSpace: 'nowrap',
              }}
            >
              {t}
            </span>
          );
        })}
        <span style={{ width: 1, height: 11, background: C.border, margin: '0 3px' }} />
        <span style={{ display: 'flex', padding: '2px 3px' }}>
          <IconGlyph d={ICONS.search} size={10.5} />
        </span>
        {['导读'].map((t) => {
          const on = tab === t;
          return (
            <span
              key={t}
              style={{
                fontSize: 8.8,
                lineHeight: 1,
                padding: '3px 5px',
                borderRadius: 5,
                border: `1px solid ${on ? C.brandLine : 'transparent'}`,
                background: on ? C.brandSoft : 'transparent',
                color: on ? C.brand : C.muted,
                fontWeight: on ? 600 : 500,
              }}
            >
              {t}
            </span>
          );
        })}
        <span style={{ display: 'flex', padding: '2px 2px 2px 4px' }}>
          <IconGlyph d={ICONS.gear} size={10.5} />
        </span>
      </div>
    </div>
  );
};

const composerButton = (enabled: boolean): React.CSSProperties => ({
  width: 19,
  height: 19,
  borderRadius: '50%',
  background: enabled ? C.brand : '#e9edf3',
  color: enabled ? '#fff' : '#a7afbc',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
});

export const Composer: React.FC<{
  height: number;
  mode: 'idle' | 'quoted';
  typed?: string;
  frame: number;
  typing?: boolean;
  placeholder?: string;
  quote?: { source: string; text: string };
  quoteEnter?: number;
  attachment?: { label?: string } | null;
}> = ({ height, mode, typed = '', frame, typing = false, placeholder = '选中正文即可引用提问，或直接输入…', quote, quoteEnter = 1, attachment = null }) => (
  <div
    style={{
      height,
      flex: '0 0 auto',
      borderTop: `1px solid ${C.border}`,
      background: '#fcfcfd',
      padding: '6px 12px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      overflow: 'hidden',
    }}
  >
    {mode === 'quoted' && quote ? (
      <div
        style={{
          border: `1px solid ${C.border}`,
          borderLeft: `2px solid ${C.brand}`,
          background: C.layer1,
          borderRadius: 6,
          padding: '3px 7px',
          marginBottom: 4,
          opacity: quoteEnter,
          transform: `translateY(${(1 - quoteEnter) * 6}px)`,
        }}
      >
        <div style={{ fontSize: 7.5, color: C.muted, display: 'flex', gap: 4, alignItems: 'center' }}>
          <IconGlyph d={ICONS.book} size={7.5} />
          {quote.source}
        </div>
        <div
          style={{
            fontSize: 9,
            color: C.ink2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 1,
          }}
        >
          {quote.text}
        </div>
      </div>
    ) : null}
    {mode === 'quoted' && attachment ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          marginBottom: 4,
          opacity: quoteEnter,
          transform: `translateY(${(1 - quoteEnter) * 4}px)`,
        }}
      >
        <ReplicaFigure width={30} height={20} compact />
        <span style={{ fontSize: 7.2, color: C.ink2 }}>{attachment.label || '图 1 · 线性一致性'}</span>
        <span
          style={{
            fontSize: 6.4,
            color: C.brand,
            background: C.brandSoft,
            border: `1px solid ${C.brandLine}`,
            borderRadius: 4,
            padding: '1px 4px',
          }}
        >
          已附加
        </span>
      </div>
    ) : null}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1px solid ${C.border}`,
          color: C.muted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        <IconGlyph d={ICONS.plus} size={9} />
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 10, color: mode === 'quoted' && typed ? C.ink : C.faint }}>
        {mode === 'quoted' && typed ? (
          <span>
            {typed}
            {typing ? (
              <span
                style={{
                  display: 'inline-block',
                  width: 1,
                  height: 10,
                  background: C.ink,
                  marginLeft: 1,
                  verticalAlign: '-1px',
                  opacity: caretOpacity(frame),
                }}
              />
            ) : null}
          </span>
        ) : (
          mode === 'quoted' ? '补一句问题…' : placeholder
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 8.5, color: C.faint }}>⏎ 发送</span>
        <div style={composerButton(Boolean(typed))}>
          <IconGlyph d={ICONS.send} size={9} style={{ color: 'inherit' }} />
        </div>
      </div>
    </div>
  </div>
);

/** Dark lower-third caption strip, with crossfading phases. */
export type CaptionPhase = { from: number; text: string };

export const CaptionBar: React.FC<{ phases: CaptionPhase[]; step: string }> = ({ phases, step }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: CAPTION_Y,
        width: ART.w,
        height: CAPTION_H,
        background: C.dark,
        display: 'flex',
        alignItems: 'center',
        padding: '0 30px',
        boxSizing: 'border-box',
        gap: 12,
        overflow: 'hidden',
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, letterSpacing: 1 }}>{step}</span>
      <span style={{ width: 1, height: 12, background: C.darkLine }} />
      <div style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden' }}>
        {phases.map((phase, i) => {
          const next = phases[i + 1];
          const enter = prog(frame, i === 0 ? phase.from : phase.from + 5, phase.from + (i === 0 ? 10 : 15));
          const exit = next ? prog(frame, next.from, next.from + 8) : 0;
          const op = Math.max(0, enter - exit);
          return (
            <div
              key={phase.text}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                opacity: op,
                transform: `translateY(${(1 - enter) * 7 - exit * 5}px)`,
                whiteSpace: 'nowrap',
                fontSize: 11.5,
                color: C.darkText,
                letterSpacing: 0.3,
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: C.amber,
                  flex: '0 0 auto',
                }}
              />
              {phase.text}
            </div>
          );
        })}
      </div>
      <span style={{ fontSize: 8.5, color: C.darkMuted, letterSpacing: 0.6 }}>砚读 · DSH 阅读插件</span>
    </div>
  );
};

export const Chip: React.FC<{
  children: React.ReactNode;
  tone?: 'plain' | 'brand' | 'amber' | 'green';
  style?: React.CSSProperties;
}> = ({ children, tone = 'plain', style }) => {
  const tones = {
    plain: { bg: C.layer2, color: C.muted, border: 'transparent' },
    brand: { bg: C.brandSoft, color: C.brand, border: C.brandLine },
    amber: { bg: C.amberSoft, color: C.amberInk, border: '#f0dd9a' },
    green: { bg: C.greenSoft, color: C.green, border: '#bfe3c9' },
  }[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 8,
        lineHeight: 1,
        padding: '3px 5px',
        borderRadius: 5,
        background: tones.bg,
        color: tones.color,
        border: `1px solid ${tones.border}`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
};


/**
 * First and last frames fade to the same paper tone so the GIF loops without a
 * hard cut (a README GIF restarts immediately when it ends).
 */
export const FadeEdges: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const intro = 1 - prog(frame, 0, 9);
  const outro = prog(frame, durationInFrames - 8, durationInFrames - 2);
  const opacity = Math.max(intro, outro);
  if (opacity <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: C.paper,
        opacity,
        zIndex: 400,
        pointerEvents: 'none',
      }}
    />
  );
};

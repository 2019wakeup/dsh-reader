import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IO = Easing.bezier(0.65, 0, 0.35, 1);

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 0..1 progress between two frames, clamped. */
export const prog = (frame: number, start: number, end: number, easing = EASE) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Spring that starts at `start` frame and settles to 1. */
export const useSpringIn = (start: number, config: object = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - start,
    fps,
    config: { damping: 24, stiffness: 210, mass: 0.9, ...config },
  });
};

/** Local 0..1 progress hook relative to the current frame. */
export const useProg = (start: number, end: number, easing = EASE) => {
  const frame = useCurrentFrame();
  return prog(frame, start, end, easing);
};

/** Text reveal used for typewriter/streaming effects. */
export const typewriter = (text: string, frame: number, start: number, charsPerFrame = 1.4) => {
  const count = Math.max(0, Math.min(text.length, Math.floor((frame - start) * charsPerFrame)));
  return text.slice(0, count);
};

/** Caret opacity: on/off every ~7 frames. */
export const caretOpacity = (frame: number) => (Math.floor(frame / 7) % 2 === 0 ? 1 : 0.08);

export type CursorKey = { f: number; x: number; y: number };

export type CursorState = {
  x: number;
  y: number;
  pressed: boolean;
  visible: boolean;
  ripples: { key: number; p: number }[];
};

/**
 * Keyframed cursor. Between two keys it eases with `EASE_IO`; before the first
 * key it stays put, after the last it stays put.
 */
export const useCursorAt = (keys: CursorKey[], clicks: number[] = [], hideAfter = Infinity): CursorState => {
  const frame = useCurrentFrame();
  let x = keys[0].x;
  let y = keys[0].y;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (frame >= b.f) {
      x = b.x;
      y = b.y;
    } else if (frame > a.f) {
      const p = EASE_IO((frame - a.f) / Math.max(1, b.f - a.f));
      x = lerp(a.x, b.x, p);
      y = lerp(a.y, b.y, p);
    }
  }
  const pressed = clicks.some((c) => frame >= c && frame < c + 8);
  const ripples = clicks
    .map((c, key) => ({ key, p: clamp01((frame - c) / 20) }))
    .filter((r, i) => frame >= clicks[i] && frame < clicks[i] + 20);
  return {
    x,
    y,
    pressed,
    visible: frame >= keys[0].f && frame <= hideAfter,
    ripples,
  };
};

// Visual language for the README demo animations.
// The palette is sampled from the reader's real UI (eval/visual/baseline):
// neutral white canvas, #1f2329 ink, #e3e6eb hairlines, #1f6feb brand blue.
// The artboard is 800x540 CSS px and is rendered at 2x (1600x1080) so the
// final 800x540 GIF stays crisp.

export const ART = { w: 800, h: 540 } as const;

export const C = {
  paper: '#f4efe6',
  paper2: '#ece5d7',
  ink: '#1f2329',
  ink2: '#333a43',
  muted: '#5b6472',
  faint: '#8a93a0',
  border: '#e3e6eb',
  borderSoft: '#eef0f4',
  layer1: '#f7f8fa',
  layer2: '#eef1f5',
  white: '#ffffff',
  brand: '#1f6feb',
  brandSoft: '#e8f1ff',
  brandLine: '#a7c7fb',
  amber: '#f2c94c',
  amberSoft: '#fdf3d5',
  amberInk: '#8a6d1f',
  green: '#2f9e44',
  greenSoft: '#e6f4ea',
  red: '#c0392b',
  dark: '#14161a',
  dark2: '#1d2027',
  darkLine: '#2b2f37',
  darkText: '#e8eaee',
  darkMuted: '#9aa3b2',
} as const;

export const FONT =
  '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif';

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// Window geometry on the artboard.
export const WIN = { x: 30, y: 52, w: 740, h: 452 } as const;
export const TOPBAR_H = 28;
export const COMPOSER_H = 38;
export const CAPTION_H = 36;
export const CAPTION_Y = ART.h - CAPTION_H;

export const SHADOW = '0 22px 60px rgba(31, 35, 41, 0.16), 0 3px 10px rgba(31, 35, 41, 0.06)';

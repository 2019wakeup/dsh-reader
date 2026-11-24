import React from 'react';
import { Easing, useCurrentFrame } from 'remotion';
import { ART } from './theme';

/**
 * 2.5D product-film camera.
 *
 * The artboard stays 800x540; the camera moves a 3D scene inside it. Only
 * establishing shots and transitions are allowed to tilt; copy that must be
 * read is always shown near 0 degrees. See CAMERA.md.
 */
export type CameraKey = {
  f: number;
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  /** Legacy centre zoom; kept so older keys still evaluate. */
  scale?: number;
  /** World-space point the camera should move toward / keep centred. */
  fx?: number;
  fy?: number;
  /** Local zoom around the focus point. */
  zoom?: number;
};

export type CameraState = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  zoom: number;
  fx: number;
  fy: number;
};

const BASE: CameraState = {
  x: 0,
  y: 0,
  z: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  zoom: 1,
  fx: ART.w / 2,
  fy: ART.h / 2,
};
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Pure camera interpolation, so stills and tests can evaluate any frame. */
export function cameraAt(keys: CameraKey[], frame: number): CameraState {
  if (!keys.length) return BASE;
  const sorted = [...keys].sort((a, b) => a.f - b.f);
  const withBase = (key: CameraKey): CameraState => ({
    ...BASE,
    ...key,
    zoom: key.zoom ?? key.scale ?? 1,
    fx: key.fx ?? ART.w / 2,
    fy: key.fy ?? ART.h / 2,
  });
  if (frame <= sorted[0].f) return withBase(sorted[0]);
  const last = sorted[sorted.length - 1];
  if (frame >= last.f) return withBase(last);
  for (let index = 1; index < sorted.length; index++) {
    const to = sorted[index];
    const from = sorted[index - 1];
    if (frame > to.f) continue;
    const progress = EASE((frame - from.f) / Math.max(1, to.f - from.f));
    const a = withBase(from);
    const b = withBase(to);
    return {
      x: mix(a.x, b.x, progress),
      y: mix(a.y, b.y, progress),
      z: mix(a.z, b.z, progress),
      rx: mix(a.rx, b.rx, progress),
      ry: mix(a.ry, b.ry, progress),
      rz: mix(a.rz, b.rz, progress),
      zoom: mix(a.zoom, b.zoom, progress),
      fx: mix(a.fx, b.fx, progress),
      fy: mix(a.fy, b.fy, progress),
    };
  }
  return withBase(last);
}

export const Camera: React.FC<{
  keys: CameraKey[];
  children: React.ReactNode;
  perspective?: number;
  origin?: string;
}> = ({ keys, children, perspective = 2200, origin = '50% 48%' }) => {
  const frame = useCurrentFrame();
  const camera = cameraAt(keys, frame);
  const zoom = Math.max(0.2, camera.zoom);
  // Keep the 800x540 window inside the frame when pushing in. Edge controls
  // still get a zoom toward them, but the camera clamps instead of showing a
  // large sheet of empty paper. Vertical focus is kept near the window centre
  // for the same reason; the UI component itself moves in frame instead.
  const halfW = ART.w / (2 * zoom);
  const minX = halfW + 10;
  const maxX = ART.w - halfW - 10;
  const focusX = minX < maxX ? Math.min(maxX, Math.max(minX, camera.fx)) : ART.w / 2;
  const focusY = Math.min(305, Math.max(235, camera.fy));
  const tx = ART.w / 2 - focusX + camera.x;
  const ty = ART.h / 2 - focusY + camera.y;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        perspective,
        perspectiveOrigin: origin,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transformOrigin: `${focusX}px ${focusY}px`,
          transform: `translate3d(${tx}px, ${ty}px, ${camera.z}px) rotateX(${camera.rx}deg) rotateY(${camera.ry}deg) rotateZ(${camera.rz}deg) scale(${zoom})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** A flat UI layer lifted in Z so the camera produces real parallax. */
export const Layer: React.FC<{
  depth?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ depth = 0, children, style }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      transformStyle: 'preserve-3d',
      transform: `translateZ(${depth}px)`,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Soft ground shadow under the reader window; sells the window as a physical sheet. */
export const GroundShadow: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <div
    style={{
      position: 'absolute',
      left: 58,
      top: 486,
      width: 688,
      height: 30,
      borderRadius: '50%',
      background: 'rgba(31, 35, 41, 0.20)',
      filter: 'blur(18px)',
      opacity: 0.55 * opacity,
      transform: 'translateZ(-26px)',
      pointerEvents: 'none',
    }}
  />
);

/** Very light vignette; keeps the paper edge from looking like a hard crop when the camera tilts. */
export const Vignette: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background:
        'radial-gradient(120% 100% at 50% 45%, rgba(251,248,242,0) 58%, rgba(46,40,30,0.10) 100%)',
      pointerEvents: 'none',
    }}
  />
);

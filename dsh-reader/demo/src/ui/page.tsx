import React from 'react';
import { C } from './theme';

export const Page: React.FC<{ width: number; children: React.ReactNode; paddingTop?: number }> = ({
  width,
  children,
  paddingTop = 18,
}) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      paddingTop,
      boxSizing: 'border-box',
    }}
  >
    <div style={{ width, maxWidth: '100%', boxSizing: 'border-box', padding: '0 10px' }}>{children}</div>
  </div>
);

export const H1: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, letterSpacing: 0.2, margin: '0 0 12px' }}>
    {children}
  </div>
);

export const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 17, fontWeight: 650, lineHeight: 1.3, margin: '16px 0 7px' }}>{children}</div>
);

export const P: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontSize: 13.5, lineHeight: 1.9, letterSpacing: 0.1, margin: '0 0 8px', ...style }}>{children}</div>
);

export const Muted: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 10 }) => (
  <span style={{ fontSize: size, color: C.muted }}>{children}</span>
);

/** A saved-concept term: dashed underline fades in when `show` goes 0 -> 1. */
export const Term: React.FC<{
  children: React.ReactNode;
  show?: number;
  selection?: number;
}> = ({ children, show = 0, selection }) => (
  <span
    style={{
      position: 'relative',
      backgroundImage:
        selection === undefined
          ? undefined
          : `linear-gradient(90deg, rgba(31,111,235,0.25) ${selection * 100}%, rgba(31,111,235,0) ${selection * 100}%)`,
      borderRadius: 2,
      padding: '0 0.5px',
      borderBottom: `1px dashed rgba(91,100,114,${show * 0.55})`,
      textUnderlineOffset: 3,
    }}
  >
    {children}
  </span>
);

/** Inline text selection with an animated left-to-right fill. */
export const Sel: React.FC<{ children: React.ReactNode; p: number }> = ({ children, p }) => (
  <span
    style={{
      backgroundImage: `linear-gradient(90deg, rgba(31,111,235,0.25) ${p * 100}%, rgba(31,111,235,0) ${p * 100}%)`,
      borderRadius: 2,
      padding: '0 0.5px',
    }}
  >
    {children}
  </span>
);

export const Footnote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 10, color: C.faint, marginTop: 10, letterSpacing: 0.2 }}>{children}</div>
);

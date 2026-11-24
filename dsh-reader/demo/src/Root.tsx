import React from 'react';
import { Composition } from 'remotion';
import { SelectExplain } from './scenes/SelectExplain';
import { AskAI } from './scenes/AskAI';
import { GuideMindmap } from './scenes/GuideMindmap';

/**
 * README demo reels. 1600x1080 (2x artboard) -> 640x432 GIF.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SelectExplain"
        component={SelectExplain}
        durationInFrames={270}
        fps={30}
        width={1600}
        height={1080}
      />
      <Composition
        id="AskAI"
        component={AskAI}
        durationInFrames={300}
        fps={30}
        width={1600}
        height={1080}
      />
      <Composition
        id="GuideMindmap"
        component={GuideMindmap}
        durationInFrames={300}
        fps={30}
        width={1600}
        height={1080}
      />
    </>
  );
};

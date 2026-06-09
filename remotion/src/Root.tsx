import React from 'react';
import { Composition } from 'remotion';
import { MaternityReel } from './compositions/MaternityReel';

export function Root() {
  return (
    <Composition
      id="MaternityReel"
      component={MaternityReel}
      durationInFrames={540}
      fps={30}
      width={1080}
      height={1920}
    />
  );
}

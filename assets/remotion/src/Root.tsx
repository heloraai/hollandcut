import React from 'react';
import {Composition} from 'remotion';
import {ShenVideo} from './Video';
import spec from '../public/spec.json';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Shen"
    component={ShenVideo}
    durationInFrames={Math.round(spec.duration * spec.fps)}
    fps={spec.fps}
    width={spec.width}
    height={spec.height}
  />
);

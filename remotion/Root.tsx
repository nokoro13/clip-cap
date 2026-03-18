import React from 'react';
import { Composition } from 'remotion';
import {
  MyComposition,
  SubtitleComposition,
  DEFAULT_SUBTITLE_STYLE,
} from './Composition';
import type { Subtitle } from './Composition';

// Sample subtitles for demo (30fps, so 30 frames = 1 second)
const sampleSubtitles: Subtitle[] = [
  { id: '1', text: 'Welcome to ClipCap!', startFrame: 0, endFrame: 60 },
  { id: '2', text: 'Add subtitles to your videos', startFrame: 75, endFrame: 150 },
  { id: '3', text: "It's super easy!", startFrame: 165, endFrame: 240 },
  { id: '4', text: '🚀 Let\'s get started', startFrame: 255, endFrame: 300 },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Simple test composition */}
      <Composition
        id="HelloWorld"
        component={MyComposition}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Hello from Remotion!',
        }}
      />

      {/* Subtitle composition - this is what your editor will use */}
      <Composition
        id="SubtitleVideo"
        component={SubtitleComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          videoUrl: null,
          subtitles: sampleSubtitles,
          style: DEFAULT_SUBTITLE_STYLE,
        }}
      />

      {/* Editor export composition - used by Lambda for video export */}
      <Composition
        id="EditorVideo"
        component={SubtitleComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: null,
          subtitles: [],
          style: DEFAULT_SUBTITLE_STYLE,
          videoSegments: [],
          videoTransform: { scale: 1, offsetX: 0, offsetY: 0 },
          customTextSegments: [],
          customTextTracks: [],
          bannerSegments: [],
          bannerTracks: [],
        }}
        calculateMetadata={({ props }) => {
          const duration =
            props.videoSegments && props.videoSegments.length > 0
              ? Math.max(...props.videoSegments.map((s) => s.endFrame))
              : 300;
          return {
            durationInFrames: duration,
            fps: 30,
          };
        }}
      />
    </>
  );
};
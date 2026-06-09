import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { loadFont } from '@remotion/google-fonts/PlayfairDisplay';

const { fontFamily } = loadFont('normal');
loadFont('italic');
loadFont('normal', '700');

// Sequence durations chosen so TransitionSeries totals exactly 450 frames:
//   sum = 75 + 66×4 + 65×3 = 534
//   net = 534 − 7 transitions × 12 frames = 450
// End card occupies frames 450–539 (90 frames) → composition total = 540.
const TRANSITION_FRAMES = 12;
const IMAGE_DURATIONS = [75, 66, 66, 66, 66, 65, 65, 65] as const;
const END_CARD_START = 450;
const END_CARD_DURATION = 90;

const IMAGE_DATA: Array<{ src: string; text: string | null }> = [
  { src: staticFile('images/01.png'), text: null },
  { src: staticFile('images/02.png'), text: 'Your bump. Your art.' },
  { src: staticFile('images/03.png'), text: null },
  { src: staticFile('images/04.png'), text: 'Every detail, remembered' },
  { src: staticFile('images/05.png'), text: null },
  { src: staticFile('images/06.png'), text: null },
  { src: staticFile('images/07.png'), text: null },
  { src: staticFile('images/08.png'), text: null },
];

function ImageScene({
  src,
  text,
  durationInFrames,
}: {
  src: string;
  text: string | null;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slow Ken Burns: 1.0 → 1.08 over the full sequence
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Text fades in after the cross-fade in completes, fades out before cross-fade out begins
  const textOpacity = text
    ? interpolate(
        frame,
        [
          TRANSITION_FRAMES,
          TRANSITION_FRAMES + 10,
          durationInFrames - TRANSITION_FRAMES - 10,
          durationInFrames - TRANSITION_FRAMES,
        ],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      )
    : 0;

  // Gentle upward spring entrance for text
  const textEntrance = spring({
    fps,
    frame: Math.max(0, frame - TRANSITION_FRAMES),
    config: { damping: 90, stiffness: 16, mass: 1 },
    durationInFrames: 32,
  });
  const textY = interpolate(textEntrance, [0, 1], [28, 0]);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#111111' }}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          display: 'block',
        }}
      />
      {text && (
        <div
          style={{
            position: 'absolute',
            bottom: '13%',
            left: '8%',
            right: '8%',
            textAlign: 'center',
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
          }}
        >
          <span
            style={{
              fontFamily,
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 54,
              color: '#FFFFFF',
              textShadow:
                '0 2px 20px rgba(0,0,0,0.55), 0 1px 6px rgba(0,0,0,0.35)',
              letterSpacing: '0.02em',
              lineHeight: 1.4,
              display: 'block',
            }}
          >
            {text}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
}

function EndCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const makeSpring = (delay: number) =>
    spring({
      fps,
      frame,
      config: { damping: 80, stiffness: 14, mass: 1 },
      durationInFrames: 45,
      delay,
    });

  const s1 = makeSpring(6);
  const s2 = makeSpring(22);
  const s3 = makeSpring(40);

  const lines: Array<{
    s: number;
    text: string;
    style: React.CSSProperties;
  }> = [
    {
      s: s1,
      text: 'SILWER LINING PHOTOGRAPHY',
      style: {
        fontWeight: 700,
        fontStyle: 'normal',
        fontSize: 34,
        letterSpacing: '0.22em',
      },
    },
    {
      s: s2,
      text: 'Maternity Studio · Helderkruin, JHB',
      style: {
        fontWeight: 400,
        fontStyle: 'italic',
        fontSize: 30,
        letterSpacing: '0.04em',
      },
    },
    {
      s: s3,
      text: 'Booking July & August — message us 🤍',
      style: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontSize: 28,
        letterSpacing: '0.02em',
      },
    },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#F2EFEA',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 32,
        padding: '0 80px',
      }}
    >
      {lines.map(({ s, text, style }) => (
        <p
          key={text}
          style={{
            ...style,
            fontFamily,
            color: '#2C2825',
            margin: 0,
            textAlign: 'center',
            opacity: s,
            transform: `translateY(${interpolate(s, [0, 1], [22, 0])}px)`,
          }}
        >
          {text}
        </p>
      ))}
    </AbsoluteFill>
  );
}

export function MaternityReel() {
  const sequences: React.ReactNode[] = [];

  IMAGE_DATA.forEach((image, index) => {
    const duration = IMAGE_DURATIONS[index];
    sequences.push(
      <TransitionSeries.Sequence key={`seq-${index}`} durationInFrames={duration}>
        <ImageScene
          src={image.src}
          text={image.text}
          durationInFrames={duration}
        />
      </TransitionSeries.Sequence>,
    );
    if (index < IMAGE_DATA.length - 1) {
      sequences.push(
        <TransitionSeries.Transition
          key={`trans-${index}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />,
      );
    }
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0D0D0D' }}>
      <Audio src={staticFile('audio/track.mp3')} />
      <TransitionSeries>{sequences}</TransitionSeries>
      <Sequence from={END_CARD_START} durationInFrames={END_CARD_DURATION}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}

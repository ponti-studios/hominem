import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  withSpring,
} from 'react-native-reanimated';

const portableMotion = {
  distance: { rowEnter: '0.5rem', sceneReveal: '2rem' },
  duration: { deliberate: '500ms', quick: '150ms', standard: '300ms' },
  easing: {
    enter: [0, 0, 0.2, 1],
    exit: [0.4, 0, 1, 1],
    inOut: [0.4, 0, 0.2, 1],
  },
  interruption: { policy: 'cancel-and-settle' },
  reducedMotion: { policy: 'replace-transform-with-opacity' },
} as const;

function milliseconds(value: string) {
  return Number.parseFloat(value);
}

function pixels(value: string) {
  const amount = Number.parseFloat(value);
  return value.endsWith('rem') ? amount * 16 : amount;
}

function cubicBezier(value: readonly number[]) {
  return Easing.bezier(value[0], value[1], value[2], value[3]);
}

export const nativeMotionContracts = {
  duration: {
    quick: milliseconds(portableMotion.duration.quick),
    standard: milliseconds(portableMotion.duration.standard),
    deliberate: milliseconds(portableMotion.duration.deliberate),
  },
  distance: {
    rowEnter: pixels(portableMotion.distance.rowEnter),
    sceneReveal: pixels(portableMotion.distance.sceneReveal),
  },
  easing: {
    enter: cubicBezier(portableMotion.easing.enter),
    exit: cubicBezier(portableMotion.easing.exit),
    inOut: cubicBezier(portableMotion.easing.inOut),
  },
  interruption: portableMotion.interruption.policy,
  reducedMotion: portableMotion.reducedMotion.policy,
} as const;

// Shared entering/exiting/layout builders for the chat + composer surface --
// one instance per shape, reused everywhere instead of every component
// constructing its own `.duration(nativeMotionContracts.duration.quick)`
// call. See chat-message.tsx, chat-message-actions.tsx, ComposerAttachmentRow.tsx,
// Composer.tsx for the split-node pattern these are used with.
export const nativeMotionAnimations = {
  fadeInQuick: FadeIn.duration(nativeMotionContracts.duration.quick),
  fadeOutQuick: FadeOut.duration(nativeMotionContracts.duration.quick),
  fadeInDownQuick: FadeInDown.duration(nativeMotionContracts.duration.quick),
  fadeOutUpQuick: FadeOutUp.duration(nativeMotionContracts.duration.quick),
  layoutQuick: LinearTransition.duration(nativeMotionContracts.duration.quick),
};

export const nativeMotionTiming = {
  quick: {
    duration: nativeMotionContracts.duration.quick,
    easing: nativeMotionContracts.easing.enter,
  } satisfies WithTimingConfig,
  enter: {
    duration: nativeMotionContracts.duration.standard,
    easing: nativeMotionContracts.easing.enter,
  } satisfies WithTimingConfig,
  exit: {
    duration: nativeMotionContracts.duration.quick,
    easing: nativeMotionContracts.easing.exit,
  } satisfies WithTimingConfig,
};

// Spring presets, named after the SwiftUI animations they match. Duration-based
// so they read the same as `.snappy` / `.smooth` / `.bouncy` on the native side.
export const nativeMotionSprings = {
  // Answers a touch: presses, toggles, chips.
  snappy: { duration: 350, dampingRatio: 0.85 },
  // Sheets, docks and bars changing size or place.
  smooth: { duration: 500, dampingRatio: 1 },
  // Arrivals worth noticing: a new row, a toast, a completion.
  bouncy: { duration: 500, dampingRatio: 0.7 },
} as const satisfies Record<string, WithSpringConfig>;

// How far a control sinks under a finger.
export const PRESS_SCALE = 0.96;

// Entering animation for a glass surface: it grows and settles into place.
// Transform only -- system glass stops rendering while its opacity (or a
// parent's) is below 1, so a fade would show a flat grey box for a moment.
export function glassPopIn() {
  'worklet';
  return {
    initialValues: { transform: [{ scale: 0.92 }, { translateY: 10 }] },
    animations: {
      transform: [
        { scale: withSpring(1, nativeMotionSprings.bouncy) },
        { translateY: withSpring(0, nativeMotionSprings.bouncy) },
      ],
    },
  };
}

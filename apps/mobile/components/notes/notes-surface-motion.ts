import { durations } from '@hominem/ui/tokens';
import {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LinearTransition,
} from 'react-native-reanimated';

export function createNotesEnterFade(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeIn.duration(durations.enter);
}

export function createNotesExitFade(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeOut.duration(durations.exit);
}

export function createNotesEnterLift(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeInDown.duration(durations.enter);
}

export function createNotesExitLift(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeOutDown.duration(durations.exit);
}

export function createNotesLayoutTransition(reducedMotion: boolean) {
  return reducedMotion ? undefined : LinearTransition.duration(durations.enter);
}

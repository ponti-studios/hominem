import { durations, translateDistances } from '@hominem/ui/tokens';
import { Easing } from 'react-native-reanimated';

export const VOID_MOTION_ENTER = durations.enter;
export const VOID_MOTION_EXIT = durations.exit;
export const VOID_MOTION_DURATION_STANDARD = durations.standard;

export const VOID_EASING_ENTER = Easing.out(Easing.cubic);
export const VOID_EASING_EXIT = Easing.in(Easing.cubic);
export const VOID_EASING_STANDARD = Easing.inOut(Easing.ease);

export const VOID_ENTER_TRANSLATE_Y = translateDistances.enterY;
export const VOID_EXIT_TRANSLATE_Y = translateDistances.exitY;

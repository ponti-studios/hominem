import { Easing } from 'react-native-reanimated';

import {
  VOID_EASING_ENTER,
  VOID_EASING_EXIT,
  VOID_MOTION_ENTER,
  VOID_MOTION_EXIT,
} from '~/components/theme/motion';

export const fadeEnterConfig = {
  duration: VOID_MOTION_ENTER,
  easing: VOID_EASING_ENTER,
};

export const fadeExitConfig = {
  duration: VOID_MOTION_EXIT,
  easing: VOID_EASING_EXIT,
};

export const fadeEnterStyle = {
  opacity: 0,
};

export const fadeEnterTarget = {
  opacity: 1,
};

export const fadeExitTarget = {
  opacity: 0,
};

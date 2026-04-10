import { Easing } from 'react-native-reanimated';

export const slideUpEnterConfig = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

export const slideDownExitConfig = {
  duration: 200,
  easing: Easing.in(Easing.cubic),
};

export const slideUpEnterStyle = {
  opacity: 0,
  translateY: 20,
};

export const slideUpEnterTarget = {
  opacity: 1,
  translateY: 0,
};

export const slideDownExitTarget = {
  opacity: 0,
  translateY: -10,
};

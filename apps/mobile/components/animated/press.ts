import { Easing } from 'react-native-reanimated';

export const pressScaleConfig = {
  duration: 100,
  easing: Easing.out(Easing.ease),
};

export const pressScaleActiveStyle = {
  scale: 0.97,
};

export const pressScaleInactiveStyle = {
  scale: 1,
};

export const pressScaleSpringConfig = {
  damping: 15,
  stiffness: 200,
  mass: 0.5,
};

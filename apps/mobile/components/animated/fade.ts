import { Easing } from 'react-native-reanimated';

export const fadeEnterConfig = {
  duration: 200,
  easing: Easing.out(Easing.ease),
};

export const fadeExitConfig = {
  duration: 150,
  easing: Easing.in(Easing.ease),
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

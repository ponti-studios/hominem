import { View } from 'react-native'

const Animated = {
  View,
  createAnimatedComponent: (Component: typeof View) => Component,
}

export default Animated

export function useAnimatedStyle(factory: () => object) {
  return factory()
}

export function useSharedValue<T>(value: T) {
  return { value }
}

export function withSpring<T>(value: T) {
  return value
}

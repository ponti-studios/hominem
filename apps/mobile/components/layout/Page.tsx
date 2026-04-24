import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { makeStyles, spacing } from '~/components/theme';

import type { PageMaxWidth } from './page.types';

const maxWidthMap: Record<PageMaxWidth, number | undefined> = {
  sm: 672,
  md: 768,
  lg: 1024,
  xl: 1280,
  full: undefined,
};

interface ScreenProps extends Omit<ScrollViewProps, 'contentContainerStyle' | 'style'> {
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[] | undefined;
  maxWidth?: PageMaxWidth | undefined;
  padded?: boolean | undefined;
  scroll?: boolean | undefined;
  style?: StyleProp<ViewStyle>;
}

function getContentStyle(maxWidth: PageMaxWidth, padded: boolean): ViewStyle {
  return {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: maxWidthMap[maxWidth],
    paddingHorizontal: padded ? spacing[4] : 0,
    width: '100%',
  };
}

const useScreenStyles = makeStyles(() =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
  }),
);

function Screen({
  children,
  contentContainerStyle,
  edges = ['top', 'right', 'bottom', 'left'],
  maxWidth = 'lg',
  padded = true,
  scroll = true,
  style,
  ...props
}: ScreenProps) {
  const styles = useScreenStyles();
  const contentStyle = getContentStyle(maxWidth, padded);

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, style]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[contentStyle, contentContainerStyle]} {...props}>
          {children}
        </ScrollView>
      ) : (
        <View style={[contentStyle, contentContainerStyle]} {...props}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export { Screen };
export type { PageMaxWidth, ScreenProps };

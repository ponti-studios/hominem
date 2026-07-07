import { useCallback, useRef } from 'react';
import { Alert, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';

import { makeStyles, useThemeColors } from '~/components/theme';
import { SwipeAction } from '~/components/ui';
import t from '~/translations';

interface SwipeableTaskRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  isList?: boolean;
}

export function SwipeableTaskRow({ children, onDelete, isList = false }: SwipeableTaskRowProps) {
  const styles = useStyles();
  const themeColors = useThemeColors();
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    const copy = isList ? t.tasks.deleteList : t.tasks.deleteTask;
    Alert.alert(copy.title, copy.message, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.confirm, style: 'destructive', onPress: onDelete },
    ]);
  }, [isList, onDelete]);

  const renderSwipeAction = useCallback(
    (progress: SharedValue<number>) => (
      <SwipeAction
        progress={progress}
        iconName="trash"
        onPress={handleDelete}
        accessibilityLabel={t.tasks.delete}
        backgroundColor={themeColors.destructive}
        style={styles.swipeAction}
      />
    ),
    [handleDelete, styles, themeColors],
  );

  return (
    <View style={styles.outer}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        containerStyle={styles.swipeableContainer}
        childrenContainerStyle={styles.swipeableChildrenContainer}
        renderRightActions={renderSwipeAction}
        rightThreshold={60}
        friction={2}
        overshootRight={false}
        enableTrackpadTwoFingerGesture
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  outer: {
    paddingHorizontal: 16,
  },
  swipeAction: {
    height: '100%',
  },
  swipeableChildrenContainer: {
    overflow: 'visible',
  },
  swipeableContainer: {
    overflow: 'visible',
  },
}));

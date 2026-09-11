import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import { type ReactElement, useEffect, useRef } from 'react';
import {
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
} from 'react-native';

const styles = StyleSheet.create({
  // Without an explicit flex, an unstyled FlashList nested in a `flex: 1`
  // parent isn't bounded to the space Yoga reserved for it -- it renders
  // past its own box and visually overlaps whatever sibling sits below it
  // (here, the floating composer dock) instead of stopping short of it.
  list: { flex: 1 },
});

interface StreamListProps<T> {
  contentPaddingBottom?: number;
  contentPaddingTop?: number;
  data: readonly T[];
  keyExtractor: (item: T) => string;
  ListEmptyComponent?: ReactElement | null;
  ListFooterComponent?: ReactElement | null;
  ListHeaderComponent?: ReactElement | null;
  onEndReached?: () => void;
  onScrollOffsetChange?: (offset: number) => void;
  refreshControl?: ReactElement<RefreshControlProps>;
  renderItem: ListRenderItem<T>;
  restoredScrollOffset?: number;
  testID: string;
}

export function StreamList<T>({
  contentPaddingBottom = 0,
  contentPaddingTop = 0,
  data,
  keyExtractor,
  ListEmptyComponent,
  ListFooterComponent,
  ListHeaderComponent,
  onEndReached,
  onScrollOffsetChange,
  refreshControl,
  renderItem,
  restoredScrollOffset = 0,
  testID,
}: StreamListProps<T>) {
  const listRef = useRef<FlashListRef<T>>(null);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current || restoredScrollOffset <= 0) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ animated: false, offset: restoredScrollOffset });
      hasRestoredRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [restoredScrollOffset]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScrollOffsetChange?.(event.nativeEvent.contentOffset.y);
  };

  return (
    <FlashList
      ref={listRef}
      style={styles.list}
      // Real reserved space, not `contentInset` -- inset only affects
      // overscroll/bounce boundaries on iOS, so it can't keep a row that
      // lands at a normal (non-bounced) resting scroll position from ending
      // up underneath the floating composer dock. `contentContainerStyle`
      // padding is layout space the list can never scroll content into.
      contentContainerStyle={{ paddingBottom: contentPaddingBottom, paddingTop: contentPaddingTop }}
      data={data}
      keyboardDismissMode="on-drag"
      keyExtractor={keyExtractor}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      ListHeaderComponent={ListHeaderComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      onScroll={onScroll}
      refreshControl={refreshControl}
      renderItem={renderItem}
      scrollEventThrottle={16}
      scrollIndicatorInsets={{ bottom: contentPaddingBottom }}
      showsVerticalScrollIndicator={false}
      testID={testID}
    />
  );
}

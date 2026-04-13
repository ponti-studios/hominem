import { spacing } from '@hominem/ui/tokens';
import { FlashList } from '@shopify/flash-list';
import type { FlashListProps, ListRenderItem } from '@shopify/flash-list';
import React, { useCallback } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';

import { theme } from '~/components/theme';
import { Separator } from '~/components/ui/Separator';
import { Surface } from '~/components/ui/Surface';

// Default composer clearance: home indicator (~34) + composer card (~100) + padding (~8)
const DEFAULT_BOTTOM_PADDING = spacing[7] * 3; // 144

interface ListShellProps<T>
  extends Omit<FlashListProps<T>, 'ItemSeparatorComponent' | 'contentContainerStyle'> {
  data: T[];
  renderItem: ListRenderItem<T>;
  /** Bottom padding to clear floating UI (composer, tab bar). Defaults to 144. */
  contentPaddingBottom?: number;
  /** Separator left inset in px. Defaults to spacing[4]=16. */
  separatorInset?: number;
  /** Pull-to-refresh callback. Shows RefreshControl when provided. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function SeparatorComponent({ inset }: { inset?: number }) {
  return <Separator inset={inset} />;
}

export function ListShell<T>({
  data,
  renderItem,
  contentPaddingBottom = DEFAULT_BOTTOM_PADDING,
  separatorInset,
  onRefresh,
  isRefreshing = false,
  ...rest
}: ListShellProps<T>) {
  const ItemSeparator = useCallback(
    () => <SeparatorComponent inset={separatorInset} />,
    [separatorInset],
  );

  return (
    <Surface elevation="surface" radius="icon" border shadow style={styles.shell}>
      <FlashList
        data={data}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors['text-tertiary']}
            />
          ) : undefined
        }
        {...rest}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
});

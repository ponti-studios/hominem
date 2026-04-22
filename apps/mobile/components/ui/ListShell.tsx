import { FlashList, type FlashListProps, type ListRenderItem } from '@shopify/flash-list';
import { useCallback } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';

import { useThemeColors } from '~/components/theme/theme';
import { spacing } from '../theme/tokens';
import { Separator } from './Separator';
import { Surface } from './Surface';

const DEFAULT_BOTTOM_PADDING = spacing[7] * 3;

interface ListShellProps<T> extends Omit<
  FlashListProps<T>,
  'ItemSeparatorComponent' | 'contentContainerStyle'
> {
  contentPaddingBottom?: number | undefined;
  data: T[];
  isRefreshing?: boolean | undefined;
  onRefresh?: (() => void) | undefined;
  renderItem: ListRenderItem<T>;
  separatorInset?: number | undefined;
}

function ListShell<T>({
  contentPaddingBottom = DEFAULT_BOTTOM_PADDING,
  data,
  isRefreshing = false,
  onRefresh,
  renderItem,
  separatorInset,
  ...props
}: ListShellProps<T>) {
  const themeColors = useThemeColors();
  const ItemSeparator = useCallback(() => <Separator inset={separatorInset} />, [separatorInset]);

  return (
    <Surface border elevation="surface" radius="icon" shadow style={styles.shell}>
      <FlashList
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
        data={data}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              onRefresh={onRefresh}
              refreshing={isRefreshing}
              tintColor={themeColors['text-tertiary']}
            />
          ) : undefined
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        {...props}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
});

export { ListShell };
export type { ListShellProps };

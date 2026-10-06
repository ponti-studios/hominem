import type { RefObject } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

interface ChatSearchBarProps {
  inputRef: RefObject<TextInput | null>;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  query: string;
  resultCount: number;
}

// Search, as the composer flattened into one line. It takes the composer's
// place in the dock, so it floats above the keyboard and the header stays as
// small as it is: no card dropping in from the top, no field under the header.
export function ChatSearchBar({
  inputRef,
  onChangeQuery,
  onClose,
  query,
  resultCount,
}: ChatSearchBarProps) {
  const { bar, barForeground } = useAppTheme().colors;
  const hasQuery = query.trim().length > 0;
  const styles = useStyles((theme) => ({
    bar: {
      alignItems: 'center',
      backgroundColor: theme.colors.bar,
      borderCurve: 'continuous',
      borderRadius: 28,
      boxShadow: theme.shadows.bar,
      flexDirection: 'row',
      gap: 10,
      height: 56,
      paddingLeft: 18,
      paddingRight: 6,
    },
    input: {
      color: theme.colors.barForeground,
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      paddingVertical: 0,
    },
    count: {
      color: theme.colors.barForeground,
      fontSize: 13,
      fontWeight: '700',
      opacity: 0.6,
    },
    close: {
      alignItems: 'center',
      backgroundColor: theme.colors.barForeground,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
  }));

  return (
    <Animated.View entering={FadeIn.duration(160)} testID="chat-search-bar">
      <View style={styles.bar}>
        <AppIcon name="magnifyingglass" size={18} tintColor={barForeground} />
        <TextInput
          ref={inputRef}
          autoFocus
          accessibilityLabel={t.chat.search.title}
          cursorColor={barForeground}
          onChangeText={onChangeQuery}
          placeholder={t.chat.search.placeholder}
          placeholderTextColor={barForeground}
          returnKeyType="search"
          selectionColor={barForeground}
          style={styles.input}
          testID="chat-search-input"
          value={query}
        />
        {hasQuery ? <Text style={styles.count}>{t.chat.search.results(resultCount)}</Text> : null}
        <Pressable
          accessibilityLabel={t.chat.search.close}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.close}
          testID="chat-search-close"
        >
          <AppIcon name="xmark" size={18} tintColor={bar} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

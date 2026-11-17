import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormGroup } from './form';

/** The colors a choice list needs. Each app passes its own theme, so the list stays theme-free. */
export type ChoiceListColors = {
  foreground: string;
  mutedForeground: string;
  primary: string;
  card: string;
  border: string;
};

export type ChoiceOption<T extends string = string> = { id: T; name: string; note?: string };

export interface ChoiceListProps<T extends string = string> {
  options: readonly ChoiceOption<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
  colors: ChoiceListColors;
  accessibilityLabel?: string;
  testIDPrefix?: string;
  /** Where the check mark sits. Trailing is the default. */
  checkPosition?: 'leading' | 'trailing';
}

/**
 * The check on a selected row. It is always mounted in a fixed slot, so the labels never shift, and
 * it fades and scales in when picked and back out when another row takes the selection.
 */
function Check({ selected, color }: { selected: boolean; color: string }) {
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selected, progress]);
  return (
    <View style={styles.checkSlot} accessible={false}>
      <Animated.Text
        style={[
          styles.check,
          {
            color,
            opacity: progress,
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            ],
          },
        ]}
      >
        ✓
      </Animated.Text>
    </View>
  );
}

/** A group of single-choice rows: a name, an optional note, and a check on the selected one. */
export function ChoiceList<T extends string>({
  options,
  selectedId,
  onSelect,
  colors,
  accessibilityLabel,
  testIDPrefix,
  checkPosition = 'trailing',
}: ChoiceListProps<T>) {
  return (
    <FormGroup
      colors={colors}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option, index) => {
        const selected = option.id === selectedId;
        const check = <Check selected={selected} color={colors.primary} />;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.name}
            accessibilityHint={option.note}
            onPress={() => onSelect(option.id)}
            testID={testIDPrefix ? `${testIDPrefix}-${option.id}` : undefined}
            style={[
              styles.row,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}
          >
            {checkPosition === 'leading' ? check : null}
            <View style={styles.text}>
              <Text style={[styles.name, { color: colors.foreground }]}>{option.name}</Text>
              {option.note ? (
                <Text style={[styles.note, { color: colors.mutedForeground }]}>{option.note}</Text>
              ) : null}
            </View>
            {checkPosition === 'trailing' ? check : null}
          </Pressable>
        );
      })}
    </FormGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13 },
  checkSlot: { width: 20, alignItems: 'center' },
  check: { fontSize: 17, fontWeight: '700' },
});

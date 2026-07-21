import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  componentSizes,
  fontSizes,
  fontWeights,
  radii,
  themeSpacing,
} from '~/components/theme';

interface SegmentedToggleOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentedToggleProps<T extends string> {
  onChange: (value: T) => void;
  options: SegmentedToggleOption<T>[];
  testID?: string;
  value: T;
}

/**
 * A flat toggle built from our own tokens — no native segmented control, so
 * no OS glass material to fight with.
 */
export function SegmentedToggle<T extends string>({
  onChange,
  options,
  testID,
  value,
}: SegmentedToggleProps<T>) {
  return (
    <View style={styles.track} testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors['text-secondary'],
    fontSize: fontSizes.footnote,
    fontWeight: fontWeights.semibold,
  },
  labelSelected: {
    color: colors['primary-foreground'],
  },
  segment: {
    alignItems: 'center',
    borderRadius: radii.full,
    justifyContent: 'center',
    paddingHorizontal: themeSpacing.md,
  },
  segmentSelected: {
    backgroundColor: colors.accent,
  },
  track: {
    // Matches the nav bar's IconButton default size (componentSizes.lg) so
    // the toggle sits at the same height as the buttons beside it.
    backgroundColor: colors.muted,
    borderRadius: radii.full,
    flexDirection: 'row',
    height: componentSizes.lg,
    padding: 2,
  },
});

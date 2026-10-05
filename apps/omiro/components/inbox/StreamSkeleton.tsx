import { View } from 'react-native';

import { useStyles } from '~/components/theme';

const ROW_TITLE_WIDTHS = ['60%', '48%', '66%', '40%', '56%'] as const;

// Static placeholder cards shown only on a cold start, before the first page
// lands. No shimmer: a looping animation per row is exactly the per-frame
// cost the stream is trying to avoid.
export function StreamSkeleton() {
  const styles = useStyles((theme) => ({
    row: {
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      flexDirection: 'row',
      gap: 14,
      marginHorizontal: 16,
      marginVertical: 5,
      padding: 16,
    },
    tile: { backgroundColor: theme.colors.border, borderRadius: 15, height: 44, width: 44 },
    lines: { flex: 1, gap: 9, paddingTop: 4 },
    title: { backgroundColor: theme.colors.border, borderRadius: 8, height: 16 },
    preview: {
      backgroundColor: theme.colors.border,
      borderRadius: 6,
      height: 12,
      opacity: 0.7,
      width: '90%',
    },
  }));

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
      accessible
      testID="stream-skeleton"
    >
      {ROW_TITLE_WIDTHS.map((width) => (
        <View key={width} style={styles.row}>
          <View style={styles.tile} />
          <View style={styles.lines}>
            <View style={[styles.title, { width }]} />
            <View style={styles.preview} />
          </View>
        </View>
      ))}
    </View>
  );
}

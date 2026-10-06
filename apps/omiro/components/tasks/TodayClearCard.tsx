import { Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

// Shown in place of the Today list once everything planned for today is done.
export function TodayClearCard() {
  const { foreground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    card: {
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 22,
    },
    tile: {
      alignItems: 'center',
      backgroundColor: theme.colors.lime,
      borderCurve: 'continuous',
      borderRadius: 15,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    label: { ...theme.textVariants.title2, color: theme.colors.foreground },
  }));
  return (
    <View style={styles.card} testID="tasks-today-clear">
      <View style={styles.tile}>
        <AppIcon name="checkmark" size={24} tintColor={foreground} />
      </View>
      <Text style={styles.label}>All done for today</Text>
    </View>
  );
}

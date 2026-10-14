import { Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

export function AuthArtwork({ compact = false }: { compact?: boolean }) {
  const {
    foreground,
    primary,
    primaryForeground,
    eventViolet,
    eventSky,
    lime,
    limeForeground,
    bar,
    barForeground,
    mutedForeground,
  } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    scene: { width: '100%', maxWidth: 320, alignSelf: 'center', gap: 10 },
    tiles: { flexDirection: 'row', gap: 8 },
    tile: {
      flex: 1,
      height: compact ? 52 : 68,
      borderRadius: theme.borderRadii.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    tileLabel: { ...theme.textVariants.chip, color: foreground },
    composer: {
      height: compact ? 46 : 58,
      paddingHorizontal: 14,
      borderRadius: theme.borderRadii.xl,
      backgroundColor: bar,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    composerLabel: { ...theme.textVariants.subhead, color: mutedForeground },
    composerControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    composerIcon: { alignItems: 'center', justifyContent: 'center', width: 28, height: 28 },
    send: {
      width: 36,
      height: 36,
      borderRadius: theme.borderRadii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: primary,
    },
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.scene}
    >
      <View style={styles.tiles}>
        <View style={[styles.tile, { backgroundColor: eventViolet }]}>
          <AppIcon name="bubble.left.and.bubble.right.fill" size={21} tintColor={foreground} />
          <Text style={styles.tileLabel}>Chat</Text>
        </View>
        <View style={[styles.tile, { backgroundColor: eventSky }]}>
          <AppIcon name="text.alignleft" size={21} tintColor={foreground} />
          <Text style={styles.tileLabel}>Notes</Text>
        </View>
        <View style={[styles.tile, { backgroundColor: lime }]}>
          <AppIcon name="checkmark" size={21} tintColor={limeForeground} />
          <Text style={[styles.tileLabel, { color: limeForeground }]}>Tasks</Text>
        </View>
      </View>
      <View style={styles.composer}>
        <Text style={styles.composerLabel}>Message</Text>
        <View style={styles.composerControls}>
          <View style={styles.composerIcon}>
            <AppIcon name="plus" size={19} tintColor={barForeground} />
          </View>
          <View style={styles.send}>
            <AppIcon name="arrow.up" size={18} tintColor={primaryForeground} />
          </View>
        </View>
      </View>
    </View>
  );
}

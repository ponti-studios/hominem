import type { SFSymbol } from 'expo-symbols';
import { Text, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import { fontFamilies, useAppTheme, useStyles } from '~/components/theme';

import { Button } from './button';
import AppIcon from './icon';

type EmptyStateTone = 'violet' | 'coral' | 'sky' | 'sun';

interface EmptyStateProps {
  action?: { label: string; onPress: () => void };
  description?: string;
  sfSymbol?: SFSymbol;
  title: string;
  // Which pastel fill the tilted tile takes; the same four the event cards use.
  tone?: EmptyStateTone;
}

// The one empty / error / "gone" surface: a tilted pastel tile, a big title, a
// short line of help, and at most one primary action. Mirrors the old Time tab's
// "A clear day" so every dead end in the app looks like it belongs to it.
function EmptyState({ action, description, sfSymbol, title, tone = 'violet' }: EmptyStateProps) {
  const colors = useAppTheme().colors;
  const fills: Record<EmptyStateTone, string> = {
    violet: colors.eventViolet,
    coral: colors.eventCoral,
    sky: colors.eventSky,
    sun: colors.eventSun,
  };
  const styles = useStyles((theme) => ({
    container: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    content: { alignItems: 'center', gap: 14, maxWidth: 340, paddingHorizontal: 32 },
    tile: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 40,
      height: 120,
      justifyContent: 'center',
      transform: [{ rotate: '-6deg' }],
      width: 120,
    },
    title: {
      color: theme.colors.foreground,
      fontFamily: fontFamilies.sans,
      fontSize: 26,
      fontWeight: '800',
      marginTop: 8,
      textAlign: 'center',
    },
    description: {
      color: theme.colors.mutedForeground,
      fontFamily: fontFamilies.sans,
      fontSize: 16,
      lineHeight: 22,
      textAlign: 'center',
    },
  }));

  return (
    <Reanimated.View entering={FadeIn.duration(280)} style={styles.container}>
      <View style={styles.content}>
        {sfSymbol ? (
          <View style={[styles.tile, { backgroundColor: fills[tone] }]}>
            <AppIcon name={sfSymbol} size={48} tintColor={colors.eventForeground} />
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {action ? <Button label={action.label} onPress={action.onPress} variant="primary" /> : null}
      </View>
    </Reanimated.View>
  );
}

export { EmptyState };
export type { EmptyStateTone };

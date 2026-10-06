import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import { useStyles } from '~/components/theme';
import { consumeActiveEnhanceSession } from '~/services/ai/active-enhance-session';
import { useTextEnhance } from '~/services/ai/use-text-enhance';
import t from '~/translations';

// The wand button navigates here instead of opening an inline panel -- check
// active-enhance-session.ts to see how this screen grabs the triggering
// composer's draft without needing router params or shared context.
export default function EnhanceSheetScreen() {
  const router = useRouter();
  const [session] = useState(consumeActiveEnhanceSession);
  const { enhance, isEnhancing } = useTextEnhance();
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles((theme) => ({
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 28 },
    header: { alignItems: 'center', gap: 6 },
    title: { ...theme.textVariants.headline, color: theme.colors.foreground, fontSize: 20 },
    subtitle: {
      ...theme.textVariants.subhead,
      color: theme.colors.mutedForeground,
      textAlign: 'center',
    },
  }));

  const runEnhance = useCallback(
    async (presetInstruction?: string) => {
      const text = session.getMessage();
      if (!text.trim() || isEnhancing) {
        return;
      }

      setError(null);
      try {
        const enhanced = await enhance({
          text,
          instruction: presetInstruction?.trim() || instruction.trim() || undefined,
        });
        session.setMessage(enhanced);
        router.back();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Enhancement failed');
      }
    },
    [enhance, instruction, isEnhancing, router, session],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.enhance.title}</Text>
        <Text style={styles.subtitle}>{t.enhance.subtitle}</Text>
      </View>
      <InlineEnhanceTray
        instruction={instruction}
        onInstructionChange={setInstruction}
        onPresetSelect={(preset) => {
          void runEnhance(preset);
        }}
        onCancel={() => router.back()}
        onConfirm={() => {
          void runEnhance();
        }}
        isEnhancing={isEnhancing}
        error={error}
      />
    </View>
  );
}

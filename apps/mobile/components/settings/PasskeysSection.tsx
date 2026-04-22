import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { useThemeColors } from '~/components/theme/theme';

import { useSharedStyles } from '../theme/styles';
import { RowSeparator } from './RowSeparator';
import { SectionCard } from './SectionCard';
import { SectionLabel } from './SectionLabel';
import { SettingsRow } from './SettingsRow';

interface Passkey {
  id: string;
  name: string;
}

interface PasskeysSectionProps {
  passkeys: Passkey[];
  isLoading: boolean;
  onAddPress: () => void;
  onDeletePress: (id: string, name: string) => void;
}

export function PasskeysSection({
  passkeys,
  isLoading,
  onAddPress,
  onDeletePress,
}: PasskeysSectionProps) {
  const themeColors = useThemeColors();
  const styles = useSharedStyles();

  return (
    <>
      <SectionLabel>Passkeys</SectionLabel>
      <SectionCard>
        <SettingsRow
          sf="person.badge.key.fill"
          label="Add passkey"
          onPress={onAddPress}
          trailing={
            isLoading ? (
              <ActivityIndicator size="small" color={themeColors['text-tertiary']} />
            ) : undefined
          }
          disabled={isLoading}
        />
        {passkeys.map((pk) => (
          <React.Fragment key={pk.id}>
            <RowSeparator />
            <SettingsRow
              sf="key.fill"
              label={pk.name}
              trailing={
                <Pressable
                  onPress={() => onDeletePress(pk.id, pk.name)}
                  hitSlop={8}
                  accessibilityLabel={`Remove passkey ${pk.name}`}
                  accessibilityRole="button"
                >
                  <Image
                    source="sf:trash"
                    style={styles.trashIcon}
                    tintColor={themeColors.destructive}
                    contentFit="contain"
                  />
                </Pressable>
              }
            />
          </React.Fragment>
        ))}
      </SectionCard>
    </>
  );
}

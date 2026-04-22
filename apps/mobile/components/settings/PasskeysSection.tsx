import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { theme } from '~/components/theme';

import { styles } from '../theme/styles';
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
              <ActivityIndicator size="small" color={theme.colors['text-tertiary']} />
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
                    tintColor={theme.colors.destructive}
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

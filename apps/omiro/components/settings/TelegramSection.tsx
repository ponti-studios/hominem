import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { SectionLabel, SettingsRow } from '~/components/settings/SettingsRow';
import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

const telegramConnectionKey = ['telegram', 'connection'] as const;

export function TelegramSection() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { tertiary: tertiaryColor } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    disclosure: { paddingHorizontal: 16, fontSize: 12, color: theme.colors.mutedForeground },
  }));
  const connection = useQuery({
    queryKey: telegramConnectionKey,
    queryFn: async () => {
      const response = await client.api.telegram.connection.$get();
      return response.json();
    },
  });
  const link = useMutation({
    mutationFn: async () => {
      const response = await client.api.telegram.connection.link.$post();
      return response.json();
    },
    onSuccess: (result) => {
      if ('url' in result) {
        void Linking.openURL(result.url).catch(() =>
          Alert.alert(t.settings.telegram.errorTitle, t.settings.telegram.errorMessage),
        );
      }
      void queryClient.invalidateQueries({ queryKey: telegramConnectionKey });
    },
    onError: () => Alert.alert(t.settings.telegram.errorTitle, t.settings.telegram.errorMessage),
  });
  const unlink = useMutation({
    mutationFn: () => client.api.telegram.connection.$delete(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: telegramConnectionKey });
      Alert.alert(t.settings.telegram.unlinkedTitle, t.settings.telegram.unlinkedMessage);
    },
    onError: () => Alert.alert(t.settings.telegram.errorTitle, t.settings.telegram.errorMessage),
  });

  const status = connection.data;
  const startLink = () => {
    if (!status?.available) {
      return;
    }
    if (!status.configured) {
      Alert.alert(t.settings.telegram.setupTitle, t.settings.telegram.setupMessage, [
        {
          text: t.settings.telegram.copyAccountId,
          onPress: () => Clipboard.setStringAsync(status.accountId),
        },
        { text: t.settings.telegram.ok },
      ]);
      return;
    }
    link.mutate();
  };

  const onPress = () => {
    if (status?.connected) {
      Alert.alert(t.settings.telegram.unlinkTitle, t.settings.telegram.unlinkMessage, [
        { text: t.settings.telegram.cancel, style: 'cancel' },
        { text: t.settings.telegram.unlink, style: 'destructive', onPress: () => unlink.mutate() },
      ]);
      return;
    }
    startLink();
  };

  const description = connection.isPending
    ? t.settings.telegram.loading
    : status?.connected
      ? t.settings.telegram.connected
      : status?.available === false
        ? t.settings.telegram.unavailable
        : status?.configured === false
          ? t.settings.telegram.needsSetup
          : connection.isError
            ? t.settings.telegram.errorMessage
            : t.settings.telegram.disconnected;

  return (
    <>
      <SectionLabel>{t.settings.telegram.section}</SectionLabel>
      <SettingsRow
        icon="paperplane"
        label={t.settings.telegram.label}
        description={description}
        onPress={status?.available ? onPress : undefined}
        testID="settings-telegram-connection"
        accessory={
          connection.isPending || link.isPending || unlink.isPending ? (
            <ActivityIndicator size="small" color={tertiaryColor} />
          ) : status?.available ? (
            <AppIcon name="chevron.right" size={12} tintColor={tertiaryColor} />
          ) : null
        }
      />
      <View>
        <Text style={styles.disclosure}>{t.settings.telegram.privacyDisclosure}</Text>
      </View>
    </>
  );
}

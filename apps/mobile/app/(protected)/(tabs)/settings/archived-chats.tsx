import {
  Button as SwiftUIButton,
  Form as SwiftUIForm,
  Host as SwiftUIHost,
  HStack,
  Image as SwiftUIImage,
  Section as SwiftUISection,
  Spacer,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  foregroundStyle,
  listStyle,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import type { RelativePathString } from 'expo-router';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { useArchivedSessions } from '~/hooks/useArchivedSessions';
import { formatRelativeAge } from '~/services/date/format-relative-age';

export default function ArchivedChatsScreen() {
  const router = useRouter();
  const { data: chats = [] } = useArchivedSessions();
  const onPressChat = useCallback(
    (chatId: string) => {
      router.push(`/(protected)/(tabs)/chat/${chatId}` as RelativePathString);
    },
    [router],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Archived chats',
        }}
      />
      <ArchivedChatsSwiftUI chats={chats} onPressChat={onPressChat} />
    </>
  );
}

function ArchivedChatsSwiftUI({
  chats,
  onPressChat,
}: {
  chats: NonNullable<ReturnType<typeof useArchivedSessions>['data']>;
  onPressChat: (chatId: string) => void;
}) {
  return (
    <SwiftUIHost style={swiftUIStyles.host} useViewportSizeMeasurement>
      <SwiftUIForm modifiers={[listStyle('insetGrouped')]}>
        <SwiftUISection>
          <VStack spacing={2} modifiers={[padding({ vertical: 4 })]}>
            <SwiftUIText
              modifiers={[
                font({ size: 13 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              Archived chats
            </SwiftUIText>
            <SwiftUIText modifiers={[font({ size: 28, weight: 'bold' })]}>
              Revisit past conversations
            </SwiftUIText>
            <SwiftUIText
              modifiers={[
                font({ size: 16 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              Archived chats are hidden from the main chat flow but remain available here.
            </SwiftUIText>
          </VStack>
        </SwiftUISection>

        <SwiftUISection>
          {chats.length > 0 ? (
            chats.map((chat) => (
              <SwiftUIButton
                key={chat.id}
                onPress={() => onPressChat(chat.id)}
                modifiers={[buttonStyle('plain')]}
              >
                <HStack spacing={10}>
                  <SwiftUIImage systemName="tray" size={14} color="#8E8E93" />
                  <VStack alignment="leading" spacing={2}>
                    <SwiftUIText>{chat.title ?? 'Untitled session'}</SwiftUIText>
                    <SwiftUIText
                      modifiers={[
                        font({ size: 12 }),
                        foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                      ]}
                    >
                      Archived {formatRelativeAge(chat.archivedAt ?? chat.activityAt)}
                    </SwiftUIText>
                  </VStack>
                  <Spacer />
                  <SwiftUIImage systemName="chevron.right" size={12} color="#C7C7CC" />
                </HStack>
              </SwiftUIButton>
            ))
          ) : (
            <VStack spacing={2} modifiers={[padding({ vertical: 2 })]}>
              <SwiftUIText>No archived chats yet</SwiftUIText>
              <SwiftUIText
                modifiers={[
                  font({ size: 14 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                Chats you archive will appear here for later reference.
              </SwiftUIText>
            </VStack>
          )}
        </SwiftUISection>
      </SwiftUIForm>
    </SwiftUIHost>
  );
}

const swiftUIStyles = {
  host: {
    flex: 1,
  },
} as const;

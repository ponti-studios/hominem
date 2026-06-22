import ExpoSegmentedControl from '@expo/ui/community/segmented-control';
import { GlassEffectContainer, Host, HStack, RNHostView } from '@expo/ui/swift-ui';
import { frame, glassEffect, padding } from '@expo/ui/swift-ui/modifiers';
import React from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, View } from 'react-native';

import { makeStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import type { WorkspaceHomeTab } from '~/services/workspace/home-screen-state';
import t from '~/translations';

interface WorkspaceHomeHeaderProps {
  activeTab: WorkspaceHomeTab;
  topInset: number;
  onChangeTab: (tab: WorkspaceHomeTab) => void;
  onOpenArchivedChats: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

const TAB_VALUES = [t.workspace.home.chatsTab, t.workspace.home.notesTab];

export function WorkspaceHomeHeader({
  activeTab,
  topInset,
  onChangeTab,
  onOpenArchivedChats,
  onOpenSearch,
  onOpenSettings,
}: WorkspaceHomeHeaderProps) {
  const styles = useStyles();
  const handleOpenMenu = React.useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [t.workspace.home.archivedChats, t.workspace.home.settings, 'Cancel'],
        cancelButtonIndex: 2,
      },
      (selectedIndex) => {
        if (selectedIndex === 0) {
          onOpenArchivedChats();
          return;
        }

        if (selectedIndex === 1) {
          onOpenSettings();
        }
      },
    );
  }, [onOpenArchivedChats, onOpenSettings]);

  return (
    <View style={[styles.container, { paddingTop: topInset + 18 }]}>
      <View style={styles.topRow}>
        <View style={styles.utilitySpacer} />

        <Host style={styles.segmentedHost}>
          <GlassEffectContainer>
            <HStack
              modifiers={[
                glassEffect({
                  glass: { variant: 'clear' },
                  shape: 'roundedRectangle',
                  cornerRadius: 18,
                }),
                padding({ all: 2 }),
              ]}
            >
              <RNHostView matchContents>
                <ExpoSegmentedControl
                  appearance="light"
                  selectedIndex={activeTab === 'notes' ? 1 : 0}
                  style={styles.segmentedControl}
                  testID="home-tab-control"
                  values={TAB_VALUES}
                  onChange={(event) =>
                    onChangeTab(event.nativeEvent.selectedSegmentIndex === 1 ? 'notes' : 'chats')
                  }
                />
              </RNHostView>
            </HStack>
          </GlassEffectContainer>
        </Host>

        <Host style={styles.utilityHost}>
          <GlassEffectContainer>
            <HStack
              modifiers={[
                glassEffect({
                  glass: { variant: 'clear' },
                  shape: 'roundedRectangle',
                  cornerRadius: 18,
                }),
                frame({ minHeight: 36 }),
              ]}
            >
              <RNHostView matchContents>
                <View style={styles.utilityPill}>
                  <Pressable
                    accessibilityLabel={t.workspace.home.showSearchA11y}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={onOpenSearch}
                    testID="home-search-action"
                  >
                    <View style={styles.utilityButton}>
                      <AppIcon name="magnifyingglass" size={15} />
                    </View>
                  </Pressable>
                  <View style={styles.utilityDivider} />
                  <Pressable
                    accessibilityLabel={t.workspace.home.openMenuA11y}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={handleOpenMenu}
                    testID="home-overflow-action"
                  >
                    <View style={styles.utilityButton}>
                      <AppIcon name="person.crop.circle" size={16} />
                    </View>
                  </Pressable>
                </View>
              </RNHostView>
            </HStack>
          </GlassEffectContainer>
        </Host>
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    paddingBottom: 8,
  },
  segmentedControl: {
    height: 28,
    width: 144,
  },
  segmentedHost: {
    minHeight: 32,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  utilityButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  utilityDivider: {
    backgroundColor: theme.colors['border-subtle'],
    height: 16,
    width: StyleSheet.hairlineWidth,
  },
  utilityHost: {
    minHeight: 36,
  },
  utilityPill: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  utilitySpacer: {
    width: 78,
  },
}));

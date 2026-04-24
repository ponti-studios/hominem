import { parseInboxTimestamp } from '@hominem/chat';
import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import { Text, makeStyles, radii, spacing } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';

import type { InboxStreamItemData } from './InboxStreamItem.types';

type InboxStreamItemPresentationProps = {
  item: InboxStreamItemData;
  compact?: boolean;
  isActive?: boolean;
  showPreview?: boolean;
};

const ICON_SIZE = 32;
const ICON_SIZE_COMPACT = 26;

export function InboxStreamItemPresentation({
  item,
  compact = false,
  isActive = false,
  showPreview = false,
}: InboxStreamItemPresentationProps) {
  const styles = useStyles();
  const title = item.title ?? item.preview ?? 'Untitled';
  const icon = item.kind === 'note' ? 'sf:note.text' : 'sf:bubble.left.fill';

  return (
    <View style={[styles.row, compact && styles.rowCompact, isActive && styles.rowActive]}>
      <View
        style={[
          styles.iconContainer,
          compact && styles.iconContainerCompact,
          item.kind === 'chat' && styles.iconContainerChat,
        ]}
      >
        <Image
          source={icon}
          style={compact ? styles.iconCompact : styles.icon}
          contentFit="contain"
        />
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.date, compact && styles.dateCompact]}>
            {formatTimestamp(item.updatedAt)}
          </Text>
        </View>
        {showPreview && item.preview ? (
          <Text style={[styles.preview, compact && styles.previewCompact]} numberOfLines={1}>
            {item.preview}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function formatTimestamp(value: string): string {
  try {
    const date = parseInboxTimestamp(value);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.round((today.getTime() - targetDay.getTime()) / 86400000);

    if (dayDiff === 0) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    if (dayDiff === 1) {
      return 'Yesterday';
    }
    if (dayDiff > 1 && dayDiff < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  rowCompact: {
    borderRadius: radii.md,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  rowActive: {
    backgroundColor: theme.colors['bg-elevated'],
  },
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radii.sm,
    backgroundColor: theme.colors['bg-elevated'],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconContainerCompact: {
    width: ICON_SIZE_COMPACT,
    height: ICON_SIZE_COMPACT,
  },
  iconContainerChat: {
    backgroundColor: theme.colors['emphasis-minimal'],
  },
  icon: {
    width: 16,
    height: 16,
  },
  iconCompact: {
    width: 13,
    height: 13,
  },
  content: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    color: theme.colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  titleCompact: {
    fontSize: 14,
  },
  date: {
    color: theme.colors['text-tertiary'],
    flexShrink: 0,
    fontSize: 12,
  },
  dateCompact: {
    fontSize: 11,
  },
  preview: {
    color: theme.colors['text-secondary'],
    fontSize: 13,
    lineHeight: 18,
  },
  previewCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
}));

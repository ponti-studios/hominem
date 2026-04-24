import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import { Text, makeStyles, spacing } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';

import type { InboxStreamItemData } from './InboxStreamItem.types';

type InboxStreamItemPresentationProps = {
  item: InboxStreamItemData;
  compact?: boolean;
  isActive?: boolean;
  showPreview?: boolean;
};

export function InboxStreamItemPresentation({
  item,
  compact = false,
  isActive = false,
  showPreview = false,
}: InboxStreamItemPresentationProps) {
  const styles = useStyles();
  const themeColors = useThemeColors();
  const title = item.title ?? item.preview ?? 'Untitled';
  const icon = item.kind === 'note' ? 'sf:square.and.pencil' : 'sf:bubble.left';

  return (
    <View style={[styles.row, compact && styles.rowCompact, isActive && styles.rowActive]}>
      <View style={styles.rowTop}>
        <View style={styles.rowTitleWrap}>
          <Image
            source={icon}
            style={compact ? styles.rowIconCompact : styles.rowIcon}
            tintColor={themeColors['text-secondary']}
            contentFit="contain"
          />
          <Text style={[styles.rowTitle, compact && styles.rowTitleCompact]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={[styles.rowDate, compact && styles.rowDateCompact]}>
          {formatTimestamp(item.updatedAt)}
        </Text>
      </View>
      {showPreview && item.preview ? (
        <Text style={[styles.rowPreview, compact && styles.rowPreviewCompact]} numberOfLines={1}>
          {item.preview}
        </Text>
      ) : null}
    </View>
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
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
}

const useStyles = makeStyles((theme) => ({
  row: {
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  rowCompact: {
    borderRadius: 10,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  rowActive: {
    backgroundColor: theme.colors['bg-elevated'],
    borderColor: theme.colors.accent,
  },
  rowTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'space-between',
  },
  rowTitleWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing[2],
    minWidth: 0,
  },
  rowIcon: {
    flexShrink: 0,
    height: 16,
    width: 16,
  },
  rowIconCompact: {
    flexShrink: 0,
    height: 14,
    width: 14,
  },
  rowTitle: {
    color: theme.colors.foreground,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  rowTitleCompact: {
    fontSize: 14,
  },
  rowDate: {
    color: theme.colors['text-tertiary'],
    flexShrink: 0,
    fontSize: 11,
  },
  rowDateCompact: {
    fontSize: 11,
  },
  rowPreview: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
  },
  rowPreviewCompact: {
    fontSize: 12,
  },
}));

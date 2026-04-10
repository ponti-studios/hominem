import { LucideIcon } from 'lucide-react-native';
import React from 'react';

import { theme } from '~/components/theme';

type IconName = keyof typeof iconMap;

const iconMap = {
  'arrow.clockwise': 'RotateCw',
  'arrow.left': 'ArrowLeft',
  'arrow.up': 'ArrowUp',
  calendar: 'Calendar',
  camera: 'Camera',
  'camera.rotate': 'FlipHorizontal',
  'checkmark.circle': 'CheckCircle',
  'checkmark.circle.fill': 'CheckCircle',
  'chevron.right': 'ChevronRight',
  clock: 'Clock',
  'doc.on.doc': 'Copy',
  ellipsis: 'MoreVertical',
  gearshape: 'Settings',
  'info.circle': 'Info',
  magnifyingglass: 'Search',
  mic: 'Mic',
  'note.text': 'FileText',
  'note.text.badge.plus': 'FileText',
  'plus.circle': 'PlusCircle',
  plus: 'Plus',
  'speaker.wave.2': 'Volume2',
  'square.and.arrow.up': 'Share',
  'square.and.pencil': 'Edit',
  'stop.fill': 'Square',
  tray: 'Inbox',
  trash: 'Trash2',
  xmark: 'X',
  'xmark.circle.fill': 'XCircle',
  'bubble.left': 'MessageCircle',
  circle: 'Circle',
} as const;

const ICON_SIZE_MAP = {
  20: 20,
  24: 24,
  32: 32,
  48: 48,
} as const;

type IconSize = keyof typeof ICON_SIZE_MAP;

interface IconProps {
  name: IconName;
  size?: IconSize | number;
  color?: string;
}

const AppIcon = ({ name, size = 24, color }: IconProps) => {
  const iconColor = color ?? theme.colors['icon-primary'];
  const iconName = iconMap[name];

  if (!iconName) {
    console.warn(`Icon "${name}" not found in iconMap`);
    return null;
  }

  const IconComponent = require('lucide-react-native')[iconName] as LucideIcon;
  const iconSize = typeof size === 'number' ? size : ICON_SIZE_MAP[size];

  return <IconComponent size={iconSize} color={iconColor} />;
};

export default AppIcon;
export type { IconProps, IconName, IconSize };

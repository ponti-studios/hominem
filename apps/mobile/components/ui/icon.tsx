import { SymbolView, type AndroidSymbol, type SFSymbol, type SymbolViewProps } from 'expo-symbols';
import type { TextStyle } from 'react-native';

import { theme } from '~/theme';

type AppIconName = SFSymbol;

const ANDROID_SYMBOL_MAP: Partial<Record<AppIconName, AndroidSymbol>> = {
  'arrow.clockwise': 'refresh',
  'arrow.left': 'arrow_back',
  'arrow.up': 'arrow_upward',
  calendar: 'calendar_today',
  camera: 'camera',
  'camera.rotate': 'flip_camera_android',
  'checkmark.circle': 'check_circle',
  'checkmark.circle.fill': 'check_circle',
  'chevron.right': 'chevron_right',
  clock: 'schedule',
  'doc.on.doc': 'content_copy',
  ellipsis: 'more_vert',
  gearshape: 'settings',
  'info.circle': 'info',
  magnifyingglass: 'search',
  mic: 'mic',
  'note.text': 'note',
  'note.text.badge.plus': 'note_add',
  'plus.circle': 'add_circle',
  plus: 'add',
  'speaker.wave.2': 'volume_up',
  'square.and.arrow.up': 'share',
  'square.and.pencil': 'edit_square',
  'stop.fill': 'stop',
  tray: 'inbox',
  trash: 'delete',
  xmark: 'close',
  'xmark.circle.fill': 'cancel',
  'bubble.left': 'chat_bubble',
  circle: 'circle',
};

interface IconProps {
  color?: string;
  name: AppIconName;
  size: number;
  style?: TextStyle | TextStyle[];
}

const AppIcon = ({ color = theme.colors.foreground, name, size, style }: IconProps) => {
  const androidSymbol = ANDROID_SYMBOL_MAP[name];

  return (
    <SymbolView
      name={
        androidSymbol
          ? {
              ios: name,
              android: androidSymbol,
              web: androidSymbol,
            }
          : name
      }
      size={size}
      tintColor={color}
      style={style as SymbolViewProps['style']}
    />
  );
};

export default AppIcon;

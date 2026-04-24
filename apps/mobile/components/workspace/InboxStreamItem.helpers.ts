// Android only — iOS uses the native SwiftUI Menu in InboxStreamItem.
import { Alert } from 'react-native';

import type { InboxStreamItemData } from './InboxStreamItem.types';

interface InboxItemMenuCallbacks {
  onDelete: () => void;
  onArchive: () => void;
}

export function showInboxItemMenu(
  item: InboxStreamItemData,
  { onArchive, onDelete }: InboxItemMenuCallbacks,
) {
  if (item.kind === 'note') {
    Alert.alert(item.title ?? 'Note', undefined, [
      { text: 'Delete', style: 'destructive', onPress: onDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  } else {
    Alert.alert(item.title ?? 'Chat', undefined, [
      { text: 'Archive', style: 'destructive', onPress: onArchive },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
}

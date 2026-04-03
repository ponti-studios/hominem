import type { Note } from '@hominem/rpc/types';

import AppIcon from '~/components/ui/icon';
import { theme } from '~/theme';

const ITEM_ICON_SIZE = 20;
export const NoteIcon = ({ item }: { item: Note }) => {
  switch (item.type) {
    case 'task':
      return <AppIcon name="circle" color={theme.colors['emphasis-low']} size={ITEM_ICON_SIZE} />;
    case 'timer':
      return <AppIcon name="clock" color={theme.colors['emphasis-low']} size={ITEM_ICON_SIZE} />;
    case 'journal':
    case 'document':
    case 'essay':
    case 'blog_post':
    case 'social_post':
    case 'tweet':
    case 'note':
      return (
        <AppIcon name="note.text" color={theme.colors['emphasis-low']} size={ITEM_ICON_SIZE} />
      );
    default:
      return (
        <AppIcon name="note.text" color={theme.colors['emphasis-low']} size={ITEM_ICON_SIZE} />
      );
  }
};

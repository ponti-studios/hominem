import { StreamingText as KitStreamingText } from '@hominem/rn-kit';
import type { TextStyle } from 'react-native';

import { useAppTheme } from '~/components/theme';

// Theme adapter over the shared StreamingText: ink and caret use the app's lime.
export function StreamingText({ content, style }: { content: string; style: TextStyle }) {
  const { lime } = useAppTheme().colors;
  return <KitStreamingText content={content} inkColor={lime} style={style} />;
}

import { useAppTheme } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { IconButton } from '~/components/ui/icon-button';

/** The round glass ✕ in the corner of a chat sheet. Every sheet and picker closes with this one. */
export function ChatSheetCloseButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { foreground } = useAppTheme().colors;
  return (
    <IconButton variant="glass" size="md" accessibilityLabel={label} onPress={onPress}>
      <AppIcon name="xmark" size={14} tintColor={foreground} />
    </IconButton>
  );
}

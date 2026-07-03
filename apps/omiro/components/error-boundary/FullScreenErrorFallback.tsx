import { ErrorFallback } from '~/components/error-boundary/ErrorFallback';
import t from '~/translations';

interface FullScreenErrorFallbackProps {
  actionLabel: string;
  message: string;
  onPress: () => void;
}

export function FullScreenErrorFallback({
  actionLabel,
  message,
  onPress,
}: FullScreenErrorFallbackProps) {
  return (
    <ErrorFallback
      title={t.errors.somethingWentWrong}
      titleSize="title1"
      message={message}
      actionLabel={actionLabel}
      onAction={onPress}
      buttonVariant="primary"
    />
  );
}

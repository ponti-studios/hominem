export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'destructive'
  | 'icon'
  | 'ghost'
  | 'link'
  | 'outline'
  | 'secondary';

export type ButtonSize =
  | 'default'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xs'
  | 'icon'
  | 'icon-xs'
  | 'icon-sm'
  | 'icon-lg';

export interface ButtonBaseProps {
  isLoading?: boolean | undefined;
  fullWidth?: boolean | undefined;
  size?: ButtonSize;
  title?: string | undefined;
  variant?: ButtonVariant;
}

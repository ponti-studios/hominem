import { cn } from '~/lib/utils';

type ContainerProps = {
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZES = {
  xs: 'max-w-2xl',
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
} as const;

/** Standard page column. One max-width scale for the whole platform. */
export function Container({ children, size = 'lg', className }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8', SIZES[size], className)}>
      {children}
    </div>
  );
}

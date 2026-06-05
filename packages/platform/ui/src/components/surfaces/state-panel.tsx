import type { EmptyStateProps } from './empty-state';
import { EmptyState } from './empty-state';

interface StatePanelProps {
  icon?: EmptyStateProps['icon'];
  title?: EmptyStateProps['title'];
  description?: EmptyStateProps['description'];
  actions?: EmptyStateProps['action'];
  children?: EmptyStateProps['children'];
  layout?: EmptyStateProps['layout'];
  variant?: 'default' | 'dashed';
}

export function StatePanel({
  icon,
  title,
  description,
  actions,
  children,
  layout = 'centered',
  variant = 'default',
}: StatePanelProps) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={actions}
      children={children}
      layout={layout}
      variant={variant}
      size="lg"
    />
  );
}

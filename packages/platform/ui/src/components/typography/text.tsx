import * as React from 'react';

import { cn } from '../../lib/utils';
import type { TextVariant } from './text.types';

const legacyVariantMap = {
  'body-1': 'headline',
  'body-2': 'body',
  'body-3': 'footnote',
  'body-4': 'caption1',
} as const;

type TextElement = 'p' | 'span' | 'div' | 'li' | 'label' | 'strong' | 'em' | 'small';

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Visual variant from the VOID body typography scale.
   * Defaults to body-2.
   */
  variant?: TextVariant;
  /**
   * HTML element to render.
   * Defaults to `p`.
   */
  as?: TextElement;
  /** Muted/secondary color treatment */
  muted?: boolean;
}

/**
 * Text — body copy primitive mapped to VOID typography scale.
 * Replaces direct `<p>` / `<span>` usage for body text in feature code.
 *
 * @example
 * <Text>Body copy</Text>
 * <Text variant="body-4" muted>Helper hint</Text>
 * <Text as="span" variant="body-3">Inline text</Text>
 */
function Text({
  variant = 'body',
  as: Comp = 'p',
  muted = false,
  className,
  ...props
}: TextProps) {
  const resolvedVariant = legacyVariantMap[variant as keyof typeof legacyVariantMap] ?? variant;
  return (
    <Comp className={cn(resolvedVariant, muted && 'text-text-tertiary', className)} {...props} />
  );
}

export { Text, type TextProps, type TextVariant };

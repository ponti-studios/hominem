'use client';

import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/utils';

export type ThemeToggleMode = 'light' | 'dark';

export interface ThemeToggleProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  mode: ThemeToggleMode;
  onModeChange: (mode: ThemeToggleMode) => void;
}

export function ThemeToggle({
  mode,
  onModeChange,
  className,
  type = 'button',
  ...props
}: ThemeToggleProps) {
  const isDark = mode === 'dark';

  return (
    <button
      type={type}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => onModeChange(isDark ? 'light' : 'dark')}
      className={cn(
        'border-border bg-background text-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors',
        isDark
          ? 'hover:bg-accent/15 hover:text-warning focus-visible:bg-accent/15 focus-visible:text-warning'
          : 'hover:bg-black hover:text-white focus-visible:bg-black focus-visible:text-white',
        className,
      )}
      {...props}
    >
      {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  );
}

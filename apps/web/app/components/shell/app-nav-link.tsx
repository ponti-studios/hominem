import { motion } from 'motion/react';
import { NavLink } from 'react-router';

import { cn } from '~/lib/utils';

type AppNavLinkProps = {
  to: string;
  label: string;
  end?: boolean;
  variant?: 'sidebar' | 'pill';
  icon?: React.ReactNode;
  prefetch?: 'intent' | 'viewport' | 'none';
  onNavigate?: () => void;
};

/**
 * The single navigation link primitive. Sidebar rows get a choreographed
 * `layoutId` active indicator; pills serve second-level domain nav.
 * Replaces the three copy-pasted NavLink class strings.
 */
export function AppNavLink({
  to,
  label,
  end,
  variant = 'sidebar',
  icon,
  prefetch = 'intent',
  onNavigate,
}: AppNavLinkProps) {
  if (variant === 'pill') {
    return (
      <NavLink
        className={({ isActive }) =>
          cn(
            'relative inline-flex h-8 shrink-0 items-center gap-1.5 border-b px-3 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors duration-200',
            isActive
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )
        }
        end={end}
        onClick={onNavigate}
        prefetch={prefetch}
        to={to}
      >
        {({ isActive }) => (
          <>
            {isActive ? (
              <motion.span
                aria-hidden
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 border-b border-primary"
                initial={{ opacity: 0, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            ) : null}
            {icon ? <span className="relative shrink-0 [&_svg]:size-3.5">{icon}</span> : null}
            <span className={icon ? 'relative hidden sm:inline' : 'relative'}>{label}</span>
          </>
        )}
      </NavLink>
    );
  }

  return (
    <NavLink
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-200',
          isActive
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
      end={end}
      onClick={onNavigate}
      prefetch={prefetch}
      to={to}
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-sm border border-border bg-muted"
              layoutId="sidebar-active"
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            />
          ) : null}
          <span
            aria-hidden
            className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 bg-primary"
            style={{ opacity: isActive ? 1 : 0, transition: 'opacity 200ms' }}
          />
          {icon ? <span className="relative shrink-0 [&_svg]:size-4">{icon}</span> : null}
          <span className="relative min-w-0 flex-1 truncate font-medium">{label}</span>
        </>
      )}
    </NavLink>
  );
}

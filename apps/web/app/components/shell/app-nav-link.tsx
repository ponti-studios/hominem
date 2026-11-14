import { motion } from 'motion/react';
import { NavLink } from 'react-router';

import { cn } from '~/lib/utils';

type AppNavLinkProps = {
  to: string;
  label: string;
  end?: boolean;
  activeContext?: boolean;
  variant?: 'sidebar' | 'nested' | 'pill';
  icon?: React.ReactNode;
  prefetch?: 'intent' | 'viewport' | 'none';
  onNavigate?: () => void;
};

/**
 * The single navigation link primitive for domain, nested, and compact navigation.
 */
export function AppNavLink({
  to,
  label,
  end,
  activeContext = false,
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

  if (variant === 'nested') {
    return (
      <NavLink
        className={({ isActive }) =>
          cn(
            'ml-4 flex min-h-10 items-center rounded-sm px-3 pl-11 text-sm transition-colors duration-150',
            isActive
              ? 'bg-muted font-medium text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )
        }
        end={end}
        onClick={onNavigate}
        prefetch={prefetch}
        to={to}
      >
        {label}
      </NavLink>
    );
  }

  return (
    <NavLink
      className={({ isActive }) => {
        const selected = isActive || activeContext;
        return cn(
          'group relative flex min-h-10 items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-150',
          selected
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        );
      }}
      end={end}
      onClick={onNavigate}
      prefetch={prefetch}
      to={to}
    >
      {
        <>
          {icon ? <span className="relative shrink-0 [&_svg]:size-4">{icon}</span> : null}
          <span className="relative min-w-0 flex-1 truncate font-medium">{label}</span>
        </>
      }
    </NavLink>
  );
}

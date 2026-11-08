import { motion } from 'motion/react';
import { NavLink } from 'react-router';

import { cn } from '~/lib/utils';

type AppNavLinkProps = {
  to: string;
  label: string;
  end?: boolean;
  variant?: 'sidebar' | 'pill';
  icon?: React.ReactNode;
  accent?: string;
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
  accent = '#d7ff3e',
  prefetch = 'intent',
  onNavigate,
}: AppNavLinkProps) {
  if (variant === 'pill') {
    return (
      <NavLink
        className={({ isActive }) =>
          cn(
            'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors duration-200',
            isActive ? 'text-[#101300]' : 'text-[#9ba3b4] hover:text-[#f2f4f8]',
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
                className="absolute inset-0 rounded-full"
                initial={{ opacity: 0, scale: 0.92 }}
                style={{ background: accent, boxShadow: `0 4px 20px -4px ${accent}66` }}
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
          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-200',
          isActive ? 'text-[#f2f4f8]' : 'text-[#9ba3b4] hover:bg-white/[0.04] hover:text-[#f2f4f8]',
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
              className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.06]"
              layoutId="sidebar-active"
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            />
          ) : null}
          <span
            aria-hidden
            className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-full"
            style={{
              background: accent,
              opacity: isActive ? 1 : 0,
              boxShadow: isActive ? `0 0 12px ${accent}` : undefined,
              transition: 'opacity 200ms',
            }}
          />
          {icon ? <span className="relative shrink-0 [&_svg]:size-4">{icon}</span> : null}
          <span className="relative min-w-0 flex-1 truncate font-medium">{label}</span>
        </>
      )}
    </NavLink>
  );
}

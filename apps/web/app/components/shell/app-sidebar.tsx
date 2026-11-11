import { motion } from 'motion/react';
import { memo } from 'react';

import { ENABLED_DOMAINS } from '~/domains';

import { AppNavLink } from './app-nav-link';

export const AppSidebar = memo(function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border p-3 md:flex">
      <nav aria-label="Domains" className="flex flex-col gap-0.5">
        {ENABLED_DOMAINS.map((domain, i) => {
          const Icon = domain.icon;
          return (
            <motion.div
              key={domain.id}
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: -12 }}
              transition={{ delay: 0.05 + i * 0.05, type: 'spring', stiffness: 320, damping: 30 }}
            >
              <AppNavLink
                end={domain.subNav.length === 0}
                icon={<Icon />}
                label={domain.label}
                onNavigate={onNavigate}
                prefetch="intent"
                to={domain.path}
              />
            </motion.div>
          );
        })}
      </nav>

      <div className="mt-auto px-3 pt-4 pb-1">
        <p className="font-mono text-[10px] leading-relaxed tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase">
          <Kbd>⌘K</Kbd> jump anywhere
        </p>
      </div>
    </aside>
  );
});

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}

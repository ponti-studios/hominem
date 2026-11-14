import { Menu } from 'lucide-react';

type AppTopbarProps = {
  pageTitle: string;
  onNavigationOpen: () => void;
};

export function AppTopbar({ pageTitle, onNavigationOpen }: AppTopbarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3 md:hidden">
      <button
        aria-label="Open navigation"
        className="flex size-10 shrink-0 items-center justify-center rounded-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={onNavigationOpen}
        type="button"
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <span className="min-w-0 truncate text-sm font-medium">{pageTitle}</span>
    </header>
  );
}

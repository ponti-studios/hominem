import { ArrowUpRight, CornerDownLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { buildPaletteIndex, searchPalette } from '~/lib/navigation';
import { cn } from '~/lib/utils';

const KIND_LABEL: Record<string, string> = {
  domain: 'Domains',
  page: 'Pages',
  action: 'Actions',
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const index = useMemo(() => buildPaletteIndex(), []);
  const results = useMemo(() => searchPalette(index, query), [index, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function go(path: string) {
    onClose();
    void navigate(path, { viewTransition: true });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[active];
      if (item) go(item.path);
    }
  }

  let lastKind = '';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[14vh]"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10"
            style={{
              boxShadow: '0 32px 96px -16px rgb(0 0 0 / 0.9), 0 0 0 1px rgb(215 255 62 / 0.08)',
            }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            role="dialog"
            aria-modal="true"
            aria-label="Jump anywhere"
            transition={{ type: 'spring', stiffness: 480, damping: 36 }}
          >
            <div className="gradient-hairline-top">
              <input
                ref={inputRef}
                aria-label="Search pages and actions"
                autoComplete="off"
                className="w-full bg-transparent px-5 py-4 text-[15px] text-[#f2f4f8] outline-none placeholder:text-[#5e6678]"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Jump to tasks, runway, applications…"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={`palette-item-${active}`}
                spellCheck={false}
                value={query}
              />
            </div>
            <div
              ref={listRef}
              id="palette-list"
              role="listbox"
              className="max-h-[46vh] overflow-y-auto border-t border-white/[0.06] p-2"
            >
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-[#5e6678]">
                  No matches for “{query}”.
                </p>
              ) : null}
              {results.map((item, i) => {
                const header =
                  item.kind !== lastKind ? (
                    <p
                      key={`header-${item.kind}`}
                      className="px-3 pt-3 pb-1 font-mono text-[10px] tracking-[0.16em] text-[#5e6678] uppercase"
                    >
                      {KIND_LABEL[item.kind]}
                    </p>
                  ) : null;
                lastKind = item.kind;
                return (
                  <div key={item.key}>
                    {header}
                    <button
                      aria-selected={i === active}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                        i === active ? 'bg-white/[0.07]' : 'bg-transparent',
                      )}
                      data-index={i}
                      id={`palette-item-${i}`}
                      onClick={() => go(item.path)}
                      onMouseMove={() => setActive(i)}
                      role="option"
                      type="button"
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          background: item.accent,
                          boxShadow: i === active ? `0 0 10px ${item.accent}` : undefined,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#f2f4f8]">
                          {item.label}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-[#5e6678]">
                          {item.hint}
                        </span>
                      </span>
                      {i === active ? (
                        <CornerDownLeft aria-hidden className="size-4 shrink-0 text-[#d7ff3e]" />
                      ) : (
                        <ArrowUpRight aria-hidden className="size-4 shrink-0 text-[#5e6678]" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-white/[0.06] px-5 py-2.5 font-mono text-[10px] tracking-wider text-[#5e6678] uppercase">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

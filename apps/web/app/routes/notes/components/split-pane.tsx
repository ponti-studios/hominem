import { Button } from '@hominem/ui/button';
import { cn } from '@hominem/ui/lib/utils';
import { GripVertical, PanelLeftClose, PanelRightClose } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';

interface SplitPaneProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  defaultSplit?: number;
  minWidth?: number;
  storageKey?: string;
  className?: string;
}

export function SplitPane({
  leftPanel,
  rightPanel,
  defaultSplit = 50,
  minWidth = 300,
  storageKey = 'notes-split-position',
  className,
}: SplitPaneProps) {
  const [splitPosition, setSplitPosition] = useState(() => {
    if (typeof window === 'undefined') {
      return defaultSplit;
    }

    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return defaultSplit;
    }

    const parsed = Number.parseInt(stored, 10);
    return !Number.isNaN(parsed) && parsed > 0 && parsed < 100 ? parsed : defaultSplit;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [collapsedSide, setCollapsedSide] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const persistSplitPosition = useCallback(
    (nextPosition: number) => {
      if (typeof window === 'undefined') {
        return;
      }

      window.localStorage.setItem(storageKey, String(Math.round(nextPosition)));
    },
    [storageKey],
  );

  const cleanupDrag = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
      const minPercent = (minWidth / rect.width) * 100;

      if (newPosition >= minPercent && newPosition <= 100 - minPercent) {
        setSplitPosition(newPosition);
        persistSplitPosition(newPosition);
      }
    };

    const handleMouseUp = () => {
      cleanupDrag();
    };

    dragCleanupRef.current?.();
    dragCleanupRef.current = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setIsDragging(true);
  }, [cleanupDrag, minWidth, persistSplitPosition]);

  const handleDoubleClick = useCallback(() => {
    setSplitPosition(defaultSplit);
    persistSplitPosition(defaultSplit);
  }, [defaultSplit, persistSplitPosition]);

  const toggleCollapseLeft = useCallback(() => {
    setCollapsedSide((prev) => (prev === 'left' ? null : 'left'));
  }, []);

  const toggleCollapseRight = useCallback(() => {
    setCollapsedSide((prev) => (prev === 'right' ? null : 'right'));
  }, []);

  const setContainerElement = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        cleanupDrag();
      }

      containerRef.current = element;
    },
    [cleanupDrag],
  );

  return (
    <div ref={setContainerElement} className={cn('flex h-full w-full', className)}>
      {/* Left Panel */}
      <div
        className={cn(
          'flex h-full flex-col overflow-hidden transition-all duration-200',
          collapsedSide === 'left' && 'w-0',
          collapsedSide === 'right' && 'flex-1',
          collapsedSide === null && 'border-r border-border/30',
        )}
        style={
          collapsedSide === null
            ? { width: `${splitPosition}%` }
            : collapsedSide === 'right'
              ? {}
              : { width: '0%' }
        }
      >
        {collapsedSide !== 'left' && (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-3 py-2">
              <span className="text-xs text-text-tertiary">Note</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={toggleCollapseLeft}
                title="Collapse note panel"
              >
                <PanelLeftClose className="size-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">{leftPanel}</div>
          </>
        )}
      </div>

      {/* Divider */}
      {collapsedSide === null && (
        <div
          className={cn(
            'relative flex w-1 cursor-col-resize items-center justify-center transition-colors',
            'bg-border/30 hover:bg-foreground/20',
            isDragging && 'bg-foreground/30',
          )}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <GripVertical className="size-3 text-text-tertiary opacity-50" />
        </div>
      )}

      {/* Right Panel */}
      <div
        className={cn(
          'flex h-full flex-col overflow-hidden transition-all duration-200',
          collapsedSide === 'right' && 'w-0',
          collapsedSide === 'left' && 'flex-1',
          collapsedSide === null && 'border-l border-border/30',
        )}
        style={
          collapsedSide === null
            ? { width: `${100 - splitPosition}%` }
            : collapsedSide === 'left'
              ? {}
              : { width: '0%' }
        }
      >
        {collapsedSide !== 'right' && (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-3 py-2">
              <span className="text-xs text-text-tertiary">Chat</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={toggleCollapseRight}
                title="Collapse chat panel"
              >
                <PanelRightClose className="size-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">{rightPanel}</div>
          </>
        )}
      </div>

      {/* Expand buttons when collapsed */}
      {collapsedSide === 'left' && (
        <Button
          variant="outline"
          size="sm"
          className="absolute left-2 top-1/2 -translate-y-1/2"
          onClick={toggleCollapseLeft}
          title="Show note panel"
        >
          <PanelLeftClose className="size-4 rotate-180" />
        </Button>
      )}
      {collapsedSide === 'right' && (
        <Button
          variant="outline"
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2"
          onClick={toggleCollapseRight}
          title="Show chat panel"
        >
          <PanelRightClose className="size-4 rotate-180" />
        </Button>
      )}
    </div>
  );
}

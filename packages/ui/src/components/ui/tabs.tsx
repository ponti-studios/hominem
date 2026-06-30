import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "../../lib/utils";

function Tabs({ ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

type TabsListElement = React.ComponentRef<typeof TabsPrimitive.List>;
type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>;

const TabsList = React.forwardRef<TabsListElement, TabsListProps>(function TabsList(
  { className, children, ...props },
  ref,
) {
  const listRef = React.useRef<TabsListElement | null>(null);
  const indicatorInset = 1;
  const indicatorOffsetY = -1;
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({
    opacity: 0,
    transform: "translate3d(0, 0, 0)",
    width: 0,
    height: 0,
  });

  const setRefs = React.useCallback(
    (node: TabsListElement | null) => {
      listRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  const syncIndicator = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const activeTrigger = list.querySelector<HTMLElement>("[data-state='active']");
    if (!activeTrigger) {
      setIndicatorStyle((current) =>
        current.opacity === 0 ? current : { ...current, opacity: 0 },
      );
      return;
    }

    const listRect = list.getBoundingClientRect();
    const triggerRect = activeTrigger.getBoundingClientRect();
    const nextStyle: React.CSSProperties = {
      opacity: 1,
      transform: `translate3d(${triggerRect.left - listRect.left + indicatorInset}px, ${triggerRect.top - listRect.top + indicatorInset + indicatorOffsetY}px, 0)`,
      width: Math.max(0, triggerRect.width - indicatorInset * 2),
      height: Math.max(0, triggerRect.height - indicatorInset * 2),
    };

    setIndicatorStyle((current) => {
      if (
        current.opacity === nextStyle.opacity &&
        current.transform === nextStyle.transform &&
        current.width === nextStyle.width &&
        current.height === nextStyle.height
      ) {
        return current;
      }
      return nextStyle;
    });
  }, []);

  React.useLayoutEffect(() => {
    syncIndicator();
  }, [syncIndicator, children]);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncIndicator);
    };

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(list);

    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(list, {
      attributes: true,
      attributeFilter: ["data-state", "class", "style"],
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [syncIndicator]);

  return (
    <TabsPrimitive.List
      ref={setRefs}
      data-slot="tabs-list"
      className={cn(
        "border-border bg-secondary/30 text-secondary-foreground relative isolate inline-flex h-9 items-center justify-center rounded-lg border p-1",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="border-border bg-background pointer-events-none absolute top-0 left-0 rounded-[11px] border transition-[transform,width,height,opacity] duration-200 ease-out will-change-[transform,width,height]"
        style={indicatorStyle}
      />
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = "TabsList";

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-secondary-foreground focus-visible:border-foreground focus-visible:text-foreground data-[state=active]:text-foreground relative z-10 inline-flex min-h-6 items-center justify-center rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "focus-visible:border-border focus-visible:bg-accent/10 mt-2 rounded-md focus-visible:border focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };

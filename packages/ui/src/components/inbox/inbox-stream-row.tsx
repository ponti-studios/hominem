import { MessageCircle } from "lucide-react";
import { memo, type ReactNode } from "react";

import { cn } from "../../lib/utils";

export interface InboxStreamRowItem {
  kind: string;
  entityId: string;
  title?: string | null;
  preview?: string | null;
  updatedAt: string | Date;
  href?: string;
}

export interface InboxStreamRowLinkProps {
  children: ReactNode;
  className: string;
  href: string;
}

export interface InboxStreamRowProps {
  item: InboxStreamRowItem;
  href?: string;
  onClick?: () => void;
  renderLink?: (props: InboxStreamRowLinkProps) => ReactNode;
}

function formatTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - targetDay.getTime()) / 86400000);

  if (dayDiff === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  if (dayDiff === 1) {
    return "Yesterday";
  }

  if (dayDiff > 1 && dayDiff < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function deriveInboxLabel(item: InboxStreamRowItem) {
  const normalizedTitle = item.title?.trim();
  if (normalizedTitle) {
    return normalizedTitle;
  }

  const normalizedPreview = item.preview?.replace(/\s+/g, " ").trim();
  if (normalizedPreview) {
    return normalizedPreview;
  }

  return item.kind === "chat" ? "Untitled chat" : "Untitled note";
}

export const InboxStreamRow = memo(function InboxStreamRow({
  item,
  href,
  onClick,
  renderLink,
}: InboxStreamRowProps) {
  const label = deriveInboxLabel(item);
  const timestamp = formatTimestamp(item.updatedAt);
  const resolvedHref = href ?? item.href ?? `/inbox/${item.kind}/${item.entityId}`;
  const isChat = item.kind === "chat";
  const icon = isChat ? (
    <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
  ) : (
    <span className="h-[18px] w-[18px] rounded-sm border border-current" aria-hidden="true" />
  );

  const content = (
    <>
      <div className="text-text-secondary group-active:text-foreground mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center transition-colors">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h2 className="text-foreground min-w-0 flex-1 truncate text-[15px] leading-5 font-medium tracking-[-0.2px] group-active:font-medium">
            {label}
          </h2>
          <div className="text-text-tertiary shrink-0 text-right text-[11px] leading-3">
            {timestamp}
          </div>
        </div>
      </div>
    </>
  );

  const interactiveClassName = cn(
    "group active:bg-elevated/40 focus-visible:outline-ring flex items-start gap-2 rounded-none px-4 py-3 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-style:solid]",
  );

  let rowContent: ReactNode;
  if (renderLink) {
    rowContent = renderLink({
      children: content,
      className: interactiveClassName,
      href: resolvedHref,
    });
  } else if (onClick) {
    rowContent = (
      <button
        type="button"
        className={cn(interactiveClassName, "w-full text-left")}
        onClick={onClick}
      >
        {content}
      </button>
    );
  } else {
    rowContent = (
      <a href={resolvedHref} className={interactiveClassName}>
        {content}
      </a>
    );
  }

  return (
    <div className="after:bg-border-subtle relative py-0 after:absolute after:inset-x-3 after:bottom-0 after:h-px last:after:hidden">
      {rowContent}
    </div>
  );
});

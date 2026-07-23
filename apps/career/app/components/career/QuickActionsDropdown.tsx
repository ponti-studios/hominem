import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ponti-studios/ui/overlays';
import { Button } from '@ponti-studios/ui/primitives';
import { Menu } from 'lucide-react';
import { useState } from 'react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }> | (() => React.ReactElement);
  onClick: () => void;
}

interface QuickActionsDropdownProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActionsDropdown({ actions, className = '' }: QuickActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          aria-label="Quick Actions"
          onPointerDown={(event) => {
            event.preventDefault();
            setIsOpen((open) => !open);
          }}
        >
          <Menu className="size-4" />
          Quick Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent sideOffset={8} className="w-56">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.id}
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
            >
              {typeof Icon === 'function' && Icon.length === 0 ? (
                <Icon />
              ) : (
                <Icon className="size-4" />
              )}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

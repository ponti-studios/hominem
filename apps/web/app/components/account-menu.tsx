import { Activity, LogOut, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { InitialsAvatar } from '~/components/design/avatar';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { useCollaborationInvites } from '~/hooks/use-collaboration-invites';
import type { User } from '~/lib/auth.server';

export function AccountMenu({ user }: { user: User }) {
  const navigate = useNavigate();
  const { count } = useCollaborationInvites();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Open account menu" className="relative" size="icon-sm" variant="ghost">
          <InitialsAvatar name={user.name.trim() || user.email} />
          {count > 0 ? (
            <span
              aria-label="Unread notifications"
              className="absolute top-1 right-1 size-2 rounded-full bg-destructive"
            />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/usage" viewTransition>
            <Activity />
            Usage
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" viewTransition>
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            if (window.confirm('Are you sure you want to sign out?')) navigate('/logout');
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useAuthClient } from '@hominem/auth/client/provider';
import { Avatar, AvatarFallback } from '@hominem/ui/avatar';
import { Badge } from '@hominem/ui/badge';
import { Button, buttonVariants } from '@hominem/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@hominem/ui/drawer';
import { MenuIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { cn } from '~/lib/utils';

import { useCurrentPortfolio, useUser } from '../hooks/useAuth';

interface NavItem {
  href: string;
  label: string;
}

const AUTH_LINKS: { authenticated: NavItem[]; unauthenticated: NavItem[] } = {
  authenticated: [
    { href: '/editor', label: 'Editor' },
    { href: '/career', label: 'Career' },
    { href: '/career/applications', label: 'Applications' },
  ],
  unauthenticated: [
    { href: '/login', label: 'Log in' },
    { href: '/onboarding', label: 'Sign up' },
  ],
};

const PUBLIC_LINKS: NavItem[] = [{ href: '/demo', label: 'Demo' }];

function isActiveRoute(pathname: string, href: string) {
  if (href === '/editor') {
    return pathname === href || pathname.startsWith('/editor/');
  }

  if (href === '/career/applications') {
    return pathname === href || pathname.startsWith('/career/applications/');
  }

  if (href === '/career') {
    return (
      pathname === href ||
      pathname === '/career/certifications' ||
      pathname.startsWith('/career/experience/')
    );
  }

  return pathname === href;
}

function UserAvatar({ user }: { user: { name?: string | null; email?: string | null } }) {
  return (
    <Avatar>
      <AvatarFallback>{(user.name || user.email || 'U')[0]?.toUpperCase() || 'U'}</AvatarFallback>
    </Avatar>
  );
}

function NavigationLink({
  href,
  label,
  pathname,
  mobile = false,
  onClick,
}: NavItem & {
  pathname: string;
  mobile?: boolean;
  onClick?: () => void;
}) {
  const is_active = isActiveRoute(pathname, href);

  return (
    <Link
      to={href}
      onClick={onClick}
      aria-current={is_active ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: 'ghost' }),
        'rounded-full px-4',
        mobile && 'w-full justify-start rounded-md',
        is_active
          ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

export default function Navigation() {
  const user = useUser();
  const currentPortfolio = useCurrentPortfolio();
  const authClient = useAuthClient();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const primaryLinks = user ? AUTH_LINKS.authenticated : PUBLIC_LINKS;

  const closeMenu = () => setIsMenuOpen(false);
  const handleSignOut = async () => {
    closeMenu();
    await authClient.signOut();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-3 text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          <img
            src="/icons/icon-192x192.png"
            alt="Career logo"
            className="h-10 w-auto"
            width="40"
            height="40"
          />
        </Link>

        <div className="hidden flex-1 justify-end md:flex">
          <nav className="flex items-center gap-2" aria-label="Primary">
            {primaryLinks.map((link) => (
              <NavigationLink key={link.href} {...link} pathname={location.pathname} />
            ))}

            {user ? (
              <div className="flex items-center gap-2">
                {currentPortfolio ? (
                  <Link
                    to="/editor"
                    className={cn(
                      buttonVariants({ variant: 'ghost' }),
                      'rounded-full px-3 text-left',
                      isActiveRoute(location.pathname, '/editor')
                        ? 'bg-accent/10 text-foreground hover:bg-accent/10 hover:text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <div className="flex max-w-40 flex-col items-start leading-tight">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Current portfolio
                      </span>
                      <span className="truncate text-sm font-medium">{currentPortfolio.title}</span>
                    </div>
                  </Link>
                ) : (
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    No portfolio yet
                  </Badge>
                )}

                <Link
                  to="/account"
                  aria-current={isActiveRoute(location.pathname, '/account') ? 'page' : undefined}
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'rounded-full px-2.5',
                    isActiveRoute(location.pathname, '/account')
                      ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span>Account</span>
                  <UserAvatar user={user} />
                </Link>
              </div>
            ) : (
              AUTH_LINKS.unauthenticated.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    buttonVariants({
                      variant: link.href !== '/onboarding' ? 'ghost' : undefined,
                    }),
                    'rounded-full px-4',
                  )}
                >
                  {link.label}
                </Link>
              ))
            )}
          </nav>
        </div>

        <Drawer open={isMenuOpen} onOpenChange={setIsMenuOpen} direction="right">
          <DrawerTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 md:hidden"
              aria-label="Open navigation menu"
            >
              <MenuIcon className="size-5" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="h-full max-h-none rounded-none border-l bg-background p-0">
            <DrawerHeader className="border-b border-border px-4 py-4">
              <DrawerTitle>Menu</DrawerTitle>
            </DrawerHeader>

            <div className="flex flex-col gap-6 p-4">
              {primaryLinks.length > 0 ? (
                <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
                  {primaryLinks.map((link) => (
                    <NavigationLink
                      key={link.href}
                      {...link}
                      pathname={location.pathname}
                      mobile
                      onClick={closeMenu}
                    />
                  ))}
                </nav>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                {user ? (
                  <>
                    {currentPortfolio ? (
                      <Link
                        to="/editor"
                        onClick={closeMenu}
                        className={cn(
                          buttonVariants({ variant: 'ghost' }),
                          'justify-start rounded-md px-4',
                        )}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Current portfolio
                          </span>
                          <span className="text-sm font-medium">{currentPortfolio.title}</span>
                        </div>
                      </Link>
                    ) : (
                      <Badge variant="outline" className="justify-start rounded-md px-4 py-2">
                        No portfolio yet
                      </Badge>
                    )}
                    <DrawerClose asChild>
                      <Link
                        to="/account"
                        className={cn(
                          buttonVariants({ variant: 'ghost' }),
                          'justify-start rounded-md px-4',
                        )}
                      >
                        <UserAvatar user={user} />
                        <span>Account</span>
                      </Link>
                    </DrawerClose>
                    <Button
                      type="button"
                      onClick={() => void handleSignOut()}
                      variant="ghost"
                      className="justify-start rounded-md px-4"
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  AUTH_LINKS.unauthenticated.map((link) => (
                    <DrawerClose key={link.href} asChild>
                      <Link
                        to={link.href}
                        className={cn(
                          buttonVariants({
                            variant: link.href !== '/onboarding' ? 'ghost' : undefined,
                          }),
                          'justify-start rounded-md px-4',
                        )}
                      >
                        {link.label}
                      </Link>
                    </DrawerClose>
                  ))
                )}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </header>
  );
}

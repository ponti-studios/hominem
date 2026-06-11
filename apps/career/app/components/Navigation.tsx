import { useAuthClient } from '@hominem/auth/client/provider';
import { Avatar, AvatarFallback } from '@hominem/ui/avatar';
import { Button } from '@hominem/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@hominem/ui/drawer';
import { MenuIcon } from 'lucide-react';
import { Link, NavLink, useRevalidator } from 'react-router';

import { cn } from '~/lib/utils';

import { useCurrentPortfolio, useUser } from '../hooks/useAuth';

type NavItem = {
  href: string;
  label: string;
  end?: boolean;
  variant?: 'default' | 'ghost';
  stateful?: boolean;
};

const AUTHENTICATED_LINKS = [
  { href: '/work', label: 'Work' },
  { href: '/applications', label: 'Applications' },
  { href: '/projects', label: 'Projects', end: true },
  { href: '/skills', label: 'Skills', end: true },
] as const satisfies readonly NavItem[];

const UNAUTHENTICATED_LINKS = [
  { href: '/login', label: 'Log in', end: true, variant: 'ghost', stateful: true },
  { href: '/onboarding', label: 'Sign up', end: true, variant: 'default', stateful: false },
] as const satisfies readonly NavItem[];

const AUTH_LINKS = {
  authenticated: AUTHENTICATED_LINKS,
  unauthenticated: UNAUTHENTICATED_LINKS,
} as const;

const PUBLIC_LINKS = [{ href: '/demo', label: 'Demo', end: true, variant: 'ghost' }] as const satisfies readonly NavItem[];

function UserAvatar({ user }: { user: { name?: string | null; email?: string | null } }) {
  return (
    <Avatar>
      <AvatarFallback>{(user.name || user.email || 'U')[0]?.toUpperCase() || 'U'}</AvatarFallback>
    </Avatar>
  );
}

function navLinkClassName({
  isActive,
  variant = 'ghost',
  mobile = false,
  className,
  activeClassName,
  inactiveClassName,
  stateful = true,
}: {
  isActive: boolean;
  variant?: 'default' | 'ghost';
  mobile?: boolean;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  stateful?: boolean;
}) {
  const baseClasses =
    variant === 'default' && !stateful
      ? 'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors duration-150 hover:bg-foreground/90 focus-visible:outline-none'
      : 'inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-150 focus-visible:outline-none';

  return cn(
    baseClasses,
    mobile ? 'w-full justify-start rounded-md px-4 py-2' : 'rounded-full px-4 py-2',
    className,
    stateful &&
      (isActive
        ? activeClassName ??
          'bg-accent/20 text-text-primary hover:bg-accent/25 hover:text-text-primary'
        : inactiveClassName ?? 'text-text-secondary hover:bg-surface hover:text-text-primary'),
  );
}

export default function Navigation() {
  const user = useUser();
  const currentPortfolio = useCurrentPortfolio();
  const authClient = useAuthClient();
  const revalidator = useRevalidator();

  const primaryLinks: readonly NavItem[] = user && currentPortfolio ? AUTH_LINKS.authenticated : PUBLIC_LINKS;

  const handleSignOut = async () => {
    await authClient.signOut();
    revalidator.revalidate();
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4">
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
          <nav className="flex items-center justify-between gap-2" aria-label="Primary">
            {primaryLinks.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                end={link.end}
                className={({ isActive }) =>
                  navLinkClassName({
                    isActive,
                    variant: link.variant,
                    stateful: link.stateful,
                  })
                }
              >
                {link.label}
              </NavLink>
            ))}

            {user ? (
              <div className="flex items-center gap-2">
                {currentPortfolio ? (
                  <NavLink
                    to="/work"
                    end={false}
                    className={({ isActive }) =>
                      navLinkClassName({
                        isActive,
                        className: 'px-3 text-left',
                        activeClassName:
                          'bg-accent/20 text-text-primary hover:bg-accent/25 hover:text-text-primary',
                      })
                    }
                  >
                    <div className="flex max-w-40 flex-col items-start leading-tight">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Current portfolio
                      </span>
                      <span className="truncate text-sm font-medium">{currentPortfolio.title}</span>
                    </div>
                  </NavLink>
                ) : (
                  <NavLink
                    to="/onboarding"
                    end
                    className={({ isActive }) =>
                      navLinkClassName({
                        isActive,
                        stateful: false,
                        className: 'text-sm',
                      })
                    }
                  >
                    Upload resume
                  </NavLink>
                )}

                <NavLink
                  to="/account"
                  end
                  className={({ isActive }) =>
                    navLinkClassName({
                      isActive,
                      className: 'rounded-full px-2.5',
                    })
                  }
                >
                  <span>Account</span>
                  <UserAvatar user={user} />
                </NavLink>
              </div>
            ) : (
              AUTH_LINKS.unauthenticated.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  end={link.end}
                  className={({ isActive }) =>
                    navLinkClassName({
                      isActive,
                      stateful: link.stateful,
                    })
                  }
                >
                  {link.label}
                </NavLink>
              ))
            )}
          </nav>
        </div>

        <Drawer direction="right">
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
                    <DrawerClose key={link.href} asChild>
                      <NavLink
                        to={link.href}
                        end={link.end}
                        className={({ isActive }) =>
                          navLinkClassName({
                            isActive,
                            mobile: true,
                            stateful: link.stateful,
                          })
                        }
                      >
                        {link.label}
                      </NavLink>
                    </DrawerClose>
                  ))}
                </nav>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                {user ? (
                  <>
                    {currentPortfolio ? (
                      <DrawerClose asChild>
                        <NavLink
                          to="/work"
                          end={false}
                          className={({ isActive }) =>
                            navLinkClassName({
                              isActive,
                              mobile: true,
                              activeClassName:
                                'bg-accent/20 text-text-primary hover:bg-accent/25 hover:text-text-primary',
                            })
                          }
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Current portfolio
                            </span>
                            <span className="text-sm font-medium">{currentPortfolio.title}</span>
                          </div>
                        </NavLink>
                      </DrawerClose>
                    ) : (
                      <DrawerClose asChild>
                        <NavLink
                          to="/onboarding"
                          end
                          className={({ isActive }) =>
                            navLinkClassName({
                              isActive,
                              mobile: true,
                              stateful: false,
                              className: 'text-sm',
                            })
                          }
                        >
                          Upload resume
                        </NavLink>
                      </DrawerClose>
                    )}
                    <DrawerClose asChild>
                      <NavLink
                        to="/account"
                        end
                        className={({ isActive }) =>
                          navLinkClassName({
                            isActive,
                            mobile: true,
                          })
                        }
                      >
                        <UserAvatar user={user} />
                        <span>Account</span>
                      </NavLink>
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
                      <NavLink
                        to={link.href}
                        end={link.end}
                        className={({ isActive }) =>
                          navLinkClassName({
                            isActive,
                            mobile: true,
                            stateful: link.stateful,
                          })
                        }
                      >
                        {link.label}
                      </NavLink>
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

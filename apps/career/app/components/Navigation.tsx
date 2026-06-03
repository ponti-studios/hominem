import { useAuthClient } from '@hominem/auth/client/provider';
import { Avatar, AvatarFallback } from '@hominem/ui/avatar';
import { Button, buttonVariants } from '@hominem/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@hominem/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hominem/ui/dropdown';
import { BriefcaseIcon, FileTextIcon, MenuIcon, PencilIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigation } from 'react-router';

import { cn } from '~/lib/utils';

import { useUser } from '../hooks/useAuth';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const AUTH_LINKS: { authenticated: NavItem[]; unauthenticated: NavItem[] } = {
  authenticated: [
    { href: '/editor', label: 'Editor', icon: PencilIcon },
    { href: '/career', label: 'Career', icon: BriefcaseIcon },
    { href: '/career/applications', label: 'Applications', icon: FileTextIcon },
  ],
  unauthenticated: [
    { href: '/login', label: 'Log In' },
    { href: '/onboarding', label: 'Sign Up' },
  ],
};

const PUBLIC_LINKS: NavItem[] = [{ href: '/demo', label: 'Demo' }];

function UserAvatar({ user }: { user: { name?: string | null; email?: string | null } }) {
  return (
    <Avatar className="size-8 border border-border bg-muted">
      <AvatarFallback>{(user.name || user.email || 'U')[0]?.toUpperCase() || 'U'}</AvatarFallback>
    </Avatar>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  isCurrentPage,
  onClick,
  mobile = false,
}: NavItem & {
  isCurrentPage: (href: string) => boolean;
  onClick?: () => void;
  mobile?: boolean;
}) {
  return (
    <Link
      to={href}
      onClick={onClick}
      className={cn(
        buttonVariants({ variant: 'ghost', size: mobile ? 'lg' : 'sm' }),
        'justify-start gap-2',
        mobile && 'h-11 w-full',
        isCurrentPage(href)
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </Link>
  );
}

export default function Navigation() {
  const user = useUser();
  const authClient = useAuthClient();
  const navigation = useNavigation();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  const isNavigating = navigation.state === 'loading';
  const navLinks = user ? [] : PUBLIC_LINKS;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 10);

      if (currentScrollY > lastScrollY + 10 && currentScrollY > 100) {
        setIsNavHidden(true);
      } else if (currentScrollY < lastScrollY - 10 || currentScrollY < 50) {
        setIsNavHidden(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const closeMenu = () => setIsMenuOpen(false);

  const isCurrentPage = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname === href;

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      closeMenu();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav
      className={cn(
        'fixed inset-x-0 top-0 z-50 px-4 transition-transform duration-200 ease-out',
        isNavHidden ? '-translate-y-full' : 'translate-y-0',
      )}
    >
      <div
        className={cn(
          'mx-auto mt-4 max-w-7xl rounded-full border px-4 py-2 transition-colors duration-200 sm:px-6',
          isScrolled
            ? 'border-border bg-background/85 backdrop-blur-xl'
            : 'border-border/70 bg-background/70 backdrop-blur-md',
          isNavigating && 'border-accent',
        )}
      >
        <div className="flex h-12 items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 rounded-md text-foreground">
            <span className="flex size-8 items-center justify-center rounded-md border border-border bg-muted">
              <img src="/icons/icon-192x192.png" alt="Craftd Logo" className="h-5 w-auto" />
            </span>
            <span className="text-lg font-semibold tracking-normal">Craftd</span>
          </Link>

          {navLinks.length > 0 ? (
            <div className="hidden items-center gap-2 md:flex">
              {navLinks.map((link) => (
                <NavLink key={link.href} {...link} isCurrentPage={isCurrentPage} />
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            {user ? (
              <div className="hidden items-center gap-2 md:flex">
                {AUTH_LINKS.authenticated.map((link) => (
                  <NavLink key={link.href} {...link} isCurrentPage={isCurrentPage} />
                ))}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" className="gap-2">
                      <span>Account</span>
                      <UserAvatar user={user} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate">
                      {user.name || user.email || 'Account'}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/account">Account settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  Log In
                </Link>
                <Link
                  to="/onboarding"
                  className={buttonVariants({ variant: 'primary', size: 'sm' })}
                >
                  Sign Up
                </Link>
              </div>
            )}

            <Drawer open={isMenuOpen} onOpenChange={setIsMenuOpen} direction="right">
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation menu"
                >
                  <MenuIcon className="size-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-full max-h-none rounded-none border-l bg-background p-0">
                <DrawerHeader className="border-b border-border p-4">
                  <DrawerTitle>Navigation</DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col gap-2 p-4">
                  {navLinks.map((link) => (
                    <NavLink
                      key={link.href}
                      {...link}
                      isCurrentPage={isCurrentPage}
                      onClick={closeMenu}
                      mobile
                    />
                  ))}

                  {user ? (
                    <>
                      <DrawerClose asChild>
                        <Link
                          to="/account"
                          className={cn(
                            buttonVariants({ variant: 'ghost', size: 'lg' }),
                            'h-11 w-full justify-start gap-2 text-muted-foreground',
                          )}
                        >
                          <UserAvatar user={user} />
                          My Account
                        </Link>
                      </DrawerClose>
                      {AUTH_LINKS.authenticated.map((link) => (
                        <NavLink
                          key={link.href}
                          {...link}
                          isCurrentPage={isCurrentPage}
                          onClick={closeMenu}
                          mobile
                        />
                      ))}
                      <Button
                        type="button"
                        onClick={handleSignOut}
                        variant="ghost"
                        size="lg"
                        className="h-11 w-full justify-start text-muted-foreground"
                      >
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    AUTH_LINKS.unauthenticated.map((link) => (
                      <DrawerClose key={link.href} asChild>
                        <Link
                          to={link.href}
                          className={cn(
                            buttonVariants({
                              variant: link.href === '/onboarding' ? 'primary' : 'ghost',
                              size: 'lg',
                            }),
                            'h-11 w-full justify-start',
                          )}
                        >
                          {link.label}
                        </Link>
                      </DrawerClose>
                    ))
                  )}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>
    </nav>
  );
}

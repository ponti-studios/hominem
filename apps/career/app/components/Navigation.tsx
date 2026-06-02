import { BriefcaseIcon, FileTextIcon, MenuIcon, PencilIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigation } from 'react-router'
import { Button, getButtonClasses } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import { useUser } from '../hooks/useAuth'
import { createClient } from '../lib/supabase/client'
import { Avatar } from './Avatar'
import styles from './Navigation.module.css'

// Navigation item interface
interface NavItem {
  href: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
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
}

const NavLink = ({
  href,
  label,
  icon: Icon,
  isCurrentPage,
  onClick,
  variant = 'desktop',
}: {
  href: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  isCurrentPage: (href: string) => boolean
  onClick?: () => void
  variant?: 'desktop' | 'mobile'
}) => {
  const baseClasses = getButtonClasses({
    variant: 'ghost',
    size: variant === 'desktop' ? 'sm' : 'default',
  })
  const desktopClasses = cn(
    baseClasses,
    'inline-flex gap-2 items-center',
    isCurrentPage(href)
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:text-foreground'
  )

  const mobileClasses = cn(
    'flex items-center gap-2 px-md py-sm text-base font-medium rounded-md transition-fast',
    isCurrentPage(href)
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
  )

  return (
    <Link
      to={href}
      onClick={onClick}
      className={variant === 'desktop' ? desktopClasses : mobileClasses}
    >
      {Icon && <Icon className={variant === 'desktop' ? 'w-4 h-4' : 'size-4'} />}
      {label}
    </Link>
  )
}

export default function Navigation() {
  const user = useUser()
  const navigation = useNavigation()
  const isNavigating = navigation.state === 'loading'

  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isNavHidden, setIsNavHidden] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Navigation links - conditional based on user state
  const navLinks = user ? [] : [{ href: '/demo', label: 'Demo' }]

  // Handle scroll for background blur effect and hide/show nav on scroll
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Check if scrolled down
      setIsScrolled(currentScrollY > 10)

      // Hide navigation when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY + 10 && currentScrollY > 100) {
        setIsNavHidden(true)
      } else if (currentScrollY < lastScrollY - 10 || currentScrollY < 50) {
        setIsNavHidden(false)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  // Close menu when clicking outside or on link
  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  // Check if current page
  const isCurrentPage = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname === href
  }

  const handleSignOut = async () => {
    try {
      const supabase = await createClient()
      await supabase.auth.signOut()
      closeMenu()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Helper function to get container classes
  const getContainerClasses = () =>
    cn(
      'mx-auto mt-4 max-w-7xl transition-all duration-300 ease-out rounded-full px-6 py-2',
      styles.navigationPill,
      isNavigating && styles.animatedBorder,
      isScrolled
        ? 'backdrop-blur-2xl bg-background/60 border border-white/20 shadow-2xl shadow-black/10'
        : 'backdrop-blur-xl bg-background/40 border border-white/10 shadow-xl shadow-black/5'
    )

  return (
    <>
      {/* Main Navigation */}
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-base px-4',
          isNavHidden ? '-translate-y-full' : 'translate-y-0'
        )}
      >
        <div className={getContainerClasses()}>
          <div className="flex items-center justify-between h-12">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group transition-fast hover:opacity-80">
              <div className="size-7 rounded-lg flex items-center justify-center text-white text-sm font-semibold">
                <img
                  src="/icons/icon-192x192.png"
                  alt="Craftd Logo"
                  className="h-5 w-auto transition-fast group-hover:opacity-80"
                />
              </div>
              <span className="font-sans text-lg font-semibold tracking-tight text-foreground">
                Craftd
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="flex gap-2">
              {navLinks.length > 0 && (
                <div className="hidden md:flex items-center gap-2">
                  {navLinks.map((link) => (
                    <NavLink
                      key={link.href}
                      href={link.href}
                      label={link.label}
                      isCurrentPage={isCurrentPage}
                      variant="desktop"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* User Menu or Sign In */}
            <div className="flex items-center gap-2">
              {user ? (
                <div className="hidden md:flex items-center gap-4">
                  {AUTH_LINKS.authenticated.map((link) => (
                    <NavLink
                      key={link.href}
                      href={link.href}
                      label={link.label}
                      icon={link.icon}
                      isCurrentPage={isCurrentPage}
                      variant="desktop"
                    />
                  ))}

                  {/* Account dropdown */}
                  <Link
                    to="/account"
                    className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-fast px-sm py-xs rounded-md hover:bg-accent"
                  >
                    <span className="mr-2">Account</span>
                    <Avatar user={user} />
                  </Link>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link to="/login" className={getButtonClasses({ variant: 'ghost', size: 'sm' })}>
                    Log In
                  </Link>
                  <Link
                    to="/onboarding"
                    className={getButtonClasses({ variant: 'primary', size: 'sm' })}
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <Button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation menu"
              >
                {isMenuOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-xl border border-white/20 rounded-2xl mx-4 mt-2 shadow-lg">
            <div className="px-lg py-lg space-y-1">
              {navLinks.length > 0 && (
                <div className="space-y-1 pb-lg border-b border-border">
                  {navLinks.map((link) => (
                    <NavLink
                      key={link.href}
                      href={link.href}
                      label={link.label}
                      isCurrentPage={isCurrentPage}
                      onClick={closeMenu}
                      variant="mobile"
                    />
                  ))}
                </div>
              )}

              <div className="space-y-1 pt-lg">
                {user ? (
                  <>
                    <Link
                      to="/account"
                      onClick={closeMenu}
                      className="flex items-center gap-2 px-md py-sm text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-fast"
                    >
                      <Avatar user={user} className="size-8" />
                      My Account
                    </Link>
                    {AUTH_LINKS.authenticated.map((link) => (
                      <NavLink
                        key={link.href}
                        href={link.href}
                        label={link.label}
                        icon={link.icon}
                        isCurrentPage={isCurrentPage}
                        onClick={closeMenu}
                        variant="mobile"
                      />
                    ))}
                    <Button
                      type="button"
                      onClick={handleSignOut}
                      variant="ghost"
                      className="block w-full text-left px-md py-sm text-base font-medium justify-start"
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    {AUTH_LINKS.unauthenticated.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={closeMenu}
                        className={cn(
                          link.href === '/onboarding'
                            ? `${getButtonClasses({ variant: 'primary', size: 'default' })} block mx-md my-sm text-center`
                            : 'block px-md py-sm text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-fast'
                        )}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile menu backdrop */}
      {isMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-background/20 backdrop-blur-sm z-40 md:hidden cursor-default transition-fast"
          onClick={closeMenu}
          aria-label="Close menu"
        />
      )}
    </>
  )
}

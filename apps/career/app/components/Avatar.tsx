import {
  Avatar as SharedAvatar,
  AvatarFallback,
  AvatarImage,
} from '@hominem/ui/avatar'

import { cn } from '~/lib/utils'
import type { User } from '../lib/auth.server'

// Helper function to get avatar URL from user
const getAvatarUrl = (user: User): string | undefined => {
  return user.supabaseUser?.user_metadata?.avatar_url as string | undefined
}

interface AvatarProps {
  user: User
  className?: string
}

export const Avatar = ({ user, className = 'size-8' }: AvatarProps) => {
  const avatarUrl = getAvatarUrl(user)
  const fallback = (user.name || user.email || 'U')[0]?.toUpperCase() || 'U'

  return (
    <SharedAvatar className={cn(className, 'border border-input')}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={user.name || 'User'} /> : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </SharedAvatar>
  )
}

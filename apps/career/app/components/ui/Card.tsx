import type React from 'react'
import { cn } from '~/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white/30 backdrop-blur-md border border-white/40 shadow rounded-lg flex flex-col gap-4 px-4 py-5 sm:p-6 overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  children,
  className = '',
}: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-lg leading-6 font-medium text-gray-900', className)}>{children}</h3>
  )
}

export function CardDescription({
  children,
  className = '',
}: { children: React.ReactNode; className?: string }) {
  return <p className={cn('mt-1 text-sm text-gray-500', className)}>{children}</p>
}

interface CardHeaderProps {
  className?: string
  children?: React.ReactNode
}
export function CardHeader({ className = '', children }: CardHeaderProps) {
  return (
    <div
      className={cn('border-b border-gray-200 flex items-center justify-between pb-2', className)}
    >
      {children}
    </div>
  )
}

export function CardContent({
  children,
  className = '',
}: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

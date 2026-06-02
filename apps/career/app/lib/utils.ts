import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a decimal number as a percentage
 * @param value - The decimal value (e.g., 0.25 for 25%)
 * @param decimals - Number of decimal places to show
 * @returns Formatted percentage string (e.g., "25.0%")
 */
export function formatPercentage(value: number, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0.0%'
  }
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Convert cents to dollars
 * @param cents - Amount in cents
 * @returns Amount in dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100
}

/**
 * Format currency with proper formatting
 * @param amount - Amount in dollars
 * @param currency - Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format large numbers with abbreviations (K, M, B)
 * @param num - The number to format
 * @returns Formatted string with abbreviation
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toString()
}

/**
 * Calculate days between two dates
 * @param startDate - Start date
 * @param endDate - End date (default: current date)
 * @returns Number of days
 */
export function daysBetween(startDate: Date, endDate = new Date()): number {
  const timeDiff = endDate.getTime() - startDate.getTime()
  return Math.ceil(timeDiff / (1000 * 3600 * 24))
}

// Form utilities for handling nullable database values

/**
 * Helper function to format dates for HTML date inputs
 * Converts Date objects or date strings to YYYY-MM-DD format
 */
export const formatDateForInput = (date: string | Date | null | undefined): string | undefined => {
  if (!date) return undefined
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (Number.isNaN(dateObj.getTime())) return undefined
    return dateObj.toISOString().split('T')[0] // Returns YYYY-MM-DD format
  } catch {
    return undefined
  }
}

/**
 * Helper function to safely convert nullable string to undefined
 * Useful for form default values where null should become undefined
 */
export const nullToUndefined = (value: string | null | undefined): string | undefined => {
  return value === null ? undefined : value
}

/**
 * Helper function to safely convert nullable array to undefined
 * Useful for form default values where null arrays should become undefined
 */
export const nullArrayToUndefined = (value: string[] | null | undefined): string[] | undefined => {
  return value === null ? undefined : value
}

/**
 * Helper function to convert date string to Date object
 * Returns undefined for invalid dates
 */
export const stringToDate = (dateString?: string): Date | undefined => {
  if (!dateString) return undefined
  const date = new Date(dateString)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export const normalizeString = (str: string): string => {
  return str.toLocaleLowerCase().replace(/\s+/g, '-')
}

import type { CareerPortfolioRecord } from '@hominem/db';

export interface AccountPageUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface AccountPortfolioSummary {
  id: string;
  title: string;
  slug: string;
  isPublic: boolean;
  isActive: boolean;
  updatedat: string | Date;
  name?: string;
  jobTitle?: string;
  bio?: string;
  profileImageUrl?: string;
}

export interface AccountLoaderData {
  user: AccountPageUser;
  portfolios: AccountPortfolioSummary[];
  currentPortfolio: CareerPortfolioRecord | null;
  currentPortfolioId: string | null;
  hasPortfolio: boolean;
}

export interface BasicInfoFormValues {
  name: string;
  initials?: string | null;
  title?: string | null;
  jobTitle: string;
  bio: string;
  tagline: string;
  currentLocation: string;
  locationTagline?: string | null;
  email: string;
  phone?: string | null;
  availabilityStatus?: boolean;
  availabilityMessage?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
}

export interface AccountActionResult<TData = undefined> {
  success: boolean;
  message?: string;
  error?: string;
  data?: TData;
}

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
  is_public: boolean;
  is_active: boolean;
  updatedat: string | Date;
  name?: string;
  job_title?: string;
  bio?: string;
  profile_image_url?: string;
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
  job_title: string;
  bio: string;
  tagline: string;
  current_location: string;
  location_tagline?: string | null;
  email: string;
  phone?: string | null;
  availability_status?: boolean;
  availability_message?: string | null;
  is_public?: boolean;
  is_active?: boolean;
}

export interface AccountActionResult<TData = undefined> {
  success: boolean;
  message?: string;
  error?: string;
  data?: TData;
}

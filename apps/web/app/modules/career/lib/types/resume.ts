// Client-safe resume shapes. The API owns parsing and normalization; the web app
// only receives an already-validated payload.
export type ConvertedResumeData = {
  portfolio: {
    name: string;
    title: string | null;
    job_title: string;
    current_location: string;
    email: string;
    phone?: string | null;
    bio: string;
    tagline: string;
    initials?: string | null;
    is_public: boolean;
    is_active: boolean;
    availability_status: boolean;
    open_to_remote?: boolean | null;
    slug: string;
  };
  social_links?: {
    github?: string | null;
    linkedin?: string | null;
    twitter?: string | null;
    website?: string | null;
  } | null;
  workExperience: Array<{
    company: string;
    role: string;
    description: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }>;
  skills: Array<{
    name: string;
    level: number;
    category?: string | null;
    description?: string | null;
    years_of_experience?: number | null;
  }>;
  projects: Array<{
    title: string;
    description: string | null;
    short_description?: string | null;
    live_url?: string | null;
    github_url?: string | null;
    technologies: string[];
    status: string;
  }>;
};

export type ResumeConvertStage =
  | 'auth'
  | 'request'
  | 'file-validation'
  | 'rate-limit'
  | 'pdf-extraction'
  | 'ai-parse'
  | 'schema-validation'
  | 'storage'
  | 'database'
  | 'complete';

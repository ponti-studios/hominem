import type { FullPortfolio } from '../portfolio.server'

export interface TestUser {
  id: string
  email: string
  name: string
  supabaseUser: {
    id: string
    email: string
    user_metadata: {
      full_name: string
      provider: string
    }
    app_metadata: Record<string, unknown>
    aud: string
    created_at: string
    updated_at: string
    email_confirmed_at: string
    last_sign_in_at: string
    role: string
    confirmation_sent_at?: string
    confirmed_at: string
    email_change_sent_at?: string
    new_email?: string
    invited_at?: string
    action_link?: string
    recovery_sent_at?: string
    phone?: string
    phone_confirmed_at?: string
    phone_change_sent_at?: string
    new_phone?: string
    identities: unknown[]
    factors: unknown[]
    is_anonymous: boolean
  }
}

export const createTestUser = (overrides: Partial<TestUser> = {}): TestUser => {
  const now = new Date().toISOString()

  return {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'test@example.com',
    name: 'Test User',
    supabaseUser: {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User',
        provider: 'google',
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: now,
      updated_at: now,
      email_confirmed_at: now,
      last_sign_in_at: now,
      role: 'authenticated',
      confirmation_sent_at: undefined,
      confirmed_at: now,
      email_change_sent_at: undefined,
      new_email: undefined,
      invited_at: undefined,
      action_link: undefined,
      recovery_sent_at: undefined,
      phone: undefined,
      phone_confirmed_at: undefined,
      phone_change_sent_at: undefined,
      new_phone: undefined,
      identities: [],
      factors: [],
      is_anonymous: false,
    },
    ...overrides,
  }
}

export const defaultTestUser = createTestUser()

// Use FullPortfolio directly for test portfolio
export const defaultTestPortfolio: FullPortfolio = {
  id: 'test-portfolio-id',
  userId: '00000000-0000-0000-0000-000000000000',
  slug: 'test-user-portfolio',
  title: 'Test Portfolio',
  isPublic: true,
  isActive: true,
  name: 'Test User',
  initials: 'TU',
  jobTitle: 'Software Engineer',
  bio: 'A passionate software engineer with expertise in full-stack development.',
  tagline: 'Building the future, one line of code at a time',
  currentLocation: 'San Francisco, CA',
  locationTagline: 'Silicon Valley',
  availabilityStatus: true,
  availabilityMessage: 'Open to new opportunities',
  email: 'test@example.com',
  phone: '+1 (555) 123-4567',
  profileImageUrl: 'https://via.placeholder.com/150',
  theme: {
    primaryColor: '#3B82F6',
    accentColor: '#10B981',
  },
  copyright: '© 2024 Test User. All rights reserved.',
  createdAt: new Date(),
  updatedAt: new Date(),
  socialLinks: {
    id: 'social-1',
    portfolioId: 'test-portfolio-id',
    github: 'https://github.com/testuser',
    linkedin: 'https://linkedin.com/in/testuser',
    twitter: 'https://twitter.com/testuser',
    website: 'https://testuser.dev',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  portfolioStats: [
    {
      id: 'stat-1',
      portfolioId: 'test-portfolio-id',
      label: 'Years Experience',
      value: '5+',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'stat-2',
      portfolioId: 'test-portfolio-id',
      label: 'Projects Completed',
      value: '50+',
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  workExperiences: [
    {
      id: 'work-1',
      portfolioId: 'test-portfolio-id',
      company: 'Tech Corp',
      description: 'Led development of key features and mentored junior developers.',
      role: 'Full Stack Developer',
      startDate: new Date('2022-01-01'),
      endDate: null,
      image: null,
      gradient: 'from-blue-500 to-purple-600',
      metrics: 'Led team of 5',
      action: 'Learn More',
      tags: ['React', 'Node.js', 'TypeScript'],
      metadata: {
        company_size: '500+',
        industry: 'Technology',
        location: 'San Francisco, CA',
      },
      sortOrder: 0,
      isVisible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Added missing fields
      baseSalary: null,
      currency: 'USD',
      salaryRange: null,
      totalCompensation: null,
      equityValue: null,
      equityPercentage: null,
      signingBonus: null,
      annualBonus: null,
      bonusHistory: [],
      benefits: null,
      employmentType: 'full-time',
      workArrangement: 'office',
      seniorityLevel: null,
      department: null,
      teamSize: null,
      reportsTo: null,
      directReports: 0,
      performanceRatings: [],
      salaryAdjustments: [],
      reasonForLeaving: null,
      exitNotes: null,
    },
  ],
  skills: [
    {
      id: 'skill-1',
      portfolioId: 'test-portfolio-id',
      name: 'React',
      level: 90,
      category: 'Frontend',
      icon: 'react',
      description: 'Expert in React development',
      yearsOfExperience: 5,
      isVisible: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'skill-2',
      portfolioId: 'test-portfolio-id',
      name: 'TypeScript',
      level: 85,
      category: 'Language',
      icon: 'typescript',
      description: 'Strong TypeScript skills',
      yearsOfExperience: 4,
      isVisible: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  projects: [
    {
      id: 'project-1',
      portfolioId: 'test-portfolio-id',
      workExperienceId: null,
      title: 'E-commerce Platform',
      description: 'A full-stack e-commerce platform built with React and Node.js',
      shortDescription: 'E-commerce platform with modern UI',
      status: 'completed',
      technologies: ['React', 'Node.js', 'MongoDB'],
      githubUrl: 'https://github.com/testuser/ecommerce',
      liveUrl: 'https://ecommerce-demo.com',
      imageUrl: null,
      videoUrl: null,
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-06-01'),
      isFeatured: true,
      isVisible: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  testimonials: [
    {
      id: 'testimonial-1',
      portfolioId: 'test-portfolio-id',
      name: 'Jane Smith',
      title: 'Product Manager',
      company: 'Tech Corp',
      content: 'Amazing developer who delivers high-quality work consistently.',
      avatarUrl: null,
      linkedinUrl: null,
      rating: 5,
      isVerified: false,
      isVisible: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
}

import { describe, expect, it } from 'vitest'
import type { FullPortfolio } from '../portfolio.server'
import { formatPortfolioForLLM } from './portfolio-formatter'

// Mock portfolio data for testing
const createMockPortfolio = (overrides: Partial<FullPortfolio> = {}): FullPortfolio => ({
  id: 'test-portfolio-id',
  userId: 'test-user-id',
  slug: 'test-portfolio',
  title: 'Test Portfolio',
  isPublic: true,
  isActive: true,
  name: 'John Doe',
  initials: 'JD',
  jobTitle: 'Senior Software Engineer',
  bio: 'Passionate full-stack developer with 5+ years of experience building scalable web applications.',
  tagline: 'Building the future, one line of code at a time',
  currentLocation: 'San Francisco, CA',
  locationTagline: 'Silicon Valley',
  availabilityStatus: true,
  availabilityMessage: 'Open to new opportunities',
  email: 'john.doe@example.com',
  phone: '+1 (555) 123-4567',
  profileImageUrl: null,
  theme: null,
  copyright: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  socialLinks: {
    id: 'social-1',
    portfolioId: 'test-portfolio-id',
    github: 'https://github.com/johndoe',
    linkedin: 'https://linkedin.com/in/johndoe',
    twitter: 'https://twitter.com/johndoe',
    website: 'https://johndoe.dev',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  portfolioStats: [
    {
      id: 'stat-1',
      portfolioId: 'test-portfolio-id',
      label: 'Years Experience',
      value: '5+',
      sortOrder: 0,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'stat-2',
      portfolioId: 'test-portfolio-id',
      label: 'Projects Completed',
      value: '50+',
      sortOrder: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
  workExperiences: [
    {
      id: 'work-1',
      portfolioId: 'test-portfolio-id',
      company: 'TechCorp Inc',
      description:
        'Led development of key features and mentored junior developers. Implemented CI/CD pipelines and improved deployment efficiency by 40%.',
      role: 'Senior Full Stack Developer',
      startDate: new Date('2022-01-01'),
      endDate: null,
      image: null,
      gradient: null,
      metrics: 'Led team of 5, improved performance by 40%',
      action: null,
      tags: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
      metadata: null,
      sortOrder: 0,
      isVisible: true,
      // Required financial fields
      baseSalary: 12000000, // $120,000 in cents
      currency: 'USD',
      salaryRange: null,
      totalCompensation: 14000000, // $140,000 in cents
      equityValue: null,
      equityPercentage: null,
      signingBonus: null,
      annualBonus: 2000000, // $20,000 in cents
      bonusHistory: [],
      benefits: null,
      // Employment details
      employmentType: 'full-time',
      workArrangement: 'hybrid',
      seniorityLevel: 'senior',
      department: 'Engineering',
      teamSize: 8,
      reportsTo: 'Engineering Manager',
      directReports: 2,
      performanceRatings: [],
      salaryAdjustments: [],
      reasonForLeaving: null,
      exitNotes: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'work-2',
      portfolioId: 'test-portfolio-id',
      company: 'StartupXYZ',
      description:
        'Developed MVP for a fintech startup. Built responsive web application from scratch using modern technologies.',
      role: 'Frontend Developer',
      startDate: new Date('2020-06-01'),
      endDate: new Date('2021-12-31'),
      image: null,
      gradient: null,
      metrics: 'Reduced load time by 60%',
      action: null,
      tags: ['Vue.js', 'JavaScript', 'CSS3'],
      metadata: null,
      sortOrder: 1,
      isVisible: true,
      // Required financial fields
      baseSalary: 8500000, // $85,000 in cents
      currency: 'USD',
      salaryRange: null,
      totalCompensation: 9000000, // $90,000 in cents
      equityValue: null,
      equityPercentage: '0.5%',
      signingBonus: 500000, // $5,000 in cents
      annualBonus: null,
      bonusHistory: [],
      benefits: null,
      // Employment details
      employmentType: 'full-time',
      workArrangement: 'office',
      seniorityLevel: 'mid-level',
      department: 'Product',
      teamSize: 4,
      reportsTo: 'Product Manager',
      directReports: 0,
      performanceRatings: [],
      salaryAdjustments: [],
      reasonForLeaving: 'better_opportunity',
      exitNotes: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
  skills: [
    {
      id: 'skill-1',
      portfolioId: 'test-portfolio-id',
      name: 'React',
      level: 90,
      category: 'Frontend',
      icon: null,
      description: 'Expert in React development with hooks and context',
      yearsOfExperience: 5,
      isVisible: true,
      sortOrder: 0,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'skill-2',
      portfolioId: 'test-portfolio-id',
      name: 'Node.js',
      level: 85,
      category: 'Backend',
      icon: null,
      description: 'Strong backend development skills',
      yearsOfExperience: 4,
      isVisible: true,
      sortOrder: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'skill-3',
      portfolioId: 'test-portfolio-id',
      name: 'Docker',
      level: 75,
      category: null, // Should go to "Other" category
      icon: null,
      description: null,
      yearsOfExperience: null,
      isVisible: true,
      sortOrder: 2,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
  projects: [
    {
      id: 'project-1',
      portfolioId: 'test-portfolio-id',
      workExperienceId: null,
      title: 'E-commerce Platform',
      description:
        'Built a full-stack e-commerce platform with payment integration and admin dashboard.',
      shortDescription: null,
      technologies: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
      liveUrl: 'https://ecommerce-demo.com',
      githubUrl: 'https://github.com/johndoe/ecommerce',
      imageUrl: null,
      videoUrl: null,
      status: 'completed',
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-06-01'),
      isFeatured: false,
      isVisible: true,
      sortOrder: 0,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'project-2',
      portfolioId: 'test-portfolio-id',
      workExperienceId: null,
      title: 'Task Management App',
      description: 'A collaborative task management application with real-time updates.',
      shortDescription: null,
      technologies: ['Vue.js', 'Express', 'Socket.io'],
      liveUrl: null,
      githubUrl: 'https://github.com/johndoe/task-manager',
      imageUrl: null,
      videoUrl: null,
      status: 'in-progress',
      startDate: new Date('2023-07-01'),
      endDate: null,
      isFeatured: false,
      isVisible: true,
      sortOrder: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
  testimonials: [],
  ...overrides,
})

describe('formatPortfolioForLLM', () => {
  it('should format complete portfolio data correctly', () => {
    const portfolio = createMockPortfolio()
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('CANDIDATE PROFILE:')
    expect(result).toContain('Name: John Doe')
    expect(result).toContain('Current Role: Senior Software Engineer')
    expect(result).toContain('Location: San Francisco, CA')
    expect(result).toContain('Email: john.doe@example.com')
    expect(result).toContain('Phone: +1 (555) 123-4567')
  })

  it('should include professional summary', () => {
    const portfolio = createMockPortfolio()
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('PROFESSIONAL SUMMARY:')
    expect(result).toContain('Passionate full-stack developer with 5+ years')
  })

  it('should format social links correctly', () => {
    const portfolio = createMockPortfolio()
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('CONTACT LINKS:')
    expect(result).toContain('- LinkedIn: https://linkedin.com/in/johndoe')
    expect(result).toContain('- GitHub: https://github.com/johndoe')
    expect(result).toContain('- Website: https://johndoe.dev')
    expect(result).toContain('- Twitter: https://twitter.com/johndoe')
  })

  it('should handle missing social links gracefully', () => {
    const portfolio = createMockPortfolio({
      socialLinks: null,
    })
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('CONTACT LINKS:')
    expect(result).not.toContain('- LinkedIn:')
    expect(result).not.toContain('- GitHub:')
  })

  it('should format work experience with dates', () => {
    const portfolio = createMockPortfolio()
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('WORK EXPERIENCE:')
    expect(result).toContain('1. Senior Full Stack Developer at TechCorp Inc (Dec 2021 - Present)')
    expect(result).toContain('2. Frontend Developer at StartupXYZ (May 2020 - Dec 2021)')
    expect(result).toContain('Key Metrics: Led team of 5, improved performance by 40%')
    expect(result).toContain('Technologies: React, Node.js, TypeScript, PostgreSQL')
  })

  it('should handle missing work experience dates', () => {
    const portfolio = createMockPortfolio({
      workExperiences: [
        {
          ...createMockPortfolio().workExperiences[0],
          startDate: null,
          endDate: null,
        },
      ],
    })
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('(Unknown - Present)')
  })

  it('should categorize skills correctly', () => {
    const portfolio = createMockPortfolio()
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('SKILLS:')
    expect(result).toContain('Frontend:')
    expect(result).toContain('- React (90% proficiency) - 5 years - Expert in React development')
    expect(result).toContain('Backend:')
    expect(result).toContain(
      '- Node.js (85% proficiency) - 4 years - Strong backend development skills'
    )
    expect(result).toContain('Other:')
    expect(result).toContain('- Docker (75% proficiency)')
  })

  it('should format projects with technologies and URLs', () => {
    const portfolio = createMockPortfolio()
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('PROJECTS:')
    expect(result).toContain('1. E-commerce Platform (completed)')
    expect(result).toContain('Technologies: React, Node.js, PostgreSQL, Stripe')
    expect(result).toContain('Live URL: https://ecommerce-demo.com')
    expect(result).toContain('GitHub: https://github.com/johndoe/ecommerce')

    expect(result).toContain('2. Task Management App (in-progress)')
    expect(result).toContain('Technologies: Vue.js, Express, Socket.io')
    expect(result).toContain('GitHub: https://github.com/johndoe/task-manager')
    expect(result).not.toContain('Live URL: null')
  })

  it('should include portfolio statistics', () => {
    const portfolio = createMockPortfolio()
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('KEY STATISTICS:')
    expect(result).toContain('- Years Experience: 5+')
    expect(result).toContain('- Projects Completed: 50+')
  })

  it('should handle empty portfolio stats gracefully', () => {
    const portfolio = createMockPortfolio({
      portfolioStats: [],
    })
    const result = formatPortfolioForLLM(portfolio)

    expect(result).not.toContain('KEY STATISTICS:')
  })

  it('should handle missing phone number', () => {
    const portfolio = createMockPortfolio({
      phone: null,
    })
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('Name: John Doe')
    expect(result).toContain('Email: john.doe@example.com')
    expect(result).not.toContain('Phone:')
  })

  it('should handle empty arrays gracefully', () => {
    const portfolio = createMockPortfolio({
      workExperiences: [],
      skills: [],
      projects: [],
      portfolioStats: [],
    })
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('CANDIDATE PROFILE:')
    expect(result).toContain('WORK EXPERIENCE:')
    expect(result).toContain('SKILLS:')
    expect(result).toContain('PROJECTS:')
    expect(result).not.toContain('KEY STATISTICS:')
  })

  it('should handle skills without optional fields', () => {
    const portfolio = createMockPortfolio({
      skills: [
        {
          id: 'skill-minimal',
          portfolioId: 'test-portfolio-id',
          name: 'JavaScript',
          level: 80,
          category: 'Programming',
          icon: null,
          description: null,
          yearsOfExperience: null,
          isVisible: true,
          sortOrder: 0,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ],
    })
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('Programming:')
    expect(result).toContain('- JavaScript (80% proficiency)')
    expect(result).not.toContain('- JavaScript (80% proficiency) - ')
  })

  it('should handle projects without optional URLs', () => {
    const portfolio = createMockPortfolio({
      projects: [
        {
          id: 'project-minimal',
          portfolioId: 'test-portfolio-id',
          workExperienceId: null,
          title: 'Simple App',
          description: 'A basic application',
          shortDescription: null,
          technologies: [],
          liveUrl: null,
          githubUrl: null,
          status: 'completed' as const,
          imageUrl: null,
          videoUrl: null,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-01'),
          isFeatured: false,
          sortOrder: 0,
          isVisible: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ],
    })
    const result = formatPortfolioForLLM(portfolio)

    expect(result).toContain('1. Simple App (completed)')
    expect(result).toContain('Description: A basic application')
    expect(result).not.toContain('Live URL:')
    // Note: GitHub appears in CONTACT LINKS section from social links, not project section
  })
})

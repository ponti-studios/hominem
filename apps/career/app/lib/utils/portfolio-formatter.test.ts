import { describe, expect, it } from 'vitest';

import type { FullPortfolio } from '../portfolio.server';
import { formatPortfolioForLLM } from './portfolio-formatter';

// Mock portfolio data for testing
const createMockPortfolio = (overrides: Partial<FullPortfolio> = {}): FullPortfolio => ({
  id: 'test-portfolio-id',
  owner_userid: 'test-user-id',
  slug: 'test-portfolio',
  title: 'Test Portfolio',
  is_public: true,
  is_active: true,
  name: 'John Doe',
  initials: 'JD',
  job_title: 'Senior Software Engineer',
  bio: 'Passionate full-stack developer with 5+ years of experience building scalable web applications.',
  tagline: 'Building the future, one line of code at a time',
  current_location: 'San Francisco, CA',
  location_tagline: 'Silicon Valley',
  availability_status: true,
  availability_message: 'Open to new opportunities',
  email: 'john.doe@example.com',
  phone: '+1 (555) 123-4567',
  profile_image_url: null,
  theme: null,
  copyright: null,
  createdat: new Date('2024-01-01'),
  updatedat: new Date('2024-01-01'),
  social_links: {
    id: 'social-1',
    portfolio_id: 'test-portfolio-id',
    github: 'https://github.com/johndoe',
    linkedin: 'https://linkedin.com/in/johndoe',
    twitter: 'https://twitter.com/johndoe',
    website: 'https://johndoe.dev',
    createdat: new Date('2024-01-01'),
    updatedat: new Date('2024-01-01'),
  },
  portfolio_stats: [
    {
      id: 'stat-1',
      portfolio_id: 'test-portfolio-id',
      label: 'Years Experience',
      value: '5+',
      sort_order: 0,
      createdat: new Date('2024-01-01'),
      updatedat: new Date('2024-01-01'),
    },
    {
      id: 'stat-2',
      portfolio_id: 'test-portfolio-id',
      label: 'Projects Completed',
      value: '50+',
      sort_order: 1,
      createdat: new Date('2024-01-01'),
      updatedat: new Date('2024-01-01'),
    },
  ],
  work_experiences: [
    {
      id: 'work-1',
      portfolio_id: 'test-portfolio-id',
      company: 'TechCorp Inc',
      description:
        'Led development of key features and mentored junior developers. Implemented CI/CD pipelines and improved deployment efficiency by 40%.',
      role: 'Senior Full Stack Developer',
      start_date: new Date('2022-01-01'),
      end_date: null,
      image: null,
      gradient: null,
      metrics: 'Led team of 5, improved performance by 40%',
      action: null,
      tags: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
      metadata: null,
      sort_order: 0,
      is_visible: true,
      // Required financial fields
      base_salary: 12000000, // $120,000 in cents
      currency: 'USD',
      salary_range: null,
      signing_bonus: null,
      annual_bonus: 2000000, // $20,000 in cents
      bonus_history: [],
      benefits: null,
      // Employment details
      employment_type: 'full-time',
      work_arrangement: 'hybrid',
      seniority_level: 'senior',
      department: 'Engineering',
      team_size: 8,
      reports_to: 'Engineering Manager',
      direct_reports: 2,
      performance_ratings: [],
      salary_adjustments: [],
      reason_for_leaving: null,
      exit_notes: null,
      createdat: new Date('2024-01-01'),
      updatedat: new Date('2024-01-01'),
    },
    {
      id: 'work-2',
      portfolio_id: 'test-portfolio-id',
      company: 'StartupXYZ',
      description:
        'Developed MVP for a fintech startup. Built responsive web application from scratch using modern technologies.',
      role: 'Frontend Developer',
      start_date: new Date('2020-06-01'),
      end_date: new Date('2021-12-31'),
      image: null,
      gradient: null,
      metrics: 'Reduced load time by 60%',
      action: null,
      tags: ['Vue.js', 'JavaScript', 'CSS3'],
      metadata: null,
      sort_order: 1,
      is_visible: true,
      // Required financial fields
      base_salary: 8500000, // $85,000 in cents
      currency: 'USD',
      salary_range: null,
      signing_bonus: 500000, // $5,000 in cents
      annual_bonus: null,
      bonus_history: [],
      benefits: null,
      // Employment details
      employment_type: 'full-time',
      work_arrangement: 'office',
      seniority_level: 'mid-level',
      department: 'Product',
      team_size: 4,
      reports_to: 'Product Manager',
      direct_reports: 0,
      performance_ratings: [],
      salary_adjustments: [],
      reason_for_leaving: 'better_opportunity',
      exit_notes: null,
      createdat: new Date('2024-01-01'),
      updatedat: new Date('2024-01-01'),
    },
  ],
  skills: [
    {
      id: 'skill-1',
      portfolio_id: 'test-portfolio-id',
      name: 'React',
      level: 90,
      category: 'Frontend',
      icon: null,
      description: 'Expert in React development with hooks and context',
      years_of_experience: 5,
      is_visible: true,
      sort_order: 0,
      createdat: new Date('2024-01-01'),
      updatedat: new Date('2024-01-01'),
    },
    {
      id: 'skill-2',
      portfolio_id: 'test-portfolio-id',
      name: 'Node.js',
      level: 85,
      category: 'Backend',
      icon: null,
      description: 'Strong backend development skills',
      years_of_experience: 4,
      is_visible: true,
      sort_order: 1,
      createdat: new Date('2024-01-01'),
      updatedat: new Date('2024-01-01'),
    },
    {
      id: 'skill-3',
      portfolio_id: 'test-portfolio-id',
      name: 'Docker',
      level: 75,
      category: null, // Should go to "Other" category
      icon: null,
      description: null,
      years_of_experience: null,
      is_visible: true,
      sort_order: 2,
      createdat: new Date('2024-01-01'),
      updatedat: new Date('2024-01-01'),
    },
  ],
  projects: [
    {
      id: 'project-1',
      portfolio_id: 'test-portfolio-id',
      work_experience_id: null,
      title: 'E-commerce Platform',
      description:
        'Built a full-stack e-commerce platform with payment integration and admin dashboard.',
      short_description: null,
      technologies: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
      live_url: 'https://ecommerce-demo.com',
      github_url: 'https://github.com/johndoe/ecommerce',
      image_url: null,
      video_url: null,
      status: 'completed',
      start_date: new Date('2023-01-01'),
      end_date: new Date('2023-06-01'),
      is_featured: false,
      is_visible: true,
      sort_order: 0,
      createdat: new Date('2024-01-01'),
      updatedat: new Date('2024-01-01'),
    },
    {
      id: 'project-2',
      portfolio_id: 'test-portfolio-id',
      work_experience_id: null,
      title: 'Task Management App',
      description: 'A collaborative task management application with real-time updates.',
      short_description: null,
      technologies: ['Vue.js', 'Express', 'Socket.io'],
      live_url: null,
      github_url: 'https://github.com/johndoe/task-manager',
      image_url: null,
      video_url: null,
      status: 'in-progress',
      start_date: new Date('2023-07-01'),
      end_date: null,
      is_featured: false,
      is_visible: true,
      sort_order: 1,
      createdat: new Date('2024-01-01'),
      updatedat: new Date('2024-01-01'),
    },
  ],
  testimonials: [],
  ...overrides,
});

describe('formatPortfolioForLLM', () => {
  it('should format complete portfolio data correctly', () => {
    const portfolio = createMockPortfolio();
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('CANDIDATE PROFILE:');
    expect(result).toContain('Name: John Doe');
    expect(result).toContain('Current Role: Senior Software Engineer');
    expect(result).toContain('Location: San Francisco, CA');
    expect(result).toContain('Email: john.doe@example.com');
    expect(result).toContain('Phone: +1 (555) 123-4567');
  });

  it('should include professional summary', () => {
    const portfolio = createMockPortfolio();
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('PROFESSIONAL SUMMARY:');
    expect(result).toContain('Passionate full-stack developer with 5+ years');
  });

  it('should format social links correctly', () => {
    const portfolio = createMockPortfolio();
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('CONTACT LINKS:');
    expect(result).toContain('- LinkedIn: https://linkedin.com/in/johndoe');
    expect(result).toContain('- GitHub: https://github.com/johndoe');
    expect(result).toContain('- Website: https://johndoe.dev');
    expect(result).toContain('- Twitter: https://twitter.com/johndoe');
  });

  it('should handle missing social links gracefully', () => {
    const portfolio = createMockPortfolio({
      social_links: null,
    });
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('CONTACT LINKS:');
    expect(result).not.toContain('- LinkedIn:');
    expect(result).not.toContain('- GitHub:');
  });

  it('should format work experience with dates', () => {
    const portfolio = createMockPortfolio();
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('WORK EXPERIENCE:');
    expect(result).toContain('1. Senior Full Stack Developer at TechCorp Inc (Dec 2021 - Present)');
    expect(result).toContain('2. Frontend Developer at StartupXYZ (May 2020 - Dec 2021)');
    expect(result).toContain('Key Metrics: Led team of 5, improved performance by 40%');
    expect(result).toContain('Technologies: React, Node.js, TypeScript, PostgreSQL');
  });

  it('should handle missing work experience dates', () => {
    const portfolio = createMockPortfolio({
      work_experiences: [
        {
          ...createMockPortfolio().work_experiences[0],
          start_date: null,
          end_date: null,
        },
      ],
    });
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('(Unknown - Present)');
  });

  it('should categorize skills correctly', () => {
    const portfolio = createMockPortfolio();
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('SKILLS:');
    expect(result).toContain('Frontend:');
    expect(result).toContain('- React (90% proficiency) - 5 years - Expert in React development');
    expect(result).toContain('Backend:');
    expect(result).toContain(
      '- Node.js (85% proficiency) - 4 years - Strong backend development skills',
    );
    expect(result).toContain('Other:');
    expect(result).toContain('- Docker (75% proficiency)');
  });

  it('should format projects with technologies and URLs', () => {
    const portfolio = createMockPortfolio();
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('PROJECTS:');
    expect(result).toContain('1. E-commerce Platform (completed)');
    expect(result).toContain('Technologies: React, Node.js, PostgreSQL, Stripe');
    expect(result).toContain('Live URL: https://ecommerce-demo.com');
    expect(result).toContain('GitHub: https://github.com/johndoe/ecommerce');

    expect(result).toContain('2. Task Management App (in-progress)');
    expect(result).toContain('Technologies: Vue.js, Express, Socket.io');
    expect(result).toContain('GitHub: https://github.com/johndoe/task-manager');
    expect(result).not.toContain('Live URL: null');
  });

  it('should include portfolio statistics', () => {
    const portfolio = createMockPortfolio();
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('KEY STATISTICS:');
    expect(result).toContain('- Years Experience: 5+');
    expect(result).toContain('- Projects Completed: 50+');
  });

  it('should handle empty portfolio stats gracefully', () => {
    const portfolio = createMockPortfolio({
      portfolio_stats: [],
    });
    const result = formatPortfolioForLLM(portfolio);

    expect(result).not.toContain('KEY STATISTICS:');
  });

  it('should handle missing phone number', () => {
    const portfolio = createMockPortfolio({
      phone: null,
    });
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('Name: John Doe');
    expect(result).toContain('Email: john.doe@example.com');
    expect(result).not.toContain('Phone:');
  });

  it('should handle empty arrays gracefully', () => {
    const portfolio = createMockPortfolio({
      work_experiences: [],
      skills: [],
      projects: [],
      portfolio_stats: [],
    });
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('CANDIDATE PROFILE:');
    expect(result).toContain('WORK EXPERIENCE:');
    expect(result).toContain('SKILLS:');
    expect(result).toContain('PROJECTS:');
    expect(result).not.toContain('KEY STATISTICS:');
  });

  it('should handle skills without optional fields', () => {
    const portfolio = createMockPortfolio({
      skills: [
        {
          id: 'skill-minimal',
          portfolio_id: 'test-portfolio-id',
          name: 'JavaScript',
          level: 80,
          category: 'Programming',
          icon: null,
          description: null,
          years_of_experience: null,
          is_visible: true,
          sort_order: 0,
          createdat: new Date('2024-01-01'),
          updatedat: new Date('2024-01-01'),
        },
      ],
    });
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('Programming:');
    expect(result).toContain('- JavaScript (80% proficiency)');
    expect(result).not.toContain('- JavaScript (80% proficiency) - ');
  });

  it('should handle projects without optional URLs', () => {
    const portfolio = createMockPortfolio({
      projects: [
        {
          id: 'project-minimal',
          portfolio_id: 'test-portfolio-id',
          work_experience_id: null,
          title: 'Simple App',
          description: 'A basic application',
          short_description: null,
          technologies: [],
          live_url: null,
          github_url: null,
          status: 'completed' as const,
          image_url: null,
          video_url: null,
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-01'),
          is_featured: false,
          sort_order: 0,
          is_visible: true,
          createdat: new Date('2024-01-01'),
          updatedat: new Date('2024-01-01'),
        },
      ],
    });
    const result = formatPortfolioForLLM(portfolio);

    expect(result).toContain('1. Simple App (completed)');
    expect(result).toContain('Description: A basic application');
    expect(result).not.toContain('Live URL:');
    // Note: GitHub appears in CONTACT LINKS section from social links, not project section
  });
});

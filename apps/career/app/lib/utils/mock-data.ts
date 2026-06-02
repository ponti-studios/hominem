import { getMockPortfolioData } from '../auth.server'

/**
 * Check if user is a test user
 */
export function isTestUser(userId: string): boolean {
  return userId === '00000000-0000-0000-0000-000000000000'
}

/**
 * Check if request should use mock data
 */
export function shouldUseMockData(request: Request): boolean {
  const cookieHeader = request.headers.get('Cookie')
  const testAuthCookie = cookieHeader
    ?.split(';')
    .find((c) => c.trim().startsWith('test-auth-user='))
    ?.split('=')[1]
  return !!testAuthCookie
}

/**
 * Get mock data with forms for editor
 */
export async function getMockDataWithForms(request: Request) {
  const mockData = getMockPortfolioData(request)
  if (!mockData) {
    throw new Error('No mock data available')
  }

  return {
    user: {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
      name: 'Test User',
    },
    existingPortfolio: mockData.completePortfolio,
    portfolioId: mockData.portfolio.id,
    workExperienceData: mockData.workExperience,
    skillsData: mockData.skills,
    personalInfoData: {
      name: mockData.portfolio.name,
      jobTitle: mockData.portfolio.jobTitle,
      bio: mockData.portfolio.bio,
      tagline: mockData.portfolio.tagline,
      currentLocation: mockData.portfolio.currentLocation,
      locationTagline: mockData.portfolio.locationTagline,
      availabilityStatus: mockData.portfolio.availabilityStatus,
      availabilityMessage: mockData.portfolio.availabilityMessage,
      email: mockData.portfolio.email,
      phone: mockData.portfolio.phone,
      copyright: mockData.portfolio.copyright,
      theme: mockData.portfolio.theme,
    },
    socialLinksData: {},
    statsData: [],
  }
}

/**
 * Get mock portfolio for forms
 */
export function getMockPortfolioForForms(request: Request) {
  return getMockDataWithForms(request)
}

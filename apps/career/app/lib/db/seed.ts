import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { client, db, schema } from './index'

const SEED_USER_EMAIL = 'user@example.com'
const SEED_USER_NAME = 'Demo User'
const PORTFOLIO_SLUG = 'charles-ponti'

async function seed() {
  console.info('🌱 Starting database seed...')

  try {
    // 1. Upsert User
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, SEED_USER_EMAIL),
    })

    if (user) {
      console.info(`Found existing user: ${user.name} (${user.email})`)
    } else {
      const newUsers = await db
        .insert(schema.users)
        .values({
          email: SEED_USER_EMAIL,
          name: SEED_USER_NAME,
        })
        .returning()
      user = newUsers[0]
      console.info(`Created new user: ${user.name} (${user.email})`)
    }

    if (!user) {
      throw new Error('Failed to create or find user.')
    }
    const userId = user.id

    // 2. Upsert Portfolio
    let portfolio = await db.query.portfolios.findFirst({
      where: eq(schema.portfolios.slug, PORTFOLIO_SLUG),
    })

    if (portfolio) {
      console.info(`Found existing portfolio: ${portfolio.title} (slug: ${portfolio.slug})`)
      // Optionally update existing portfolio
      const updatedPortfolios = await db
        .update(schema.portfolios)
        .set({
          userId: userId,
          title: 'Demo Portfolio',
          updatedAt: new Date(),
        })
        .where(eq(schema.portfolios.id, portfolio.id))
        .returning()
      portfolio = updatedPortfolios[0]
      console.info(`Updated portfolio: ${portfolio.title}`)
    } else {
      const newPortfolios = await db
        .insert(schema.portfolios)
        .values({
          userId: userId,
          slug: PORTFOLIO_SLUG,
          title: 'Demo Portfolio',
          isPublic: true,
          isActive: true,
          name: SEED_USER_NAME,
          initials: 'DU',
          jobTitle: 'Developer',
          bio: 'Demo user bio.',
          tagline: 'Demo tagline.',
          currentLocation: 'Demo City',
          locationTagline: 'Remote',
          availabilityStatus: true,
          availabilityMessage: 'Available for new opportunities.',
          email: SEED_USER_EMAIL,
          phone: '555-555-5555',
          theme: {
            primaryColor: '#6366F1',
            accentColor: '#F59E42',
            backgroundColor: '#FFFFFF',
            fontFamily: 'Inter, sans-serif',
          },
          copyright: '© Demo User',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
      portfolio = newPortfolios[0]
      console.info(`Created new portfolio: ${portfolio.title} (slug: ${portfolio.slug})`)
    }

    if (!portfolio) {
      throw new Error('Failed to create or find portfolio.')
    }
    const portfolioId = portfolio.id

    // 3. Skipping work experience and skills seeding due to missing demo data.

    console.info('✅ Database seed completed successfully.')
  } catch (error) {
    console.error('🔴 Error during database seed:', error)
    process.exit(1)
  } finally {
    // Ensure the database connection is closed
    await client.end()
    console.info('Database connection closed.')
  }
}

seed()

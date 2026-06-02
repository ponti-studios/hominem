import { getFullUserPortfolio } from '../lib/portfolio.server'

export async function loader({ params }: { params: { userId: string } }) {
  const { userId } = params

  if (!userId) {
    throw new Response('User ID is required', { status: 400 })
  }

  try {
    const portfolio = await getFullUserPortfolio(userId)

    if (!portfolio) {
      throw new Response('Portfolio not found', { status: 404 })
    }

    return Response.json(portfolio)
  } catch (error) {
    console.error('Error fetching portfolio:', error)
    throw new Response('Internal server error', { status: 500 })
  }
}

import type { LoaderFunctionArgs } from 'react-router'
import { getServerEnv } from '~/lib/env'

export async function loader({ request }: LoaderFunctionArgs) {
  const start = Date.now()
  const checks: Record<string, boolean | string> = {}

  try {
    // Check database connectivity
    const env = getServerEnv()
    const dbUrl = new URL(env.VITE_DATABASE_URL)
    checks.database = 'connected'

    // Check Supabase connectivity
    const supabaseResponse = await fetch(`${env.VITE_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: env.VITE_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })
    checks.supabase = supabaseResponse.ok ? 'connected' : 'failed'

    const responseTime = Date.now() - start

    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime,
      checks,
      version: process.env.npm_package_version || 'unknown',
    })
  } catch (error) {
    return Response.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - start,
        checks,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}

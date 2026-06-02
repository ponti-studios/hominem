import { useEffect, useState } from 'react'
import type { MetaFunction } from 'react-router'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '~/components/ui/button'
import { useUser } from '../hooks/useAuth'
import { createClient } from '../lib/supabase/client'

export const meta: MetaFunction = () => {
  return [
    { title: 'Login - Craftd' },
    {
      name: 'description',
      content: 'Sign in to Craftd to create and manage your professional portfolio',
    },
  ]
}

export default function Login() {
  const [searchParams] = useSearchParams()
  const user = useUser()
  const navigate = useNavigate()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  const errorMessage = searchParams.get('error')

  useEffect(() => {
    if (user) {
      navigate('/account')
    }
  }, [user, navigate])

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setGoogleError(null)
    try {
      const supabase = await createClient()

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setGoogleError(error.message || 'Google login failed. Please try again.')
      }
    } catch (err: unknown) {
      function isErrorWithMessage(e: unknown): e is { message: string } {
        return (
          typeof e === 'object' &&
          e !== null &&
          'message' in e &&
          typeof (e as { message?: unknown }).message === 'string'
        )
      }
      if (isErrorWithMessage(err)) {
        setGoogleError(err.message)
      } else {
        setGoogleError('Google login failed. Please try again.')
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  // Redirect if user is already logged in
  if (user) {
    return (
      <div className=" flex items-center justify-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-center sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            ✨
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Sign in to Craftd
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Create and manage your professional portfolio
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {(errorMessage || googleError) && (
            <div className="mb-6 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {googleError
                      ? googleError
                      : errorMessage === 'oauth_error'
                        ? 'There was an error signing in with Google. Please try again.'
                        : errorMessage === 'auth_callback_error'
                          ? 'Authentication failed. Please try signing in again.'
                          : 'An error occurred during authentication.'}
                  </h3>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <Button
              type="button"
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full flex justify-center items-center px-4 py-3 text-sm font-medium"
              disabled={isGoogleLoading}
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" role="img" aria-label="Google logo">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {isGoogleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
            </Button>

            <div className="text-center">
              <Link to="/" className="text-sm text-blue-600 hover:text-blue-500">
                ← Back to home
              </Link>
            </div>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Why Google?</span>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 space-y-2">
                <p>
                  • <strong>Secure:</strong> No passwords to remember or manage
                </p>
                <p>
                  • <strong>Fast:</strong> One-click sign-in with your Google account
                </p>
                <p>
                  • <strong>Trusted:</strong> Powered by Google's security infrastructure
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

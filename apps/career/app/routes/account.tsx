import { and, eq, ne } from 'drizzle-orm'
import { Download, Edit, ExternalLink, LogOut, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { useActionData, useLoaderData, useNavigate, useSubmit } from 'react-router'
import { Button } from '~/components/ui/button'
import { ProfileImageUpload } from '../components/ProfileImageUpload'
import { SlugEditor } from '../components/SlugEditor'
import { db } from '../lib/db'
import { portfolios } from '../lib/db/schema'
import { getFullUserPortfolio } from '../lib/portfolio.server'
import {
  createErrorResponse,
  createSuccessResponse,
  tryAsync,
  withAuthAction,
  withAuthLoader,
  withMockDataFallback,
} from '../lib/route-utils'
import {
  FILE_VALIDATION_PRESETS,
  deleteFile,
  uploadFile,
  validateFile,
} from '../lib/services/storage.service'
import { createClient } from '../lib/supabase/client'
import { getMockPortfolioForForms } from '../lib/utils/mock-data'

// Account loader - migrated from Svelte layout server
export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user, request }) => {
    return withMockDataFallback(
      request,
      async (request) => {
        const mockData = await getMockPortfolioForForms(request)
        // Convert mock data to PortfolioSummary format
        const mockSummary = {
          id: mockData.portfolioId,
          slug: 'test-portfolio',
          title: 'Test Portfolio',
          name: mockData.personalInfoData.name,
          jobTitle: mockData.personalInfoData.jobTitle,
          bio: mockData.personalInfoData.bio,
          isPublic: true,
          isActive: true,
          updatedAt: new Date(),
          profileImageUrl: undefined,
        }
        return {
          user,
          portfolios: [mockSummary],
          hasPortfolio: true,
        }
      },
      async () => {
        const fullPortfolio = await getFullUserPortfolio(user.id)
        const portfolios: Portfolio[] = fullPortfolio
          ? [
              {
                id: fullPortfolio.id,
                title: fullPortfolio.title,
                slug: fullPortfolio.slug,
                isPublic: fullPortfolio.isPublic,
                isActive: fullPortfolio.isActive,
                updatedAt: fullPortfolio.updatedAt,
                name: fullPortfolio.name,
                jobTitle: fullPortfolio.jobTitle,
                bio: fullPortfolio.bio,
                profileImageUrl: fullPortfolio.profileImageUrl || undefined,
              },
            ]
          : []
        return {
          user,
          portfolios,
          hasPortfolio: portfolios.length > 0,
        }
      }
    )
  })
}

// Server action for portfolio operations
export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ supabase, user }) => {
    const formData = await args.request.formData()
    const action = formData.get('action')
    const portfolioId = formData.get('portfolioId')

    if (action === 'delete' && portfolioId) {
      return tryAsync(async () => {
        const { error } = await supabase.from('portfolios').delete().eq('id', portfolioId)

        if (error) {
          return createErrorResponse(error.message)
        }

        return createSuccessResponse(null, 'Portfolio deleted successfully')
      }, 'Failed to delete portfolio')
    }

    if (action === 'upload-profile-image') {
      return tryAsync(async () => {
        const imageFile = formData.get('image') as File | null

        if (!imageFile) {
          return createErrorResponse('No image file provided')
        }

        // Use centralized file validation
        const validation = validateFile(imageFile, FILE_VALIDATION_PRESETS.PROFILE_IMAGE)
        if (!validation.valid) {
          return createErrorResponse(validation.error || 'Invalid file')
        }

        // Generate unique filename - use Supabase auth user ID for RLS policy
        const supabaseUserId = user.supabaseUser?.id
        if (!supabaseUserId) {
          return createErrorResponse('User authentication required')
        }

        // Use centralized upload helper
        const uploadResult = await uploadFile(supabase, {
          file: imageFile,
          userId: supabaseUserId,
          folder: 'profile-images',
          upsert: true,
        })

        if (!uploadResult.success) {
          console.error('Supabase upload error:', uploadResult.error)
          return createErrorResponse(uploadResult.error || 'Failed to upload image')
        }

        // Update portfolio with new profile image URL using Drizzle
        try {
          await db
            .update(portfolios)
            .set({ profileImageUrl: uploadResult.publicUrl })
            .where(eq(portfolios.userId, user.id))
        } catch (updateError) {
          console.error('Database update error:', updateError)
          // Clean up uploaded file on database error
          if (uploadResult.filePath) {
            await deleteFile(supabase, uploadResult.filePath)
          }
          return createErrorResponse('Failed to update portfolio')
        }

        return createSuccessResponse(
          { imageUrl: uploadResult.publicUrl },
          'Profile image updated successfully'
        )
      }, 'Failed to upload profile image')
    }

    if (action === 'update-slug') {
      return tryAsync(async () => {
        const newSlug = formData.get('slug') as string
        const portfolioId = formData.get('portfolioId') as string

        if (!newSlug || !portfolioId) {
          return createErrorResponse('Slug and portfolio ID are required')
        }

        // Basic slug validation
        if (!/^[a-z0-9-]+$/.test(newSlug)) {
          return createErrorResponse(
            'Slug can only contain lowercase letters, numbers, and hyphens'
          )
        }

        if (newSlug.length < 3) {
          return createErrorResponse('Slug must be at least 3 characters long')
        }

        if (newSlug.length > 50) {
          return createErrorResponse('Slug must be less than 50 characters long')
        }

        // Check if slug already exists (excluding current portfolio)
        const existingPortfolio = await db
          .select({ id: portfolios.id })
          .from(portfolios)
          .where(and(eq(portfolios.slug, newSlug), ne(portfolios.id, portfolioId)))
          .limit(1)

        if (existingPortfolio.length > 0) {
          return createErrorResponse('Slug is already taken')
        }

        // Update portfolio slug
        await db
          .update(portfolios)
          .set({ slug: newSlug })
          .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, user.id)))

        return createSuccessResponse({ slug: newSlug }, 'Portfolio URL updated successfully')
      }, 'Failed to update portfolio URL')
    }

    return createErrorResponse('Invalid action')
  })
}

interface Portfolio {
  id: string
  title: string
  slug: string
  isPublic: boolean
  isActive: boolean
  updatedAt: string | Date
  name?: string
  jobTitle?: string
  bio?: string
  profileImageUrl?: string
}

export function meta() {
  return [
    { title: 'Account - Craftd' },
    { name: 'description', content: 'Manage your portfolio and account settings' },
  ]
}

export default function Account() {
  const navigate = useNavigate()
  const submit = useSubmit()
  const loaderData = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const { user, portfolios, hasPortfolio } = loaderData

  const portfolio = portfolios[0]
  const [profileImageUrl, setProfileImageUrl] = useState(portfolio?.profileImageUrl || undefined)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      const supabase = await createClient()
      await supabase.auth.signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleDeletePortfolio = (portfolioId: string) => {
    if (confirm('Are you sure you want to delete this portfolio? This action cannot be undone.')) {
      const formData = new FormData()
      formData.append('action', 'delete')
      formData.append('portfolioId', portfolioId)

      submit(formData, { method: 'post' })
    }
  }

  const handleImageUpload = (imageUrl: string) => {
    setProfileImageUrl(imageUrl)
    setUploadError(null)
  }

  const handleImageError = (error: string) => {
    setUploadError(error)
  }

  const handleDownloadPdf = async () => {
    if (!portfolio?.slug || !portfolio.isPublic) {
      setPdfError('Portfolio must be public to generate PDF')
      return
    }

    try {
      setPdfGenerating(true)
      setPdfError(null)

      const portfolioUrl = `${window.location.origin}/p/${portfolio.slug}`

      const response = await fetch('https://craftd-worker.fly.dev/trigger-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: portfolioUrl,
          userId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success && result.pdfUrl) {
        // Open the PDF in a new tab for download
        window.open(result.pdfUrl, '_blank')
      } else {
        setPdfError(result.message || 'Failed to generate PDF')
      }
    } catch (error) {
      console.error('PDF generation error:', error)
      setPdfError('Failed to generate PDF. Please try again.')
    } finally {
      setPdfGenerating(false)
    }
  }

  // User should be available from loader (requireAuth ensures this)
  if (!user) {
    navigate('/login')
    return null
  }

  const userDisplayName = String(user.supabaseUser?.user_metadata?.full_name || user.name || user.email)
  const userAvatar = user.supabaseUser?.user_metadata?.avatar_url

  return (
    <div className="py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center -mt-4">
          <p className="mt-2 text-gray-600">Manage your portfolio and account settings</p>
        </div>

        {/* Profile Information Card */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6 space-y-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Profile Information</h3>

            <ProfileImageUpload
              currentImageUrl={portfolio.profileImageUrl}
              onImageUploaded={handleImageUpload}
              onError={handleImageError}
            />

            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <h3 className="text-lg font-medium">{userDisplayName}</h3>
                  <p className="text-gray-600">{user.email}</p>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                variant="outline"
                size="sm"
                className="inline-flex items-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isSigningOut ? 'Signing Out...' : 'Sign Out'}
              </Button>
            </div>

            {uploadError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{uploadError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Portfolio Management Section */}
        <div className="mb-6">
          {portfolio ? (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-3 sm:hidden">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Portfolio</h2>
                    {portfolio.isPublic && (
                      <a
                        href={`/p/${portfolio.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="text-xs">View</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          portfolio.isPublic
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {portfolio.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop: Horizontal layout */}
                <div className="hidden sm:flex sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-lg font-semibold">Portfolio</h2>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          portfolio.isPublic
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {portfolio.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>

                  {portfolio.isPublic && (
                    <a
                      href={`/p/${portfolio.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Live
                    </a>
                  )}
                </div>

                <div className="mt-4 space-y-4">
                  {/* Editable Portfolio URL */}
                  <SlugEditor portfolioId={portfolio.id} initialSlug={portfolio.slug} />

                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      Want to update your portfolio with a new resume? Use "Upload New Resume" to
                      replace your current portfolio data with fresh information from your updated
                      resume.
                    </p>
                  </div>

                  {/* Responsive button layout */}
                  <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                    <Button
                      type="button"
                      onClick={() => navigate('/editor')}
                      variant="default"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Portfolio
                    </Button>
                    <Button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={pdfGenerating || !portfolio.isPublic}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto border-green-200 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {pdfGenerating ? 'Generating PDF...' : 'Download PDF'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => navigate('/onboarding')}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto border-blue-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload New Resume
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleDeletePortfolio(portfolio.id)}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Portfolio
                    </Button>
                  </div>

                  {pdfError && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-600">{pdfError}</p>
                    </div>
                  )}

                  {!portfolio.isPublic && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        Your portfolio must be public to generate a PDF. Make it public in the
                        editor to enable PDF downloads.
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Last updated: {new Date(portfolio.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-8 text-center">
                <p className="text-gray-500 mb-4">No portfolio found</p>
                <p className="text-sm text-gray-400 mb-6">
                  Create your professional portfolio to showcase your skills and experience.
                </p>
                <Button
                  type="button"
                  onClick={() => navigate('/onboarding')}
                  variant="default"
                  className="inline-flex items-center justify-center"
                >
                  Get Started
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

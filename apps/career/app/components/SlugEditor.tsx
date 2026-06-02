import { Check, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSubmit } from 'react-router'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

interface SlugEditorProps {
  portfolioId: string
  initialSlug: string
  onSave?: (newSlug: string) => void
  onCancel?: () => void
}

interface ValidationState {
  isChecking: boolean
  isAvailable: boolean | null
  message: string
  isValid: boolean
}

export function SlugEditor({ portfolioId, initialSlug, onSave, onCancel }: SlugEditorProps) {
  const submit = useSubmit()

  // Component state
  const [slugValue, setSlugValue] = useState(initialSlug)
  const [isSaving, setIsSaving] = useState(false)
  const [validation, setValidation] = useState<ValidationState>({
    isChecking: false,
    isAvailable: null,
    message: '',
    isValid: true,
  })

  // Reset slug value when initialSlug changes (from successful save)
  useEffect(() => {
    setSlugValue(initialSlug)
  }, [initialSlug])

  // Debounced slug validation
  const validateSlug = useCallback(
    async (slug: string) => {
      // Reset validation if empty or same as initial
      if (!slug || slug === initialSlug) {
        setValidation({ isChecking: false, isAvailable: null, message: '', isValid: true })
        return
      }

      // Basic client-side validation
      if (slug.length < 3) {
        setValidation({
          isChecking: false,
          isAvailable: false,
          message: 'Slug must be at least 3 characters long',
          isValid: false,
        })
        return
      }

      if (slug.length > 50) {
        setValidation({
          isChecking: false,
          isAvailable: false,
          message: 'Slug must be less than 50 characters long',
          isValid: false,
        })
        return
      }

      // Server-side availability check
      setValidation({
        isChecking: true,
        isAvailable: null,
        message: 'Checking availability...',
        isValid: true,
      })

      try {
        const response = await fetch(
          `/api/validate-slug?slug=${encodeURIComponent(slug)}&currentId=${encodeURIComponent(portfolioId)}`
        )
        const data = (await response.json()) as {
          success: boolean
          data?: { isAvailable: boolean; message: string }
          error?: string
        }

        if (data.success && data.data) {
          setValidation({
            isChecking: false,
            isAvailable: data.data.isAvailable,
            message: data.data.message,
            isValid: data.data.isAvailable,
          })
        } else {
          setValidation({
            isChecking: false,
            isAvailable: false,
            message: data.error || 'Invalid slug format',
            isValid: false,
          })
        }
      } catch (error) {
        setValidation({
          isChecking: false,
          isAvailable: false,
          message: 'Error checking availability',
          isValid: false,
        })
      }
    },
    [portfolioId, initialSlug]
  )

  // Debounce validation calls
  useEffect(() => {
    const timer = setTimeout(() => {
      validateSlug(slugValue)
    }, 500)

    return () => clearTimeout(timer)
  }, [slugValue, validateSlug])

  // Event handlers
  const handleSave = async () => {
    if (!validation.isValid || !validation.isAvailable || slugValue === initialSlug || isSaving) {
      return
    }

    setIsSaving(true)

    try {
      const formData = new FormData()
      formData.append('action', 'update-slug')
      formData.append('slug', slugValue)
      formData.append('portfolioId', portfolioId)

      submit(formData, { method: 'post' })

      // Let the parent component handle the success state
      onSave?.(slugValue)
    } catch (error) {
      console.error('Failed to save slug:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Transform input to valid slug format
    const newValue = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlugValue(newValue)
  }

  // Determine if save button should be enabled
  const canSave =
    validation.isValid && validation.isAvailable && slugValue !== initialSlug && !isSaving

  // Get status icon and styling
  const getValidationStatus = () => {
    if (!slugValue || slugValue === initialSlug) return null

    if (validation.isChecking) {
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
    }

    if (validation.isAvailable) {
      return <Check className="w-4 h-4 text-green-500" />
    }

    if (validation.isAvailable === false) {
      return <X className="w-4 h-4 text-red-500" />
    }

    return null
  }

  // Get message styling
  const getMessageStyling = () => {
    if (!validation.message) return ''

    if (validation.isChecking) return 'text-blue-600'
    if (validation.isAvailable) return 'text-green-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-2">
      <label htmlFor="portfolio-slug" className="text-sm font-medium text-gray-700">
        Portfolio URL
      </label>
      <div className="flex items-center space-x-2">
        <div className="flex items-center flex-1 min-w-0">
          <div className="inline-flex items-center px-4 h-8 text-sm text-gray-900 border border-r-0 bg-gray-200 border-gray-300 rounded-l-md">
            craftd.dev/p/
          </div>
          <div className="flex-1 relative">
            <input
              id="portfolio-slug"
              type="text"
              value={slugValue}
              onChange={handleInputChange}
              className={cn(
                'input rounded-l-none pr-8 font-mono h-8',
                !validation.isValid ? 'input-error' : ''
              )}
              placeholder="your-portfolio-name"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              {getValidationStatus()}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            variant="outline"
            size="xs"
            className="border-green-300 text-green-700 hover:bg-green-50"
          >
            {isSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>

      {/* Validation message */}
      {validation.message && (
        <p className={`text-xs ${getMessageStyling()}`}>{validation.message}</p>
      )}
    </div>
  )
}

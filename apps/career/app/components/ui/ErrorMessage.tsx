interface ErrorMessageProps {
  title?: string
  message: string
  className?: string
}

export function ErrorMessage({ title = 'Error', message, className = '' }: ErrorMessageProps) {
  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex">
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">{title}</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SuccessMessage({ title = 'Success', message, className = '' }: ErrorMessageProps) {
  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
      <div className="flex">
        <div className="ml-3">
          <h3 className="text-sm font-medium text-green-800">{title}</h3>
          <div className="mt-2 text-sm text-green-700">
            <p>{message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ActionResultProps {
  result?: { success: boolean; error?: string; message?: string }
  className?: string
}

export function ActionResult({ result, className = '' }: ActionResultProps) {
  if (!result) return null

  if (result.success) {
    return (
      <SuccessMessage
        message={result.message || 'Operation completed successfully'}
        className={className}
      />
    )
  }

  return <ErrorMessage message={result.error || 'Operation failed'} className={className} />
}

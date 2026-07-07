export type ToastOptions = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  [key: string]: unknown
}

export function toast(options: ToastOptions | string) {
  if (typeof options === 'string') {
    console.info('[toast]', options)
    return
  }

  const message = options.title ?? options.description ?? 'Toast'
  console.info('[toast]', message, options)
}

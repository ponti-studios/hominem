import { toast as showToast, type ToastOptions } from '~/lib/toast';

/**
 * Hook wrapper around the imperative toast API for call sites that expect useToast().
 */
export function useToast() {
  return {
    toast: (message: ToastOptions) => showToast(message),
    toasts: [] as never[],
    dismiss: (_id: string) => {},
  };
}

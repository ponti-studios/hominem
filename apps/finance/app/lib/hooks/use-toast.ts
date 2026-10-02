import { toast as showToast, type ToastOptions } from '~/lib/toast';

// just wraps the imperative toast API for call sites that expect a useToast() hook
export function useToast() {
  const toasts: ToastOptions[] = [];
  return {
    toast: (message: ToastOptions) => showToast(message),
    toasts,
    dismiss: (_id: string) => {},
  };
}

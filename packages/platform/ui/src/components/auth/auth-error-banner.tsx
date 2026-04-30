interface AuthErrorBannerProps {
  error?: string | null | undefined;
}

export function AuthErrorBanner({ error }: AuthErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="rounded-[6px] border border-destructive bg-muted p-3" role="alert">
      <span className="text-destructive text-sm font-semibold uppercase">{error}</span>
    </div>
  );
}

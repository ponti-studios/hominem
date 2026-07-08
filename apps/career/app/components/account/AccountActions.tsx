import { Button } from '@hominem/ui';
import { Download, Edit, Trash2 } from 'lucide-react';

import { cn } from '~/lib/utils';

export function AccountActions({
  canDownloadPdf,
  isGeneratingPdf,
  onDeletePortfolio,
  onDownloadPdf,
  onEditPortfolio,
}: {
  canDownloadPdf: boolean;
  isGeneratingPdf: boolean;
  onDeletePortfolio: () => Promise<void>;
  onDownloadPdf: () => Promise<void>;
  onEditPortfolio: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <ActionButtonRow
          icon={Edit}
          label="Edit portfolio"
          onClick={() => onEditPortfolio()}
          variant="default"
        />
        <ActionButtonRow
          icon={Download}
          label="Download PDF"
          onClick={() => onDownloadPdf()}
          variant="outline"
          disabled={isGeneratingPdf || !canDownloadPdf}
          isLoading={isGeneratingPdf}
          loadingLabel="Generating PDF..."
          helper={
            !canDownloadPdf
              ? 'Make the portfolio public in the editor before generating a downloadable PDF.'
              : undefined
          }
        />
        <ActionButtonRow
          icon={Trash2}
          label="Delete portfolio"
          onClick={() => onDeletePortfolio()}
          variant="outline"
          destructive
        />
      </div>
    </section>
  );
}

function ActionButtonRow({
  icon: Icon,
  label,
  helper,
  onClick,
  variant = 'outline',
  disabled = false,
  destructive = false,
  isLoading = false,
  loadingLabel,
}: {
  icon: typeof Edit;
  label: string;
  helper?: string;
  onClick: () => void | Promise<void>;
  variant?: 'default' | 'outline' | 'ghost';
  disabled?: boolean;
  destructive?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        onClick={() => onClick()}
        variant={variant}
        disabled={disabled}
        className={cn(
          'w-full justify-start rounded-full',
          destructive && 'border-destructive/30 text-destructive',
        )}
        isLoading={isLoading}
        loadingLabel={loadingLabel}
      >
        <Icon className="mr-2 h-4 w-4" />
        {label}
      </Button>
      {helper ? <p className="body-4 px-1 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

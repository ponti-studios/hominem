import { AwardIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import { AddButton, DetailSection } from '~/components/design';
import { FormGrid, TextInput } from '~/components/design/forms';
import { Button } from '~/components/ui/button';
import { FormErrorAlert } from '~/modules/career/components/FormErrorAlert';
import type {
  AccountActionResult,
  CertificationFormValues,
} from '~/modules/career/lib/account/types';
import type { CareerCertificationRecord } from '~/modules/career/lib/types/records';

export function CertificationsSection({
  certifications,
  onAdd,
  onDelete,
}: {
  certifications: CareerCertificationRecord[];
  onAdd: (values: CertificationFormValues) => Promise<AccountActionResult<unknown>>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [issuingOrganization, setIssuingOrganization] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onAdd({ name, issuingOrganization, issueDate: issueDate || null });
      if (result.success === false) {
        setError(result.error || 'Failed to add certification');
        return;
      }
      setName('');
      setIssuingOrganization('');
      setIssueDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add certification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove certification');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DetailSection title="Certifications">
      <p className="-mt-2 mb-4 text-[13px] text-muted-foreground">
        Licenses and certifications that back up your experience.
      </p>

      <FormErrorAlert message={error} />

      {certifications.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {certifications.map((certification) => (
            <li
              key={certification.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3"
            >
              <AwardIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{certification.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {certification.issuingOrganization}
                  {certification.issueDate && ` · ${certification.issueDate}`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busyId === certification.id}
                onClick={() => handleDelete(certification.id)}
                aria-label={`Remove ${certification.name}`}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-4">
        <FormGrid cols={3}>
          <TextInput
            label="Name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="AWS Certified"
            required
          />
          <TextInput
            label="Issuing organization"
            name="issuingOrganization"
            value={issuingOrganization}
            onChange={(e) => setIssuingOrganization(e.target.value)}
            required
          />
          <TextInput
            label="Issue date"
            name="issueDate"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </FormGrid>
        <div>
          <AddButton type="submit" label="Add certification" disabled={isSubmitting} />
        </div>
      </form>
    </DetailSection>
  );
}

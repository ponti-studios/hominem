import { EmptyState } from '@hominem/ui';
import { Button } from '@hominem/ui/button';
import { DatePicker } from '@hominem/ui/date-picker';
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { CareerRecordIndexShell } from '~/components/career/CareerRecordIndexShell';
import { MetricsGrid } from '~/components/career/MetricsGrid';
import { userContext } from '~/lib/middleware';
import { cn } from '~/lib/utils';
import {
  formatCertificationStatus,
  getCertificationStatusClasses,
} from '~/lib/utils/certificationUtils';
import type { Certification, CertificationSummary } from '~/types/career-data';

import { Route } from './+types/certifications';

const formatDateValue = (value: Date | undefined) => {
  if (!value) {
    return '';
  }

  return value.toISOString().split('T')[0] ?? '';
};

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  try {
    const certifications: Certification[] = [];
    const summary: CertificationSummary = {
      totalCertifications: 0,
      activeCertifications: 0,
      expiredCertifications: 0,
      expiringInSixMonths: 0,
      categories: [],
      totalInvestment: 0,
      upcomingRenewals: [],
      certificationsByYear: [],
    };

    return { user, certifications, summary };
  } catch (error) {
    console.error('Error loading certifications:', error);
    throw new Response('Failed to load certifications', { status: 500 });
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const operation = formData.get('operation') as string;

  try {
    if (operation === 'create') {
      return { success: true, message: 'Certification created successfully' };
    }

    if (operation === 'update') {
      return { success: true, message: 'Certification updated successfully' };
    }

    if (operation === 'delete') {
      return { success: true, message: 'Certification deleted successfully' };
    }

    throw new Response('Invalid operation', { status: 400 });
  } catch (error) {
    console.error('Error handling certification operation:', error);
    throw new Response('Failed to process certification request', { status: 500 });
  }
}

export default function CertificationsPage({ loaderData }: Route.ComponentProps) {
  const { certifications, summary } = loaderData;
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <CareerRecordIndexShell
      title="Professional Certifications"
      subtitle="Track your certifications across your entire career"
      primaryAction={
        <Button onClick={() => setShowCreateForm(true)}>
          <PlusIcon className="mr-2 w-4 h-4" />
          Add Certification
        </Button>
      }
      metrics={
        <MetricsGrid
          items={[
            {
              label: 'Total Certifications',
              value: String(summary.totalCertifications),
            },
            {
              label: 'Active',
              value: String(summary.activeCertifications),
              tone: 'success',
            },
            {
              label: 'Expiring Soon',
              value: String(summary.expiringInSixMonths),
              tone: 'warning',
            },
            {
              label: 'Total Investment',
              value: `$${(summary.totalInvestment / 100).toLocaleString()}`,
            },
          ]}
        />
      }
      sectionTitle="Your Certifications"
      emptyState={
        certifications.length === 0 ? (
          <EmptyState
            title="No certifications yet"
            description="Start tracking your professional certifications to showcase your expertise."
            action={
              <Button onClick={() => setShowCreateForm(true)}>
                <PlusIcon className="size-4" />
                Add Your First Certification
              </Button>
            }
          />
        ) : undefined
      }
    >
      {certifications.length > 0 ? (
        <div className="divide-y divide-slate-200/50">
          {certifications.map((certification) => (
            <CertificationCard key={certification.id} certification={certification} />
          ))}
        </div>
      ) : null}

      {showCreateForm ? (
        <CreateCertificationModal onClose={() => setShowCreateForm(false)} />
      ) : null}
    </CareerRecordIndexShell>
  );
}

interface CertificationCardProps {
  certification: Certification;
}

function CertificationCard({ certification }: CertificationCardProps) {
  const [, setIsEditing] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">{certification.name}</h3>
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-medium',
                getCertificationStatusClasses(certification.status),
              )}
            >
              {formatCertificationStatus(certification.status)}
            </span>
          </div>
          <p className="mb-3 text-muted-foreground">{certification.issuingOrganization}</p>
          {certification.description ? (
            <p className="mb-3 text-muted-foreground">{certification.description}</p>
          ) : null}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>Issued: {new Date(certification.issueDate).toLocaleDateString()}</span>
            {certification.expirationDate ? (
              <span>Expires: {new Date(certification.expirationDate).toLocaleDateString()}</span>
            ) : null}
            {certification.cost ? (
              <span>Cost: ${(certification.cost / 100).toLocaleString()}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-muted-foreground hover:text-muted-foreground"
          >
            <PencilIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive/70 hover:text-destructive">
            <TrashIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CreateCertificationModalProps {
  onClose: () => void;
}

function CreateCertificationModal({ onClose }: CreateCertificationModalProps) {
  const [issueDate, setIssueDate] = useState<Date | undefined>();
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md bg-card">
        <div className="border-b border-border p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Add Certification</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <form className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="cert-name"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Certification Name *
              </label>
              <input
                id="cert-name"
                type="text"
                name="name"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
                placeholder="AWS Solutions Architect"
              />
            </div>
            <div>
              <label
                htmlFor="issuing-org"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Issuing Organization *
              </label>
              <input
                id="issuing-org"
                type="text"
                name="issuingOrganization"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
                placeholder="Amazon Web Services"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium text-muted-foreground"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
              placeholder="Brief description of what this certification covers..."
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <DatePicker
                id="issue-date"
                label="Issue Date *"
                value={issueDate}
                onSelect={(nextDate) => {
                  if (nextDate) {
                    setIssueDate(nextDate);
                  }
                }}
                placeholder="Pick issue date"
                containerClassName="min-w-0"
              />
              <input type="hidden" name="issueDate" value={formatDateValue(issueDate)} />
            </div>
            <div>
              <DatePicker
                id="expiration-date"
                label="Expiration Date"
                value={expirationDate}
                onSelect={setExpirationDate}
                placeholder="Pick expiration date"
                containerClassName="min-w-0"
              />
              <input type="hidden" name="expirationDate" value={formatDateValue(expirationDate)} />
            </div>
            <div>
              <label
                htmlFor="cost"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Cost
              </label>
              <input
                id="cost"
                type="number"
                name="cost"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
                placeholder="299.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
              >
                <option value="">Select category...</option>
                <option value="technical">Technical</option>
                <option value="leadership">Leadership</option>
                <option value="project_management">Project Management</option>
                <option value="security">Security</option>
                <option value="cloud">Cloud</option>
                <option value="data">Data</option>
                <option value="compliance">Compliance</option>
                <option value="industry">Industry</option>
                <option value="language">Language</option>
                <option value="design">Design</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="status"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue="active"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="pending_renewal">Pending Renewal</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              <CheckIcon className="mr-2 w-4 h-4" />
              Add Certification
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

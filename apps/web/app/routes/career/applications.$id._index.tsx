import { ExternalLinkIcon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { useOutletContext } from 'react-router';

import { DetailField, DetailSection } from '~/components/design';
import { Button } from '~/components/ui/button';
import { ApplicationEditor } from '~/modules/career/components/career/applications/ApplicationEditor';
import type { CareerApplicationWithRelations } from '~/modules/career/lib/types/records';
import {
  formatApplicationDate,
  formatApplicationSalary,
} from '~/modules/career/lib/utils/applicationUtils';

export default function ApplicationOverviewRoute() {
  const application = useOutletContext<CareerApplicationWithRelations>();
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return <ApplicationEditor application={application} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <DetailSection title="Application information">
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
          {application.source && <DetailField label="Source" value={application.source} />}
          {application.appliedAt && (
            <DetailField
              label="Applied"
              value={formatApplicationDate(application.appliedAt)}
              mono
            />
          )}
          {application.location && <DetailField label="Location" value={application.location} />}
          {application.salaryExpectation != null && (
            <DetailField
              label="Salary Expectation"
              value={formatApplicationSalary(application.salaryExpectation)}
              mono
            />
          )}
          {application.jobPostingUrl && (
            <DetailField
              label="Job Posting"
              value={
                <a
                  href={application.jobPostingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#d7ff3e] hover:underline"
                >
                  View posting
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              }
            />
          )}
        </div>
      </DetailSection>

      {application.notes && (
        <DetailSection title="Notes">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[#9ba3b4]">
            {application.notes}
          </p>
        </DetailSection>
      )}

      {application.offers.map((offer) => {
        const stage = application.stages.find((candidate) => candidate.id === offer.stageId);
        return (
          <DetailSection key={offer.id} title={stage?.stage ?? 'Offer'}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {offer.baseSalary != null && (
                <DetailField label="Base" value={formatApplicationSalary(offer.baseSalary)} mono />
              )}
              {offer.equity && <DetailField label="Equity" value={offer.equity} />}
              {offer.bonus != null && (
                <DetailField label="Bonus" value={formatApplicationSalary(offer.bonus)} mono />
              )}
              {offer.totalComp != null && (
                <DetailField
                  label="Total Comp"
                  value={formatApplicationSalary(offer.totalComp)}
                  mono
                />
              )}
              <DetailField label="Decision" value={offer.decision} />
            </div>
          </DetailSection>
        );
      })}
    </div>
  );
}

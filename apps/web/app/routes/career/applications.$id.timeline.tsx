import { useOutletContext } from 'react-router';

import { PanelState } from '~/components/design';
import { DetailSection } from '~/components/design';
import type { CareerApplicationWithRelations } from '~/modules/career/lib/types/records';
import { formatApplicationDate } from '~/modules/career/lib/utils/applicationUtils';

export default function ApplicationTimelineRoute() {
  const application = useOutletContext<CareerApplicationWithRelations>();

  if (!application.stages?.length) {
    return <PanelState title="No pipeline stages recorded" />;
  }

  const sortedStages = [...application.stages].sort((a, b) => {
    const dateA = a.enteredAt ?? '';
    const dateB = b.enteredAt ?? '';
    return dateB.localeCompare(dateA);
  });

  return (
    <DetailSection title="Pipeline">
      <ol>
        {sortedStages.map((stage, index) => (
          <li key={stage.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="mt-1.5 size-3 rounded-full bg-[#d7ff3e] shadow-[0_0_12px_-2px_#d7ff3e]" />
              {index < sortedStages.length - 1 && <div className="w-px flex-1 bg-white/10" />}
            </div>
            <div className={index < sortedStages.length - 1 ? 'flex-1 pb-6' : 'flex-1'}>
              <p className="text-[15px] font-medium text-[#f2f4f8]">{stage.stage}</p>
              <div className="mt-1 flex flex-col gap-0.5 text-[13px] text-[#9ba3b4]">
                {stage.enteredAt && <p>Entered: {formatApplicationDate(stage.enteredAt)}</p>}
                {stage.exitedAt && <p>Exited: {formatApplicationDate(stage.exitedAt)}</p>}
              </div>
              {stage.notes && <p className="mt-2 text-[13px] text-[#9ba3b4]">{stage.notes}</p>}
            </div>
          </li>
        ))}
      </ol>
    </DetailSection>
  );
}

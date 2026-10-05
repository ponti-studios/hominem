import { TimeResultSheet } from './TimeResultSheet';
import { TimeToast } from './TimeToast';
import type { Planner } from './use-planner';

// The planner's result sheet and toast, rendered over the Stream. `toastBottom`
// is how far above the screen's bottom edge the toast floats (above the
// composer).
export function PlannerSheets({ planner, toastBottom }: { planner: Planner; toastBottom: number }) {
  const { composer, dismissToast, submitDraft, toast } = planner;
  return (
    <>
      {toast ? (
        <TimeToast
          bottom={toastBottom}
          key={toast.id}
          onDismiss={() => {
            if (toast.tone === 'error') {
              composer.cancelResult();
            }
            dismissToast();
          }}
          toast={toast}
        />
      ) : null}
      <TimeResultSheet
        isSaving={composer.isSaving}
        onCancel={composer.cancelResult}
        onChooseEvent={composer.chooseEvent}
        onChooseOpening={composer.chooseOpening}
        onEditField={composer.updateDraft}
        onSubmitDraft={submitDraft}
        state={composer.interaction}
      />
    </>
  );
}

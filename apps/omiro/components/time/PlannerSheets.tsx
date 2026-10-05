import { TimeResultSheet } from './TimeResultSheet';
import { TimeToast } from './TimeToast';
import type { Planner } from './use-planner';

// The planner's result sheet and toast, rendered over the Stream. `toastBottom`
// is how far below the top of the screen the toast floats; it sits at the top
// because the keyboard covers anything at the bottom while the user types.
export function PlannerSheets({ planner, toastTop = 8 }: { planner: Planner; toastTop?: number }) {
  const { composer, dismissToast, submitDraft, toast } = planner;
  return (
    <>
      {toast ? (
        <TimeToast
          top={toastTop}
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

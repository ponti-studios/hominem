import { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { useStyles } from '~/components/theme';
import { BottomSheet } from '~/components/ui';

import type { EditableTimeBlockField, TimeInteractionState, TimeOpening } from './time-types';
import { TimeAvailabilityResult } from './TimeAvailabilityResult';
import { TimeDraftResult } from './TimeDraftResult';
import { TimeEventChoiceResult } from './TimeEventChoiceResult';
import { CancelRow } from './TimeResultActions';

type ResultState = Extract<
  TimeInteractionState,
  { kind: 'answer' | 'event-choice' | 'availability' | 'draft' }
>;

export function isResultState(state: TimeInteractionState): state is ResultState {
  return (
    state.kind === 'answer' ||
    state.kind === 'availability' ||
    state.kind === 'draft' ||
    state.kind === 'event-choice'
  );
}

interface TimeResultSheetProps {
  isSaving?: boolean;
  onCancel: () => void;
  onChooseEvent: (id: string) => void;
  onChooseOpening: (opening: TimeOpening) => void | Promise<void>;
  onEditField: (field: EditableTimeBlockField, value: string) => void;
  onSubmitDraft: () => void | Promise<void>;
  state: TimeInteractionState;
}

// Every successful result of a request lands in this one sheet (failures are
// a toast with a retry, see TimeToast). The last result stays
// rendered while the sheet animates out, so closing never flashes empty.
export function TimeResultSheet({ state, ...actions }: TimeResultSheetProps) {
  const [lastResult, setLastResult] = useState<ResultState | null>(null);
  const styles = useStyles((theme) => ({
    content: { gap: 14, paddingBottom: 8 },
    scroll: { flexGrow: 0, flexShrink: 1 },
    message: { ...theme.textVariants.body, color: theme.colors.foreground },
  }));
  // Hold the last result so the sheet keeps its content while animating out.
  if (isResultState(state) && state !== lastResult) {
    setLastResult(state);
  }
  const result = isResultState(state) ? state : lastResult;

  return (
    <BottomSheet onClose={actions.onCancel} testID="time-result" visible={isResultState(state)}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {result ? (
          <ResultContent messageStyle={styles.message} state={result} {...actions} />
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

function ResultContent({
  messageStyle,
  state,
  ...actions
}: Omit<TimeResultSheetProps, 'state'> & { messageStyle: object; state: ResultState }) {
  switch (state.kind) {
    case 'answer':
      return (
        <>
          <Text style={messageStyle}>{state.answer}</Text>
          <CancelRow onCancel={actions.onCancel} testID="time-answer-cancel" />
        </>
      );
    case 'event-choice':
      return (
        <TimeEventChoiceResult
          candidates={state.candidates}
          onCancel={actions.onCancel}
          onChooseEvent={actions.onChooseEvent}
        />
      );
    case 'availability':
      return (
        <TimeAvailabilityResult
          onCancel={actions.onCancel}
          onChooseOpening={actions.onChooseOpening}
          openings={state.openings}
        />
      );
    case 'draft':
      return (
        <TimeDraftResult
          block={state.block}
          isSaving={actions.isSaving}
          onCancel={actions.onCancel}
          onEditField={actions.onEditField}
          onSubmitDraft={actions.onSubmitDraft}
        />
      );
  }
}

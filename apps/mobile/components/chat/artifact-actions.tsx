import type { ArtifactType, ThoughtLifecycleState } from '@hominem/rpc/types';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '~/components/theme/tokens';
import { ENABLED_ARTIFACT_TYPES } from '@hominem/chat/types';
import { Button } from '../ui/Button';

interface ArtifactActionsProps {
  state: ThoughtLifecycleState;
  messageCount: number;
  onTransform: (type: ArtifactType) => void;
}

const ACTIONS: { type: ArtifactType; label: string }[] = [
  { type: 'note', label: '→ NOTE' },
  { type: 'task', label: '→ TASK' },
  { type: 'task_list', label: '→ LIST' },
  { type: 'tracker', label: '→ TRACKER' },
];

const ENABLED: ArtifactType[] = ENABLED_ARTIFACT_TYPES.filter(
  (type): type is Exclude<ArtifactType, 'tracker'> => type !== 'tracker',
);
const BLOCKING: ThoughtLifecycleState[] = ['classifying', 'reviewing_changes', 'persisting'];

export function ArtifactActions({ state, messageCount, onTransform }: ArtifactActionsProps) {
  if (messageCount === 0) return null;

  const isComposing = state === 'composing';
  const isBlocked = BLOCKING.includes(state);

  return (
    <View style={[styles.row, isComposing ? styles.dimmed : null]}>
      {ACTIONS.filter(({ type }) => ENABLED.includes(type)).map(({ type, label }) => (
        <Button
          disabled={isBlocked}
          key={type}
          onPress={() => onTransform(type)}
          size="xs"
          style={[styles.button, isBlocked ? styles.buttonDisabled : null]}
          title={label}
          variant="outline"
        >
          {label}
        </Button>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors['bg-base'],
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  dimmed: {
    opacity: 0.5,
  },
  row: {
    backgroundColor: colors.background,
    borderTopColor: colors['border-default'],
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
});

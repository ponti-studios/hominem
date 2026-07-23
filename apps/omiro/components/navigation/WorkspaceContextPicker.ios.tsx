import { Host } from '@expo/ui';
import { Picker, Text } from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  environment,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useColorScheme } from 'react-native';

export type WorkspaceContext = 'chats' | 'notes' | 'tasks';

interface WorkspaceContextPickerProps {
  value: WorkspaceContext;
  onChange: (value: WorkspaceContext) => void;
}

export function WorkspaceContextPicker({ value, onChange }: WorkspaceContextPickerProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <Host style={{ height: 44, width: 232 }}>
      <Picker
        modifiers={[
          environment({ key: 'colorScheme', value: colorScheme }),
          pickerStyle('segmented'),
        ]}
        selection={value}
        onSelectionChange={(nextValue) => onChange(nextValue as WorkspaceContext)}
      >
        <Text modifiers={[tag('chats'), accessibilityIdentifier('workspace-context-chats')]}>
          Chats
        </Text>
        <Text modifiers={[tag('notes'), accessibilityIdentifier('workspace-context-notes')]}>
          Notes
        </Text>
        <Text modifiers={[tag('tasks'), accessibilityIdentifier('workspace-context-tasks')]}>
          Tasks
        </Text>
      </Picker>
    </Host>
  );
}

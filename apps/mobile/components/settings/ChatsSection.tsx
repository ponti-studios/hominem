import React from 'react';

import { styles } from '../theme/styles';
import { SectionCard } from './SectionCard';
import { SectionLabel } from './SectionLabel';
import { SettingsRow } from './SettingsRow';

interface ChatsSectionProps {
  onPress: () => void;
}

export function ChatsSection({ onPress }: ChatsSectionProps) {
  return (
    <>
      <SectionLabel>Chats</SectionLabel>
      <SectionCard>
        <SettingsRow sf="archivebox" label="Archived chats" onPress={onPress} />
      </SectionCard>
    </>
  );
}

import React from 'react';

import { Text } from '~/components/theme';

import { styles } from '../styles';
import { NameEditor } from './NameEditor';
import { RowSeparator } from './RowSeparator';
import { SectionCard } from './SectionCard';
import { SectionLabel } from './SectionLabel';
import { SettingsRow } from './SettingsRow';

interface AccountSectionProps {
  userEmail: string;
  initialName: string;
  onSaveName: (name: string) => Promise<void>;
}

export function AccountSection({ userEmail, initialName, onSaveName }: AccountSectionProps) {
  return (
    <>
      <SectionLabel>Account</SectionLabel>
      <SectionCard>
        <NameEditor initialName={initialName} onSave={onSaveName} />
        <RowSeparator />
        <SettingsRow
          sf="envelope"
          label="Email"
          trailing={
            <Text style={styles.trailingValue} numberOfLines={1}>
              {userEmail ?? '—'}
            </Text>
          }
        />
      </SectionCard>
    </>
  );
}

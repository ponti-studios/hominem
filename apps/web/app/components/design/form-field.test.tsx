import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SelectField } from './form-field';
import { TextAreaInput, TextInput } from './forms';

describe('form field styling', () => {
  it('uses the same attached label style for selects and text inputs', () => {
    render(
      <>
        <TextInput label="Merchant" name="merchant" />
        <TextAreaInput label="Notes" name="notes" defaultValue="" />
        <SelectField
          label="Account"
          name="account"
          options={[{ value: 'checking', label: 'Checking' }]}
        />
      </>,
    );

    const textLabel = screen.getByText('Merchant');
    const selectLabel = screen.getByText('Account');
    expect(selectLabel.className).toBe(textLabel.className);
    expect(selectLabel.parentElement).toHaveClass('flex', 'flex-col');
    expect(screen.getByRole('combobox', { name: 'Account' })).toHaveClass('rounded-tl-none');
    expect(screen.getByLabelText('Merchant')).toHaveClass('focus-visible:ring-inset');
    expect(screen.getByRole('combobox', { name: 'Account' })).toHaveClass(
      'focus-visible:ring-inset',
    );
    expect(screen.getByLabelText('Merchant')).toHaveClass('focus-visible:ring-1');
    expect(screen.getByRole('combobox', { name: 'Account' })).toHaveClass('focus-visible:ring-1');
    expect(screen.getByLabelText('Merchant')).toHaveClass('focus-visible:ring-sky-400');
    expect(screen.getByLabelText('Merchant')).toHaveClass('field-value');
    expect(screen.getByLabelText('Notes')).toHaveClass('field-value');
    expect(screen.getByRole('combobox', { name: 'Account' })).toHaveClass(
      'focus-visible:ring-sky-400',
    );
    expect(screen.getByRole('combobox', { name: 'Account' })).toHaveClass('field-value');
    expect(screen.getByText('Notes').className).toBe(textLabel.className);
    expect(screen.getByLabelText('Notes')).toHaveClass('focus-visible:ring-inset');
  });
});

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Currency } from './currency';

describe('Currency', () => {
  it('keeps currency affixes separate from right-aligned tabular values', () => {
    render(
      <>
        <Currency amount={-225.7} currencyCode="USD" />
        <Currency amount={-225.7} currencyCode="GBP" />
        <Currency amount={-225.7} currencyCode="EUR" />
      </>,
    );

    const values = screen.getAllByText('225.70');
    expect(values).toHaveLength(3);
    for (const value of values) {
      expect(value).toHaveClass('text-right');
      expect(value.parentElement).toHaveClass('tabular-nums');
    }
  });
});

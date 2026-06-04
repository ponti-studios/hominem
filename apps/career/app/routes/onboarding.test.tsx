import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

vi.mock('../components/UploadResumeForm', () => ({
  UploadResumeForm: ({
    onUploadComplete,
  }: {
    onUploadComplete: (response: {
      portfolioSlug: string;
    }) => void;
  }) => (
    <button type="button" onClick={() => onUploadComplete(makeUploadResumeResponse())}>
      Mock Upload Form
    </button>
  ),
}));

function makeUploadResumeResponse() {
  return {
    portfolioSlug: 'charles-ponti',
  };
}

import Onboarding from './onboarding';

describe('Onboarding', () => {
  it('shows the success state inline after upload completes', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Onboarding />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /mock upload form/i }));

    expect(screen.getByText('Portfolio created')).toBeInTheDocument();
    expect(screen.getByText('/p/charles-ponti')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload another resume/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /upload another resume/i }));

    expect(screen.getByRole('button', { name: /mock upload form/i })).toBeInTheDocument();
  });
});

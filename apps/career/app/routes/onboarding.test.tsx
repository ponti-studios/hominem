import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../components/UploadResumeForm', () => ({
  UploadResumeForm: ({
    onUploadComplete,
  }: {
    onUploadComplete: (response: { portfolioSlug: string }) => void;
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
  it('navigates to the created portfolio after upload completes', async () => {
    const user = userEvent.setup();
    navigate.mockReset();

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Onboarding />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /mock upload form/i }));

    expect(navigate).toHaveBeenCalledWith('/p/charles-ponti');
  });
});

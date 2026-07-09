import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const fetcherSubmit = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
    useFetcher: () => ({
      state: 'idle',
      data: null,
      submit: fetcherSubmit,
    }),
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

function renderOnboarding() {
  const router = createMemoryRouter(
    [
      {
        path: '/onboarding',
        element: <Onboarding />,
      },
    ],
    { initialEntries: ['/onboarding'] },
  );

  return render(<RouterProvider router={router} />);
}

describe('Onboarding', () => {
  it('navigates to work after upload completes', async () => {
    const user = userEvent.setup();
    navigate.mockReset();

    renderOnboarding();

    await user.click(screen.getByRole('button', { name: /mock upload form/i }));

    expect(navigate).toHaveBeenCalledWith('/work');
  });

  it('submits start-without-resume action', async () => {
    const user = userEvent.setup();
    fetcherSubmit.mockReset();

    renderOnboarding();

    await user.click(screen.getByRole('button', { name: /start without a resume/i }));

    expect(fetcherSubmit).toHaveBeenCalledWith({}, { method: 'POST' });
  });
});

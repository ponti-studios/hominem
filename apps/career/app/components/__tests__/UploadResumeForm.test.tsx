import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeUploadResumeResponse } from '~/test/factories/resume';

import { UploadResumeForm } from '../UploadResumeForm';

const uploadResponse = makeUploadResumeResponse();

function renderForm() {
  const onUploadStart = vi.fn();
  const onUploadComplete = vi.fn();
  const onUploadError = vi.fn();

  render(
    <UploadResumeForm
      onUploadStart={onUploadStart}
      onUploadComplete={onUploadComplete}
      onUploadError={onUploadError}
    />,
  );

  return { onUploadStart, onUploadComplete, onUploadError };
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('file input not found');
  return input;
}

async function selectFile(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(fileInput(), file);
}

function expectUploadRequestField(
  fetchMock: ReturnType<typeof vi.fn>,
  callIndex: number,
  field: string,
  value: string,
) {
  const body = fetchMock.mock.calls[callIndex]?.[1]?.body;
  expect(body).toBeInstanceOf(FormData);
  expect((body as FormData).get(field)).toBe(value);
}

describe('UploadResumeForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows an error when uploading without a file', async () => {
    const { onUploadError } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: /upload resume/i }));

    expect(await screen.findByText('Please select a PDF file')).toBeInTheDocument();
    expect(onUploadError).toHaveBeenCalledWith('Please select a PDF file');
  });

  it('rejects a non-PDF file', async () => {
    const user = userEvent.setup();
    const { onUploadError } = renderForm();
    await selectFile(user, new File(['hello'], 'resume.txt', { type: 'text/plain' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));

    expect(await screen.findByText('Please select a PDF file')).toBeInTheDocument();
    expect(onUploadError).toHaveBeenCalledWith('Please select a PDF file');
  });

  it('accepts a PDF filename when the MIME type is missing', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => Response.json(uploadResponse));
    vi.stubGlobal('fetch', fetchMock);
    const { onUploadComplete } = renderForm();
    await selectFile(user, new File(['pdf'], 'resume.pdf', { type: '' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith(uploadResponse));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a PDF larger than 10MB', async () => {
    const user = userEvent.setup();
    const { onUploadError } = renderForm();
    await selectFile(user, new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'resume.pdf', {
      type: 'application/pdf',
    }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));

    expect(await screen.findByText('File size must be less than 10MB')).toBeInTheDocument();
    expect(onUploadError).toHaveBeenCalledWith('File size must be less than 10MB');
  });

  it('shows a sign-in action for auth failures', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: 'Please log in to upload your resume.', stage: 'auth', retryable: false },
          { status: 401 },
        ),
      ),
    );
    renderForm();
    await selectFile(user, new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));

    expect(await screen.findByText('Please log in to upload your resume.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login?next=/onboarding',
    );
  });

  it('keeps the form mounted and allows retry after a storage error', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: 'Could not store the resume file. Start local MinIO and make sure the storage bucket is available, then try again.',
            stage: 'storage',
            retryable: true,
          },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(Response.json(uploadResponse));
    vi.stubGlobal('fetch', fetchMock);
    const { onUploadComplete } = renderForm();
    await selectFile(user, new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));

    expect(await screen.findByText(/start local minio/i)).toBeInTheDocument();
    expect(screen.getByText('resume.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith(uploadResponse));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks for confirmation before replacing an existing portfolio', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          error: 'Uploading this resume will replace your existing portfolio.',
          stage: 'replace-confirmation',
          retryable: false,
          existingPortfolio: { slug: 'existing', title: 'Existing Portfolio' },
        },
        { status: 409 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { onUploadError } = renderForm();
    await selectFile(user, new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));

    expect(await screen.findByText('Replace existing portfolio?')).toBeInTheDocument();
    expect(
      screen.getByText(/current portfolio: existing portfolio at \/p\/existing/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /replace portfolio/i })).toBeEnabled();
    expect(onUploadError).not.toHaveBeenCalled();
  });

  it('resubmits with replaceExisting when replacement is confirmed', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: 'Uploading this resume will replace your existing portfolio.',
            stage: 'replace-confirmation',
            retryable: false,
            existingPortfolio: { slug: 'existing', title: 'Existing Portfolio' },
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(Response.json(uploadResponse));
    vi.stubGlobal('fetch', fetchMock);
    const { onUploadComplete } = renderForm();
    await selectFile(user, new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));
    await user.click(await screen.findByRole('button', { name: /replace portfolio/i }));

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith(uploadResponse));
    expectUploadRequestField(fetchMock, 1, 'replaceExisting', 'true');
  });

  it('clears replacement confirmation when choosing a different PDF', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: 'Uploading this resume will replace your existing portfolio.',
            stage: 'replace-confirmation',
            retryable: false,
            existingPortfolio: { slug: 'existing', title: 'Existing Portfolio' },
          },
          { status: 409 },
        ),
      ),
    );
    renderForm();
    await selectFile(user, new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));
    expect(await screen.findByText('Replace existing portfolio?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /use a different pdf/i }));

    expect(screen.queryByText('Replace existing portfolio?')).not.toBeInTheDocument();
    expect(screen.queryByText('resume.pdf')).not.toBeInTheDocument();
  });

  it('clears file and error state when choosing a different PDF', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: 'Storage failed', stage: 'storage', retryable: true },
          { status: 503 },
        ),
      ),
    );
    renderForm();
    await selectFile(user, new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));
    expect(await screen.findByText('Storage failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /use a different pdf/i }));

    expect(screen.queryByText('Storage failed')).not.toBeInTheDocument();
    expect(screen.queryByText('resume.pdf')).not.toBeInTheDocument();
  });

  it('shows a readable fallback for non-JSON errors', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 500 })));
    renderForm();
    await selectFile(user, new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));

    expect(
      await screen.findByText('Server returned an unreadable error response. Try again.'),
    ).toBeInTheDocument();
  });

  it('selects the first dropped file and shows a notice for multiple files', () => {
    renderForm();
    const dropzone = screen.getByText(/drop your resume here/i).closest('div');
    if (!dropzone) throw new Error('dropzone not found');

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [
          new File(['one'], 'first.pdf', { type: 'application/pdf' }),
          new File(['two'], 'second.pdf', { type: 'application/pdf' }),
        ],
      },
    });

    expect(screen.getByText('first.pdf')).toBeInTheDocument();
    expect(screen.queryByText('second.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('Only the first PDF was selected.')).toBeInTheDocument();
  });

  it('cancels an in-flight upload and preserves the selected file', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );
    renderForm();
    await selectFile(user, new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));

    await user.click(screen.getByRole('button', { name: /upload resume/i }));
    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(await screen.findByText('Upload canceled.')).toBeInTheDocument();
    expect(screen.getByText('resume.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload resume/i })).toBeEnabled();
  });
});

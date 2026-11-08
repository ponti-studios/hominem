import { DropZone, type DropZoneProps } from '@ponti-studios/ui/forms';
import { useRef, useState } from 'react';
import { Form } from 'react-router';

import { DeleteButton } from '~/components/design';
import { List } from '~/components/design/lists';
import { SectionCard } from '~/components/design/surfaces';
import { createCareerServerClient, uploadCareerDocument } from '~/modules/career/lib/server-client';

import { Route } from './+types/applications.$id.files';

type DropZoneStatus = DropZoneProps['status'];

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function loader({ request, params }: Route.LoaderArgs) {
  const response = await createCareerServerClient(request).applications[':id'].files.$get({
    param: { id: params.id },
  });
  if (response.status === 404) throw new Response('Application not found', { status: 404 });
  if (!response.ok) throw new Response('Failed to load files', { status: 500 });
  return response.json();
}

export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const career = createCareerServerClient(request);

  if (intent === 'delete') {
    const id = formData.get('id');
    if (typeof id === 'string') {
      await career.applications[':id'].files.delete.$post({
        param: { id: params.id },
        json: { id },
      });
    }
    return { ok: true };
  }

  if (intent === 'upload') {
    const file = formData.get('file');
    if (!(file instanceof File)) return { ok: false, error: 'No file provided' };
    if (file.size > MAX_FILE_SIZE) return { ok: false, error: 'File must be 25 MB or smaller' };

    const upload = await uploadCareerDocument(request, file);
    if (!upload.ok) return { ok: false, error: 'Upload failed' };
    const { document } = await upload.json();

    const attach = await career.applications[':id'].files.create.$post({
      param: { id: params.id },
      json: { fileName: document.name, fileUrl: document.url, fileType: file.type || null },
    });
    if (!attach.ok) return { ok: false, error: 'Upload failed' };

    return { ok: true, stored: document };
  }

  return { ok: false, error: 'Unknown intent' };
}

export default function ApplicationFilesRoute({ loaderData }: Route.ComponentProps) {
  const { files } = loaderData;
  const [status, setStatus] = useState<DropZoneStatus>('empty');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = () => {
    formRef.current?.requestSubmit();
  };

  if (files.length === 0 && status === 'empty') {
    return (
      <UploadForm
        formRef={formRef}
        status={status}
        selectedFile={selectedFile}
        error={error}
        onSelect={(file) => {
          setSelectedFile(file);
          setStatus('armed');
        }}
        onFiles={(file) => {
          setSelectedFile(file);
          setError(null);
          setStatus('armed');
        }}
        onSubmit={handleSubmit}
        onClear={() => {
          setStatus('empty');
          setSelectedFile(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <UploadForm
        formRef={formRef}
        status={status}
        selectedFile={selectedFile}
        error={error}
        onSelect={(file) => {
          setSelectedFile(file);
          setStatus('armed');
        }}
        onFiles={(file) => {
          setSelectedFile(file);
          setError(null);
          setStatus('armed');
        }}
        onSubmit={handleSubmit}
        onClear={() => {
          setStatus('empty');
          setSelectedFile(null);
          setError(null);
        }}
      />

      <SectionCard>
        <List ariaLabel="Attached files">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm text-[#d7ff3e] hover:underline"
              >
                <span className="truncate">{file.fileName}</span>
              </a>
              <DeleteButton
                itemName={file.fileName}
                label="Remove"
                variant="ghost"
                hiddenFields={{ id: file.id }}
              />
            </li>
          ))}
        </List>
      </SectionCard>
    </div>
  );
}

const ACCEPT =
  '.pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

function UploadForm({
  formRef,
  status,
  selectedFile,
  error,
  onSelect,
  onFiles,
  onSubmit,
  onClear,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  status: DropZoneStatus;
  selectedFile: File | null;
  error: string | null;
  onSelect: (file: File) => void;
  onFiles: (file: File) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return (
    <Form method="post" ref={formRef} navigate={false} encType="multipart/form-data">
      <input type="hidden" name="intent" value="upload" />
      <input
        type="file"
        name="file"
        style={{ display: 'none' }}
        id="hidden-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
        }}
      />
      <DropZone
        status={status}
        file={selectedFile ? { name: selectedFile.name, size: selectedFile.size } : null}
        accept={ACCEPT}
        emptyHint="PDF, Word, or text files — up to 25 MB"
        notice={error || undefined}
        onFiles={(files) => {
          const fileInput = document.getElementById('hidden-file-input');
          if (fileInput instanceof HTMLInputElement && files[0]) {
            const dt = new DataTransfer();
            dt.items.add(files[0]);
            fileInput.files = dt.files;
            onFiles(files[0]);
          }
        }}
        onSubmit={onSubmit}
        onClear={onClear}
      />
    </Form>
  );
}

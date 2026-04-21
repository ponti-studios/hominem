import { SurfacePanel } from '@hakumi/ui';
import { SpeechInput } from '@hakumi/ui/ai-elements';
import { Button } from '@hakumi/ui/button';
import { memo, useRef } from 'react';
import { Link } from 'react-router';

import { useTranscribe } from '~/hooks/use-transcribe';
import { useFileUpload } from '~/lib/hooks/use-file-upload';
import type { UploadedFile } from '~/lib/types/upload';

interface NoteActionsPanelProps {
  noteId: string;
  onFilesUploaded: (files: UploadedFile[]) => Promise<void> | void;
  onTranscribed: (text: string) => Promise<void> | void;
}

export const NoteActionsPanel = memo(function NoteActionsPanel({
  noteId,
  onFilesUploaded,
  onTranscribed,
}: NoteActionsPanelProps) {
  const transcribe = useTranscribe();
  const { uploadFiles, uploadState } = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleAttachFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const uploadedFiles = await uploadFiles(fileList);
    if (uploadedFiles.length === 0) return;

    await onFilesUploaded(uploadedFiles);
  }

  return (
    <SurfacePanel data-upload-state={uploadState.state} data-upload-progress={uploadState.progress}>
      <h2 className="text-sm font-semibold text-foreground">Actions</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          Attach files
        </Button>
        <Link
          to={`/chat?noteId=${noteId}`}
          className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Chat with this note
        </Link>
      </div>
      <div className="mt-3">
        <SpeechInput
          ariaLabel="Dictate note"
          onAudioRecorded={async (audioBlob: Blob) => {
            const result = await transcribe.mutateAsync({ audioBlob });
            await onTranscribed(result.text);
          }}
        />
      </div>
      <input
        ref={fileInputRef}
        hidden
        multiple
        type="file"
        data-testid="note-file-input"
        onChange={(event) => {
          void handleAttachFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      {uploadState.errors.length > 0 ? (
        <p className="mt-3 text-sm text-destructive">{uploadState.errors.join(', ')}</p>
      ) : null}
    </SurfacePanel>
  );
});

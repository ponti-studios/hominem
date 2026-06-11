import type { Note } from '@hominem/rpc/types/notes.types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  InlineEnhanceTray,
  SurfacePanel,
  useInlineEnhance,
} from '@hominem/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hominem/ui/dropdown';
import { slugifyText } from '@hominem/utils/text';
import { MessageCircle, MoreHorizontal, Paperclip, Sparkles, X } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { UploadedFile } from '~/lib/types/upload';

import { useNoteEditor } from './use-note-editor';
import type { NoteFile } from './use-note-editor';

interface NoteEditorProps {
  chatHref?: string;
  note: Note;
  onSave: (params: {
    id: string;
    title: string | null;
    content: string;
    fileIds: string[];
  }) => Promise<void>;
  onUploadFiles: (files: FileList) => Promise<UploadedFile[]>;
  onEnhanceText: (input: { text: string; instruction?: string }) => Promise<string>;
  onDelete: () => Promise<void>;
  isDeleting?: boolean;
  isDeletingError?: boolean;
  uploadErrors?: string[];
  isUploading?: boolean;
}

export function NoteEditor({
  chatHref,
  note,
  onSave,
  onUploadFiles,
  onEnhanceText,
  onDelete,
  isDeleting = false,
  isDeletingError = false,
  uploadErrors = [],
  isUploading = false,
}: NoteEditorProps) {
  const {
    title,
    setTitle,
    content,
    setContent,
    files,
    setFiles,
    draftRef,
    saveStatus,
    flushSave,
    scheduleIdleSave,
  } = useNoteEditor(note, onSave);
  const {
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
  } = useInlineEnhance({ onEnhanceText });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const mentionSlug = slugifyText(title || note.title || 'untitled-note') ?? 'untitled-note';
  const hasContent = content.trim().length > 0;

  const handleAttachFiles = useCallback(
    async (fileList: FileList) => {
      const uploaded = await onUploadFiles(fileList);
      if (uploaded.length === 0) return;
      const nextFiles = [...draftRef.current.files, ...uploaded.map(toNoteFile)];
      setFiles(nextFiles);
      await flushSave();
    },
    [draftRef, flushSave, onUploadFiles, setFiles],
  );

  const handleDetachFile = useCallback(
    async (fileId: string) => {
      const nextFiles = draftRef.current.files.filter((file) => file.id !== fileId);
      setFiles(nextFiles);
      await flushSave();
    },
    [draftRef, flushSave, setFiles],
  );

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      setTitle(nextTitle);
      scheduleIdleSave();
    },
    [scheduleIdleSave, setTitle],
  );

  const handleContentChange = useCallback(
    (nextContent: string) => {
      setContent(nextContent);
      scheduleIdleSave();
    },
    [scheduleIdleSave, setContent],
  );

  const handleFlushSave = useCallback(() => void flushSave().catch(() => undefined), [flushSave]);

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  const openDeleteDialog = useCallback(() => setIsDeleteDialogOpen(true), []);

  return (
    <div>
      <SurfacePanel>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <NoteTitleField
              title={title}
              mentionSlug={mentionSlug}
              saveStatus={saveStatus}
              onTitleChange={handleTitleChange}
              onBlur={handleFlushSave}
            />
            <NoteActions
              chatHref={chatHref}
              hasContent={hasContent}
              isDeleting={isDeleting}
              isEnhancing={isEnhancing}
              isUploading={isUploading}
              onAttachFiles={openFilePicker}
              onDelete={openDeleteDialog}
              onToggleEnhance={toggleEnhance}
            />
          </div>

          <input
            ref={fileInputRef}
            hidden
            multiple
            type="file"
            data-testid="note-file-input"
            onChange={(event) => {
              if (event.target.files && event.target.files.length > 0) {
                void handleAttachFiles(event.target.files);
              }
              event.currentTarget.value = '';
            }}
          />

          {uploadErrors.length > 0 ? (
            <p className="text-sm text-destructive">{uploadErrors.join(', ')}</p>
          ) : null}

          <NoteContentField
            content={content}
            onChange={handleContentChange}
            onBlur={handleFlushSave}
          />

          <NoteFiles files={files} onDetachFile={handleDetachFile} />

          {isEnhanceOpen ? (
            <InlineEnhanceTray
              instruction={enhanceInstruction}
              onInstructionChange={setEnhanceInstruction}
              onCancel={closeEnhance}
              onConfirm={() =>
                void runEnhance({
                  text: draftRef.current.content,
                  onEnhanced: (enhanced) => {
                    setContent(enhanced);
                    scheduleIdleSave();
                  },
                })
              }
              isEnhancing={isEnhancing}
              error={enhanceError}
            />
          ) : null}
        </div>
      </SurfacePanel>

      <DeleteNoteDialog
        isDeleting={isDeleting}
        isDeletingError={isDeletingError}
        isOpen={isDeleteDialogOpen}
        onDelete={onDelete}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </div>
  );
}

interface NoteTitleFieldProps {
  mentionSlug: string;
  onBlur: () => void;
  onTitleChange: (title: string) => void;
  saveStatus: string;
  title: string;
}

const NoteTitleField = memo(function NoteTitleField({
  mentionSlug,
  onBlur,
  onTitleChange,
  saveStatus,
  title,
}: NoteTitleFieldProps) {
  return (
    <div className="min-w-0 flex-1">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Untitled note"
        aria-label="Note title"
        className="w-full border-0 bg-transparent text-3xl font-semibold outline-none placeholder:text-text-tertiary"
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
        <span>
          <code>#{mentionSlug}</code>
        </span>
        <span>{saveStatus}</span>
      </div>
    </div>
  );
});

interface NoteActionsProps {
  chatHref?: string | null;
  hasContent: boolean;
  isDeleting: boolean;
  isEnhancing: boolean;
  isUploading: boolean;
  onAttachFiles: () => void;
  onDelete: () => void;
  onToggleEnhance: () => void;
}

const NoteActions = memo(function NoteActions({
  chatHref,
  hasContent,
  isDeleting,
  isEnhancing,
  isUploading,
  onAttachFiles,
  onDelete,
  onToggleEnhance,
}: NoteActionsProps) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleEnhance}
        disabled={!hasContent || isEnhancing}
        title="Enhance text"
        aria-label="Enhance text"
      >
        <Sparkles className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isUploading}
        onClick={onAttachFiles}
        title={isUploading ? 'Uploading files' : 'Attach files'}
        aria-label={isUploading ? 'Uploading files' : 'Attach files'}
      >
        <Paperclip className="size-4" />
      </Button>
      {chatHref ? (
        <Button asChild variant="ghost" size="icon" title="Chat with this note">
          <Link to={chatHref} aria-label="Chat with this note">
            <MessageCircle className="size-4" />
          </Link>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="More actions" aria-label="More actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem variant="destructive" disabled={isDeleting} onSelect={onDelete}>
            {isDeleting ? 'Deleting...' : 'Delete note'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

interface NoteContentFieldProps {
  content: string;
  onBlur: () => void;
  onChange: (content: string) => void;
}

const NoteContentField = memo(function NoteContentField({
  content,
  onBlur,
  onChange,
}: NoteContentFieldProps) {
  return (
    <textarea
      value={content}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder="Start writing..."
      aria-label="Note content"
      className="min-h-[50vh] w-full resize-none border-0 bg-transparent text-base leading-7 outline-none placeholder:text-text-tertiary"
    />
  );
});

interface NoteFilesProps {
  files: NoteFile[];
  onDetachFile: (fileId: string) => Promise<void>;
}

const NoteFiles = memo(function NoteFiles({ files, onDetachFile }: NoteFilesProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex min-w-0 max-w-full items-center gap-2 rounded-md border border-border-subtle px-2.5 py-1.5 text-sm text-text-secondary"
        >
          <a
            className="min-w-0 truncate font-medium text-foreground underline-offset-4 hover:underline"
            href={file.url}
            target="_blank"
            rel="noreferrer"
            title={file.originalName}
          >
            {file.originalName}
          </a>
          <span className="shrink-0 text-xs text-text-tertiary">{file.mimetype}</span>
          <button
            type="button"
            className="shrink-0 rounded-sm text-text-tertiary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => void onDetachFile(file.id)}
            title={`Detach ${file.originalName}`}
            aria-label={`Detach ${file.originalName}`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
});

interface DeleteNoteDialogProps {
  isDeleting: boolean;
  isDeletingError: boolean;
  isOpen: boolean;
  onDelete: () => Promise<void>;
  onOpenChange: (isOpen: boolean) => void;
}

const DeleteNoteDialog = memo(function DeleteNoteDialog({
  isDeleting,
  isDeletingError,
  isOpen,
  onDelete,
  onOpenChange,
}: DeleteNoteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this note?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the note from your feed and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onDelete()} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Confirm delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
        {isDeletingError ? (
          <p className="text-sm text-destructive">Failed to delete note. Please try again.</p>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
});

function toNoteFile(file: UploadedFile): NoteFile {
  return {
    id: file.id,
    originalName: file.originalName,
    mimetype: file.mimetype,
    size: file.size,
    url: file.url,
    uploadedAt: file.uploadedAt.toISOString(),
  };
}

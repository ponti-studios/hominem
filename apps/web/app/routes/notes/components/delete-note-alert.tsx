import { SurfacePanel } from '@hakumi/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@hakumi/ui/alert-dialog';
import { Button } from '@hakumi/ui/button';
import { memo } from 'react';
import { useNavigate } from 'react-router';

import { useDeleteNote } from '~/hooks/use-notes';

interface DeleteNoteAlertProps {
  noteId: string;
}

export const DeleteNoteAlert = memo(function DeleteNoteAlert({ noteId }: DeleteNoteAlertProps) {
  const navigate = useNavigate();
  const deleteNote = useDeleteNote();

  async function handleDelete() {
    try {
      await deleteNote.mutateAsync({ id: noteId });
      navigate('/notes');
    } catch {}
  }

  return (
    <SurfacePanel>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" className="mt-3" disabled={deleteNote.isPending}>
            {deleteNote.isPending ? 'Deleting…' : 'Delete note'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the note from your feed and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteNote.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={deleteNote.isPending}>
              {deleteNote.isPending ? 'Deleting…' : 'Confirm delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {deleteNote.isError ? (
        <p className="mt-3 text-sm text-destructive">Failed to delete note. Please try again.</p>
      ) : null}
    </SurfacePanel>
  );
});

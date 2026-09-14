import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { useCreateTask } from '~/hooks/use-tasks';

import { TaskForm } from './task-form';
import { TaskPreviewCard } from './task-preview-card';

export function CreateTaskDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const createTask = useCreateTask();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) createTask.reset();
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus /> New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        {/* Remount on open so a cancelled draft never leaks into the next create. */}
        {open ? (
          <TaskForm
            mode="create"
            onSubmit={(input) =>
              createTask.mutate(input, {
                onSuccess: (task) => {
                  setOpen(false);
                  void navigate(`/tasks/${task.id}`, { viewTransition: true });
                },
              })
            }
            pending={createTask.isPending}
            serverError={createTask.isError ? 'Could not create task.' : null}
            showPreview={(draft) => <TaskPreviewCard draft={draft} />}
            submitLabel="Create"
            variant="compact"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

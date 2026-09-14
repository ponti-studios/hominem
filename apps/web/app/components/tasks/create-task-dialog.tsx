import { LoaderCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { useCreateTask } from '~/hooks/use-tasks';

type Priority = 'low' | 'medium' | 'high';

function isPriority(value: string): value is Priority {
  return value === 'low' || value === 'medium' || value === 'high';
}

export function CreateTaskDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueAt, setDueAt] = useState('');
  const createTask = useCreateTask();

  const trimmedTitle = title.trim();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueAt('');
    }
  }

  function handleSubmit() {
    if (!trimmedTitle) return;
    createTask.mutate(
      {
        title: trimmedTitle,
        description: description.trim() || undefined,
        artifactType: 'task',
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      },
      {
        onSuccess: (task) => {
          handleOpenChange(false);
          void navigate(`/tasks/${task.id}`, { viewTransition: true });
        },
      },
    );
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
        <div className="space-y-3">
          <label className="block space-y-2 text-xs">
            <span className="text-muted-foreground">Title</span>
            <Input
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Call the plumber"
              value={title}
            />
          </label>
          <label className="block space-y-2 text-xs">
            <span className="text-muted-foreground">Description (optional)</span>
            <Textarea
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              value={description}
            />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1 space-y-2 text-xs">
              <span className="text-muted-foreground">Priority</span>
              <Select
                onValueChange={(value) => {
                  if (isPriority(value)) setPriority(value);
                }}
                value={priority}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block flex-1 space-y-2 text-xs">
              <span className="text-muted-foreground">Due (optional)</span>
              <Input
                onChange={(event) => setDueAt(event.target.value)}
                type="datetime-local"
                value={dueAt}
              />
            </label>
          </div>
          {createTask.isError ? (
            <p className="text-sm text-destructive">Could not create task.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={createTask.isPending || !trimmedTitle}
            onClick={handleSubmit}
            type="button"
          >
            {createTask.isPending ? (
              <>
                <LoaderCircle className="animate-spin" /> Creating…
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

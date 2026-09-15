import { LoaderCircle, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import type { TaskFormDraft, TaskFormPatch } from '~/hooks/use-task-form-draft';
import { useTaskWhenParser, mapParsedBlockToDraftPatch } from '~/hooks/use-task-when-parser';

export function WhenInput({
  dueAt,
  scheduledStartAt,
  scheduledEndAt,
  setField,
  applyParsedWhen,
}: {
  dueAt: TaskFormDraft['dueAt'];
  scheduledStartAt: TaskFormDraft['scheduledStartAt'];
  scheduledEndAt: TaskFormDraft['scheduledEndAt'];
  setField: <K extends keyof TaskFormDraft>(field: K, value: TaskFormDraft[K]) => void;
  applyParsedWhen: (patch: TaskFormPatch) => void;
}) {
  const parser = useTaskWhenParser();
  const lastParsed = useRef('');
  const [whenText, setWhenText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function parse() {
    const text = whenText.trim();
    if (!text || text === lastParsed.current) return;
    setMessage(null);
    try {
      const result = await parser.mutateAsync(text);
      const mapped = mapParsedBlockToDraftPatch(result.block);
      applyParsedWhen(mapped.patch);
      setMessage(mapped.note ?? 'Updated the schedule from that phrase.');
      lastParsed.current = text;
    } catch {
      setMessage("Couldn't parse that — try the buttons below.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          aria-label="Describe when"
          onBlur={() => {
            void parse();
          }}
          onChange={(event) => setWhenText(event.target.value)}
          placeholder="Tomorrow at 2pm for an hour"
          value={whenText}
        />
        <Button
          disabled={parser.isPending || !whenText.trim()}
          onClick={() => {
            void parse();
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          {parser.isPending ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Parse
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Due</span>
          <Input
            onChange={(event) => setField('dueAt', event.target.value)}
            type="datetime-local"
            value={dueAt}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Start</span>
          <Input
            onChange={(event) => setField('scheduledStartAt', event.target.value)}
            type="datetime-local"
            value={scheduledStartAt}
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>End</span>
        <Input
          onChange={(event) => setField('scheduledEndAt', event.target.value)}
          type="datetime-local"
          value={scheduledEndAt}
        />
      </label>
    </div>
  );
}

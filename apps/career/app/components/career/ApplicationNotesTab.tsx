import type { AppApplicationNotes, Selectable } from '@hominem/db';
import { EmptyState } from '@hominem/ui';
import { Badge } from '@hominem/ui';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@hominem/ui';
import { useState } from 'react';
import { Form } from 'react-router';

import { getApplicationNoteTone } from '~/lib/utils/applicationNoteUtils';

interface NotesTabProps {
  notes: Selectable<AppApplicationNotes>[];
  applicationId: string;
}

export function ApplicationNotesTab({ notes }: NotesTabProps) {
  const [showAddNote, setShowAddNote] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="heading-3 text-foreground">Notes & Feedback</h3>
        <Button onClick={() => setShowAddNote(true)}>Add Note</Button>
      </div>

      {/* Add Note Form */}
      {showAddNote && (
        <Card>
          <CardHeader>
            <CardTitle className="heading-4">Add Note</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" onSubmit={() => setShowAddNote(false)} className="space-y-4">
              <input type="hidden" name="operation" value="add_note" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="noteType" className="subheading-4 text-foreground">
                    Note Type
                  </label>
                  <Select name="noteType" defaultValue="general">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select note type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="interview">Interview</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                      <SelectItem value="research">Research</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="noteTitle" className="subheading-4 text-foreground">
                    Title (Optional)
                  </label>
                  <Input name="noteTitle" placeholder="Note title" />
                </div>
              </div>

              <div>
                <label htmlFor="noteContent" className="subheading-4 text-foreground">
                  Content
                </label>
                <Textarea
                  name="noteContent"
                  rows={4}
                  required
                  placeholder="Write your note here..."
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">Add Note</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddNote(false)}>
                  Cancel
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {notes.length === 0 ? (
          <EmptyState
            title="No notes yet"
            description="Add your first note above."
            variant="quiet"
          />
        ) : (
          notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    {note.title ? (
                      <h4 className="subheading-4 text-foreground">{note.title}</h4>
                    ) : null}
                    <Badge variant="outline" className={getApplicationNoteTone(note.type)}>
                      {note.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="body-3 text-muted-foreground whitespace-nowrap">
                      {new Date(note.createdat).toLocaleDateString()}
                    </span>
                    <Form method="post" className="inline">
                      <input type="hidden" name="operation" value="delete_note" />
                      <input type="hidden" name="noteId" value={note.id} />
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          if (!confirm('Delete this note?')) e.preventDefault();
                        }}
                      >
                        Delete
                      </Button>
                    </Form>
                  </div>
                </div>
                <p className="whitespace-pre-wrap body-3 text-foreground/90">{note.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

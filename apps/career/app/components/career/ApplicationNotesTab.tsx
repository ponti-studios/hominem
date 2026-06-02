import { useState } from 'react'
import { Form } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card'
import { Input } from '~/components/ui/input'
import { Select } from '~/components/ui/select'
import type { ApplicationNote } from '~/lib/db/schema'

interface NotesTabProps {
  notes: ApplicationNote[]
  applicationId: string
}

export function ApplicationNotesTab({ notes, applicationId }: NotesTabProps) {
  const [showAddNote, setShowAddNote] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Notes & Feedback</h3>
        <Button onClick={() => setShowAddNote(true)}>Add Note</Button>
      </div>

      {/* Add Note Form */}
      {showAddNote && (
        <Card>
          <CardHeader>
            <CardTitle>Add Note</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" onSubmit={() => setShowAddNote(false)} className="space-y-4">
              <input type="hidden" name="operation" value="add_note" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="noteType" className="text-sm font-medium text-gray-700">
                    Note Type
                  </label>
                  <Select name="noteType" defaultValue="general">
                    <option value="general">General</option>
                    <option value="interview">Interview</option>
                    <option value="feedback">Feedback</option>
                    <option value="research">Research</option>
                    <option value="follow_up">Follow Up</option>
                  </Select>
                </div>

                <div>
                  <label htmlFor="noteTitle" className="text-sm font-medium text-gray-700">
                    Title (Optional)
                  </label>
                  <Input name="noteTitle" placeholder="Note title" />
                </div>
              </div>

              <div>
                <label htmlFor="noteContent" className="text-sm font-medium text-gray-700">
                  Content
                </label>
                <textarea
                  name="noteContent"
                  rows={4}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="text-center py-8 text-gray-500">
            No notes yet. Add your first note above.
          </div>
        ) : (
          notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    {note.title && <h4 className="font-medium">{note.title}</h4>}
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        note.type === 'interview'
                          ? 'bg-purple-100 text-purple-800'
                          : note.type === 'research'
                            ? 'bg-blue-100 text-blue-800'
                            : note.type === 'follow_up'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {note.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                    <Form method="post" className="inline">
                      <input type="hidden" name="operation" value="delete_note" />
                      <input type="hidden" name="noteId" value={note.id} />
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          if (!confirm('Delete this note?')) e.preventDefault()
                        }}
                      >
                        Delete
                      </Button>
                    </Form>
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

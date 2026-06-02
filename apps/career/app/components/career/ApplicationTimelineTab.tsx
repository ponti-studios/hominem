import { useState } from 'react'
import { Form } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card'
import { Input } from '~/components/ui/input'
import { Select } from '~/components/ui/select'
import type { ApplicationWithCompany } from '~/lib/db/schema'

interface TimelineTabProps {
  application: ApplicationWithCompany
  applicationId: string
}

export function ApplicationTimelineTab({ application, applicationId }: TimelineTabProps) {
  const [showAddInterview, setShowAddInterview] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Application Timeline</h3>
        <Button onClick={() => setShowAddInterview(true)}>Add Interview</Button>
      </div>

      {/* Add Interview Form */}
      {showAddInterview && (
        <Card>
          <CardHeader>
            <CardTitle>Add Interview</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" onSubmit={() => setShowAddInterview(false)} className="space-y-4">
              <input type="hidden" name="operation" value="add_interview" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="interviewType" className="text-sm font-medium text-gray-700">
                    Interview Type
                  </label>
                  <Select name="interviewType" defaultValue="phone">
                    <option value="phone">Phone Screen</option>
                    <option value="video">Video Interview</option>
                    <option value="onsite">Onsite Interview</option>
                    <option value="technical">Technical Interview</option>
                    <option value="final">Final Interview</option>
                  </Select>
                </div>

                <div>
                  <label htmlFor="interviewDate" className="text-sm font-medium text-gray-700">
                    Date & Time
                  </label>
                  <Input name="interviewDate" type="datetime-local" required />
                </div>
              </div>

              <div>
                <label htmlFor="interviewer" className="text-sm font-medium text-gray-700">
                  Interviewer
                </label>
                <Input name="interviewer" placeholder="Name or role of interviewer" />
              </div>

              <div>
                <label htmlFor="interviewNotes" className="text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  name="interviewNotes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional notes about the interview"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">Add Interview</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddInterview(false)}>
                  Cancel
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Timeline Display */}
      <div className="space-y-4">
        {/* Application Date */}
        <div className="flex items-start space-x-4 p-4 bg-white rounded-lg border">
          <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Application Submitted</h4>
              <span className="text-sm text-gray-500">
                {new Date(application.startDate).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm text-gray-600">Initial application submitted</p>
          </div>
        </div>

        {/* Interviews */}
        {application.interviewDates?.map((interview, index) => (
          <div
            key={interview.date}
            className="flex items-start space-x-4 p-4 bg-white rounded-lg border"
          >
            <div className="w-3 h-3 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">
                  {interview.type.replace(/(\b\w)/g, (l) => l.toUpperCase())} Interview
                </h4>
                <span className="text-sm text-gray-500">
                  {new Date(interview.date).toLocaleDateString()}
                </span>
              </div>
              {interview.interviewer && (
                <p className="text-sm text-gray-600">with {interview.interviewer}</p>
              )}
              {interview.notes && <p className="text-sm text-gray-700 mt-1">{interview.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

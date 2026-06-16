import { Badge } from '@hominem/ui/badge';
import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@hominem/ui/card';
import { Input } from '@hominem/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hominem/ui/select';
import { Textarea } from '@hominem/ui/textarea';
import { useState } from 'react';
import { Form } from 'react-router';

import { jsonArray } from '~/lib/db-json';
import type { ApplicationWithCompany } from '~/types/career-data';

type InterviewEntry = {
  date: string;
  interviewer?: string;
  notes?: string;
  type: string;
};

interface TimelineTabProps {
  application: ApplicationWithCompany;
  applicationId: string;
}

export function ApplicationTimelineTab({ application }: TimelineTabProps) {
  const [showAddInterview, setShowAddInterview] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">Application Timeline</h3>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="interviewType" className="text-sm font-medium text-foreground">
                    Interview Type
                  </label>
                  <Select name="interviewType" defaultValue="phone">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select interview type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone Screen</SelectItem>
                      <SelectItem value="video">Video Interview</SelectItem>
                      <SelectItem value="onsite">Onsite Interview</SelectItem>
                      <SelectItem value="technical">Technical Interview</SelectItem>
                      <SelectItem value="final">Final Interview</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="interviewDate" className="text-sm font-medium text-foreground">
                    Date & Time
                  </label>
                  <Input name="interviewDate" type="datetime-local" required />
                </div>
              </div>

              <div>
                <label htmlFor="interviewer" className="text-sm font-medium text-foreground">
                  Interviewer
                </label>
                <Input name="interviewer" placeholder="Name or role of interviewer" />
              </div>

              <div>
                <label htmlFor="interviewNotes" className="text-sm font-medium text-foreground">
                  Notes
                </label>
                <Textarea
                  name="interviewNotes"
                  rows={3}
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
        <Card>
          <CardContent className="flex items-start gap-4 p-4">
            <div className="mt-1 size-3 shrink-0 rounded-full bg-primary" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-medium text-foreground">Application Submitted</h4>
                <span className="text-sm text-muted-foreground">
                  {new Date(application.start_date).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Initial application submitted</p>
            </div>
          </CardContent>
        </Card>

        {/* Interviews */}
        {jsonArray<InterviewEntry>(application.interview_dates).map((interview) => (
          <Card key={interview.date}>
            <CardContent className="flex items-start gap-4 p-4">
              <div className="mt-1 size-3 shrink-0 rounded-full bg-accent" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">
                      {interview.type.replace(/(\b\w)/g, (l) => l.toUpperCase())} Interview
                    </h4>
                    <Badge
                      variant="outline"
                      className="border-accent/30 bg-accent/10 text-foreground"
                    >
                      {interview.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(interview.date).toLocaleDateString()}
                  </span>
                </div>
                {interview.interviewer ? (
                  <p className="text-sm text-muted-foreground">with {interview.interviewer}</p>
                ) : null}
                {interview.notes ? (
                  <p className="mt-1 text-sm text-foreground/90">{interview.notes}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

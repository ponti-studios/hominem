import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@hominem/ui/card';

import type { ApplicationWithCompany } from '~/types/career-data';

interface FilesTabProps {
  application: ApplicationWithCompany;
}

export function ApplicationFilesTab({ application }: FilesTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Files & Documents</h3>
        <Button disabled>Upload File (Coming Soon)</Button>
      </div>

      {/* Existing text content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {application.resume && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                {application.resume}
              </div>
            </CardContent>
          </Card>
        )}

        {application.cover_letter && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cover Letter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                {application.cover_letter}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {!application.resume && !application.cover_letter && (
        <div className="text-center py-8 text-muted-foreground">
          No files uploaded yet. File upload functionality coming soon.
        </div>
      )}
    </div>
  );
}

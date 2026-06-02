import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card'
import type { ApplicationWithCompany } from '~/lib/db/schema'

interface FilesTabProps {
  application: ApplicationWithCompany
  applicationId: string
}

export function ApplicationFilesTab({ application, applicationId }: FilesTabProps) {
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
              <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                {application.resume}
              </div>
            </CardContent>
          </Card>
        )}

        {application.coverLetter && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cover Letter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                {application.coverLetter}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {!application.resume && !application.coverLetter && (
        <div className="text-center py-8 text-gray-500">
          No files uploaded yet. File upload functionality coming soon.
        </div>
      )}
    </div>
  )
}

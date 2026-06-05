import { Badge } from "@hominem/ui/badge";
import { Card, CardContent } from "@hominem/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@hominem/ui/table";
import { Link } from "react-router";

import {
  formatApplicationDate,
  formatApplicationSalary,
  formatStatusText,
  getCompanyName,
  getStatusColor,
} from "~/lib/utils/applicationUtils";

import type { ApplicationsDesktopTableProps } from "./types";

export function ApplicationsDesktopTable({
  applications,
}: ApplicationsDesktopTableProps) {
  return (
    <Card className="hidden md:block">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((application) => (
              <TableRow key={application.id} className="hover:bg-muted/40">
                <TableCell className="whitespace-nowrap">
                  <Link
                    to={`/career/applications/${application.id}`}
                    className="block hover:text-primary"
                  >
                    <div className="font-medium text-foreground">
                      {application.position}
                    </div>
                    <div className="text-muted-foreground">
                      {getCompanyName(application.company)}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge
                    variant="outline"
                    className={getStatusColor(application.status)}
                  >
                    {formatStatusText(application.status)}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatApplicationDate(
                    application.application_date ||
                      application.start_date ||
                      null,
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatApplicationDate(application.response_date)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatApplicationSalary(
                    application.salary_offered || application.salary_quoted,
                  )}
                </TableCell>
                <TableCell>
                  <span className="capitalize text-muted-foreground">
                    {application.source || "—"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

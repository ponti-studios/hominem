import { Badge } from "@hominem/ui/badge";
import { Card, CardContent } from "@hominem/ui/card";
import { ChevronRightIcon } from "lucide-react";
import { Link } from "react-router";

import {
  formatStatusText,
  getCompanyName,
  getStatusColor,
} from "~/lib/utils/applicationUtils";

import type { ApplicationsMobileListProps } from "./types";

export function ApplicationsMobileList({
  applications,
}: ApplicationsMobileListProps) {
  return (
    <Card className="md:hidden">
      <CardContent className="divide-y divide-border p-0">
        {applications.map((application) => (
          <Link
            key={application.id}
            to={`/career/applications/${application.id}`}
            className="block p-4 transition-colors duration-200 hover:bg-muted/40 focus:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-inset"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {application.position}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {getCompanyName(application.company)}
                </div>
              </div>
              <div className="ml-4 flex items-center space-x-3">
                <Badge
                  variant="outline"
                  className={getStatusColor(application.status)}
                >
                  {formatStatusText(application.status)}
                </Badge>
                <ChevronRightIcon
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

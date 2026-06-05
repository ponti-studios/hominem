import { CareerRepository, db } from "@hominem/db";
import { buttonVariants } from "@hominem/ui/button";
import { Card, CardContent } from "@hominem/ui/card";
import { useDebouncedValue } from "@hominem/ui/hooks";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Link,
  useActionData,
  useLoaderData,
  useNavigate,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { ApplicationsHeatmap } from "~/components/career/ApplicationsHeatmap";
import { ApplicationsDesktopTable } from "~/components/career/applications/ApplicationsDesktopTable";
import { ApplicationsEmptyState } from "~/components/career/applications/ApplicationsEmptyState";
import { ApplicationsFilters } from "~/components/career/applications/ApplicationsFilters";
import { ApplicationsMobileList } from "~/components/career/applications/ApplicationsMobileList";
import { ApplicationsResultsSummary } from "~/components/career/applications/ApplicationsResultsSummary";
import { useToast } from "~/hooks/useToast";
import { getAllApplicationsWithCompany } from "~/lib/career/queries/job-applications";
import {
  createErrorResponse,
  createSuccessResponse,
  withAuthAction,
  withAuthLoader,
} from "~/lib/route-utils";
import { buildApplicationsSearchParams } from "~/lib/utils/applicationsSearchParams";
import {
  getUniqueSources,
  getUniqueStatuses,
  hasActiveFilters,
} from "~/lib/utils/applicationUtils";
import type { JobApplicationStatus } from "~/types/career";

interface ApplicationFilters {
  search?: string;
  statuses: string[];
  source?: string;
}

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user, request }) => {
    try {
      const url = new URL(request.url);
      const searchParams = url.searchParams;

      // Extract pagination and filter parameters
      const page = Math.max(
        1,
        Number.parseInt(searchParams.get("page") || "1"),
      );
      const limit = Math.max(
        1,
        Math.min(100, Number.parseInt(searchParams.get("limit") || "10")),
      ); // Default 10, max 100
      const offset = (page - 1) * limit;

      const searchQuery = searchParams.get("search") || undefined;
      const selectedStatuses = searchParams.getAll("status").filter(Boolean);
      const source = searchParams.get("source") || undefined;

      // Build filter object
      const filter = {
        ...(selectedStatuses.length > 0 && { statuses: selectedStatuses }),
        ...(source && source !== "ALL" && { source }),
        ...(searchQuery && { search: searchQuery }),
      };

      // Build pagination object
      const pagination = {
        limit,
        offset,
        orderBy: (searchParams.get("orderBy") || "application_date") as
          | "application_date"
          | "response_date"
          | "offer_date"
          | "companyName"
          | "position",
        orderDirection:
          (searchParams.get("orderDirection") as "asc" | "desc") || "desc",
      };

      const allApplications = await getAllApplicationsWithCompany(user.id);
      const filteredApplications = await getAllApplicationsWithCompany(
        user.id,
        filter,
      );

      const paginatedApplications = await getAllApplicationsWithCompany(
        user.id,
        filter,
        pagination,
      );

      return createSuccessResponse({
        user,
        allApplications,
        applications: paginatedApplications,
        pagination: {
          page,
          limit,
          total: filteredApplications.length,
          totalPages: Math.ceil(filteredApplications.length / limit),
        },
        filters: {
          search: searchQuery,
          statuses: selectedStatuses,
          source: source && source !== "ALL" ? source : undefined,
        },
      });
    } catch (error) {
      console.error("Error loading job applications data:", error);
      return createSuccessResponse({
        user,
        allApplications: [],
        applications: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
        filters: {
          search: undefined,
          statuses: [],
          source: undefined,
        } satisfies ApplicationFilters,
        error: "Failed to load job applications data",
      });
    }
  });
}

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user, request }) => {
    try {
      const formData = await request.formData();
      const operation = formData.get("operation") as string;

      if (operation === "update") {
        const applicationId = formData.get("applicationId") as string;
        const status = formData.get("status") as string;

        await CareerRepository.updateJobApplicationStatus(
          db,
          user.id,
          applicationId,
          status as JobApplicationStatus,
        );

        return createSuccessResponse(
          null,
          "Job application updated successfully",
        );
      }

      if (operation === "delete") {
        const applicationId = formData.get("applicationId") as string;

        await CareerRepository.deleteJobApplication(db, user.id, applicationId);

        return createSuccessResponse(
          { success: true },
          "Job application deleted successfully",
        );
      }

      return createErrorResponse("Invalid operation");
    } catch (error) {
      console.error("Error in job applications action:", error);
      return createErrorResponse("Failed to process job application request");
    }
  });
}

export default function CareerApplications() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const searchValueFromRoute =
    loaderData.success && loaderData.data
      ? loaderData.data.filters.search || ""
      : "";
  const [searchValue, setSearchValue] = useState(searchValueFromRoute);
  const debouncedSearchValue = useDebouncedValue(searchValue, 500);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    const result = actionData as {
      success: boolean;
      error?: string;
      message?: string;
    };
    if (result.success) {
      addToast(
        result.message || "Operation completed successfully!",
        "success",
      );
      return;
    }

    addToast(`Error: ${result.error}`, "error");
  }, [actionData, addToast]);

  if (!loaderData.success || !loaderData.data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-2 p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Error Loading Data
          </h2>
          <p className="text-sm text-muted-foreground">
            {loaderData?.error ?? "Failed to load job applications data"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { allApplications, applications, pagination } = loaderData.data;
  const filters = loaderData.data.filters as ApplicationFilters;
  const statuses = getUniqueStatuses(allApplications);
  const sourceOptions = getUniqueSources(allApplications).map((source) => ({
    value: source,
    label: source || "Unknown",
  }));
  const hasFilters = hasActiveFilters(filters);

  const updateSearchParams = (
    updates: Record<string, string | string[] | null>,
  ) => {
    const nextSearchParams = buildApplicationsSearchParams(
      searchParams,
      updates,
    );
    const queryString = nextSearchParams.toString();

    navigate(queryString ? `?${queryString}` : ".");
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);

    if (value === "") {
      updateSearchParams({ search: null, page: "1" });
    }
  };

  const handleStatusToggle = (status: string) => {
    const selectedStatuses = filters.statuses || [];
    const nextStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((item: string) => item !== status)
      : [...selectedStatuses, status];

    updateSearchParams({ status: nextStatuses, page: "1" });
  };

  const handleSourceChange = (source: string) => {
    updateSearchParams({ source: source || null, page: "1" });
  };

  const clearFilters = () => {
    setSearchValue("");
    updateSearchParams({ search: null, status: [], source: null, page: "1" });
  };

  useEffect(() => {
    setSearchValue(filters.search || "");
  }, [filters.search]);

  useEffect(() => {
    if (
      debouncedSearchValue === (filters.search || "") ||
      debouncedSearchValue === ""
    ) {
      return;
    }

    updateSearchParams({ search: debouncedSearchValue, page: "1" });
  }, [debouncedSearchValue, filters.search, searchParams]);

  if (pagination.total === 0 && !hasFilters) {
    return (
      <div className="space-y-8 px-2 sm:px-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Job Applications</h1>
            <p className="text-sm text-muted-foreground">
              {allApplications.length} applications · track your pipeline and
              progress
            </p>
          </div>
          <Link
            to="/career/applications/create"
            className={buttonVariants({ size: "sm" })}
          >
            <PlusIcon className="size-4" />
            Add Application
          </Link>
        </div>

        <div className="space-y-8">
          <ApplicationsHeatmap applications={allApplications} />
          <ApplicationsEmptyState
            kind="base"
            emptyTitle="No applications found"
            emptyDescription="Start tracking your job applications to see them here"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-2 sm:px-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Job Applications</h1>
          <p className="text-sm text-muted-foreground">
            {allApplications.length} applications · track your pipeline and
            progress
          </p>
        </div>
        <Link
          to="/career/applications/create"
          className={buttonVariants({ size: "sm" })}
        >
          <PlusIcon className="size-4" />
          Add Application
        </Link>
      </div>

      <div className="space-y-8">
        <ApplicationsHeatmap applications={allApplications} />
        <Card>
          <CardContent className="space-y-4 p-4">
            <ApplicationsFilters
              searchValue={searchValue}
              onSearchChange={handleSearchChange}
              statuses={statuses}
              selectedStatuses={filters.statuses || []}
              onStatusToggle={handleStatusToggle}
              sourceOptions={sourceOptions}
              selectedSource={filters.source || ""}
              onSourceChange={handleSourceChange}
              onClearFilters={clearFilters}
            />

            <ApplicationsResultsSummary
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPrevPage={() =>
                updateSearchParams({ page: String(pagination.page - 1) })
              }
              onNextPage={() =>
                updateSearchParams({ page: String(pagination.page + 1) })
              }
              hasActiveFilters={hasFilters}
              onClearFilters={clearFilters}
            />
          </CardContent>
        </Card>

        {applications.length === 0 ? (
          <ApplicationsEmptyState
            kind="filtered"
            emptyTitle="No applications match your filters"
            emptyDescription="Try adjusting your search criteria"
          />
        ) : (
          <>
            <ApplicationsDesktopTable applications={applications} />
            <ApplicationsMobileList applications={applications} />
          </>
        )}
      </div>
    </div>
  );
}

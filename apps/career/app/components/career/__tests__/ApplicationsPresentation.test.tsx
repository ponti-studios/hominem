import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";

import { makeApplicationWithCompany } from "~/test/factories/applications";
import { JobApplicationStatus } from "~/types/career";

import { ApplicationsDesktopTable } from "../applications/ApplicationsDesktopTable";
import { ApplicationsEmptyState } from "../applications/ApplicationsEmptyState";
import { ApplicationsMobileList } from "../applications/ApplicationsMobileList";

const applications = [
  makeApplicationWithCompany({
    id: "application-1",
    position: "Staff Engineer",
    status: JobApplicationStatus.INTERVIEW,
    company: { name: "Example Co" },
  }),
];

describe("applications presentation components", () => {
  it("renders the same application details in desktop and mobile variants", () => {
    render(
      <MemoryRouter>
        <ApplicationsDesktopTable applications={applications} />
        <ApplicationsMobileList applications={applications} />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Staff Engineer")).toHaveLength(2);
    expect(screen.getAllByText("Example Co")).toHaveLength(2);
    expect(screen.getAllByText("INTERVIEW")).toHaveLength(2);
  });

  it("renders the base empty state with the create action", () => {
    render(
      <MemoryRouter>
        <ApplicationsEmptyState
          kind="base"
          emptyTitle="No applications found"
          emptyDescription="Start tracking your job applications to see them here"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("No applications found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add Application" }),
    ).toBeInTheDocument();
  });

  it("renders the filtered empty state copy without the create action", () => {
    render(
      <MemoryRouter>
        <ApplicationsEmptyState
          kind="filtered"
          emptyTitle="No applications match your filters"
          emptyDescription="Try adjusting your search criteria"
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("No applications match your filters"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Add Application" }),
    ).not.toBeInTheDocument();
  });
});

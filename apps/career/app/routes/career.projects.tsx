import type { CareerProjectRecord as Project } from "@hominem/db";
import { EmptyState } from "@hominem/ui";
import { Button } from "@hominem/ui/button";
import {
  CheckIcon,
  ExternalLinkIcon,
  GithubIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { Route } from "./+types/career.projects";

import { CareerRecordIndexShell } from "~/components/career/CareerRecordIndexShell";
import { MetricsGrid } from "~/components/career/MetricsGrid";
import { jsonArray } from "~/lib/db-json";
import { cn } from "~/lib/utils";
import { formatProjectStatus, getProjectStatusClasses } from "~/lib/utils/projectUtils";

interface ProjectSummary {
  totalProjects: number;
  completedProjects: number;
  inProgressProjects: number;
  plannedProjects: number;
  portfolioProjects: number;
  workLinkedProjects: number;
}

export async function loader() {
  try {
    const projects: (Project & {
      workExperience?: { company: string; role: string };
    })[] = [];
    const summary: ProjectSummary = {
      totalProjects: 0,
      completedProjects: 0,
      inProgressProjects: 0,
      plannedProjects: 0,
      portfolioProjects: 0,
      workLinkedProjects: 0,
    };

    return {
      projects,
      summary,
    };
  } catch (error) {
    console.error("Error loading projects:", error);
    throw new Response("Failed to load projects", { status: 500 });
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const operation = formData.get("operation") as string;

  try {
    if (operation === "create") {
      return { success: true, message: "Project created successfully" };
    }

    if (operation === "update") {
      return { success: true, message: "Project updated successfully" };
    }

    if (operation === "delete") {
      return { success: true, message: "Project deleted successfully" };
    }

    throw new Response("Invalid operation", { status: 400 });
  } catch (error) {
    console.error("Error handling project operation:", error);
    throw new Response("Failed to process project request", { status: 500 });
  }
}

export default function ProjectsPage({ loaderData }: Route.ComponentProps) {
  const { projects, summary } = loaderData;
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <CareerRecordIndexShell
      title="Project Portfolio"
      subtitle="Manage your portfolio projects and work-related projects"
      primaryAction={
        <Button onClick={() => setShowCreateForm(true)} className="flex gap-2">
          <PlusIcon className="size-4" />
          Add Project
        </Button>
      }
      metrics={
        <MetricsGrid
          items={[
            { label: "Total Projects", value: String(summary.totalProjects) },
            {
              label: "Completed",
              value: String(summary.completedProjects),
              tone: "success",
            },
            {
              label: "In Progress",
              value: String(summary.inProgressProjects),
              tone: "accent",
            },
            {
              label: "Planned",
              value: String(summary.plannedProjects),
              tone: "warning",
            },
            {
              label: "Portfolio",
              value: String(summary.portfolioProjects),
              tone: "accent",
            },
            {
              label: "Work-Linked",
              value: String(summary.workLinkedProjects),
              tone: "muted",
            },
          ]}
        />
      }
      sectionTitle="Your Projects"
      emptyState={
        projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Start building your project portfolio to showcase your work and skills."
            action={
              <Button onClick={() => setShowCreateForm(true)}>
                <PlusIcon className="size-4" />
                Add Your First Project
              </Button>
            }
          />
        ) : undefined
      }
    >
      {projects.length > 0 ? (
        <>
          <div className="hidden divide-y divide-slate-200/50 md:block">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card md:hidden">
            <div className="divide-y divide-gray-200">
              {projects.map((project) => (
                <ProjectMobileCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {showCreateForm ? <CreateProjectModal onClose={() => setShowCreateForm(false)} /> : null}
    </CareerRecordIndexShell>
  );
}

interface ProjectCardProps {
  project: Project & { workExperience?: { company: string; role: string } };
}

function ProjectCard({ project }: ProjectCardProps) {
  const [, setIsEditing] = useState(false);
  const technologies = jsonArray<string>(project.technologies);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">{project.title}</h3>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-xs font-medium",
                getProjectStatusClasses(project.status),
              )}
            >
              {formatProjectStatus(project.status)}
            </span>
            {project.is_featured ? (
              <span className="rounded-full bg-warning/10 px-2 py-1 text-xs font-medium text-foreground">
                Featured
              </span>
            ) : null}
          </div>

          {project.workExperience ? (
            <p className="mb-2 text-sm text-muted-foreground">
              Work Project at {project.workExperience.company} ({project.workExperience.role})
            </p>
          ) : null}

          <p className="mb-3 text-muted-foreground">{project.description}</p>

          {technologies.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {technologies.map((tech) => (
                <span
                  key={tech}
                  className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {project.start_date ? (
              <span>Started: {new Date(project.start_date).toLocaleDateString()}</span>
            ) : null}
            {project.end_date ? (
              <span>Completed: {new Date(project.end_date).toLocaleDateString()}</span>
            ) : null}
          </div>
        </div>

        <div className="ml-4 flex items-center gap-2">
          {project.live_url ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(project.live_url ?? undefined, "_blank", "noopener,noreferrer")
              }
              className="text-muted-foreground hover:text-muted-foreground"
            >
              <ExternalLinkIcon className="w-4 h-4" />
            </Button>
          ) : null}
          {project.github_url ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(project.github_url ?? undefined, "_blank", "noopener,noreferrer")
              }
              className="text-muted-foreground hover:text-muted-foreground"
            >
              <GithubIcon className="w-4 h-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-muted-foreground hover:text-muted-foreground"
          >
            <PencilIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive/70 hover:text-destructive">
            <TrashIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProjectMobileCard({ project }: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const technologies = jsonArray<string>(project.technologies);

  return (
    <div className="block">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left transition-colors duration-200 hover:bg-muted focus:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-inset"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{project.title}</div>
            <div className="truncate text-sm text-muted-foreground">
              {project.workExperience
                ? `${project.workExperience.company} (Work Project)`
                : "Personal Project"}
            </div>
          </div>
          <div className="ml-4 flex items-center space-x-3">
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                getProjectStatusClasses(project.status),
              )}
            >
              {formatProjectStatus(project.status)}
            </span>
            <svg
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-200",
                isExpanded ? "rotate-90" : "",
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-border px-4 pb-4">
          <div className="space-y-3 pt-3">
            {project.description ? (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            ) : null}

            {technologies.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {technologies.slice(0, 6).map((tech) => (
                  <span
                    key={tech}
                    className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                  >
                    {tech}
                  </span>
                ))}
                {technologies.length > 6 ? (
                  <span className="text-xs text-muted-foreground">
                    +{technologies.length - 6} more
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {project.start_date ? (
                  <span>Started: {new Date(project.start_date).toLocaleDateString()}</span>
                ) : null}
                {project.end_date ? (
                  <span className="ml-3">
                    Completed: {new Date(project.end_date).toLocaleDateString()}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {project.live_url ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      window.open(project.live_url ?? undefined, "_blank", "noopener,noreferrer");
                    }}
                    className="p-1 text-muted-foreground transition-colors hover:text-primary"
                    title="View Live Project"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </button>
                ) : null}
                {project.github_url ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      window.open(project.github_url ?? undefined, "_blank", "noopener,noreferrer");
                    }}
                    className="p-1 text-muted-foreground transition-colors hover:text-muted-foreground"
                    title="View on GitHub"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface CreateProjectModalProps {
  onClose: () => void;
}

function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md bg-card">
        <div className="border-b border-border p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Add Project</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <form className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="project-title"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Project Title *
              </label>
              <input
                id="project-title"
                type="text"
                name="title"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
                placeholder="E-commerce Platform"
              />
            </div>
            <div>
              <label
                htmlFor="project-status"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Status *
              </label>
              <select
                id="project-status"
                name="status"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
              >
                <option value="">Select status...</option>
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="mb-2 block text-sm font-medium text-muted-foreground"
            >
              Description *
            </label>
            <textarea
              id="project-description"
              name="description"
              rows={4}
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
              placeholder="Describe your project, technologies used, and key achievements..."
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="project-live-url"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Live URL
              </label>
              <input
                id="project-live-url"
                type="url"
                name="live_url"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
                placeholder="https://your-project.com"
              />
            </div>
            <div>
              <label
                htmlFor="project-github-url"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                GitHub URL
              </label>
              <input
                id="project-github-url"
                type="url"
                name="github_url"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
                placeholder="https://github.com/username/repo"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <label
                htmlFor="project-start-date"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Start Date
              </label>
              <input
                id="project-start-date"
                type="date"
                name="start_date"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
              />
            </div>
            <div>
              <label
                htmlFor="project-end-date"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                End Date
              </label>
              <input
                id="project-end-date"
                type="date"
                name="end_date"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
              />
            </div>
            <div>
              <label
                htmlFor="project-technologies"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
                Technologies
              </label>
              <input
                id="project-technologies"
                type="text"
                name="technologies"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
                placeholder="React, Node.js, PostgreSQL"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              <CheckIcon className="mr-2 w-4 h-4" />
              Add Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

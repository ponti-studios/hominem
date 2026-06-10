import type { CareerProjectRecord as Project } from "@hominem/db";
import { Button } from "@hominem/ui/button";
import { ArrowLeftIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { jsonArray } from "~/lib/db-json";
import { userContext } from "~/lib/middleware";
import { cn } from "~/lib/utils";
import { Route } from "./+types/career.experience.$id.projects";

export async function loader({ context, params }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const { id } = params;
  if (!id) {
    throw new Response("Work experience ID is required", { status: 400 });
  }

  try {
    const { getWorkExperienceById } = await import("~/lib/career/queries/base");
    const { getProjectsByWorkExperience } = await import("~/lib/career/queries/projects");

    const workExperience = await getWorkExperienceById(user.id, id);
    if (!workExperience) {
      throw new Response("Work experience not found", { status: 404 });
    }

    const projects = await getProjectsByWorkExperience(workExperience.portfolio_id, id);

    return { workExperience, projects };
  } catch (error) {
    console.error("Error loading work experience projects:", error);
    throw new Response("Failed to load work experience projects", { status: 500 });
  }
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const { id } = params;
  if (!id) {
    throw new Response("Work experience ID is required", { status: 400 });
  }

  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  try {
    const { getWorkExperienceById } = await import("~/lib/career/queries/base");
    const { createProject, updateProject, deleteProject } =
      await import("~/lib/career/queries/projects");

    const currentExperience = await getWorkExperienceById(user.id, id);
    if (!currentExperience) {
      throw new Response("Work experience not found", { status: 404 });
    }

    if (actionType === "add") {
      const title = formData.get("title") as string;
      const description = formData.get("description") as string;
      const status = formData.get("status") as string;
      const technologies = formData.get("technologies") as string;
      const short_description = formData.get("short_description") as string;

      await createProject(user.id, {
        portfolio_id: currentExperience.portfolio_id,
        work_experience_id: id,
        title,
        description,
        short_description: short_description || null,
        status,
        technologies: technologies ? technologies.split(",").map((t) => t.trim()) : [],
        is_visible: true,
        is_featured: false,
        sort_order: 0,
      });
    } else if (actionType === "update") {
      const projectId = formData.get("projectId") as string;
      const title = formData.get("title") as string;
      const description = formData.get("description") as string;
      const status = formData.get("status") as string;
      const technologies = formData.get("technologies") as string;
      const short_description = formData.get("short_description") as string;

      await updateProject(user.id, projectId, currentExperience.portfolio_id, {
        title,
        description,
        short_description: short_description || null,
        status,
        technologies: technologies ? technologies.split(",").map((t) => t.trim()) : [],
      });
    } else if (actionType === "delete") {
      const projectId = formData.get("projectId") as string;
      await deleteProject(user.id, projectId, currentExperience.portfolio_id);
    }

    return { success: true };
  } catch (error) {
    console.error("Error managing project:", error);
    throw new Response("Failed to manage project");
  }
}

export default function WorkExperienceProjects({ loaderData }: Route.ComponentProps) {
  const { workExperience, projects } = loaderData;
  const navigate = useNavigate();
  const [showAddForm, setShowAddForm] = useState(false);

  if (!workExperience) {
    return <div>Work experience not found</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          type="button"
          onClick={() => navigate(`/career/experience/${workExperience.id}`)}
          variant="ghost"
          size="sm"
          className="p-2"
          data-testid="back-button"
        >
          <ArrowLeftIcon className="w-5 h-5 text-muted-foreground" />
        </Button>
        <div className="flex-1 flex gap-2 items-center">
          <h1 className="text-3xl font-light text-foreground font-sans">Projects</h1>
          <p className="text-sm text-muted-foreground font-sans">
            @ {workExperience.role} at {workExperience.company}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Project
        </Button>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Add Project Form */}
          {showAddForm && <ProjectForm onCancel={() => setShowAddForm(false)} />}

          {/* Projects List */}
          {projects.length > 0 ? (
            projects.map((project: Project) => <ProjectCard key={project.id} project={project} />)
          ) : (
            <div className="bg-card rounded-md p-8  border border-border/50 text-center">
              <div className="text-muted-foreground mb-4">
                <PlusIcon className="w-12 h-12 mx-auto mb-4" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking your work items, projects, and achievements for interview
                preparation.
              </p>
              <Button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Your First Project
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProjectFormProps {
  project?: Project;
  onCancel: () => void;
}

function ProjectForm({ project, onCancel }: ProjectFormProps) {
  const [formData, setFormData] = useState({
    title: project?.title || "",
    description: project?.description || "",
    short_description: project?.short_description || "",
    status: project?.status || "in-progress",
    technologies: jsonArray<string>(project?.technologies).join(", "),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const form = document.createElement("form");
    form.method = "POST";
    form.style.display = "none";

    const actionInput = document.createElement("input");
    actionInput.name = "actionType";
    actionInput.value = project ? "update" : "add";
    form.appendChild(actionInput);

    if (project) {
      const projectIdInput = document.createElement("input");
      projectIdInput.name = "projectId";
      projectIdInput.value = project.id;
      form.appendChild(projectIdInput);
    }

    for (const [key, value] of Object.entries(formData)) {
      const input = document.createElement("input");
      input.name = key;
      input.value = value || "";
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <div className="bg-card rounded-md p-8  border border-border/50">
      <h2 className="text-2xl font-light text-foreground font-sans mb-6">
        {project ? "Edit Project" : "Add New Project"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-muted-foreground mb-2">
            Project Title
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
            placeholder="e.g., User Authentication System, Data Migration Pipeline"
            required
          />
        </div>

        <div>
          <label
            htmlFor="short_description"
            className="block text-sm font-medium text-muted-foreground mb-2"
          >
            Short Description
          </label>
          <input
            type="text"
            id="short_description"
            value={formData.short_description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, short_description: e.target.value }))
            }
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
            placeholder="Brief one-line summary"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-muted-foreground mb-2"
          >
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
            rows={4}
            placeholder="Describe what you did, the challenges you solved, and your role in the project"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-muted-foreground mb-2"
            >
              Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
            >
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="technologies"
              className="block text-sm font-medium text-muted-foreground mb-2"
            >
              Technologies Used
            </label>
            <input
              type="text"
              id="technologies"
              value={formData.technologies}
              onChange={(e) => setFormData((prev) => ({ ...prev, technologies: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
              placeholder="React, Node.js, PostgreSQL, AWS"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <CheckIcon className="w-4 h-4 mr-1" />
            {project ? "Update Project" : "Save Project"}
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            variant="ghost"
            className="text-muted-foreground hover:bg-muted"
          >
            <XIcon className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
}

function ProjectCard({ project }: ProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const technologies = jsonArray<string>(project.technologies);

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this project?")) {
      const form = document.createElement("form");
      form.method = "POST";
      form.style.display = "none";

      const actionInput = document.createElement("input");
      actionInput.name = "actionType";
      actionInput.value = "delete";
      form.appendChild(actionInput);

      const projectIdInput = document.createElement("input");
      projectIdInput.name = "projectId";
      projectIdInput.value = project.id;
      form.appendChild(projectIdInput);

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-foreground";
      case "in-progress":
        return "bg-accent/20 text-foreground";
      case "archived":
        return "bg-muted text-foreground";
      default:
        return "bg-muted text-foreground";
    }
  };

  if (isEditing) {
    return <ProjectForm project={project} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <div className="bg-card rounded-md p-6  border border-border/50">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-medium text-foreground mb-2">{project.title}</h3>
          {project.short_description && (
            <p className="text-muted-foreground mb-2">{project.short_description}</p>
          )}
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
              getStatusColor(project.status),
            )}
          >
            {project.status.replace("-", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setIsEditing(true)}
            variant="ghost"
            size="sm"
            className="p-2 text-muted-foreground hover:text-muted-foreground"
          >
            <PencilIcon className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            variant="ghost"
            size="sm"
            className="p-2 text-destructive/70 hover:text-destructive"
          >
            <TrashIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
          <p className="text-muted-foreground">{project.description}</p>
        </div>

        {technologies.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Technologies</h4>
            <div className="flex flex-wrap gap-2">
              {technologies.map((tech, index) => (
                <span
                  key={`${project.id}-tech-${index}`}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Created {new Date(project.createdat).toLocaleDateString()}
          {project.updatedat &&
            project.createdat !== project.updatedat &&
            `, updated ${new Date(project.updatedat).toLocaleDateString()}`}
        </div>
      </div>
    </div>
  );
}

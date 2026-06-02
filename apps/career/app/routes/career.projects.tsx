import {
  CheckIcon,
  ExternalLinkIcon,
  GithubIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { useLoaderData } from 'react-router'
import { Button } from '~/components/ui/button'
import type { Project } from '~/lib/db/schema'
import { createSuccessResponse, withAuthLoader } from '~/lib/route-utils'

interface ProjectSummary {
  totalProjects: number
  completedProjects: number
  inProgressProjects: number
  plannedProjects: number
  portfolioProjects: number
  workLinkedProjects: number
}

interface LoaderData {
  user: { id: string; email?: string | null; name?: string | null }
  projects: (Project & { workExperience?: { company: string; role: string } })[]
  summary: ProjectSummary
}

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    try {
      // For now, return empty data - we'll implement the queries later
      const projects: (Project & { workExperience?: { company: string; role: string } })[] = []
      const summary: ProjectSummary = {
        totalProjects: 0,
        completedProjects: 0,
        inProgressProjects: 0,
        plannedProjects: 0,
        portfolioProjects: 0,
        workLinkedProjects: 0,
      }

      return createSuccessResponse({
        user,
        projects,
        summary,
      })
    } catch (error) {
      console.error('Error loading projects:', error)
      throw new Response('Error loading projects', { status: 500 })
    }
  })
}

export async function action(args: ActionFunctionArgs) {
  return withAuthLoader(args, async ({ user, request }) => {
    const formData = await request.formData()
    const operation = formData.get('operation') as string

    try {
      if (operation === 'create') {
        // TODO: Implement project creation
        return createSuccessResponse({ success: true }, 'Project created successfully')
      }

      if (operation === 'update') {
        // TODO: Implement project update
        return createSuccessResponse({ success: true }, 'Project updated successfully')
      }

      if (operation === 'delete') {
        // TODO: Implement project deletion
        return createSuccessResponse({ success: true }, 'Project deleted successfully')
      }

      throw new Response('Invalid operation', { status: 400 })
    } catch (error) {
      console.error('Error handling project operation:', error)
      throw new Response('Error processing project request', { status: 500 })
    }
  })
}

export default function ProjectsPage() {
  const response = useLoaderData<{ success: boolean; data: LoaderData }>()
  const data = response?.data || {}
  const { projects, summary } = data

  const [showCreateForm, setShowCreateForm] = useState(false)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200/50 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-slate-900 font-serif">Project Portfolio</h1>
            <p className="text-lg text-slate-600 font-sans mt-2">
              Manage your portfolio projects and work-related projects
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2"
          >
            <PlusIcon className="size-4" />
            Add Project
          </Button>
        </div>
      </div>

      <div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-slate-900">{summary.totalProjects}</div>
            <div className="text-sm text-slate-600">Total Projects</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-green-600">{summary.completedProjects}</div>
            <div className="text-sm text-slate-600">Completed</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-blue-600">{summary.inProgressProjects}</div>
            <div className="text-sm text-slate-600">In Progress</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-amber-600">{summary.plannedProjects}</div>
            <div className="text-sm text-slate-600">Planned</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-purple-600">{summary.portfolioProjects}</div>
            <div className="text-sm text-slate-600">Portfolio</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-indigo-600">{summary.workLinkedProjects}</div>
            <div className="text-sm text-slate-600">Work-Linked</div>
          </div>
        </div>

        {/* Projects List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50">
          <div className="p-6 border-b border-slate-200/50">
            <h2 className="text-xl font-semibold text-slate-900">Your Projects</h2>
          </div>

          {projects.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-slate-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No projects yet</h3>
              <p className="text-slate-600 mb-6">
                Start building your project portfolio to showcase your work and skills.
              </p>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Your First Project
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block divide-y divide-slate-200/50">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>

              {/* Mobile List View */}
              <div className="md:hidden bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="divide-y divide-gray-200">
                  {projects.map((project) => (
                    <ProjectMobileCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Create Form Modal */}
        {showCreateForm && <CreateProjectModal onClose={() => setShowCreateForm(false)} />}
      </div>
    </div>
  )
}

interface ProjectCardProps {
  project: Project & { workExperience?: { company: string; role: string } }
}

function ProjectCard({ project }: ProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false)

  const statusColors = {
    planned: 'bg-amber-100 text-amber-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    on_hold: 'bg-gray-100 text-gray-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-slate-900">{project.title}</h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                statusColors[project.status as keyof typeof statusColors] ||
                'bg-gray-100 text-gray-800'
              }`}
            >
              {project.status.replace('_', ' ')}
            </span>
            {project.isFeatured && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                Featured
              </span>
            )}
          </div>

          {project.workExperience && (
            <p className="text-sm text-slate-500 mb-2">
              Work Project at {project.workExperience.company} ({project.workExperience.role})
            </p>
          )}

          <p className="text-slate-700 mb-3">{project.description}</p>

          {project.technologies && project.technologies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {project.technologies.map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded-md"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-slate-600">
            {project.startDate && (
              <span>Started: {new Date(project.startDate).toLocaleDateString()}</span>
            )}
            {project.endDate && (
              <span>Completed: {new Date(project.endDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {project.liveUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                project.liveUrl && window.open(project.liveUrl, '_blank', 'noopener,noreferrer')
              }
              className="text-slate-400 hover:text-slate-600"
            >
              <ExternalLinkIcon className="w-4 h-4" />
            </Button>
          )}
          {project.githubUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                project.githubUrl && window.open(project.githubUrl, '_blank', 'noopener,noreferrer')
              }
              className="text-slate-400 hover:text-slate-600"
            >
              <GithubIcon className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-slate-400 hover:text-slate-600"
          >
            <PencilIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600">
            <TrashIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ProjectMobileCard({ project }: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusColors = {
    planned: 'bg-amber-100 text-amber-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    on_hold: 'bg-gray-100 text-gray-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  const formatStatusText = (status: string) => {
    return status.replace('_', ' ').replace('-', ' ')
  }

  return (
    <div className="block">
      {/* Main list item - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 hover:bg-gray-50 transition-colors duration-200 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{project.title}</div>
            <div className="text-sm text-gray-500 truncate">
              {project.workExperience
                ? `${project.workExperience.company} (Work Project)`
                : 'Personal Project'}
            </div>
          </div>
          <div className="ml-4 flex items-center space-x-3">
            <span
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                statusColors[project.status as keyof typeof statusColors] ||
                'bg-gray-100 text-gray-800'
              }`}
            >
              {formatStatusText(project.status)}
            </span>
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
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

      {/* Expanded details - shown when expanded */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="pt-3 space-y-3">
            {project.description && <p className="text-sm text-gray-700">{project.description}</p>}

            {project.technologies && project.technologies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {project.technologies.slice(0, 6).map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md"
                  >
                    {tech}
                  </span>
                ))}
                {project.technologies.length > 6 && (
                  <span className="text-xs text-gray-500">
                    +{project.technologies.length - 6} more
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                {project.startDate && (
                  <span>Started: {new Date(project.startDate).toLocaleDateString()}</span>
                )}
                {project.endDate && (
                  <span className="ml-3">
                    Completed: {new Date(project.endDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {project.liveUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (project.liveUrl) {
                        window.open(project.liveUrl, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
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
                )}
                {project.githubUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (project.githubUrl) {
                        window.open(project.githubUrl, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
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
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface CreateProjectModalProps {
  onClose: () => void
}

function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Add Project</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <form className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="project-title"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Project Title *
              </label>
              <input
                id="project-title"
                type="text"
                name="title"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="E-commerce Platform"
              />
            </div>
            <div>
              <label
                htmlFor="project-status"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Status *
              </label>
              <select
                id="project-status"
                name="status"
                required
                defaultValue="planned"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Description *
            </label>
            <textarea
              id="project-description"
              name="description"
              required
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Describe your project, its goals, and key features..."
            />
          </div>

          <div>
            <label
              htmlFor="short-description"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Short Description
            </label>
            <input
              id="short-description"
              type="text"
              name="shortDescription"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="One-line summary for project cards"
            />
          </div>

          <div>
            <label htmlFor="technologies" className="block text-sm font-medium text-slate-700 mb-2">
              Technologies
            </label>
            <input
              id="technologies"
              type="text"
              name="technologies"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="React, Node.js, PostgreSQL (comma-separated)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="live-url" className="block text-sm font-medium text-slate-700 mb-2">
                Live URL
              </label>
              <input
                id="live-url"
                type="url"
                name="liveUrl"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="https://myproject.com"
              />
            </div>
            <div>
              <label htmlFor="github-url" className="block text-sm font-medium text-slate-700 mb-2">
                GitHub URL
              </label>
              <input
                id="github-url"
                type="url"
                name="githubUrl"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="https://github.com/user/project"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-slate-700 mb-2">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                name="startDate"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-slate-700 mb-2">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                name="endDate"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <input
                id="is-featured"
                type="checkbox"
                name="isFeatured"
                className="rounded border-slate-300 text-blue-600 focus:border-blue-500 focus:ring-blue-500"
              />
              <label htmlFor="is-featured" className="text-sm font-medium text-slate-700">
                Feature this project
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="is-visible"
                type="checkbox"
                name="isVisible"
                defaultChecked
                className="rounded border-slate-300 text-blue-600 focus:border-blue-500 focus:ring-blue-500"
              />
              <label htmlFor="is-visible" className="text-sm font-medium text-slate-700">
                Show in portfolio
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              <CheckIcon className="w-4 h-4 mr-2" />
              Add Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

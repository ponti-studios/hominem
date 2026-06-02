import { and, eq } from 'drizzle-orm'
import { FolderOpen, PlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SubmitHandler } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import type { ActionFunctionArgs, MetaFunction } from 'react-router'
import { useFetcher, useOutletContext } from 'react-router'
import { Button } from '~/components/ui/button'
import { db } from '~/lib/db'
import { projects, type NewProject, type Project } from '~/lib/db/schema'
import { useToast } from '../hooks/useToast'
import type { FullPortfolio } from '../lib/portfolio.server'
import {
  createErrorResponse,
  createSuccessResponse,
  parseFormData,
  tryAsync,
  withAuthAction,
} from '../lib/route-utils'
import { formatDateForInput, nullArrayToUndefined, stringToDate } from '../lib/utils'

export const meta: MetaFunction = () => [{ title: 'Projects - Portfolio Editor | Craftd' }]

interface ProjectFormValues {
  id?: string
  title: string
  description: string
  shortDescription?: string
  liveUrl?: string
  githubUrl?: string
  imageUrl?: string
  videoUrl?: string
  technologies?: string[]
  status?: string
  startDate?: string
  endDate?: string
  isFeatured?: boolean
  isVisible?: boolean
  sortOrder?: number
  portfolioId: string
}

interface ProjectsEditorSectionProps {
  projects?: Project[] | null
  portfolioId: string
}

function ProjectForm({
  project,
  portfolioId,
  onDelete,
}: {
  project?: Project
  portfolioId: string
  onDelete?: () => void
}) {
  const fetcher = useFetcher()
  const { addToast } = useToast()
  const isNew = !project?.id

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isValid },
  } = useForm<ProjectFormValues>({
    defaultValues: {
      id: project?.id,
      title: project?.title || '',
      description: project?.description || '',
      shortDescription: project?.shortDescription || '',
      liveUrl: project?.liveUrl || '',
      githubUrl: project?.githubUrl || '',
      imageUrl: project?.imageUrl || '',
      videoUrl: project?.videoUrl || '',
      technologies: nullArrayToUndefined(project?.technologies) || [],
      status: project?.status || 'completed',
      startDate: formatDateForInput(project?.startDate),
      endDate: formatDateForInput(project?.endDate),
      isFeatured: project?.isFeatured || false,
      isVisible: project?.isVisible !== false,
      sortOrder: project?.sortOrder || 0,
      portfolioId,
    },
    mode: 'onChange',
  })

  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as {
        success: boolean
        error?: string
        message?: string
        data?: Project
      }
      if (result.success) {
        addToast(result.message || 'Project saved successfully!', 'success')
        if (result.data && isNew) {
          // Reset form with the returned data (including new ID)
          reset({
            id: result.data.id,
            title: result.data.title || '',
            description: result.data.description || '',
            shortDescription: result.data.shortDescription || '',
            liveUrl: result.data.liveUrl || '',
            githubUrl: result.data.githubUrl || '',
            imageUrl: result.data.imageUrl || '',
            videoUrl: result.data.videoUrl || '',
            technologies: nullArrayToUndefined(result.data.technologies) || [],
            status: result.data.status || 'completed',
            startDate: formatDateForInput(result.data.startDate),
            endDate: formatDateForInput(result.data.endDate),
            isFeatured: result.data.isFeatured || false,
            isVisible: result.data.isVisible !== false,
            sortOrder: result.data.sortOrder || 0,
            portfolioId: result.data.portfolioId,
          })
        }
      } else {
        addToast(`Failed to save project: ${result.error || 'Unknown error'}`, 'error')
      }
    }
  }, [fetcher.state, fetcher.data, reset, addToast, isNew])

  const onSubmit: SubmitHandler<ProjectFormValues> = (formData) => {
    if (!isDirty && !isNew) {
      addToast('No changes to save.', 'info')
      return
    }

    if (!formData.title || !formData.description) {
      addToast('Please fill in all required fields.', 'error')
      return
    }

    const formDataToSubmit = new FormData()
    formDataToSubmit.append('operation', isNew ? 'create' : 'update')
    formDataToSubmit.append('projectData', JSON.stringify(formData))

    fetcher.submit(formDataToSubmit, {
      method: 'POST',
      action: '/editor/projects',
    })
  }

  const handleDelete = () => {
    if (!project?.id) return

    if (confirm('Are you sure you want to delete this project?')) {
      const formData = new FormData()
      formData.append('operation', 'delete')
      formData.append('id', project.id)
      formData.append('portfolioId', portfolioId)

      fetcher.submit(formData, {
        method: 'POST',
        action: '/editor/projects',
      })

      onDelete?.()
    }
  }

  const isSaving = fetcher.state === 'submitting'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card bg-muted/50 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">{isNew ? 'New Project' : 'Project'}</h3>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={isSaving || (!isDirty && !isNew) || !isValid}
            variant="primary"
            size="sm"
          >
            {isSaving ? 'Saving...' : isNew ? 'Add Project' : 'Save Changes'}
          </Button>
          {!isNew && (
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              variant="destructive"
              size="sm"
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor={`title-${project?.id || 'new'}`} className="label">
          Project Title *
        </label>
        <input
          id={`title-${project?.id || 'new'}`}
          type="text"
          {...register('title', { required: true })}
          className="input"
          placeholder="e.g., E-commerce Platform"
        />
      </div>

      <div className="form-group">
        <label htmlFor={`shortDescription-${project?.id || 'new'}`} className="label">
          Short Description
        </label>
        <input
          id={`shortDescription-${project?.id || 'new'}`}
          type="text"
          {...register('shortDescription')}
          className="input"
          placeholder="Brief one-line description"
        />
      </div>

      <div className="form-group">
        <label htmlFor={`description-${project?.id || 'new'}`} className="label">
          Full Description *
        </label>
        <textarea
          id={`description-${project?.id || 'new'}`}
          {...register('description', { required: true })}
          className="textarea"
          rows={4}
          placeholder="Detailed project description, features, and technologies used..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor={`liveUrl-${project?.id || 'new'}`} className="label">
            Live URL
          </label>
          <input
            id={`liveUrl-${project?.id || 'new'}`}
            type="url"
            {...register('liveUrl')}
            className="input"
            placeholder="https://example.com"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`githubUrl-${project?.id || 'new'}`} className="label">
            GitHub URL
          </label>
          <input
            id={`githubUrl-${project?.id || 'new'}`}
            type="url"
            {...register('githubUrl')}
            className="input"
            placeholder="https://github.com/user/repo"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor={`imageUrl-${project?.id || 'new'}`} className="label">
            Image URL
          </label>
          <input
            id={`imageUrl-${project?.id || 'new'}`}
            type="url"
            {...register('imageUrl')}
            className="input"
            placeholder="Project screenshot or image"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`videoUrl-${project?.id || 'new'}`} className="label">
            Video URL
          </label>
          <input
            id={`videoUrl-${project?.id || 'new'}`}
            type="url"
            {...register('videoUrl')}
            className="input"
            placeholder="Demo video URL"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor={`technologies-${project?.id || 'new'}`} className="label">
          Technologies
        </label>
        <input
          id={`technologies-${project?.id || 'new'}`}
          type="text"
          {...register('technologies')}
          className="input"
          placeholder="React, TypeScript, Node.js (comma-separated)"
        />
        <p className="text-xs text-muted-foreground mt-xs">
          Enter technologies separated by commas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="form-group">
          <label htmlFor={`status-${project?.id || 'new'}`} className="label">
            Status
          </label>
          <select id={`status-${project?.id || 'new'}`} {...register('status')} className="select">
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="planned">Planned</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor={`startDate-${project?.id || 'new'}`} className="label">
            Start Date
          </label>
          <input
            id={`startDate-${project?.id || 'new'}`}
            type="date"
            {...register('startDate')}
            className="input"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`endDate-${project?.id || 'new'}`} className="label">
            End Date
          </label>
          <input
            id={`endDate-${project?.id || 'new'}`}
            type="date"
            {...register('endDate')}
            className="input"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="form-group">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('isFeatured')} className="checkbox" />
            <span className="label">Featured Project</span>
          </label>
        </div>
        <div className="form-group">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('isVisible')} className="checkbox" />
            <span className="label">Visible</span>
          </label>
        </div>
      </div>
    </form>
  )
}

function ProjectsEditorSection({
  projects: initialProjects,
  portfolioId,
}: ProjectsEditorSectionProps) {
  const [showNewForm, setShowNewForm] = useState(false)
  const [projects, setProjects] = useState(initialProjects || [])

  // Update projects when initialProjects changes
  useEffect(() => {
    setProjects(initialProjects || [])
  }, [initialProjects])

  const handleAddNew = () => {
    setShowNewForm(true)
  }

  const handleDelete = (projectId: string) => {
    setProjects((prev) => prev.filter((project) => project.id !== projectId))
  }

  return (
    <section className="container flex flex-col gap-8 mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Projects</h2>
        </div>

        {!showNewForm && (
          <Button
            type="button"
            onClick={handleAddNew}
            variant="outline"
            className="inline-flex items-center gap-2 border-dashed"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:block">Add New Project</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-8">
        {/* Show new project form if requested */}
        {showNewForm && (
          <ProjectForm portfolioId={portfolioId} onDelete={() => setShowNewForm(false)} />
        )}

        {/* Existing projects */}
        {projects.map((project) => (
          <ProjectForm
            key={project.id}
            project={project}
            portfolioId={portfolioId}
            onDelete={() => handleDelete(project.id)}
          />
        ))}

        {projects.length === 0 && !showNewForm && (
          <div className="text-center py-2xl text-muted-foreground">
            No projects added yet. Click "Add New Project" to get started.
          </div>
        )}
      </div>
    </section>
  )
}

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData()
    const operation = formData.get('operation') as string

    switch (operation) {
      case 'create':
      case 'update': {
        const projectDataResult = parseFormData<ProjectFormValues>(formData, 'projectData')

        if ('success' in projectDataResult && !projectDataResult.success) {
          return projectDataResult
        }

        const projectData = projectDataResult as ProjectFormValues

        if (!projectData.portfolioId) {
          return createErrorResponse('Missing portfolioId')
        }

        return tryAsync(async () => {
          // Convert technologies string to array if needed
          const technologiesArray = Array.isArray(projectData.technologies)
            ? projectData.technologies
            : []

          if (operation === 'create') {
            // Insert new project
            const { id, ...insertData } = projectData

            // Convert date strings to Date objects for database
            const dbData = {
              ...insertData,
              technologies: technologiesArray,
              startDate: stringToDate(insertData.startDate),
              endDate: stringToDate(insertData.endDate),
            }

            const [newProject] = await db
              .insert(projects)
              .values(dbData as NewProject)
              .returning()

            return createSuccessResponse(newProject, 'Project created successfully')
          }

          // Update existing project
          const { id, ...updateData } = projectData
          if (!id) return createErrorResponse('Missing project ID for update')

          // Convert date strings to Date objects for database
          const dbData = {
            ...updateData,
            technologies: technologiesArray,
            startDate: stringToDate(updateData.startDate),
            endDate: stringToDate(updateData.endDate),
          }

          await db
            .update(projects)
            .set(dbData)
            .where(and(eq(projects.id, id), eq(projects.portfolioId, projectData.portfolioId)))

          return createSuccessResponse(null, 'Project updated successfully')
        }, `Failed to ${operation} project`)
      }

      case 'delete': {
        const id = formData.get('id') as string
        const portfolioId = formData.get('portfolioId') as string

        if (!id || !portfolioId) {
          return createErrorResponse('Missing required fields for deletion')
        }

        return tryAsync(async () => {
          await db
            .delete(projects)
            .where(and(eq(projects.id, id), eq(projects.portfolioId, portfolioId)))

          return createSuccessResponse(null, 'Project deleted successfully')
        }, 'Failed to delete project')
      }

      default:
        return createErrorResponse('Invalid operation')
    }
  })
}

export default function EditorProjects() {
  // Consume portfolio provided by parent editor layout loader via outlet context
  const portfolio = useOutletContext<FullPortfolio>()

  return <ProjectsEditorSection projects={portfolio.projects} portfolioId={portfolio.id} />
}

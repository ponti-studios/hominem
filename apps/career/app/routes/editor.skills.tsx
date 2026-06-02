import { and, eq, inArray } from 'drizzle-orm'
import { LoaderPinwheel, PlusIcon, XIcon, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { ActionFunctionArgs, MetaFunction } from 'react-router'
import { useFetcher, useOutletContext } from 'react-router'
import { Button } from '~/components/ui/button'
import { db } from '~/lib/db'
import { skills, type NewSkill } from '~/lib/db/schema'
import { useToast } from '../hooks/useToast'
import type { FullPortfolio } from '../lib/portfolio.server'
import {
  createErrorResponse,
  createSuccessResponse,
  parseFormData,
  tryAsync,
  withAuthAction,
} from '../lib/route-utils'

export const meta: MetaFunction = () => {
  return [{ title: 'Skills - Portfolio Editor | Craftd' }]
}

interface NewSkillForm {
  name: string
  category: string
  level: number
}

interface SkillsEditorSectionProps {
  skills?: NewSkill[] | null
  portfolioId: string
}

function SkillsEditorSection({ skills: initialSkills, portfolioId }: SkillsEditorSectionProps) {
  const [skills, setSkills] = useState<NewSkill[]>(initialSkills || [])
  const [isAddingSkill, setIsAddingSkill] = useState(false)
  const fetcher = useFetcher()
  const { addToast } = useToast()

  const {
    register: registerNewSkill,
    handleSubmit: handleNewSkillSubmit,
    reset: resetNewSkillForm,
  } = useForm<NewSkillForm>({
    defaultValues: {
      name: '',
      category: '',
      level: 50,
    },
  })

  useEffect(() => {
    setSkills(initialSkills || [])
  }, [initialSkills])

  // Group skills by category
  const skillsByCategory = skills.reduce(
    (acc, skill) => {
      const category = skill.category || 'Uncategorized'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(skill)
      return acc
    },
    {} as Record<string, NewSkill[]>
  )

  // Get existing categories for the dropdown
  const existingCategories = Array.from(new Set(skills.map((s) => s.category).filter(Boolean)))

  const saveSkills = (updatedSkills: NewSkill[]) => {
    // Only send the essential fields, let the database handle timestamps
    const skillsToSave = updatedSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      level: skill.level,
      portfolioId: skill.portfolioId,
    }))

    const formData = new FormData()
    formData.append('skillsData', JSON.stringify(skillsToSave))

    fetcher.submit(formData, {
      method: 'POST',
      action: '/editor/skills',
    })
  }

  // Handle fetcher errors
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const result = fetcher.data as { success: boolean; error?: string }
      if (!result.success) {
        addToast(`Failed to save skills: ${result.error || 'Unknown error'}`, 'error')
      }
    }
  }, [fetcher.state, fetcher.data, addToast])

  const handleRemoveSkill = (skillToRemove: NewSkill) => {
    const updatedSkills = skills.filter((skill) =>
      skill.id ? skill.id !== skillToRemove.id : skill !== skillToRemove
    )
    setSkills(updatedSkills)
    saveSkills(updatedSkills)
  }

  const handleAddSkill = (data: NewSkillForm) => {
    const newSkill: NewSkill = {
      name: data.name.trim(),
      category: data.category.trim() || null,
      level: data.level,
      portfolioId,
    }

    const updatedSkills = [...skills, newSkill]
    setSkills(updatedSkills)
    saveSkills(updatedSkills)
    resetNewSkillForm()
    setIsAddingSkill(false)
  }

  const getSkillLevelColor = (level: number) => {
    if (level >= 80) return 'bg-green-100 text-green-800 border-green-200'
    if (level >= 60) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (level >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const isSaving = fetcher.state === 'submitting'

  return (
    <section className="container flex flex-col gap-8 mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Skills</h2>
        </div>
        <div>
          {isSaving && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-center text-sm text-gray-600">
                <LoaderPinwheel className="size-4 animate-spin" />
                Saving changes...
              </div>
            </div>
          )}
          <Button
            type="button"
            onClick={() => setIsAddingSkill(true)}
            variant="outline"
            className="inline-flex items-center gap-2 border-dashed"
          >
            <PlusIcon className="size-4" />
            <span className="hidden sm:block">Add New Skill</span>
          </Button>
        </div>
      </div>
      {/* Add new skill section */}
      {isAddingSkill ? (
        <div className="card my-8 border border-dashed border-gray-400 py-2 px-4">
          <form onSubmit={handleNewSkillSubmit(handleAddSkill)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Skill Name *
                </label>
                <input
                  id="name"
                  {...registerNewSkill('name', { required: 'Skill name is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="e.g., React"
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  id="category"
                  {...registerNewSkill('category')}
                  list="existing-categories"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="e.g., Frontend"
                />
                <datalist id="existing-categories">
                  {existingCategories.map((category) => (
                    <option key={category} value={category || ''} />
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                  Level (1-100)
                </label>
                <input
                  id="level"
                  type="number"
                  min="1"
                  max="100"
                  {...registerNewSkill('level', {
                    valueAsNumber: true,
                    min: { value: 1, message: 'Level must be at least 1' },
                    max: { value: 100, message: 'Level cannot exceed 100' },
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="50"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                onClick={() => {
                  setIsAddingSkill(false)
                  resetNewSkillForm()
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Add Skill
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Skills grouped by category */}
      <div className="card space-y-6">
        {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
          <div key={category} className="space-y-3">
            <h3 className="text-lg font-medium text-gray-700 border-b border-gray-200 pb-2">
              {category}
            </h3>
            <div className="flex flex-wrap gap-2">
              {categorySkills.map((skill, index) => (
                <div
                  key={skill.id || `${category}-${index}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${getSkillLevelColor(skill.level || 50)}`}
                >
                  <span className="border-b border-gray-200">{skill.name}</span>
                  <span className="text-xs opacity-75">({skill.level || 50}%)</span>
                  <Button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    variant="ghost"
                    size="icon"
                    className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 h-6 w-6"
                    title="Remove skill"
                    aria-label="Remove skill"
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function EditorSkills() {
  // Use portfolio from parent editor layout via outlet context
  const portfolio = useOutletContext<FullPortfolio>()

  return (
    <div className="container mx-auto">
      <SkillsEditorSection skills={portfolio.skills} portfolioId={portfolio.id} />
    </div>
  )
}

export async function action(args: ActionFunctionArgs) {
  return withAuthAction(args, async ({ user }) => {
    const formData = await args.request.formData()
    type SkillInsert = typeof skills.$inferInsert
    const skillsDataResult = parseFormData<SkillInsert[]>(formData, 'skillsData')
    if ('success' in skillsDataResult && !skillsDataResult.success) {
      return skillsDataResult
    }
    let skillsData = skillsDataResult as SkillInsert[]
    if (!Array.isArray(skillsData)) {
      return createErrorResponse('Invalid skills data')
    }
    // Ensure all skills have portfolioId and level is a number
    const portfolioId = skillsData[0]?.portfolioId
    if (!portfolioId) return createErrorResponse('Missing portfolioId')
    skillsData = skillsData.map((s) => ({ ...s, portfolioId, level: Number(s.level) }))
    return tryAsync(async () => {
      // Fetch existing skills for this portfolio
      const existingSkills = await db
        .select({ id: skills.id })
        .from(skills)
        .where(eq(skills.portfolioId, portfolioId))
      const existingIds = (existingSkills || []).map((s) => s.id)
      const submittedIds = skillsData.filter((s) => s.id).map((s) => s.id)
      // Delete removed skills
      const idsToDelete = existingIds.filter((id: string) => !submittedIds.includes(id))
      if (idsToDelete.length > 0) {
        await db
          .delete(skills)
          .where(and(eq(skills.portfolioId, portfolioId), inArray(skills.id, idsToDelete)))
      }
      // Upsert (insert/update) all submitted skills
      for (const skill of skillsData) {
        if (skill.id) {
          // Update
          const { id, ...updateData } = skill
          await db
            .update(skills)
            .set(updateData)
            .where(and(eq(skills.id, id), eq(skills.portfolioId, portfolioId)))
        } else {
          // Insert
          await db.insert(skills).values({ ...skill, portfolioId })
        }
      }
      return createSuccessResponse(null, 'Skills saved successfully')
    }, 'Failed to save skills')
  })
}

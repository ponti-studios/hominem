import type { CareerSkillRecord } from '@hominem/db';
import { CareerRepository, db, runInTransaction } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { LoaderPinwheel, PlusIcon, XIcon, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useFetcher } from 'react-router';

import { cn } from '~/lib/utils';

import { FormErrorAlert } from '../components/FormErrorAlert';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { portfolioContext, userContext } from '../lib/middleware';
import { parseFormData } from '../lib/route-utils';
import { Route } from './+types/skills';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Skills | Craftd' }];
};

interface NewSkillForm {
  name: string;
  category: string;
  level: number;
}

type EditableSkill = Partial<CareerSkillRecord> & {
  name: string;
  level: number;
  portfolio_id: string;
};

interface SkillsEditorSectionProps {
  skills?: CareerSkillRecord[] | null;
  portfolio_id: string;
}

function SkillsEditorSection({ skills: initialSkills, portfolio_id }: SkillsEditorSectionProps) {
  const [skills, setSkills] = useState<EditableSkill[]>(initialSkills || []);
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const fetcher = useFetcher();

  const {
    register: registerNewSkill,
    handleSubmit: handleNewSkillSubmit,
    reset: resetNewSkillForm,
    formState: { errors: newSkillErrors },
  } = useForm<NewSkillForm>({
    defaultValues: {
      name: '',
      category: '',
      level: 50,
    },
  });

  useEffect(() => {
    setSkills(initialSkills || []);
  }, [initialSkills]);

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission({
    fetcher,
    errorMessage: 'We couldn’t save your skills. Try again.',
  });

  // Group skills by category
  const skillsByCategory = skills.reduce(
    (acc, skill) => {
      const category = skill.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(skill);
      return acc;
    },
    {} as Record<string, EditableSkill[]>,
  );

  // Get existing categories for the dropdown
  const existingCategories = Array.from(new Set(skills.map((s) => s.category).filter(Boolean)));

  const saveSkills = (updatedSkills: EditableSkill[]) => {
    // Only send the essential fields, let the database handle timestamps
    const skillsToSave = updatedSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      level: skill.level,
      portfolio_id: skill.portfolio_id,
    }));

    const formData = new FormData();
    formData.append('skillsData', JSON.stringify(skillsToSave));

    clearSubmissionError();
    fetcher.submit(formData, {
      method: 'POST',
      action: '/skills',
    });
  };

  const handleRemoveSkill = (skillToRemove: EditableSkill) => {
    const updatedSkills = skills.filter((skill) =>
      skill.id ? skill.id !== skillToRemove.id : skill !== skillToRemove,
    );
    setSkills(updatedSkills);
    saveSkills(updatedSkills);
  };

  const handleAddSkill = (data: NewSkillForm) => {
    const newSkill: EditableSkill = {
      name: data.name.trim(),
      category: data.category.trim() || null,
      level: data.level,
      portfolio_id,
      is_visible: true,
      sort_order: skills.length,
    };

    const updatedSkills = [...skills, newSkill];
    setSkills(updatedSkills);
    saveSkills(updatedSkills);
    resetNewSkillForm();
    setIsAddingSkill(false);
  };

  const getSkillLevelColor = (level: number) => {
    if (level >= 80) return 'bg-success/10 text-foreground border-success/30';
    if (level >= 60) return 'bg-accent/20 text-foreground border-accent/30';
    if (level >= 40) return 'bg-warning/10 text-foreground border-warning/30';
    return 'bg-muted text-foreground border-border';
  };

  const isSaving = fetcher.state === 'submitting';

  return (
    <section className="container flex flex-col gap-8 mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Skills</h2>
        </div>
        <div>
          {isSaving && (
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-center text-sm text-muted-foreground">
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
      <FormErrorAlert title="Skills weren’t saved" message={submissionError} />
      {/* Add new skill section */}
      {isAddingSkill ? (
        <div className="rounded-md border border-border bg-card p-4 my-8 border border-dashed border-border py-2 px-4">
          <form onSubmit={handleNewSkillSubmit(handleAddSkill)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-muted-foreground mb-1"
                >
                  Skill Name *
                </label>
                <input
                  id="name"
                  {...registerNewSkill('name', { required: 'Skill name is required' })}
                  aria-describedby={newSkillErrors.name ? 'new-skill-name-error' : undefined}
                  aria-invalid={newSkillErrors.name ? true : undefined}
                  className="w-full px-3 py-2 border border-border rounded-md  focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring text-sm"
                  placeholder="e.g., React"
                />
                {newSkillErrors.name ? (
                  <p id="new-skill-name-error" role="alert" className="text-xs text-destructive">
                    {newSkillErrors.name.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium text-muted-foreground mb-1"
                >
                  Category
                </label>
                <input
                  id="category"
                  {...registerNewSkill('category')}
                  list="existing-categories"
                  className="w-full px-3 py-2 border border-border rounded-md  focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring text-sm"
                  placeholder="e.g., Frontend"
                />
                <datalist id="existing-categories">
                  {existingCategories.map((category) => (
                    <option key={category} value={category || ''} />
                  ))}
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="level"
                  className="block text-sm font-medium text-muted-foreground mb-1"
                >
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
                  aria-describedby={newSkillErrors.level ? 'new-skill-level-error' : undefined}
                  aria-invalid={newSkillErrors.level ? true : undefined}
                  className="w-full px-3 py-2 border border-border rounded-md  focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring text-sm"
                  placeholder="50"
                />
                {newSkillErrors.level ? (
                  <p id="new-skill-level-error" role="alert" className="text-xs text-destructive">
                    {newSkillErrors.level.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                onClick={() => {
                  setIsAddingSkill(false);
                  resetNewSkillForm();
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button type="submit" variant="default">
                Add Skill
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Skills grouped by category */}
      <div className="rounded-md border border-border bg-card p-4 space-y-6">
        {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
          <div key={category} className="space-y-3">
            <h3 className="text-lg font-medium text-muted-foreground border-b border-border pb-2">
              {category}
            </h3>
            <div className="flex flex-wrap gap-2">
              {categorySkills.map((skill, index) => (
                <div
                  key={skill.id || `${category}-${index}`}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors',
                    getSkillLevelColor(skill.level || 50),
                  )}
                >
                  <span className="border-b border-border">{skill.name}</span>
                  <span className="text-xs opacity-75">({skill.level || 50}%)</span>
                  <Button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    variant="ghost"
                    size="icon"
                    className="ml-1 hover:bg-muted rounded-full p-0.5 h-6 w-6"
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
  );
}

export async function loader({ context }: Route.LoaderArgs) {
  const portfolio = context.get(portfolioContext)!;
  const skills = await db
    .selectFrom('app.skills')
    .selectAll()
    .where('portfolio_id', '=', portfolio.id)
    .orderBy('sort_order', 'asc')
    .execute();
  return { skills, portfolio_id: portfolio.id };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  if (!user) {
    return { success: false, error: 'Sign in again before saving your skills.' };
  }
  const formData = await request.formData();
  const skillsDataResult = parseFormData<
    Array<{
      id?: string;
      name: string;
      category?: string | null;
      level: number;
      portfolio_id: string;
    }>
  >(formData, 'skillsData');
  if ('success' in skillsDataResult && !skillsDataResult.success) {
    return { success: false, error: 'Your skills couldn’t be read. Refresh and try again.' };
  }
  let skillsData = skillsDataResult as Array<{
    id?: string;
    name: string;
    category?: string | null;
    level: number;
    portfolio_id: string;
  }>;
  if (!Array.isArray(skillsData)) {
    return { success: false, error: 'Your skills couldn’t be read. Refresh and try again.' };
  }
  // Ensure all skills have portfolio_id and level is a number
  const portfolio_id = skillsData[0]?.portfolio_id;
  if (!portfolio_id) {
    return { success: false, error: 'Choose a portfolio before saving your skills.' };
  }
  skillsData = skillsData.map((s) => ({ ...s, portfolio_id, level: Number(s.level) }));
  try {
    await runInTransaction((tx) =>
      CareerRepository.replaceSkills(
        tx,
        user.id,
        portfolio_id,
        skillsData.map((skill) => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          level: Number(skill.level),
        })),
      ),
    );
    return { success: true, message: 'Skills saved successfully' };
  } catch (error) {
    console.error('Failed to save skills:', error);
    return { success: false, error: 'We couldn’t save your skills. Try again.' };
  }
}

export default function Skills({ loaderData }: Route.ComponentProps) {
  return (
    <div className="container mx-auto">
      <SkillsEditorSection skills={loaderData.skills} portfolio_id={loaderData.portfolio_id} />
    </div>
  );
}

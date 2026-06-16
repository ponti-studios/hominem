import type { CareerSkillRecord } from '@hominem/db';
import { CareerRepository, db, runInTransaction } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { LoaderPinwheel, Sparkles, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';

import { cn } from '~/lib/utils';

import { FormErrorAlert } from '../components/FormErrorAlert';
import { useCareerEditorSubmission } from '../hooks/useCareerEditorSubmission';
import { portfolioContext, userContext } from '../lib/middleware';
import { Route } from './+types/skills';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Skills | Craftd' }];
};

type EditableSkill = Partial<CareerSkillRecord> & {
  name: string;
  level: number;
  portfolio_id: string;
  proof?: string | null;
  ai_derived?: boolean;
};

interface SkillsEditorSectionProps {
  skills?: CareerSkillRecord[] | null;
  portfolio_id: string;
}

function SkillsEditorSection({ skills: initialSkills, portfolio_id }: SkillsEditorSectionProps) {
  const [skills, setSkills] = useState<EditableSkill[]>(initialSkills || []);
  const saveFetcher = useFetcher();
  const deriveFetcher = useFetcher<{
    success: boolean;
    skills?: EditableSkill[];
    error?: string;
  }>();

  const { submissionError, clearSubmissionError } = useCareerEditorSubmission({
    fetcher: saveFetcher,
    errorMessage: "We couldn't save your skills. Try again.",
  });

  useEffect(() => {
    setSkills(initialSkills || []);
  }, [initialSkills]);

  // When derivation completes successfully, update local state
  useEffect(() => {
    if (deriveFetcher.data?.success && deriveFetcher.data.skills) {
      setSkills(deriveFetcher.data.skills as EditableSkill[]);
    }
  }, [deriveFetcher.data]);

  const skillsByCategory = skills.reduce(
    (acc, skill) => {
      const category = skill.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(skill);
      return acc;
    },
    {} as Record<string, EditableSkill[]>,
  );

  const saveSkills = (updatedSkills: EditableSkill[]) => {
    const formData = new FormData();
    formData.append(
      'skillsData',
      JSON.stringify(
        updatedSkills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          level: skill.level,
          portfolio_id: skill.portfolio_id,
        })),
      ),
    );
    clearSubmissionError();
    saveFetcher.submit(formData, { method: 'POST', action: '/skills' });
  };

  const handleRemoveSkill = (skillToRemove: EditableSkill) => {
    const updated = skills.filter((s) => (s.id ? s.id !== skillToRemove.id : s !== skillToRemove));
    setSkills(updated);
    saveSkills(updated);
  };

  const getSkillLevelColor = (level: number) => {
    if (level >= 80) return 'bg-success/10 text-foreground border-success/30';
    if (level >= 60) return 'bg-accent/20 text-foreground border-accent/30';
    if (level >= 40) return 'bg-warning/10 text-foreground border-warning/30';
    return 'bg-muted text-foreground border-border';
  };

  const isSaving = saveFetcher.state === 'submitting';
  const isDeriving = deriveFetcher.state === 'submitting';
  const deriveError = deriveFetcher.data?.success === false ? deriveFetcher.data.error : null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="heading-2 text-foreground">Skills</h2>
        <deriveFetcher.Form method="POST" action="/api/skills/derive">
          <Button
            type="submit"
            variant="outline"
            size="icon"
            disabled={isDeriving}
            aria-label={isDeriving ? 'Deriving skills' : skills.length > 0 ? 'Re-derive skills' : 'Derive skills'}
          >
            {isDeriving ? (
              <LoaderPinwheel className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
          </Button>
        </deriveFetcher.Form>
      </div>

      <FormErrorAlert title="Skills weren't saved" message={submissionError} />
      <FormErrorAlert title="Couldn't derive skills" message={deriveError} />

      {isSaving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderPinwheel className="size-4 animate-spin" />
          Saving changes…
        </div>
      )}

      {skills.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-12 text-center">
          <Sparkles className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="font-medium text-foreground">No skills yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Derive my skills" to automatically extract skills from your work history and
            projects. Each skill will include proof of where you demonstrated it.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
            <div key={category} className="rounded-md border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2">
                {category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {categorySkills.map((skill, index) => (
                  <div
                    key={skill.id || `${category}-${index}`}
                    className={cn(
                      'group relative inline-flex flex-col gap-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                      getSkillLevelColor(skill.level || 50),
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span>{skill.name}</span>
                      <span className="text-xs opacity-60">{skill.level || 50}%</span>
                      <Button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        variant="ghost"
                        size="icon"
                        className="ml-1 h-5 w-5 rounded-full p-0.5 opacity-0 transition-opacity"
                        title="Remove skill"
                        aria-label="Remove skill"
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </div>
                    {skill.proof ? (
                      <p className="text-xs font-normal opacity-70 max-w-xs">{skill.proof}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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
  const raw = formData.get('skillsData');
  if (typeof raw !== 'string') {
    return { success: false, error: "Your skills couldn't be read. Refresh and try again." };
  }

  let skillsData: Array<{
    id?: string;
    name: string;
    category?: string | null;
    level: number;
    portfolio_id: string;
  }>;

  try {
    skillsData = JSON.parse(raw);
  } catch {
    return { success: false, error: "Your skills couldn't be read. Refresh and try again." };
  }

  if (!Array.isArray(skillsData)) {
    return { success: false, error: "Your skills couldn't be read. Refresh and try again." };
  }

  const portfolio_id = skillsData[0]?.portfolio_id;
  if (!portfolio_id) {
    return { success: false, error: 'Choose a portfolio before saving your skills.' };
  }

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
    return { success: true };
  } catch (error) {
    console.error('Failed to save skills:', error);
    return { success: false, error: "We couldn't save your skills. Try again." };
  }
}

export default function Skills({ loaderData }: Route.ComponentProps) {
  return (
    <div className="container mx-auto">
      <SkillsEditorSection skills={loaderData.skills} portfolio_id={loaderData.portfolio_id} />
    </div>
  );
}

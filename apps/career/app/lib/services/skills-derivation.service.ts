import { createChatCompletion, getChatCompletionText } from '@hominem/ai';
import { CareerRepository, db } from '@hominem/db';
import { z } from 'zod';

const derivedSkillSchema = z.object({
  name: z.string(),
  level: z.number().min(1).max(100),
  category: z.enum(['technical', 'leadership', 'product', 'design', 'data', 'other']),
  proof: z.string(),
});

const derivedSkillsSchema = z.array(derivedSkillSchema);

export type DerivedSkill = z.infer<typeof derivedSkillSchema>;

const SYSTEM_PROMPT = `You are a career analyst. Given a person's work history and projects, extract a list of concrete, demonstrable skills.

For each skill return:
- name: the skill name (e.g. "TypeScript", "System Design", "Team Leadership")
- level: 1–100 proficiency estimate based on depth and duration of evidence (80+ = expert, 60–79 = proficient, 40–59 = competent, below 40 = familiar)
- category: one of "technical", "leadership", "product", "design", "data", "other"
- proof: one sentence citing the specific role or project that demonstrates this skill (e.g. "Used for 3 years at Kensho building distributed data ingestion pipelines as Staff Engineer.")

Rules:
- Only include skills directly evident from the provided history. Do not invent.
- Prefer specific, credible skills over generic ones ("React" over "Frontend Development").
- Deduplicate — if the same skill appears across multiple roles, pick the best proof and set level accordingly.
- Return 10–30 skills. Aim for breadth across technical, leadership, and domain skills where evidence exists.
- Return a valid JSON array only, no markdown, no explanation.`;

export async function deriveSkillsFromCareerHistory(
  owner_userid: string,
  portfolio_id: string,
): Promise<DerivedSkill[]> {
  const [workExperiences, projects] = await Promise.all([
    CareerRepository.listUserWorkExperiences(db, owner_userid),
    CareerRepository.listProjectsByPortfolio(db, portfolio_id),
  ]);

  if (workExperiences.length === 0 && projects.length === 0) {
    return [];
  }

  const workSection =
    workExperiences.length > 0
      ? workExperiences
          .map((exp) => {
            const dates = [exp.start_date, exp.end_date ?? 'present'].filter(Boolean).join(' – ');
            return `Role: ${exp.role} at ${exp.company} (${dates})\nDescription: ${exp.description ?? 'N/A'}`;
          })
          .join('\n\n')
      : 'No work experience provided.';

  const projectSection =
    projects.length > 0
      ? projects
          .map((p) => {
            const tags = Array.isArray(p.technologies)
              ? (p.technologies as string[]).join(', ')
              : '';
            return `Project: ${p.title}\nDescription: ${p.description ?? 'N/A'}${tags ? `\nTechnologies: ${tags}` : ''}`;
          })
          .join('\n\n')
      : 'No projects provided.';

  const userMessage = `Work History:\n${workSection}\n\nProjects:\n${projectSection}`;

  const result = await createChatCompletion({
    responseFormat: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });

  const raw = getChatCompletionText(result);
  const parsed = JSON.parse(raw);

  // The model may return { skills: [...] } or a bare array
  const arr = Array.isArray(parsed) ? parsed : (parsed.skills ?? []);
  return derivedSkillsSchema.parse(arr);
}

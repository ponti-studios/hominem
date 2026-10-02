import { resumeSchema, type ConvertedResumeData } from '@hominem/career-services/types';
import { ProjectRepository, SkillRepository, SocialLinksRepository } from '@hominem/db/career';
import { CareerRepository } from '@hominem/db/career';
import { runInTransaction, type TransactionHandle } from '@hominem/db/transaction';
import {
  getJobStatus,
  removeJobFromQueue,
  type ResumeAnalysisJob,
  type ResumeListItemChange,
} from '@hominem/queues';
import { z } from 'zod';

import { logger } from '~/lib/logger';

import type { AccountActionResult, AccountPageUser } from './types';

// The diff payloads travel through the job store untyped, so re-validate them against the
// same resume schema that produced them before turning them into rows.
const workExperiencePayloadSchema = resumeSchema.shape.workExperience.unwrap().element;
const skillPayloadSchema = resumeSchema.shape.skills.unwrap().element;
const projectPayloadSchema = resumeSchema.shape.projects.unwrap().element;

const basicsPatchSchema = z
  .object({
    headline: z.string().nullable(),
    summary: z.string().nullable(),
    tagline: z.string().nullable(),
    location: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    initials: z.string().nullable(),
    availabilityStatus: z.boolean(),
    openToRemote: z.boolean(),
  })
  .partial();

const socialPatchSchema = z
  .object({
    github: z.string().nullable(),
    linkedin: z.string().nullable(),
    twitter: z.string().nullable(),
    website: z.string().nullable(),
  })
  .partial();

function mapWorkExperiencePayload(payload: ConvertedResumeData['workExperience'][number]) {
  return {
    company: payload.company,
    title: payload.role,
    description: payload.description,
    startDate: payload.start_date ?? null,
    endDate: payload.end_date ?? null,
  };
}

function mapSkillPayload(payload: ConvertedResumeData['skills'][number]) {
  return {
    name: payload.name,
    level: payload.level,
    category: payload.category ?? null,
    description: payload.description ?? null,
    yearsOfExperience: payload.years_of_experience ?? null,
    sortOrder: 0,
  };
}

function mapProjectPayload(payload: ConvertedResumeData['projects'][number]) {
  return {
    title: payload.title,
    description: payload.description,
    shortDescription: payload.short_description ?? null,
    liveUrl: payload.live_url ?? null,
    githubUrl: payload.github_url ?? null,
    technologies: payload.technologies,
    status:
      payload.status === 'in-progress'
        ? ('IN_PROGRESS' as const)
        : payload.status === 'completed'
          ? ('DONE' as const)
          : ('CANCELED' as const),
    isVisible: true,
    isFeatured: false,
    sortOrder: 0,
  };
}

async function applySelectedListItems(
  tx: TransactionHandle,
  ownerUserId: string,
  items: ResumeListItemChange[],
) {
  for (const item of items) {
    if (item.group === 'workExperience') {
      await CareerRepository.createEngagement(
        tx,
        ownerUserId,
        mapWorkExperiencePayload(workExperiencePayloadSchema.parse(item.payload)),
      );
    } else if (item.group === 'skills') {
      await SkillRepository.create(
        tx,
        ownerUserId,
        mapSkillPayload(skillPayloadSchema.parse(item.payload)),
      );
    } else {
      await ProjectRepository.create(
        tx,
        ownerUserId,
        mapProjectPayload(projectPayloadSchema.parse(item.payload)),
      );
    }
  }
}

// Only applies the changes the user checked off. We don't trust any diff
// content sent from the client — just which keys were selected; the actual
// values always come from the job record the worker computed.
export async function handleApplyResumeImportAction({
  formData,
  user,
}: {
  formData: FormData;
  user: AccountPageUser;
}): Promise<AccountActionResult<{ profileId: string }>> {
  const jobId = formData.get('jobId');
  if (typeof jobId !== 'string' || !jobId) {
    return { success: false, error: 'Missing resume analysis job.' };
  }

  const selectedScalarKeys = new Set(formData.getAll('scalarField').map(String));
  const selectedListKeys = new Set(formData.getAll('listKey').map(String));

  const job = await getJobStatus<ResumeAnalysisJob>(jobId);
  if (!job || job.userId !== user.id) {
    return { success: false, error: 'Resume analysis job not found.' };
  }
  if (job.status !== 'done' || !job.diff) {
    return { success: false, error: 'Resume analysis is not complete yet.' };
  }

  const scalarToApply = job.diff.scalarChanges.filter((change) =>
    selectedScalarKeys.has(`${change.group}.${change.field}`),
  );
  const listToApply = job.diff.listChanges.filter((item) => selectedListKeys.has(item.key));

  if (scalarToApply.length === 0 && listToApply.length === 0) {
    return { success: false, error: 'Select at least one change to apply.' };
  }

  try {
    const profileId = await runInTransaction(async (tx) => {
      const basicsPatch = basicsPatchSchema.parse(
        Object.fromEntries(
          scalarToApply
            .filter((change) => change.group === 'basics')
            .map((change) => [change.field, change.proposed]),
        ),
      );
      if (Object.keys(basicsPatch).length > 0) {
        await CareerRepository.saveProfile(tx, user.id, basicsPatch);
      }

      const socialPatch = socialPatchSchema.parse(
        Object.fromEntries(
          scalarToApply
            .filter((change) => change.group === 'social')
            .map((change) => [change.field, change.proposed]),
        ),
      );
      if (Object.keys(socialPatch).length > 0) {
        const existingSocial = await SocialLinksRepository.get(tx, user.id);
        await SocialLinksRepository.save(tx, user.id, {
          github: existingSocial?.github ?? null,
          linkedin: existingSocial?.linkedin ?? null,
          twitter: existingSocial?.twitter ?? null,
          website: existingSocial?.website ?? null,
          ...socialPatch,
        });
      }

      await applySelectedListItems(tx, user.id, listToApply);

      const profile = await CareerRepository.getProfile(tx, user.id);
      if (!profile) throw new Error('Profile not found after applying resume changes.');
      return profile.id;
    });

    await removeJobFromQueue(jobId, user.id);

    return {
      success: true,
      message: 'Resume changes applied.',
      data: { profileId },
    };
  } catch (error) {
    logger.error('Failed to apply resume import', error, { owner_userid: user.id, jobId });
    return { success: false, error: "We couldn't apply those changes. Try again." };
  }
}

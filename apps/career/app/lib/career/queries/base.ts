import type { UpdateWorkExperienceInput } from '@hominem/db';
import { db, WorkExperienceRepository } from '@hominem/db';

export async function getUserWorkExperiencesDesc(ownerUserid: string) {
  return WorkExperienceRepository.listUserWorkExperiences(db, ownerUserid, 'desc');
}

export async function getWorkExperienceById(ownerUserid: string, experienceId: string) {
  return WorkExperienceRepository.getWorkExperienceById(db, ownerUserid, experienceId);
}

export async function updateWorkExperience(
  ownerUserid: string,
  experienceId: string,
  updates: UpdateWorkExperienceInput,
) {
  return WorkExperienceRepository.updateWorkExperience(db, {
    ownerUserid,
    experienceId,
    updates,
  });
}

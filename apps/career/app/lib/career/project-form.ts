export interface ProjectMutationValues {
  id?: string;
  title: string;
  description: string;
  shortDescription?: string | null;
  liveUrl?: string | null;
  githubUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  technologies?: string[];
  status?: string;
  startDate?: string;
  endDate?: string;
  isFeatured?: boolean;
  isVisible?: boolean;
  sortOrder?: number;
  portfolioId: string;
  workExperienceId?: string | null;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeProjectMutationValues(
  values: ProjectMutationValues,
): ProjectMutationValues {
  return {
    ...values,
    title: values.title.trim(),
    description: values.description.trim(),
    shortDescription: normalizeOptionalText(values.shortDescription),
    liveUrl: normalizeOptionalText(values.liveUrl),
    githubUrl: normalizeOptionalText(values.githubUrl),
    imageUrl: normalizeOptionalText(values.imageUrl),
    videoUrl: normalizeOptionalText(values.videoUrl),
    technologies: (values.technologies ?? []).map((item) => item.trim()).filter(Boolean),
    workExperienceId: values.workExperienceId || null,
  };
}

export interface ProjectMutationValues {
  id?: string;
  title: string;
  description: string;
  short_description?: string | null;
  live_url?: string | null;
  github_url?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  technologies?: string[];
  status?: string;
  start_date?: string;
  end_date?: string;
  is_featured?: boolean;
  is_visible?: boolean;
  sort_order?: number;
  portfolio_id: string;
  work_experience_id?: string | null;
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
    short_description: normalizeOptionalText(values.short_description),
    live_url: normalizeOptionalText(values.live_url),
    github_url: normalizeOptionalText(values.github_url),
    image_url: normalizeOptionalText(values.image_url),
    video_url: normalizeOptionalText(values.video_url),
    technologies: (values.technologies ?? []).map((item) => item.trim()).filter(Boolean),
    work_experience_id: values.work_experience_id || null,
  };
}

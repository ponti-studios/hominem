export interface TestimonialMutationValues {
  id?: string;
  name: string;
  title?: string | null;
  content: string;
  company?: string | null;
  rating?: number | null;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioId: string;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeTestimonialMutationValues(
  values: TestimonialMutationValues,
): TestimonialMutationValues {
  return {
    ...values,
    name: values.name.trim(),
    content: values.content.trim(),
    title: normalizeOptionalText(values.title),
    company: normalizeOptionalText(values.company),
    avatarUrl: normalizeOptionalText(values.avatarUrl),
    linkedinUrl: normalizeOptionalText(values.linkedinUrl),
  };
}

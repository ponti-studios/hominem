import * as z from 'zod';

export const careerPortfolioSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  title: z.string(),
  bio: z.string(),
  tagline: z.string(),
  currentLocation: z.string(),
  email: z.string().email(),
  isPublic: z.boolean(),
  profileImageUrl: z.string().nullable(),
  workExperiences: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      company: z.string(),
      description: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      isVisible: z.boolean(),
    }),
  ),
  skills: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string().nullable(),
      isVisible: z.boolean(),
    }),
  ),
});

export const careerExperiencesQuerySchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export const careerExperiencesSchema = z.object({
  experiences: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      company: z.string(),
      description: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      employmentType: z.string(),
      workArrangement: z.string(),
      isVisible: z.boolean(),
    }),
  ),
});

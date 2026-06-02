import { z } from 'zod'

export const resumeSchema = z.object({
  portfolio: z.object({
    slug: z.string(),
    title: z.string(),
    name: z.string(),
    initials: z.string().optional().nullable(),
    jobTitle: z.string(),
    bio: z.string(),
    tagline: z.string(),
    currentLocation: z.string(),
    locationTagline: z.string().optional().nullable(),
    email: z.string().email(),
    phone: z.string().optional().nullable(),
    availabilityStatus: z.boolean(),
    availabilityMessage: z.string().optional().nullable(),
    isPublic: z.boolean(),
    isActive: z.boolean(),
  }),
  socialLinks: z
    .object({
      github: z.string().optional().nullable(),
      linkedin: z.string().optional().nullable(),
      twitter: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  workExperience: z.array(
    z.object({
      company: z.string(),
      description: z.string(),
      role: z.string(),
      startDate: z.string().optional().nullable(),
      endDate: z.string().optional().nullable(),
    })
  ),
  skills: z.array(
    z.object({
      name: z.string(),
      level: z.number().min(1).max(100),
      category: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      yearsOfExperience: z.number().optional().nullable(),
      certifications: z.array(z.string()),
    })
  ),
  projects: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      shortDescription: z.string().optional().nullable(),
      technologies: z.array(z.string()),
      liveUrl: z.string().optional().nullable(),
      githubUrl: z.string().optional().nullable(),
      status: z.enum(['in-progress', 'completed', 'archived']),
    })
  ),
  stats: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    })
  ),
})

export type ConvertedResumeData = z.infer<typeof resumeSchema>

export type UploadResumeResponse =
  | {
      success: true
      message: string
      data: ConvertedResumeData
      saved: true
      portfolioId: string
      fileUrl: string
    }
  | { success: false; error: string }

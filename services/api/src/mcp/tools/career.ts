import { z } from 'zod';

import {
  addCareerWishlistCompany,
  addCareerApplicationFile,
  addCareerApplicationNote,
  createCareerApplication,
  createCareerCertification,
  createCareerEducation,
  createCareerEngagement,
  createCareerProject,
  createCareerSkill,
  createCareerTestimonial,
  getCareerApplicationDetail,
  getCareerProfile,
  getCareerSocialLinks,
  listCareerApplications,
  listCareerApplicationFiles,
  listCareerApplicationNotes,
  listCareerCertifications,
  listCareerEducation,
  listCareerEngagements,
  listCareerProjects,
  listCareerSkills,
  listCareerTestimonials,
  listCareerWishlistCompanies,
  removeCareerApplication,
  removeCareerApplicationFile,
  removeCareerApplicationNote,
  removeCareerCertification,
  removeCareerEducation,
  removeCareerSkill,
  removeCareerTestimonial,
  removeCareerEngagement,
  removeCareerProject,
  removeCareerWishlistCompany,
  updateCareerEngagement,
  updateCareerProfile,
  updateCareerProject,
  updateCareerWishlistCompany,
  updateCareerApplication,
  updateCareerCertification,
  updateCareerEducation,
  updateCareerSkill,
  updateCareerTestimonial,
  saveCareerSocialLinks,
} from '../../application/career.service';
import {
  careerApplicationCreateOutputSchema,
  careerApplicationCreateSchema,
  careerApplicationDeleteSchema,
  careerApplicationDetailSchema,
  careerApplicationFileAddOutputSchema,
  careerApplicationFileAddSchema,
  careerApplicationFileRemoveSchema,
  careerApplicationNoteAddOutputSchema,
  careerApplicationNoteAddSchema,
  careerApplicationNoteRemoveSchema,
  careerApplicationsQuerySchema,
  careerApplicationsSchema,
  careerApplicationUpdateOutputSchema,
  careerApplicationUpdateSchema,
  careerCertificationCreateOutputSchema,
  careerCertificationCreateSchema,
  careerCertificationDeleteSchema,
  careerCertificationsSchema,
  careerCertificationUpdateOutputSchema,
  careerCertificationUpdateSchema,
  careerEducationCreateOutputSchema,
  careerEducationCreateSchema,
  careerEducationDeleteSchema,
  careerEducationSchema,
  careerEducationUpdateOutputSchema,
  careerEducationUpdateSchema,
  careerEngagementCreateOutputSchema,
  careerEngagementCreateSchema,
  careerEngagementDeleteSchema,
  careerEngagementsQuerySchema,
  careerEngagementsSchema,
  careerProfileOutputSchema,
  careerEngagementUpdateOutputSchema,
  careerEngagementUpdateSchema,
  careerMcpProfileSchema,
  careerProfileUpdateOutputSchema,
  careerProfileUpdateSchema,
  careerProjectCreateOutputSchema,
  careerProjectCreateSchema,
  careerProjectDeleteSchema,
  careerProjectsSchema,
  careerProjectUpdateOutputSchema,
  careerProjectUpdateSchema,
  careerSkillCreateOutputSchema,
  careerSkillCreateSchema,
  careerSkillDeleteSchema,
  careerSkillsSchema,
  careerSkillUpdateOutputSchema,
  careerSkillUpdateSchema,
  careerSocialLinksSaveOutputSchema,
  careerSocialLinksSaveSchema,
  careerSocialLinksSchema,
  careerTestimonialCreateOutputSchema,
  careerTestimonialCreateSchema,
  careerTestimonialDeleteSchema,
  careerTestimonialsSchema,
  careerTestimonialUpdateOutputSchema,
  careerTestimonialUpdateSchema,
  careerWishlistAddOutputSchema,
  careerWishlistCompaniesQuerySchema,
  careerWishlistCompaniesSchema,
  careerWishlistCompanyCreateSchema,
  careerWishlistCompanyDeleteSchema,
  careerWishlistCompanyUpdateSchema,
  careerWishlistUpdateOutputSchema,
} from '../../schemas/career.schema';
import { removedResultSchema } from '../../schemas/common.schema';
import { registerTool } from '../tool-registry';

const noInputSchema = z.object({});

registerTool(
  {
    name: 'career_profile',
    title: 'Get your career profile',
    description: 'Returns the authenticated user career profile without contact information.',
    inputSchema: noInputSchema,
    outputSchema: careerProfileOutputSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 1,
    guidance: {
      whenToUse: 'The user asks about their current career profile, roles, or skills.',
      whenNotToUse: 'Do not use for a single application when a focused application tool exists.',
      produces: ['career profile', 'skills', 'role history'],
    },
  },
  async (ownerUserId, _input) => {
    const profile = await getCareerProfile(ownerUserId);
    return { profile: profile ? careerMcpProfileSchema.parse(profile) : null };
  },
);

registerTool(
  {
    name: 'career_profile_update',
    title: 'Update your career profile',
    description:
      'Updates the authenticated user career profile (name, headline, summary, location, industry, LinkedIn URL, websites, X/Twitter handles). Does not accept email or phone.',
    inputSchema: careerProfileUpdateSchema,
    outputSchema: careerProfileUpdateOutputSchema,
    readOnly: false,
    scopes: ['career:write'],
    resultCap: 1,
    destructive: false,
    idempotent: true,
  },
  async (ownerUserId, input) => ({ profile: await updateCareerProfile(ownerUserId, input) }),
);

// Baseline for a "create" tool (destructive: false, idempotent: false — each
// call produces a new row). Update/delete tools override both below.
const writeTool: {
  readOnly: false;
  scopes: ['career:write'];
  resultCap: number;
  destructive: false;
  idempotent: false;
} = {
  readOnly: false,
  scopes: ['career:write'],
  resultCap: 1,
  destructive: false,
  idempotent: false,
};

registerTool(
  {
    ...writeTool,
    name: 'career_engagement_create',
    title: 'Create a career engagement',
    description: 'Creates a work history engagement.',
    inputSchema: careerEngagementCreateSchema,
    outputSchema: careerEngagementCreateOutputSchema,
  },
  async (ownerUserId, input) => ({ engagement: await createCareerEngagement(ownerUserId, input) }),
);
registerTool(
  {
    ...writeTool,
    name: 'career_application_create',
    title: 'Create a career application',
    description: 'Creates a job application.',
    inputSchema: careerApplicationCreateSchema,
    outputSchema: careerApplicationCreateOutputSchema,
  },
  async (ownerUserId, input) => ({
    application: await createCareerApplication(ownerUserId, input),
  }),
);
registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'career_application_update',
    title: 'Update a career application',
    description: 'Updates a job application.',
    inputSchema: careerApplicationUpdateSchema,
    outputSchema: careerApplicationUpdateOutputSchema,
  },
  async (ownerUserId, input) => ({
    application: await updateCareerApplication(ownerUserId, input.id, input.data),
  }),
);
registerTool(
  {
    ...writeTool,
    requiresConfirmation: true,
    destructive: true,
    idempotent: true,
    name: 'career_application_delete',
    title: 'Delete a career application',
    description: 'Deletes a job application.',
    inputSchema: careerApplicationDeleteSchema,
    outputSchema: removedResultSchema,
    guidance: {
      whenToUse: 'A matching application id has been returned by career_applications.',
      whenNotToUse: 'Do not invent an application id or delete before lookup and confirmation.',
      dependencies: [
        {
          tool: 'career_applications',
          reason: 'resolve the stable application id',
          provides: ['id'],
        },
      ],
    },
    preview: async (ownerUserId, input) => {
      const parsed = careerApplicationDeleteSchema.safeParse(input);
      if (!parsed.success) return null;
      const { application } = await getCareerApplicationDetail(ownerUserId, parsed.data.id);
      if (!application) return null;
      return { company: application.company, title: application.title };
    },
  },
  async (ownerUserId, input) => ({ removed: await removeCareerApplication(ownerUserId, input.id) }),
);
registerTool(
  {
    ...writeTool,
    name: 'career_application_note_add',
    title: 'Add an application note',
    description: 'Adds a note to a job application.',
    inputSchema: careerApplicationNoteAddSchema,
    outputSchema: careerApplicationNoteAddOutputSchema,
  },
  async (ownerUserId, input) => ({
    note: await addCareerApplicationNote(ownerUserId, input.applicationId, input.content),
  }),
);
registerTool(
  {
    ...writeTool,
    requiresConfirmation: true,
    destructive: true,
    idempotent: true,
    name: 'career_application_note_remove',
    title: 'Remove an application note',
    description: 'Removes an application note.',
    inputSchema: careerApplicationNoteRemoveSchema,
    outputSchema: removedResultSchema,
    preview: async (ownerUserId, input) => {
      const parsed = careerApplicationNoteRemoveSchema.safeParse(input);
      if (!parsed.success) return null;
      const result = await listCareerApplicationNotes(ownerUserId, parsed.data.applicationId);
      const note = result?.notes.find((n) => n.id === parsed.data.id);
      return note ? { note: note.content } : null;
    },
  },
  async (ownerUserId, input) => ({
    removed: await removeCareerApplicationNote(ownerUserId, input.applicationId, input.id),
  }),
);
registerTool(
  {
    ...writeTool,
    name: 'career_application_file_add',
    title: 'Add an application file',
    description: 'Adds a file reference to a job application.',
    inputSchema: careerApplicationFileAddSchema,
    outputSchema: careerApplicationFileAddOutputSchema,
    resourceLinks: (output) => {
      const { file } = careerApplicationFileAddOutputSchema.parse(output);
      return file ? [{ uri: file.fileUrl, name: file.fileName }] : [];
    },
  },
  async (ownerUserId, input) => ({
    file: await addCareerApplicationFile(ownerUserId, input.applicationId, input),
  }),
);
registerTool(
  {
    ...writeTool,
    requiresConfirmation: true,
    destructive: true,
    idempotent: true,
    name: 'career_application_file_remove',
    title: 'Remove an application file',
    description: 'Removes an application file.',
    inputSchema: careerApplicationFileRemoveSchema,
    outputSchema: removedResultSchema,
    preview: async (ownerUserId, input) => {
      const parsed = careerApplicationFileRemoveSchema.safeParse(input);
      if (!parsed.success) return null;
      const result = await listCareerApplicationFiles(ownerUserId, parsed.data.applicationId);
      const file = result?.files.find((f) => f.id === parsed.data.id);
      return file ? { fileName: file.fileName } : null;
    },
  },
  async (ownerUserId, input) => ({
    removed: await removeCareerApplicationFile(ownerUserId, input.applicationId, input.id),
  }),
);
registerTool(
  {
    ...writeTool,
    name: 'career_education_create',
    title: 'Create education',
    description: 'Creates an education entry.',
    inputSchema: careerEducationCreateSchema,
    outputSchema: careerEducationCreateOutputSchema,
  },
  async (ownerUserId, input) => ({ education: await createCareerEducation(ownerUserId, input) }),
);
registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'career_education_update',
    title: 'Update education',
    description: 'Updates an education entry.',
    inputSchema: careerEducationUpdateSchema,
    outputSchema: careerEducationUpdateOutputSchema,
  },
  async (ownerUserId, input) => ({
    education: await updateCareerEducation(ownerUserId, input.id, input.data),
  }),
);
registerTool(
  {
    ...writeTool,
    requiresConfirmation: true,
    destructive: true,
    idempotent: true,
    name: 'career_education_delete',
    title: 'Delete education',
    description: 'Deletes an education entry.',
    inputSchema: careerEducationDeleteSchema,
    outputSchema: removedResultSchema,
    preview: async (ownerUserId, input) => {
      const parsed = careerEducationDeleteSchema.safeParse(input);
      if (!parsed.success) return null;
      const { education } = await listCareerEducation(ownerUserId);
      const entry = education.find((e) => e.id === parsed.data.id);
      return entry ? { school: entry.school, degree: entry.degree } : null;
    },
  },
  async (ownerUserId, input) => ({ removed: await removeCareerEducation(ownerUserId, input.id) }),
);
registerTool(
  {
    ...writeTool,
    name: 'career_skill_create',
    title: 'Create a skill',
    description: 'Creates a career skill.',
    inputSchema: careerSkillCreateSchema,
    outputSchema: careerSkillCreateOutputSchema,
  },
  async (ownerUserId, input) => ({ skill: await createCareerSkill(ownerUserId, input) }),
);
registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'career_skill_update',
    title: 'Update a skill',
    description: 'Updates a career skill.',
    inputSchema: careerSkillUpdateSchema,
    outputSchema: careerSkillUpdateOutputSchema,
  },
  async (ownerUserId, input) => ({
    skill: await updateCareerSkill(ownerUserId, input.id, input.data),
  }),
);
registerTool(
  {
    ...writeTool,
    requiresConfirmation: true,
    destructive: true,
    idempotent: true,
    name: 'career_skill_delete',
    title: 'Delete a skill',
    description: 'Deletes a career skill.',
    inputSchema: careerSkillDeleteSchema,
    outputSchema: removedResultSchema,
    preview: async (ownerUserId, input) => {
      const parsed = careerSkillDeleteSchema.safeParse(input);
      if (!parsed.success) return null;
      const { skills } = await listCareerSkills(ownerUserId);
      const skill = skills.find((s) => s.id === parsed.data.id);
      return skill ? { name: skill.name, category: skill.category } : null;
    },
  },
  async (ownerUserId, input) => ({ removed: await removeCareerSkill(ownerUserId, input.id) }),
);
registerTool(
  {
    ...writeTool,
    name: 'career_project_create',
    title: 'Create a project',
    description: 'Creates a career project.',
    inputSchema: careerProjectCreateSchema,
    outputSchema: careerProjectCreateOutputSchema,
  },
  async (ownerUserId, input) => ({ project: await createCareerProject(ownerUserId, input) }),
);
registerTool(
  {
    ...writeTool,
    name: 'career_testimonial_create',
    title: 'Create a testimonial',
    description: 'Creates a career testimonial.',
    inputSchema: careerTestimonialCreateSchema,
    outputSchema: careerTestimonialCreateOutputSchema,
  },
  async (ownerUserId, input) => ({
    testimonial: await createCareerTestimonial(ownerUserId, input),
  }),
);
registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'career_testimonial_update',
    title: 'Update a testimonial',
    description: 'Updates a career testimonial.',
    inputSchema: careerTestimonialUpdateSchema,
    outputSchema: careerTestimonialUpdateOutputSchema,
  },
  async (ownerUserId, input) => ({
    testimonial: await updateCareerTestimonial(ownerUserId, input.id, input.data),
  }),
);
registerTool(
  {
    ...writeTool,
    requiresConfirmation: true,
    destructive: true,
    idempotent: true,
    name: 'career_testimonial_delete',
    title: 'Delete a testimonial',
    description: 'Deletes a career testimonial.',
    inputSchema: careerTestimonialDeleteSchema,
    outputSchema: removedResultSchema,
    preview: async (ownerUserId, input) => {
      const parsed = careerTestimonialDeleteSchema.safeParse(input);
      if (!parsed.success) return null;
      const { testimonials } = await listCareerTestimonials(ownerUserId);
      const testimonial = testimonials.find((t) => t.id === parsed.data.id);
      return testimonial ? { from: testimonial.name, company: testimonial.company } : null;
    },
  },
  async (ownerUserId, input) => ({ removed: await removeCareerTestimonial(ownerUserId, input.id) }),
);
registerTool(
  {
    ...writeTool,
    name: 'career_certification_create',
    title: 'Create a certification',
    description: 'Creates a career certification.',
    inputSchema: careerCertificationCreateSchema,
    outputSchema: careerCertificationCreateOutputSchema,
  },
  async (ownerUserId, input) => ({
    certification: await createCareerCertification(ownerUserId, input),
  }),
);
registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'career_certification_update',
    title: 'Update a certification',
    description: 'Updates a career certification.',
    inputSchema: careerCertificationUpdateSchema,
    outputSchema: careerCertificationUpdateOutputSchema,
  },
  async (ownerUserId, input) => ({
    certification: await updateCareerCertification(ownerUserId, input.id, input.data),
  }),
);
registerTool(
  {
    ...writeTool,
    requiresConfirmation: true,
    destructive: true,
    idempotent: true,
    name: 'career_certification_delete',
    title: 'Delete a certification',
    description: 'Deletes a career certification.',
    inputSchema: careerCertificationDeleteSchema,
    outputSchema: removedResultSchema,
    preview: async (ownerUserId, input) => {
      const parsed = careerCertificationDeleteSchema.safeParse(input);
      if (!parsed.success) return null;
      const { certifications } = await listCareerCertifications(ownerUserId);
      const cert = certifications.find((c) => c.id === parsed.data.id);
      return cert ? { name: cert.name, issuer: cert.issuingOrganization } : null;
    },
  },
  async (ownerUserId, input) => ({
    removed: await removeCareerCertification(ownerUserId, input.id),
  }),
);
registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'career_social_links_save',
    title: 'Save career social links',
    description: 'Saves public career profile links.',
    inputSchema: careerSocialLinksSaveSchema,
    outputSchema: careerSocialLinksSaveOutputSchema,
  },
  async (ownerUserId, input) => ({ socialLinks: await saveCareerSocialLinks(ownerUserId, input) }),
);

registerTool(
  {
    name: 'career_engagements',
    title: 'List career engagements',
    description: 'Returns authenticated work history engagements filtered by type.',
    inputSchema: careerEngagementsQuerySchema,
    outputSchema: careerEngagementsSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 50,
  },
  async (ownerUserId, input) => {
    const result = await listCareerEngagements(ownerUserId, input);
    return result;
  },
);

registerTool(
  {
    name: 'career_wishlist_companies',
    title: 'List career wishlist companies',
    description: 'Lists companies you want to work for that are not active job applications.',
    inputSchema: careerWishlistCompaniesQuerySchema,
    outputSchema: careerWishlistCompaniesSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 100,
  },
  (ownerUserId, input) => listCareerWishlistCompanies(ownerUserId, input.limit),
);

registerTool(
  {
    name: 'career_wishlist_add',
    title: 'Add a career wishlist company',
    description: 'Adds a company you want to work for to your career wishlist.',
    inputSchema: careerWishlistCompanyCreateSchema,
    outputSchema: careerWishlistAddOutputSchema,
    readOnly: false,
    scopes: ['career:write'],
    resultCap: 1,
    destructive: false,
    idempotent: false,
  },
  async (ownerUserId, input) => ({
    company: await addCareerWishlistCompany(ownerUserId, input.company),
  }),
);

registerTool(
  {
    name: 'career_wishlist_update',
    title: 'Update a career wishlist company',
    description: 'Renames a company on your career wishlist.',
    inputSchema: careerWishlistCompanyUpdateSchema,
    outputSchema: careerWishlistUpdateOutputSchema,
    readOnly: false,
    scopes: ['career:write'],
    resultCap: 1,
    destructive: false,
    idempotent: true,
  },
  async (ownerUserId, input) => ({
    company: await updateCareerWishlistCompany(ownerUserId, input.id, input.company),
  }),
);

registerTool(
  {
    name: 'career_wishlist_remove',
    title: 'Remove a career wishlist company',
    description: 'Removes a company from your career wishlist.',
    inputSchema: careerWishlistCompanyDeleteSchema,
    outputSchema: removedResultSchema,
    readOnly: false,
    scopes: ['career:write'],
    resultCap: 1,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    preview: async (ownerUserId, input) => {
      const parsed = careerWishlistCompanyDeleteSchema.safeParse(input);
      if (!parsed.success) return null;
      const { companies } = await listCareerWishlistCompanies(ownerUserId);
      const company = companies.find((c) => c.id === parsed.data.id);
      return company ? { company: company.company } : null;
    },
  },
  async (ownerUserId, input) => ({
    removed: await removeCareerWishlistCompany(ownerUserId, input.id),
  }),
);

registerTool(
  {
    name: 'career_engagement_update',
    title: 'Update a career engagement',
    description:
      'Updates a work history engagement (company, title, location, dates, salary in cents, contact, source, kind, description, reason for leaving). Returns the updated engagement.',
    inputSchema: careerEngagementUpdateSchema,
    outputSchema: careerEngagementUpdateOutputSchema,
    readOnly: false,
    scopes: ['career:write'],
    resultCap: 1,
    destructive: false,
    idempotent: true,
  },
  async (ownerUserId, input) => ({
    engagement: await updateCareerEngagement(ownerUserId, input.id, input.data),
  }),
);

registerTool(
  {
    name: 'career_engagement_delete',
    title: 'Delete a career engagement',
    description: 'Deletes a work history engagement.',
    inputSchema: careerEngagementDeleteSchema,
    outputSchema: removedResultSchema,
    readOnly: false,
    scopes: ['career:write'],
    resultCap: 1,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    preview: async (ownerUserId, input) => {
      const parsed = careerEngagementDeleteSchema.safeParse(input);
      if (!parsed.success) return null;
      const { engagements } = await listCareerEngagements(ownerUserId);
      const engagement = engagements.find((e) => e.id === parsed.data.id);
      return engagement ? { company: engagement.company, title: engagement.title } : null;
    },
  },
  async (ownerUserId, input) => ({
    removed: await removeCareerEngagement(ownerUserId, input.id),
  }),
);

registerTool(
  {
    name: 'career_applications',
    title: 'List job applications',
    description:
      'Lists job applications with optional status filter. Includes stage count and offer indicator.',
    inputSchema: careerApplicationsQuerySchema,
    outputSchema: careerApplicationsSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 50,
  },
  async (ownerUserId, input) => {
    const result = await listCareerApplications(ownerUserId, input);
    return result;
  },
);

registerTool(
  {
    name: 'career_application_detail',
    title: 'Get application detail',
    description: 'Returns a single application with all pipeline stages and offer details.',
    inputSchema: z.object({ id: z.string().uuid() }),
    outputSchema: careerApplicationDetailSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 1,
  },
  async (ownerUserId, input) => {
    const result = await getCareerApplicationDetail(ownerUserId, input.id);
    return result;
  },
);

registerTool(
  {
    name: 'career_education',
    title: 'List education history',
    description: 'Returns education entries (schools, degrees, fields of study, dates).',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(20).optional().default(10),
    }),
    outputSchema: careerEducationSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 20,
  },
  async (ownerUserId, input) => {
    const result = await listCareerEducation(ownerUserId, input.limit);
    return result;
  },
);

registerTool(
  {
    name: 'career_skills',
    title: 'List career skills',
    description: 'Returns the authenticated user skills with category, level, and proof.',
    inputSchema: noInputSchema,
    outputSchema: careerSkillsSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 100,
  },
  async (ownerUserId, _input) => {
    const result = await listCareerSkills(ownerUserId);
    return result;
  },
);

registerTool(
  {
    name: 'career_projects',
    title: 'List career projects',
    description: 'Returns the authenticated user side/work projects.',
    inputSchema: noInputSchema,
    outputSchema: careerProjectsSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 100,
  },
  async (ownerUserId, _input) => {
    const result = await listCareerProjects(ownerUserId);
    return careerProjectsSchema.parse(result);
  },
);

registerTool(
  {
    name: 'career_project_update',
    title: 'Update a career project',
    description:
      'Updates a project (title, organization, descriptions, URLs, dates, status, technologies, linked engagement ids). Returns the updated project.',
    inputSchema: careerProjectUpdateSchema,
    outputSchema: careerProjectUpdateOutputSchema,
    readOnly: false,
    scopes: ['career:write'],
    resultCap: 1,
    destructive: false,
    idempotent: true,
  },
  async (ownerUserId, input) => ({
    project: await updateCareerProject(ownerUserId, input.id, input.data),
  }),
);

registerTool(
  {
    name: 'career_project_delete',
    title: 'Delete a career project',
    description: 'Deletes a project.',
    inputSchema: careerProjectDeleteSchema,
    outputSchema: removedResultSchema,
    readOnly: false,
    scopes: ['career:write'],
    resultCap: 1,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    preview: async (ownerUserId, input) => {
      const parsed = careerProjectDeleteSchema.safeParse(input);
      if (!parsed.success) return null;
      const { projects } = await listCareerProjects(ownerUserId);
      const project = projects.find((p) => p.id === parsed.data.id);
      return project ? { title: project.title, organization: project.organization } : null;
    },
  },
  async (ownerUserId, input) => ({
    removed: await removeCareerProject(ownerUserId, input.id),
  }),
);

registerTool(
  {
    name: 'career_testimonials',
    title: 'List career testimonials',
    description: 'Returns testimonials given by colleagues, managers, or clients.',
    inputSchema: noInputSchema,
    outputSchema: careerTestimonialsSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 100,
  },
  async (ownerUserId, _input) => {
    const result = await listCareerTestimonials(ownerUserId);
    return result;
  },
);

registerTool(
  {
    name: 'career_certifications',
    title: 'List career certifications',
    description: 'Returns professional certifications with issuer and dates.',
    inputSchema: noInputSchema,
    outputSchema: careerCertificationsSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 100,
  },
  async (ownerUserId, _input) => {
    const result = await listCareerCertifications(ownerUserId);
    return result;
  },
);

registerTool(
  {
    name: 'career_social_links',
    title: 'Get career social links',
    description: 'Returns the authenticated user public social/profile links.',
    inputSchema: noInputSchema,
    outputSchema: careerSocialLinksSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 1,
  },
  async (ownerUserId, _input) => {
    const result = await getCareerSocialLinks(ownerUserId);
    return result;
  },
);

import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import './career';
import {
  careerApplicationCreateOutputSchema,
  careerApplicationNoteAddOutputSchema,
  careerApplicationUpdateOutputSchema,
  careerApplicationFileAddOutputSchema,
  careerApplicationsSchema,
  careerProfileOutputSchema,
  careerCertificationCreateOutputSchema,
  careerCertificationUpdateOutputSchema,
  careerCertificationsSchema,
  careerEducationCreateOutputSchema,
  careerEducationSchema,
  careerEducationUpdateOutputSchema,
  careerEngagementCreateOutputSchema,
  careerEngagementsSchema,
  careerProfileUpdateOutputSchema,
  careerProjectCreateOutputSchema,
  careerProjectsSchema,
  careerSkillCreateOutputSchema,
  careerSkillUpdateOutputSchema,
  careerSkillsSchema,
  careerSocialLinksSaveOutputSchema,
  careerSocialLinksSchema,
  careerTestimonialCreateOutputSchema,
  careerTestimonialUpdateOutputSchema,
  careerTestimonialsSchema,
} from '../../schemas/career.schema';
import { removedResultSchema } from '../../schemas/common.schema';
import { toolOutput } from '../../testkit/tool-result';
import { callTool } from '../tool-registry';

const userId = 'a3000001-0000-4000-8000-000000000001';
const otherUserId = 'a3000001-0000-4000-8000-000000000002';

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
      [id, `Career CRUD Test User ${id}`, `${id}@test.hominem.dev`, true],
    );
  }
});

describe('career_engagement_create', () => {
  it('creates an engagement visible in career_engagements', async () => {
    const created = toolOutput(
      await callTool(userId, 'career_engagement_create', {
        company: 'Create Co',
        title: 'Founding Engineer',
      }),
      careerEngagementCreateOutputSchema,
    );
    expect(created.engagement).toMatchObject({ company: 'Create Co', title: 'Founding Engineer' });

    const listed = toolOutput(
      await callTool(userId, 'career_engagements', {}),
      careerEngagementsSchema,
    );
    expect(listed.engagements.some((e) => e.id === created.engagement.id)).toBe(true);

    await db.deleteFrom('app.careerEngagements').where('id', '=', created.engagement.id).execute();
  });
});

describe('career application MCP tools', () => {
  it('round-trips create -> list -> update -> delete', async () => {
    const created = toolOutput(
      await callTool(userId, 'career_application_create', {
        company: 'App Co',
        title: 'Platform Engineer',
      }),
      careerApplicationCreateOutputSchema,
    );
    expect(created.application).toMatchObject({ company: 'App Co', title: 'Platform Engineer' });

    const listed = toolOutput(
      await callTool(userId, 'career_applications', {}),
      careerApplicationsSchema,
    );
    expect(listed.applications.some((a) => a.id === created.application.id)).toBe(true);

    const updated = toolOutput(
      await callTool(userId, 'career_application_update', {
        id: created.application.id,
        data: { status: 'REJECTED' },
      }),
      careerApplicationUpdateOutputSchema,
    );
    expect(updated.application?.status).toBe('REJECTED');

    const removed = toolOutput(
      await callTool(userId, 'career_application_delete', { id: created.application.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(true);

    const gone = await db
      .selectFrom('app.careerApplications')
      .select('id')
      .where('id', '=', created.application.id)
      .executeTakeFirst();
    expect(gone).toBeUndefined();
  });

  it('does not update or delete another user’s application', async () => {
    const application = await db
      .insertInto('app.careerApplications')
      .values({
        ownerUserid: userId,
        company: 'Secret App Co',
        title: 'Secret role',
        status: 'WISHLIST',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const updated = toolOutput(
      await callTool(otherUserId, 'career_application_update', {
        id: application.id,
        data: { status: 'SCREENING' },
      }),
      careerApplicationUpdateOutputSchema,
    );
    expect(updated.application).toBeNull();

    const removed = toolOutput(
      await callTool(otherUserId, 'career_application_delete', { id: application.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(false);

    await db.deleteFrom('app.careerApplications').where('id', '=', application.id).execute();
  });

  it('adds and removes an application note', async () => {
    const application = await db
      .insertInto('app.careerApplications')
      .values({ ownerUserid: userId, company: 'Note Co', title: 'Note role', status: 'WISHLIST' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const added = toolOutput(
      await callTool(userId, 'career_application_note_add', {
        applicationId: application.id,
        content: 'Phone screen scheduled.',
      }),
      careerApplicationNoteAddOutputSchema,
    );
    if (!added.note) throw new Error('career_application_note_add returned no note');
    expect(added.note.content).toBe('Phone screen scheduled.');

    const removed = toolOutput(
      await callTool(userId, 'career_application_note_remove', {
        applicationId: application.id,
        id: added.note.id,
      }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(true);

    await db.deleteFrom('app.careerApplications').where('id', '=', application.id).execute();
  });

  it('rejects note operations on another user’s application', async () => {
    const application = await db
      .insertInto('app.careerApplications')
      .values({
        ownerUserid: userId,
        company: 'Guarded Co',
        title: 'Guarded role',
        status: 'WISHLIST',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const added = toolOutput(
      await callTool(otherUserId, 'career_application_note_add', {
        applicationId: application.id,
        content: 'Should not be allowed.',
      }),
      careerApplicationNoteAddOutputSchema,
    );
    expect(added.note).toBeNull();

    await db.deleteFrom('app.careerApplications').where('id', '=', application.id).execute();
  });

  it('adds and removes an application file', async () => {
    const application = await db
      .insertInto('app.careerApplications')
      .values({ ownerUserid: userId, company: 'File Co', title: 'File role', status: 'WISHLIST' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const addResult = await callTool(userId, 'career_application_file_add', {
      applicationId: application.id,
      fileName: 'resume.pdf',
      fileUrl: 'https://storage.example.com/resume.pdf',
    });
    const added = toolOutput(addResult, careerApplicationFileAddOutputSchema);
    if (!added.file) throw new Error('career_application_file_add returned no file');
    expect(added.file.fileName).toBe('resume.pdf');
    // A file-bearing tool result also carries a resource_link content block
    // so an MCP-aware client can discover/fetch the file directly, not just
    // read fileUrl as an opaque string in structuredContent.
    expect(addResult.content).toContainEqual({
      type: 'resource_link',
      uri: 'https://storage.example.com/resume.pdf',
      name: 'resume.pdf',
    });

    const removed = toolOutput(
      await callTool(userId, 'career_application_file_remove', {
        applicationId: application.id,
        id: added.file.id,
      }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(true);

    await db.deleteFrom('app.careerApplications').where('id', '=', application.id).execute();
  });
});

describe('career education MCP tools', () => {
  it('round-trips create -> list -> update -> delete', async () => {
    const created = toolOutput(
      await callTool(userId, 'career_education_create', {
        school: 'MCP University',
        degree: 'B.S. Software Engineering',
      }),
      careerEducationCreateOutputSchema,
    );
    expect(created.education.school).toBe('MCP University');

    const listed = toolOutput(
      await callTool(userId, 'career_education', {}),
      careerEducationSchema,
    );
    expect(listed.education.some((e) => e.id === created.education.id)).toBe(true);

    const updated = toolOutput(
      await callTool(userId, 'career_education_update', {
        id: created.education.id,
        data: { degree: 'M.S. Software Engineering' },
      }),
      careerEducationUpdateOutputSchema,
    );
    expect(updated.education?.degree).toBe('M.S. Software Engineering');

    const removed = toolOutput(
      await callTool(userId, 'career_education_delete', { id: created.education.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(true);

    const gone = await db
      .selectFrom('app.careerEducation')
      .select('id')
      .where('id', '=', created.education.id)
      .executeTakeFirst();
    expect(gone).toBeUndefined();
  });

  it('does not update or delete another user’s education entry', async () => {
    const education = await db
      .insertInto('app.careerEducation')
      .values({ ownerUserid: userId, school: 'Private University' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const updated = toolOutput(
      await callTool(otherUserId, 'career_education_update', {
        id: education.id,
        data: { degree: 'Leaked degree' },
      }),
      careerEducationUpdateOutputSchema,
    );
    expect(updated.education).toBeNull();

    const removed = toolOutput(
      await callTool(otherUserId, 'career_education_delete', { id: education.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(false);

    await db.deleteFrom('app.careerEducation').where('id', '=', education.id).execute();
  });
});

describe('career skill MCP tools', () => {
  it('round-trips create -> list -> update -> delete', async () => {
    const created = toolOutput(
      await callTool(userId, 'career_skill_create', { name: 'Rust', category: 'technical' }),
      careerSkillCreateOutputSchema,
    );
    expect(created.skill.name).toBe('Rust');

    const listed = toolOutput(await callTool(userId, 'career_skills', {}), careerSkillsSchema);
    expect(listed.skills.some((s) => s.id === created.skill.id)).toBe(true);

    const updated = toolOutput(
      await callTool(userId, 'career_skill_update', {
        id: created.skill.id,
        data: { level: 80 },
      }),
      careerSkillUpdateOutputSchema,
    );
    expect(updated.skill?.level).toBe(80);

    const removed = toolOutput(
      await callTool(userId, 'career_skill_delete', { id: created.skill.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(true);
  });

  it('does not update or delete another user’s skill', async () => {
    const skill = await db
      .insertInto('app.careerSkills')
      .values({ ownerUserid: userId, name: 'Private Skill' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const updated = toolOutput(
      await callTool(otherUserId, 'career_skill_update', {
        id: skill.id,
        data: { level: 1 },
      }),
      careerSkillUpdateOutputSchema,
    );
    expect(updated.skill).toBeNull();

    const removed = toolOutput(
      await callTool(otherUserId, 'career_skill_delete', { id: skill.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(false);

    await db.deleteFrom('app.careerSkills').where('id', '=', skill.id).execute();
  });
});

describe('career_project_create', () => {
  it('creates a project visible in career_projects', async () => {
    const created = toolOutput(
      await callTool(userId, 'career_project_create', { title: 'MCP Test Project' }),
      careerProjectCreateOutputSchema,
    );
    expect(created.project.title).toBe('MCP Test Project');

    const listed = toolOutput(await callTool(userId, 'career_projects', {}), careerProjectsSchema);
    expect(listed.projects.some((p) => p.id === created.project.id)).toBe(true);

    await db.deleteFrom('app.careerProjects').where('id', '=', created.project.id).execute();
  });
});

describe('career testimonial MCP tools', () => {
  it('round-trips create -> list -> update -> delete', async () => {
    const created = toolOutput(
      await callTool(userId, 'career_testimonial_create', {
        name: 'Jane Manager',
        content: 'Great to work with.',
      }),
      careerTestimonialCreateOutputSchema,
    );
    expect(created.testimonial.name).toBe('Jane Manager');

    const listed = toolOutput(
      await callTool(userId, 'career_testimonials', {}),
      careerTestimonialsSchema,
    );
    expect(listed.testimonials.some((t) => t.id === created.testimonial.id)).toBe(true);

    const updated = toolOutput(
      await callTool(userId, 'career_testimonial_update', {
        id: created.testimonial.id,
        data: { content: 'Updated praise.' },
      }),
      careerTestimonialUpdateOutputSchema,
    );
    expect(updated.testimonial?.content).toBe('Updated praise.');

    const removed = toolOutput(
      await callTool(userId, 'career_testimonial_delete', { id: created.testimonial.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(true);
  });

  it('does not update or delete another user’s testimonial', async () => {
    const testimonial = await db
      .insertInto('app.careerTestimonials')
      .values({ ownerUserid: userId, name: 'Private Person', content: 'Private content' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const updated = toolOutput(
      await callTool(otherUserId, 'career_testimonial_update', {
        id: testimonial.id,
        data: { content: 'Leaked' },
      }),
      careerTestimonialUpdateOutputSchema,
    );
    expect(updated.testimonial).toBeNull();

    const removed = toolOutput(
      await callTool(otherUserId, 'career_testimonial_delete', { id: testimonial.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(false);

    await db.deleteFrom('app.careerTestimonials').where('id', '=', testimonial.id).execute();
  });
});

describe('career certification MCP tools', () => {
  it('round-trips create -> list -> update -> delete', async () => {
    const created = toolOutput(
      await callTool(userId, 'career_certification_create', {
        name: 'AWS Certified',
        issuingOrganization: 'AWS',
      }),
      careerCertificationCreateOutputSchema,
    );
    expect(created.certification.name).toBe('AWS Certified');

    const listed = toolOutput(
      await callTool(userId, 'career_certifications', {}),
      careerCertificationsSchema,
    );
    expect(listed.certifications.some((c) => c.id === created.certification.id)).toBe(true);

    const updated = toolOutput(
      await callTool(userId, 'career_certification_update', {
        id: created.certification.id,
        data: { status: 'ACTIVE' },
      }),
      careerCertificationUpdateOutputSchema,
    );
    expect(updated.certification?.status).toBe('ACTIVE');

    const removed = toolOutput(
      await callTool(userId, 'career_certification_delete', { id: created.certification.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(true);
  });

  it('does not update or delete another user’s certification', async () => {
    const certification = await db
      .insertInto('app.careerCertifications')
      .values({ ownerUserid: userId, name: 'Private Cert', issuingOrganization: 'Private Org' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const updated = toolOutput(
      await callTool(otherUserId, 'career_certification_update', {
        id: certification.id,
        data: { name: 'Leaked' },
      }),
      careerCertificationUpdateOutputSchema,
    );
    expect(updated.certification).toBeNull();

    const removed = toolOutput(
      await callTool(otherUserId, 'career_certification_delete', { id: certification.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(false);

    await db.deleteFrom('app.careerCertifications').where('id', '=', certification.id).execute();
  });
});

describe('career_profile_update', () => {
  it('updates and reads back the profile', async () => {
    const updated = toolOutput(
      await callTool(userId, 'career_profile_update', {
        headline: 'Staff Engineer',
        location: 'Remote',
      }),
      careerProfileUpdateOutputSchema,
    );
    expect(updated.profile).toMatchObject({ headline: 'Staff Engineer', location: 'Remote' });

    const read = toolOutput(
      await callTool(userId, 'career_profile', {}),
      careerProfileOutputSchema,
    );
    expect(read.profile).toMatchObject({ headline: 'Staff Engineer', location: 'Remote' });
  });

  it('does not leak email or phone in the response', async () => {
    const updated = toolOutput(
      await callTool(userId, 'career_profile_update', { industry: 'Software' }),
      careerProfileUpdateOutputSchema,
    );
    expect(updated.profile).not.toHaveProperty('email');
    expect(updated.profile).not.toHaveProperty('phone');
  });

  it('only updates the calling user’s own profile', async () => {
    await callTool(userId, 'career_profile_update', { headline: 'Owner headline' });

    await callTool(otherUserId, 'career_profile_update', { headline: 'Other headline' });

    const ownerProfile = toolOutput(
      await callTool(userId, 'career_profile', {}),
      careerProfileOutputSchema,
    );
    expect(ownerProfile.profile?.headline).toBe('Owner headline');

    const otherProfile = toolOutput(
      await callTool(otherUserId, 'career_profile', {}),
      careerProfileOutputSchema,
    );
    expect(otherProfile.profile?.headline).toBe('Other headline');
  });

  it('rejects an empty update', async () => {
    await expect(callTool(userId, 'career_profile_update', {})).rejects.toThrow();
  });
});

describe('career_social_links_save', () => {
  it('saves and reads back social links', async () => {
    const saved = toolOutput(
      await callTool(userId, 'career_social_links_save', {
        github: 'https://github.com/mcp-test',
      }),
      careerSocialLinksSaveOutputSchema,
    );
    expect(saved.socialLinks.github).toBe('https://github.com/mcp-test');

    const read = toolOutput(
      await callTool(userId, 'career_social_links', {}),
      careerSocialLinksSchema,
    );
    expect(read.socialLinks?.github).toBe('https://github.com/mcp-test');
  });
});

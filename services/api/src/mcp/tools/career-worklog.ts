import { z } from 'zod';

import {
  createCareerWorklogEntry,
  getCareerWorklogEntry,
  listCareerWorklogEntries,
  removeCareerWorklogEntry,
  updateCareerWorklogEntry,
} from '../../application/career.service';
import {
  careerWorklogCreateOutputSchema,
  careerWorklogCreateSchema,
  careerWorklogDeleteSchema,
  careerWorklogEntriesQuerySchema,
  careerWorklogEntriesSchema,
  careerWorklogEntryDetailSchema,
  careerWorklogUpdateOutputSchema,
  careerWorklogUpdateSchema,
} from '../../schemas/career.schema';
import { removedResultSchema } from '../../schemas/common.schema';
import { registerTool } from '../tool-registry';

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
    name: 'career_worklog_entries',
    title: 'List career worklog entries',
    description:
      'Lists career worklog entries — the record of work as it happened — newest first. Filters combine, and each one narrows the result further.',
    inputSchema: careerWorklogEntriesQuerySchema,
    outputSchema: careerWorklogEntriesSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 100,
    guidance: {
      whenToUse: 'The user asks what they worked on, when, and what it changed.',
      whenNotToUse:
        'Do not use for the static career layer (engagements, projects, skills); those have their own tools.',
      produces: ['worklog entry ids'],
    },
  },
  async (ownerUserId, input) => listCareerWorklogEntries(ownerUserId, input),
);

registerTool(
  {
    name: 'career_worklog_entry',
    title: 'Get a career worklog entry',
    description:
      'Returns one career worklog entry with the skills that point at it. The raw note is the user’s words, captured once.',
    inputSchema: z.object({ id: z.string().uuid() }),
    outputSchema: careerWorklogEntryDetailSchema,
    readOnly: true,
    scopes: ['career:read'],
    resultCap: 100,
    guidance: {
      whenToUse: 'One specific worklog entry has been resolved by id.',
      whenNotToUse: 'Do not use when a list answers the question; use career_worklog_entries.',
      dependencies: [
        {
          tool: 'career_worklog_entries',
          reason: 'resolve the stable entry id',
          provides: ['id'],
        },
      ],
    },
  },
  async (ownerUserId, input) => getCareerWorklogEntry(ownerUserId, input.id),
);

registerTool(
  {
    ...writeTool,
    name: 'career_worklog_create',
    title: 'Create a career worklog entry',
    description:
      'Records a career worklog entry. Only the engagement and the raw note are required; every other field can be filled in later by updating the entry.',
    inputSchema: careerWorklogCreateSchema,
    outputSchema: careerWorklogCreateOutputSchema,
    guidance: {
      whenToUse: 'The user reports work they just did, or work worth keeping a record of.',
      whenNotToUse: 'Do not use to edit an existing entry; use career_worklog_update.',
      dependencies: [
        {
          tool: 'career_engagements',
          reason: 'resolve the engagement the work belongs to',
          provides: ['id'],
        },
      ],
      produces: ['worklog entry id'],
    },
  },
  async (ownerUserId, input) => ({ entry: await createCareerWorklogEntry(ownerUserId, input) }),
);

registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'career_worklog_update',
    title: 'Update a career worklog entry',
    description:
      'Updates a career worklog entry. The raw note, the capture time, and the id are immutable once the entry exists.',
    inputSchema: careerWorklogUpdateSchema,
    outputSchema: careerWorklogUpdateOutputSchema,
    guidance: {
      whenToUse: 'An entry id has been returned by career_worklog_entries.',
      whenNotToUse:
        'Do not try to rewrite the raw note, the capture time, or the id — they cannot change after creation.',
      dependencies: [
        {
          tool: 'career_worklog_entries',
          reason: 'resolve the stable entry id',
          provides: ['id'],
        },
      ],
    },
  },
  async (ownerUserId, input) => ({
    entry: await updateCareerWorklogEntry(ownerUserId, input.id, input.data),
  }),
);

registerTool(
  {
    ...writeTool,
    requiresConfirmation: true,
    destructive: true,
    idempotent: true,
    name: 'career_worklog_delete',
    title: 'Delete a career worklog entry',
    description: 'Deletes a career worklog entry.',
    inputSchema: careerWorklogDeleteSchema,
    outputSchema: removedResultSchema,
    guidance: {
      whenToUse: 'A matching worklog entry id has been returned by career_worklog_entries.',
      whenNotToUse: 'Do not invent an entry id or delete before lookup and confirmation.',
      dependencies: [
        {
          tool: 'career_worklog_entries',
          reason: 'resolve the stable entry id',
          provides: ['id'],
        },
      ],
    },
    preview: async (ownerUserId, input) => {
      const parsed = careerWorklogDeleteSchema.safeParse(input);
      if (!parsed.success) return null;
      const { entry } = await getCareerWorklogEntry(ownerUserId, parsed.data.id);
      if (!entry) return null;
      return {
        area: entry.area,
        occurredStart: entry.occurredStart,
        rawNote: entry.rawNote.slice(0, 200),
      };
    },
  },
  async (ownerUserId, input) => ({
    removed: await removeCareerWorklogEntry(ownerUserId, input.id),
  }),
);

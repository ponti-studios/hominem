import {
  createPerson,
  getPersonPeople,
  getPersonTimeline,
  updatePerson,
} from '../../application/people.service';
import {
  peopleLookupInputSchema,
  peopleLookupOutputSchema,
  personCreateToolInputSchema,
  personCreateToolOutputSchema,
  personTimelineInputSchema,
  personTimelineOutputSchema,
  personUpdateToolInputSchema,
  personUpdateToolOutputSchema,
} from '../../schemas/people.schema';
import { registerTool } from '../tool-registry';

registerTool(
  {
    name: 'people_lookup',
    title: 'People lookup',
    description:
      'Searches people by name or alias and returns a summary with contact info, organizations, and tags.',
    inputSchema: peopleLookupInputSchema,
    outputSchema: peopleLookupOutputSchema,
    readOnly: true,
    scopes: ['people:read'],
    resultCap: 50,
    guidance: {
      whenToUse:
        'A person must be resolved by name or alias before requesting person-specific data.',
      whenNotToUse: 'Do not guess a person id or use this for general relationship questions.',
      produces: ['person ids', 'person names', 'contact summaries'],
    },
  },
  async (ownerUserId, input) =>
    getPersonPeople({ ownerUserId, query: input.query, limit: input.limit }),
);

registerTool(
  {
    name: 'person_timeline',
    title: 'Person timeline',
    description:
      'A person\u2019s activity across identity, travel, and relationships, newest first. Requires people, travel, and social read access.',
    inputSchema: personTimelineInputSchema,
    outputSchema: personTimelineOutputSchema,
    readOnly: true,
    scopes: ['people:read', 'travel:read', 'social:read'],
    resultCap: 50,
    guidance: {
      whenToUse:
        "A resolved person id is available and the user asks for that person's cross-domain timeline.",
      whenNotToUse: 'Do not call before people_lookup has identified a person id.',
      dependencies: [
        { tool: 'people_lookup', reason: 'requires a stable person id', provides: ['personId'] },
      ],
      produces: ['person timeline', 'related trips', 'relationships'],
    },
  },
  async (ownerUserId, input) => getPersonTimeline({ ownerUserId, personId: input.personId }),
);

registerTool(
  {
    name: 'person_create',
    title: 'Add a person',
    description:
      'Adds a person to the address book with an optional primary email. Call people_lookup first so the same person is not added twice.',
    inputSchema: personCreateToolInputSchema,
    outputSchema: personCreateToolOutputSchema,
    readOnly: false,
    scopes: ['people:write'],
    resultCap: 1,
    destructive: false,
    idempotent: false,
    guidance: {
      whenToUse: 'The user asks to add someone and people_lookup found no match.',
      whenNotToUse: 'Do not create a person that people_lookup already returns.',
      dependencies: [
        { tool: 'people_lookup', reason: 'avoid creating a duplicate', provides: ['personId'] },
      ],
      produces: ['person id'],
    },
  },
  async (ownerUserId, input) => ({
    person: await createPerson({
      ownerUserId,
      displayName: input.displayName,
      email: input.email ?? null,
    }),
  }),
);

registerTool(
  {
    name: 'person_update',
    title: 'Update a person',
    description:
      "Changes a person's display name and/or primary email. Returns null if the person does not exist.",
    inputSchema: personUpdateToolInputSchema,
    outputSchema: personUpdateToolOutputSchema,
    readOnly: false,
    scopes: ['people:write'],
    resultCap: 1,
    destructive: false,
    idempotent: true,
    guidance: {
      whenToUse: 'A person id has been returned by people_lookup.',
      whenNotToUse: 'Do not invent a person id.',
      dependencies: [
        { tool: 'people_lookup', reason: 'resolve the stable person id', provides: ['personId'] },
      ],
    },
  },
  async (ownerUserId, input) => ({
    person: await updatePerson({
      ownerUserId,
      personId: input.personId,
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
    }),
  }),
);

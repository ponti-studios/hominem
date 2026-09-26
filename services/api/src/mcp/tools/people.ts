import { getPersonPeople, getPersonTimeline } from '../../application/people.service';
import {
  peopleLookupInputSchema,
  peopleLookupOutputSchema,
  personTimelineInputSchema,
  personTimelineOutputSchema,
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

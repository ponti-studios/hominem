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
  },
  async (ownerUserId, input) => getPersonTimeline({ ownerUserId, personId: input.personId }),
);

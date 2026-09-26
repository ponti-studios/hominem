import { getPlaceVisitHistory } from '../../application/places.service';
import {
  placeVisitHistoryInputSchema,
  placeVisitHistoryOutputSchema,
} from '../../schemas/places.schema';
import { registerTool } from '../tool-registry';

registerTool(
  {
    name: 'place_visit_history',
    title: 'Place visit history',
    description:
      "Lists visits to places (restaurants, venues, addresses), newest first, with the visited place's name and address.",
    inputSchema: placeVisitHistoryInputSchema,
    outputSchema: placeVisitHistoryOutputSchema,
    readOnly: true,
    scopes: ['places:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks which restaurants, venues, or addresses they visited.',
      whenNotToUse: 'Do not use to answer trip-history questions when no place visit is requested.',
      produces: ['place ids', 'place names', 'visit dates'],
    },
  },
  async (ownerUserId, input) => getPlaceVisitHistory(ownerUserId, input),
);

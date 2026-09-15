import { listTripHistory } from '../../application/travel.service';
import { tripHistoryInputSchema, tripHistoryOutputSchema } from '../../schemas/travel.schema';
import { registerTool } from '../tool-registry';

registerTool(
  {
    name: 'trip_history',
    title: 'Trip history',
    description: 'Lists past and upcoming trips, newest first, with attendee names.',
    inputSchema: tripHistoryInputSchema,
    outputSchema: tripHistoryOutputSchema,
    readOnly: true,
    scopes: ['travel:read'],
    resultCap: 50,
  },
  (ownerUserId, input) => listTripHistory(ownerUserId, input),
);

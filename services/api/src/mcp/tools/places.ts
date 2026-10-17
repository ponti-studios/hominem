import {
  createPlaceResidence,
  deletePlaceResidence,
  getPlaceResidence,
  listPlaceResidences,
  updatePlaceResidence,
} from '../../application/place-residences.service';
import { getPlaceVisitHistory } from '../../application/places.service';
import {
  placeResidenceCreateInputSchema,
  placeResidenceDeleteInputSchema,
  placeResidenceGetInputSchema,
  placeResidenceListInputSchema,
  placeResidenceListOutputSchema,
  placeResidenceMutationOutputSchema,
  placeResidenceOutputSchema,
  placeResidenceUpdateInputSchema,
} from '../../schemas/place-residences.schema';
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

registerTool(
  {
    name: 'place_residence_list',
    title: 'List residences',
    description: 'Lists places the person has lived and their recorded periods.',
    inputSchema: placeResidenceListInputSchema,
    outputSchema: placeResidenceListOutputSchema,
    readOnly: true,
    scopes: ['places:read'],
    resultCap: 200,
  },
  (owner, input) => listPlaceResidences(owner, input),
);
registerTool(
  {
    name: 'place_residence_get',
    title: 'Get residence history for a place',
    description: 'Gets a lived-in history record by UUID.',
    inputSchema: placeResidenceGetInputSchema,
    outputSchema: placeResidenceOutputSchema.nullable(),
    readOnly: true,
    scopes: ['places:read'],
    resultCap: 1,
  },
  (owner, input) => getPlaceResidence(owner, input),
);
registerTool(
  {
    name: 'place_residence_create',
    title: 'Record a residence',
    description: 'Records a place the person has lived and its lived-in periods.',
    inputSchema: placeResidenceCreateInputSchema,
    outputSchema: placeResidenceMutationOutputSchema,
    readOnly: false,
    scopes: ['places:write'],
    idempotent: false,
    resultCap: 1,
  },
  (owner, input) => createPlaceResidence(owner, input),
);
registerTool(
  {
    name: 'place_residence_update',
    title: 'Update residence history',
    description: 'Replaces recorded lived-in periods and/or notes.',
    inputSchema: placeResidenceUpdateInputSchema,
    outputSchema: placeResidenceMutationOutputSchema,
    readOnly: false,
    scopes: ['places:write'],
    idempotent: true,
    resultCap: 1,
  },
  (owner, input) => updatePlaceResidence(owner, input),
);
registerTool(
  {
    name: 'place_residence_delete',
    title: 'Delete residence history',
    description: 'Deletes a residence history record after explicit confirmation.',
    inputSchema: placeResidenceDeleteInputSchema,
    outputSchema: placeResidenceMutationOutputSchema,
    readOnly: false,
    scopes: ['places:write'],
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    resultCap: 1,
    preview: async () => null,
  },
  (owner, input) => deletePlaceResidence(owner, input),
);

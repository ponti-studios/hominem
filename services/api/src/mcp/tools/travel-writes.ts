import { z } from 'zod';

import { updateTravelAirportCuration } from '../../application/airport-catalogue.service';
import {
  deleteTravelEntity,
  getTravelWriteEntity,
  writeTravelEntity,
} from '../../application/travel-write.service';
import {
  travelDeleteInputSchema,
  travelEntityWriteOutputSchema,
  travelIdeaCreateInputSchema,
  travelIdeaUpdateInputSchema,
  travelJourneyCreateInputSchema,
  travelJourneyUpdateInputSchema,
  travelPlaceCreateInputSchema,
  travelPlaceUpdateInputSchema,
  travelSegmentCreateInputSchema,
  travelSegmentUpdateInputSchema,
  travelStayCreateInputSchema,
  travelStayUpdateInputSchema,
  travelTransportCreateInputSchema,
  travelTransportUpdateInputSchema,
  travelAirportCurationUpdateInputSchema,
} from '../../schemas/travel-write.schema';
import { registerTool } from '../tool-registry';

const asInput = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_input');
  return Object.fromEntries(Object.entries(input));
};

const write = { readOnly: false, scopes: ['travel:write'], resultCap: 1 } as const;
const read = { readOnly: true, scopes: ['travel:read'], resultCap: 1 } as const;
const rowOut = travelEntityWriteOutputSchema;
const names = {
  journey: ['journey', 'Journey'],
  segment: ['segment', 'Segment'],
  transport: ['transport', 'Transport'],
  stay: ['stay', 'Stay'],
  place: ['place', 'Place'],
  idea: ['idea', 'Idea'],
} as const;

function registerCreate(entity: keyof typeof names, schema: z.ZodType) {
  const [singular, title] = names[entity];
  registerTool(
    {
      ...write,
      name: `travel_${singular}_create`,
      title: `Create travel ${title.toLowerCase()}`,
      description: `Creates or returns an existing travel ${title.toLowerCase()} by its natural key. Mode: write. Use when: a resolved travel ${title.toLowerCase()} needs to be recorded. Do not use when: the entity already exists and needs correction; use its update tool. Prerequisites: resolve referenced UUIDs first. Produces: the ${title.toLowerCase()} UUID.`,
      inputSchema: schema,
      outputSchema: rowOut,
      destructive: false,
      idempotent: true,
      standaloneWrite: true,
    },
    (owner, input) => writeTravelEntity(owner, entity, 'create', asInput(input)),
  );
}
function registerUpdate(entity: keyof typeof names, schema: z.ZodType) {
  const [singular, title] = names[entity];
  registerTool(
    {
      ...write,
      name: `travel_${singular}_update`,
      title: `Update travel ${title.toLowerCase()}`,
      description: `Updates an owned travel ${title.toLowerCase()} with optimistic concurrency. Mode: write. Use when: a matching id has been resolved. Do not use when: the entity should be removed; use its delete tool. Prerequisites: provide the stable id. Produces: the updated entity and change counters.`,
      inputSchema: schema,
      outputSchema: rowOut,
      destructive: false,
      idempotent: true,
    },
    (owner, input) => writeTravelEntity(owner, entity, 'update', asInput(input)),
  );
}
function registerDelete(entity: keyof typeof names) {
  const [singular, title] = names[entity];
  registerTool(
    {
      ...write,
      name: `travel_${singular}_delete`,
      title: `Delete travel ${title.toLowerCase()}`,
      description: `Deletes an owned travel ${title.toLowerCase()} after explicit confirmation. Mode: write. Use when: the caller has reviewed the entity and provided iUnderstand=true. Do not use when: references remain; resolve them first. Prerequisites: stable id and explicit confirmation. Produces: deleted snapshot or named refusal.`,
      inputSchema: travelDeleteInputSchema,
      outputSchema: rowOut,
      destructive: true,
      idempotent: true,
      requiresConfirmation: true,
      preview: async () => null,
    },
    (owner, input) => deleteTravelEntity(owner, entity, asInput(input)),
  );
}

registerCreate('journey', travelJourneyCreateInputSchema);
registerUpdate('journey', travelJourneyUpdateInputSchema);
registerDelete('journey');
registerCreate('segment', travelSegmentCreateInputSchema);
registerUpdate('segment', travelSegmentUpdateInputSchema);
registerDelete('segment');
registerCreate('transport', travelTransportCreateInputSchema);
registerUpdate('transport', travelTransportUpdateInputSchema);
registerDelete('transport');
registerCreate('stay', travelStayCreateInputSchema);
registerUpdate('stay', travelStayUpdateInputSchema);
registerDelete('stay');
registerCreate('place', travelPlaceCreateInputSchema);
registerUpdate('place', travelPlaceUpdateInputSchema);
registerCreate('idea', travelIdeaCreateInputSchema);
registerUpdate('idea', travelIdeaUpdateInputSchema);

const getInput = z.object({ id: z.string().uuid() });
for (const entity of ['transport', 'stay'] as const) {
  registerTool(
    {
      ...read,
      name: `travel_${entity}_get`,
      title: `Get travel ${entity}`,
      description: `Gets one travel ${entity} by UUID. Mode: read-only. Use when: one resolved ${entity} is needed. Do not use when: a collection is requested. Prerequisites: stable entity UUID. Produces: the ${entity} snapshot.`,
      inputSchema: getInput,
      outputSchema: rowOut,
    },
    (owner, input) => getTravelWriteEntity(owner, entity, input),
  );
}

registerTool(
  {
    ...write,
    name: 'travel_airport_update',
    title: 'Curate travel airport or station',
    description:
      'Sets travel-specific airport curation by code. Reference data stays read-only. For codes outside the reference dataset, provide the full station fields to add a standalone endpoint. Mode: write. Prerequisites: use an existing Place UUID target by name in servesPlace. Produces: the merged airport view.',
    inputSchema: travelAirportCurationUpdateInputSchema,
    outputSchema: rowOut,
    destructive: false,
    idempotent: true,
  },
  async (owner, input) => ({ airport: await updateTravelAirportCuration(owner, input) }),
);

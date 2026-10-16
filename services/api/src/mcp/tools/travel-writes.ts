import { z } from 'zod';

import {
  deleteTravelEntity,
  getTravelWriteEntity,
  writeTravelEntity,
} from '../../application/travel-write.service';
import {
  travelAirportCreateInputSchema,
  travelAirportUpdateInputSchema,
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
  airport: ['airport', 'Airport'],
  idea: ['idea', 'Idea'],
} as const;

function registerCreate(entity: keyof typeof names, schema: z.ZodType) {
  const [singular, title] = names[entity];
  registerTool(
    {
      ...write,
      name: `travel_${singular}_create`,
      title: `Create travel ${title.toLowerCase()}`,
      description: `Creates or returns an existing travel ${title.toLowerCase()}. Mode: write. Use when: a resolved travel ${title.toLowerCase()} needs to be recorded. Do not use when: the entity already exists and needs correction; use its update tool. Prerequisites: resolve referenced ids first. Produces: the ${title.toLowerCase()} id and legacyId.`,
      inputSchema: schema,
      outputSchema: rowOut,
      destructive: false,
      idempotent: false,
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
registerCreate('airport', travelAirportCreateInputSchema);
registerUpdate('airport', travelAirportUpdateInputSchema);
registerCreate('idea', travelIdeaCreateInputSchema);
registerUpdate('idea', travelIdeaUpdateInputSchema);

const getInput = z
  .object({ id: z.string().uuid().optional(), legacyId: z.string().optional() })
  .refine((v) => Boolean(v.id) !== Boolean(v.legacyId));
for (const entity of ['transport', 'stay'] as const) {
  registerTool(
    {
      ...read,
      name: `travel_${entity}_get`,
      title: `Get travel ${entity}`,
      description: `Gets one travel ${entity} by id or legacyId. Mode: read-only. Use when: one resolved ${entity} is needed. Do not use when: a collection is requested. Prerequisites: exactly one id or legacyId. Produces: the ${entity} snapshot.`,
      inputSchema: getInput,
      outputSchema: rowOut,
    },
    (owner, input) => getTravelWriteEntity(owner, entity, input),
  );
}

import {
  cloneTravelJourney,
  mergeTravelPlace,
  mergeTravelSegments,
  refreshTravelPlaces,
  reorderTravelSegments,
  saveTravelJourney,
} from '../../application/travel-maintenance.service';
import { deleteTravelEntity } from '../../application/travel-write.service';
import {
  travelEntityDeleteInputSchema,
  travelJourneyCloneInputSchema,
  travelMaintenanceOutputSchema,
  travelMergeInputSchema,
  travelPlaceRefreshInputSchema,
  travelReorderInputSchema,
  travelSegmentMergeInputSchema,
  travelJourneySaveInputSchema,
} from '../../schemas/travel-maintenance.schema';
import { registerTool } from '../tool-registry';

const write = { readOnly: false, scopes: ['travel:write'], resultCap: 100 } as const;

for (const entity of ['place', 'idea'] as const) {
  registerTool(
    {
      ...write,
      name: `travel_${entity}_delete`,
      title: `Delete travel ${entity}`,
      description: `Deletes an unused travel ${entity} after explicit confirmation. Mode: write. Use when: a resolved entity should be removed. Do not use when: the entity remains referenced; merge or repoint first. Prerequisites: id and iUnderstand=true. Produces: deleted snapshot or in-use refusal.`,
      inputSchema: travelEntityDeleteInputSchema,
      outputSchema: travelMaintenanceOutputSchema,
      destructive: true,
      idempotent: true,
      requiresConfirmation: true,
      preview: async () => null,
    },
    (owner, input) => deleteTravelEntity(owner, entity, input),
  );
}

registerTool(
  {
    ...write,
    name: 'travel_journey_clone',
    title: 'Clone travel journey',
    description:
      'Creates a draft copy of a journey and shifts its dated records, clearing booking references. Mode: write. Use when: planning a similar trip. Do not use when: editing the original journey. Prerequisites: source journey id. Produces: the new journey and copied counts.',
    inputSchema: travelJourneyCloneInputSchema,
    outputSchema: travelMaintenanceOutputSchema,
    destructive: false,
    idempotent: false,
  },
  (owner, input) => cloneTravelJourney(owner, input),
);

registerTool(
  {
    ...write,
    name: 'travel_segment_reorder',
    title: 'Reorder journey segments',
    description:
      'Atomically assigns segment sequence values for a complete journey order. Mode: write. Use when: the user explicitly changes stop order. Do not use when: changing only one stop field. Prerequisites: complete ordered segment id list. Produces: the new sequence.',
    inputSchema: travelReorderInputSchema,
    outputSchema: travelMaintenanceOutputSchema,
    destructive: false,
    idempotent: true,
  },
  (owner, input) => reorderTravelSegments(owner, input),
);

registerTool(
  {
    ...write,
    name: 'travel_segment_merge',
    title: 'Merge travel segments',
    description:
      'Merges one stop into another in the same journey, repointing stays and transport links. Mode: write. Use when: two stops are confirmed duplicates. Do not use when: they represent distinct visits. Prerequisites: both segment ids and iUnderstand=true. Produces: survivor and deleted snapshot.',
    inputSchema: travelSegmentMergeInputSchema,
    outputSchema: travelMaintenanceOutputSchema,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    preview: async (_owner, input) => ({
      fromSegmentId: input.fromSegmentId,
      intoSegmentId: input.intoSegmentId,
    }),
  },
  (owner, input) => mergeTravelSegments(owner, input),
);

registerTool(
  {
    ...write,
    name: 'travel_place_merge',
    title: 'Merge travel places',
    description:
      'Moves segment and residence references to a canonical travel place, then removes the source place. Mode: write. Use when: the operator confirms duplicate place identity. Do not use when: records are merely similar. Prerequisites: source and destination ids and iUnderstand=true. Produces: deleted snapshot and repointed count.',
    inputSchema: travelMergeInputSchema,
    outputSchema: travelMaintenanceOutputSchema,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    preview: async (_owner, input) => ({ fromId: input.fromId, intoId: input.intoId }),
  },
  (owner, input) => mergeTravelPlace(owner, input),
);

registerTool(
  {
    ...write,
    name: 'travel_place_refresh',
    title: 'Reconcile travel place fields',
    description:
      'Compares or explicitly refreshes stored place status and visit dates from segments. Mode: write. Use when: the operator requests a place reconciliation. Do not use when: validating discrepancies only. Prerequisites: review the full dry-run diff first. Produces: all changed fields.',
    inputSchema: travelPlaceRefreshInputSchema,
    outputSchema: travelMaintenanceOutputSchema,
    destructive: false,
    idempotent: true,
  },
  (owner, input) => refreshTravelPlaces(owner, input.dryRun),
);

registerTool(
  {
    ...write,
    name: 'travel_journey_save',
    title: 'Save travel journey dossier',
    description:
      'Atomically upserts a journey and its segments, transport, and stays. Mode: write. Use when: recording a complete trip dossier. Do not use when: correcting one field on an existing entity. Prerequisites: resolve all place, airport, and journey references. Produces: per-section change counters.',
    inputSchema: travelJourneySaveInputSchema,
    outputSchema: travelMaintenanceOutputSchema,
    destructive: false,
    idempotent: true,
    standaloneWrite: true,
  },
  (owner, input) => saveTravelJourney(owner, input),
);

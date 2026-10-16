import { travelEntityHistory, travelExport } from '../../application/travel-history-export.service';
import {
  travelEntityHistoryInputSchema,
  travelExportInputSchema,
  travelGenericOutputSchema,
} from '../../schemas/travel-history-export.schema';
import { registerTool } from '../tool-registry';

registerTool(
  {
    name: 'travel_entity_history',
    title: 'Read travel entity history',
    description:
      'Reads append-only changes for one travel entity, including deleted entities. Mode: read-only. Use when: the caller asks what changed. Do not use when: the current entity snapshot is enough. Prerequisites: provide entity type and stable id. Produces: audit event ids, operations, changed fields, snapshots, and timestamps.',
    inputSchema: travelEntityHistoryInputSchema,
    outputSchema: travelGenericOutputSchema,
    readOnly: true,
    scopes: ['travel:read'],
    resultCap: 100,
  },
  (owner, input) => travelEntityHistory(owner, input),
);

registerTool(
  {
    name: 'travel_export',
    title: 'Export travel data',
    description:
      'Exports all travel entities in native or source-sheet column format, including residences. Mode: read-only. Use when: the caller needs a backup or parity diff. Do not use when: records need to be imported or changed. Prerequisites: none. Produces: the complete travel dataset.',
    inputSchema: travelExportInputSchema,
    outputSchema: travelGenericOutputSchema,
    readOnly: true,
    scopes: ['travel:read'],
    resultCap: 1000,
  },
  (owner, input) => travelExport(owner, input.format),
);

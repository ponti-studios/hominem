import {
  travelDistance,
  travelInsights,
  travelSearch,
  travelStats,
  travelTimeline,
  travelUnresolved,
  travelValidate,
} from '../../application/travel-analytics.service';
import {
  travelDistanceInputSchema,
  travelDistanceOutputSchema,
  travelInsightsInputSchema,
  travelInsightsOutputSchema,
  travelSearchInputSchema,
  travelSearchOutputSchema,
  travelStatsInputSchema,
  travelStatsOutputSchema,
  travelTimelineInputSchema,
  travelTimelineOutputSchema,
  travelUnresolvedInputSchema,
  travelUnresolvedOutputSchema,
  travelValidateInputSchema,
  travelValidateOutputSchema,
} from '../../schemas/travel-analytics.schema';
import { registerTool } from '../tool-registry';

const analyticsReadTool = { readOnly: true, scopes: ['travel:read'], resultCap: 200 } as const;

registerTool(
  {
    ...analyticsReadTool,
    name: 'travel_unresolved',
    title: 'Show unresolved travel items',
    description:
      'Combines thin-evidence stays, open admin ideas, and integrity counts. Mode: read-only. Use when: the operator asks what travel records need triage. Do not use when: they ask for one entity or a broad text search. Prerequisites: none. Produces: stay and idea ids with validation counts.',
    inputSchema: travelUnresolvedInputSchema,
    outputSchema: travelUnresolvedOutputSchema,
  },
  (owner) => travelUnresolved(owner),
);
registerTool(
  {
    ...analyticsReadTool,
    name: 'travel_stats',
    title: 'Summarize travel statistics',
    description:
      'Summarizes segment-derived places, countries, journeys, legs, and distances. Mode: read-only. Use when: the user asks for travel totals or records by year. Do not use when: they ask for a detailed timeline. Prerequisites: none. Produces: journey and place UUIDs for the returned trip summaries.',
    inputSchema: travelStatsInputSchema,
    outputSchema: travelStatsOutputSchema,
  },
  (owner, input) => travelStats(owner, input),
);
registerTool(
  {
    ...analyticsReadTool,
    name: 'travel_search',
    title: 'Search travel records',
    description:
      'Searches journey names and notes, places, stays, carriers, booking references, and ideas. Mode: read-only. Use when: the user gives a text query across travel records. Do not use when: a precise entity filter is available. Prerequisites: a search query. Produces: matching UUIDs grouped by entity type.',
    inputSchema: travelSearchInputSchema,
    outputSchema: travelSearchOutputSchema,
  },
  (owner, input) => travelSearch(owner, input),
);
registerTool(
  {
    ...analyticsReadTool,
    name: 'travel_validate',
    title: 'Validate travel data',
    description:
      'Reports travel data integrity checks and offending entity references without changing records. Mode: read-only. Use when: the operator asks about consistency, import quality, or unresolved discrepancies. Do not use when: they ask to repair data. Prerequisites: none. Produces: entity UUIDs for findings.',
    inputSchema: travelValidateInputSchema,
    outputSchema: travelValidateOutputSchema,
  },
  (owner) => travelValidate(owner),
);
registerTool(
  {
    ...analyticsReadTool,
    name: 'travel_timeline',
    title: 'View travel timeline',
    description:
      'Interleaves dated journey stops with home gaps labelled from Residence periods. Mode: read-only. Use when: the user asks when trips happened or when they were home. Do not use when: they need aggregate counts only. Prerequisites: none. Produces: journey, segment, and residence references.',
    inputSchema: travelTimelineInputSchema,
    outputSchema: travelTimelineOutputSchema,
  },
  (owner, input) => travelTimeline(owner, input),
);
registerTool(
  {
    ...analyticsReadTool,
    name: 'travel_insights',
    title: 'Analyze travel patterns',
    description:
      'Ranks places, countries, routes, stays, travel years, and home periods from recorded travel data. Mode: read-only. Use when: the user asks for travel patterns or a next-trip summary. Do not use when: they ask for a complete event-by-event timeline. Prerequisites: none. Produces: place, journey, leg, and residence references.',
    inputSchema: travelInsightsInputSchema,
    outputSchema: travelInsightsOutputSchema,
  },
  (owner, input) => travelInsights(owner, input),
);
registerTool(
  {
    ...analyticsReadTool,
    name: 'travel_distance',
    title: 'Calculate airport distance',
    description:
      'Calculates haversine distance between two registered airports and resolves their served places. Mode: read-only. Use when: the user asks how far a route is. Do not use when: they ask for recorded transport legs or trip totals. Prerequisites: airport codes. Produces: airport ids and resolved place names.',
    inputSchema: travelDistanceInputSchema,
    outputSchema: travelDistanceOutputSchema,
  },
  (owner, input) => travelDistance(owner, input),
);

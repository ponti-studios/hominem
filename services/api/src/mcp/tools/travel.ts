import { importTravelRows } from '../../application/travel-import.service';
import {
  getTravelAirport,
  getTravelJourney,
  getTravelPlace,
  getTravelSegment,
  getTravelWishlist,
  listTravelAirports,
  listTravelCountries,
  listTravelIdeas,
  listTravelJourneys,
  listTravelPlaces,
  listTravelSegments,
  listTravelStays,
  listTravelTransport,
  lookupTravelBooking,
} from '../../application/travel-read.service';
import {
  createTravelResidence,
  deleteTravelResidence,
  getTravelResidence,
  listTravelResidences,
  updateTravelResidence,
} from '../../application/travel-residences.service';
import { listTripHistory } from '../../application/travel.service';
import {
  travelImportInputSchema,
  travelImportOutputSchema,
} from '../../schemas/travel-import.schema';
import {
  travelAirportGetInputSchema,
  travelAirportListInputSchema,
  travelAirportListOutputSchema,
  travelBookingLookupInputSchema,
  travelBookingLookupOutputSchema,
  travelCountriesInputSchema,
  travelCountriesOutputSchema,
  travelEntityOutputSchema,
  travelIdeaListInputSchema,
  travelIdeaListOutputSchema,
  travelJourneyGetInputSchema,
  travelJourneyListInputSchema,
  travelJourneyListOutputSchema,
  travelPlaceGetInputSchema,
  travelPlaceListInputSchema,
  travelPlaceListOutputSchema,
  travelSegmentGetInputSchema,
  travelSegmentListInputSchema,
  travelSegmentListOutputSchema,
  travelStayListInputSchema,
  travelStayListOutputSchema,
  travelTransportListInputSchema,
  travelTransportListOutputSchema,
  travelWishlistInputSchema,
  travelWishlistOutputSchema,
} from '../../schemas/travel-read.schema';
import {
  travelResidenceCreateInputSchema,
  travelResidenceDeleteInputSchema,
  travelResidenceGetInputSchema,
  travelResidenceListInputSchema,
  travelResidenceOutputSchema,
  travelResidenceUpdateInputSchema,
} from '../../schemas/travel-residences.schema';
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
    guidance: {
      whenToUse: 'The user asks about past or upcoming trips, destinations, dates, or attendees.',
      whenNotToUse: 'Do not use for restaurant or venue visits without a travel question.',
      produces: ['trip ids', 'trip dates', 'trip destinations', 'attendee names'],
    },
  },
  (ownerUserId, input) => listTripHistory(ownerUserId, input),
);

const readTool = {
  readOnly: true,
  scopes: ['travel:read'],
  resultCap: 200,
} as const;

registerTool(
  {
    ...readTool,
    name: 'travel_journey_list',
    title: 'List travel journeys',
    description:
      'Lists journeys with derived stop summaries and filters. Mode: read-only. Use when: the user asks for trips, journeys, or a date range. Do not use when: the user asks only for legacy calendar trips; use trip_history. Prerequisites: none. Produces: journey ids and legacyIds.',
    inputSchema: travelJourneyListInputSchema,
    outputSchema: travelJourneyListOutputSchema,
  },
  (owner, input) => listTravelJourneys(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_journey_get',
    title: 'Get travel journey',
    description:
      'Returns a complete journey dossier with stops, legs, resolved airports, distances, and stays. Mode: read-only. Use when: the user asks about one journey. Do not use when: a list or aggregate answers the question. Prerequisites: identify by id or legacyId. Produces: journey, segment, transport, airport, and stay ids.',
    inputSchema: travelJourneyGetInputSchema,
    outputSchema: travelEntityOutputSchema,
  },
  (owner, input) => getTravelJourney(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_segment_list',
    title: 'List travel segments',
    description:
      'Lists journey stops with optional journey, place, and date filters. Mode: read-only. Use when: the user asks which places a journey includes or when a stop occurred. Do not use when: the full journey dossier is needed. Prerequisites: none. Produces: segment and journey ids.',
    inputSchema: travelSegmentListInputSchema,
    outputSchema: travelSegmentListOutputSchema,
  },
  (owner, input) => listTravelSegments(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_segment_get',
    title: 'Get travel segment',
    description:
      'Returns one stop with its journey, arrival and departure legs, and stays. Mode: read-only. Use when: the user asks about a particular stop. Do not use when: they mean a restaurant or venue visit. Prerequisites: identify by id or legacyId. Produces: segment, journey, leg, and stay ids.',
    inputSchema: travelSegmentGetInputSchema,
    outputSchema: travelEntityOutputSchema,
  },
  (owner, input) => getTravelSegment(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_place_list',
    title: 'List travel places',
    description:
      'Lists canonical travel places with derived visit and residence relationships. Mode: read-only. Use when: the user asks about destinations, countries, or visited and wanted places. Do not use when: they ask about venues or restaurants; use place_visit_history. Prerequisites: none. Produces: travel place ids and legacyIds.',
    inputSchema: travelPlaceListInputSchema,
    outputSchema: travelPlaceListOutputSchema,
  },
  (owner, input) => listTravelPlaces(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_place_get',
    title: 'Get travel place',
    description:
      'Returns one travel place with visit history, residence periods, and derived relationships. Mode: read-only. Use when: the user asks if or when they visited or lived in a destination. Do not use when: they ask about a restaurant, venue, or address visit. Prerequisites: identify by id or legacyId. Produces: place, journey, segment, and residence ids.',
    inputSchema: travelPlaceGetInputSchema,
    outputSchema: travelEntityOutputSchema,
  },
  (owner, input) => getTravelPlace(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_countries',
    title: 'List travel countries',
    description:
      'Returns countries and places derived from journey segments with a transparent comparison to stored place statuses. Mode: read-only. Use when: the user asks which countries they travelled to. Do not use when: they ask for a destination wish list. Prerequisites: none. Produces: country and place names.',
    inputSchema: travelCountriesInputSchema,
    outputSchema: travelCountriesOutputSchema,
  },
  (owner) => listTravelCountries(owner),
);
registerTool(
  {
    ...readTool,
    name: 'travel_transport_list',
    title: 'List travel transport',
    description:
      'Lists flights and rail legs with airport and served-place resolution. Mode: read-only. Use when: the user asks about flights, trains, carriers, routes, dates, or bookings. Do not use when: they ask about lodging. Prerequisites: none. Produces: transport, journey, and airport codes.',
    inputSchema: travelTransportListInputSchema,
    outputSchema: travelTransportListOutputSchema,
  },
  (owner, input) => listTravelTransport(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_airport_list',
    title: 'List travel airports',
    description:
      'Lists airports with served places and leg counts. Mode: read-only. Use when: the user asks about airports, codes, or destinations served. Do not use when: they ask about venue locations. Prerequisites: none. Produces: airport ids and codes.',
    inputSchema: travelAirportListInputSchema,
    outputSchema: travelAirportListOutputSchema,
  },
  (owner, input) => listTravelAirports(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_airport_get',
    title: 'Get travel airport',
    description:
      'Gets an airport and its served place by code or id. Mode: read-only. Use when: the user asks what an airport code serves. Do not use when: they ask about venues. Prerequisites: provide an airport code or id. Produces: airport id and code.',
    inputSchema: travelAirportGetInputSchema,
    outputSchema: travelEntityOutputSchema,
  },
  (owner, input) => getTravelAirport(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_stay_list',
    title: 'List travel stays',
    description:
      'Lists lodging records with optional city, journey, segment, and evidence filters. Mode: read-only. Use when: the user asks where they stayed or about lodging plans. Do not use when: they ask about flight or rail bookings. Prerequisites: none. Produces: stay, journey, and segment ids.',
    inputSchema: travelStayListInputSchema,
    outputSchema: travelStayListOutputSchema,
  },
  (owner, input) => listTravelStays(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_booking_lookup',
    title: 'Look up travel booking',
    description:
      'Searches transport and lodging bookings by exact or partial booking reference. Mode: read-only. Use when: the user provides a travel booking reference. Do not use when: they ask for all legs or stays. Prerequisites: booking reference. Produces: matching transport and stay ids.',
    inputSchema: travelBookingLookupInputSchema,
    outputSchema: travelBookingLookupOutputSchema,
  },
  (owner, input) => lookupTravelBooking(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_wishlist',
    title: 'Show travel wishlist',
    description:
      'Returns wanted places, unlinked wishlist stays, and open experience ideas in separate sections. Mode: read-only. Use when: the user asks what travel plans or ideas are on their wish list. Do not use when: they ask for completed visits. Prerequisites: none. Produces: place, stay, and idea ids.',
    inputSchema: travelWishlistInputSchema,
    outputSchema: travelWishlistOutputSchema,
  },
  (owner, input) => getTravelWishlist(owner, input),
);
registerTool(
  {
    ...readTool,
    name: 'travel_idea_list',
    title: 'List travel ideas',
    description:
      'Lists travel ideas by status and type. Mode: read-only. Use when: the user asks about recorded travel ideas. Do not use when: they ask for the full travel wish list. Prerequisites: none. Produces: idea ids and legacyIds.',
    inputSchema: travelIdeaListInputSchema,
    outputSchema: travelIdeaListOutputSchema,
  },
  (owner, input) => listTravelIdeas(owner, input),
);

registerTool(
  {
    name: 'travel_residence_list',
    title: 'List residences',
    description: 'Lists residences and their canonical travel places.',
    inputSchema: travelResidenceListInputSchema,
    outputSchema: travelResidenceOutputSchema.array(),
    readOnly: true,
    scopes: ['travel:read'],
    resultCap: 100,
  },
  (owner, input) => listTravelResidences(owner, input),
);
registerTool(
  {
    name: 'travel_residence_get',
    title: 'Get residence',
    description: 'Gets a residence by id or legacy id.',
    inputSchema: travelResidenceGetInputSchema,
    outputSchema: travelResidenceOutputSchema.nullable(),
    readOnly: true,
    scopes: ['travel:read'],
    resultCap: 1,
  },
  (owner, input) => getTravelResidence(owner, input),
);
registerTool(
  {
    name: 'travel_residence_create',
    title: 'Create residence',
    description: 'Creates a residence for an owned travel place.',
    inputSchema: travelResidenceCreateInputSchema,
    outputSchema: travelResidenceOutputSchema.nullable(),
    readOnly: false,
    scopes: ['travel:write'],
    idempotent: true,
    resultCap: 1,
  },
  (owner, input) => createTravelResidence(owner, input),
);
registerTool(
  {
    name: 'travel_residence_update',
    title: 'Update residence',
    description: 'Replaces residence periods and/or notes.',
    inputSchema: travelResidenceUpdateInputSchema,
    outputSchema: travelResidenceOutputSchema.nullable(),
    readOnly: false,
    scopes: ['travel:write'],
    idempotent: true,
    resultCap: 1,
  },
  (owner, input) => updateTravelResidence(owner, input),
);
registerTool(
  {
    name: 'travel_residence_delete',
    title: 'Delete residence',
    description: 'Deletes a residence after explicit confirmation; its place remains.',
    inputSchema: travelResidenceDeleteInputSchema,
    outputSchema: travelResidenceOutputSchema.nullable(),
    readOnly: false,
    scopes: ['travel:write'],
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    resultCap: 1,
  },
  (owner, input) => deleteTravelResidence(owner, input.id),
);

registerTool(
  {
    readOnly: false,
    scopes: ['travel:write'],
    destructive: true,
    idempotent: true,
    standaloneWrite: true,
    requiresConfirmation: true,
    name: 'travel_import',
    title: 'Travel Import',
    description:
      'Batch upsert the seven travel entities from sheet-shaped rows. Append is idempotent; replace clears this user’s travel records first and requires explicit confirmation. dryRun validates and projects counts without writing.',
    inputSchema: travelImportInputSchema,
    outputSchema: travelImportOutputSchema,
    resultCap: 1000,
    guidance: {
      whenToUse: 'Import or reconcile a batch of travel records.',
      whenNotToUse: 'Do not use replace without explicit confirmation or bypass row rejections.',
    },
    preview: async (_ownerUserId, input) => {
      const parsed = travelImportInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const { mode, dryRun, iUnderstand, rows } = parsed.data;
      if (mode !== 'replace' || dryRun || iUnderstand) return null;
      const count = Object.values(rows).reduce(
        (total, entityRows) => total + (Array.isArray(entityRows) ? entityRows.length : 0),
        0,
      );
      return { mode: 'replace', count };
    },
  },
  (ownerUserId, input) => importTravelRows(ownerUserId, input),
);

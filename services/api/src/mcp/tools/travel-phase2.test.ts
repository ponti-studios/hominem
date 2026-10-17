import { describe, expect, it } from 'vitest';

import './travel';
import './travel-writes';
import './travel-maintenance';
import './travel-history-export';
import './travel-analytics';
import { getToolDefinition, listTools } from '../tool-registry';

const phaseTwoTools = [
  'travel_entity_history',
  'travel_export',
  'travel_journey_create',
  'travel_journey_update',
  'travel_journey_delete',
  'travel_segment_create',
  'travel_segment_update',
  'travel_segment_delete',
  'travel_transport_create',
  'travel_transport_update',
  'travel_transport_delete',
  'travel_transport_get',
  'travel_stay_create',
  'travel_stay_update',
  'travel_stay_delete',
  'travel_stay_get',
  'travel_place_create',
  'travel_place_update',
  'travel_place_delete',
  'travel_place_refresh',
  'travel_place_merge',
  'travel_airport_update',
  'travel_idea_create',
  'travel_idea_update',
  'travel_idea_delete',
  'travel_journey_save',
  'travel_journey_clone',
  'travel_segment_reorder',
  'travel_segment_merge',
];

describe('travel MCP phase 2 registration', () => {
  it('registers the complete travel write surface with write scopes on mutations', () => {
    expect(phaseTwoTools).toHaveLength(29);
    for (const name of phaseTwoTools) expect(getToolDefinition(name), name).toBeDefined();
    for (const name of phaseTwoTools.filter(
      (name) =>
        ![
          'travel_entity_history',
          'travel_export',
          'travel_transport_get',
          'travel_stay_get',
        ].includes(name),
    )) {
      expect(getToolDefinition(name), name).toMatchObject({
        readOnly: false,
        scopes: ['travel:write'],
      });
    }
    for (const name of [
      'travel_entity_history',
      'travel_export',
      'travel_transport_get',
      'travel_stay_get',
    ]) {
      expect(getToolDefinition(name), name).toMatchObject({
        readOnly: true,
        scopes: ['travel:read'],
      });
    }
  });

  it('does not advertise Place creation as retry-idempotent', () => {
    expect(getToolDefinition('travel_place_create')).toMatchObject({ idempotent: false });
    expect(getToolDefinition('travel_journey_create')).toMatchObject({ idempotent: true });
  });

  it('exposes 51 travel tools and removes airport create, merge, delete, and request tools', () => {
    expect(listTools().filter(({ name }) => name.startsWith('travel_'))).toHaveLength(51);
    for (const name of [
      'travel_airport_create',
      'travel_airport_merge',
      'travel_airport_delete',
      'travel_airport_request',
      'travel_airport_request_list',
    ]) {
      expect(getToolDefinition(name), name).toBeUndefined();
    }
    expect(getToolDefinition('travel_airport_update')).toMatchObject({
      readOnly: false,
      scopes: ['travel:write'],
    });
  });

  it('does not request a second confirmation after iUnderstand on deletes', async () => {
    const deleteTools = phaseTwoTools.filter((name) => name.endsWith('_delete'));
    for (const name of deleteTools) {
      const preview = getToolDefinition(name)?.preview;
      expect(preview, name).toBeTypeOf('function');
      await expect(preview?.('owner', { iUnderstand: true })).resolves.toBeNull();
    }
  });
});

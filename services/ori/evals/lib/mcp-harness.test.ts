import { expect, test } from 'bun:test';

import { executeFixtureTool } from './mcp-fixtures';
import { tools, toolsByDomain } from './mcp-tool-catalog';

test('an eval case can provide its own tool result without changing shared fixtures', () => {
  const fixture = {
    responses: {
      travel_countries: { output: { countries: [{ country: 'Syntheticland' }] } },
    },
  };
  const state = { calls: [], fixture };

  expect(executeFixtureTool('travel_countries', {}, state).output).toEqual({
    countries: [{ country: 'Syntheticland' }],
  });
});

test('tool surfaces are declared by the eval case', () => {
  expect(toolsByDomain.finance.every((tool) => tool.function.name.startsWith('finance_'))).toEqual(
    true,
  );
  expect(tools.some((tool) => tool.function.name === 'travel_countries')).toEqual(true);
  expect(toolsByDomain.travel.some((tool) => tool.function.name === 'travel_countries')).toEqual(
    false,
  );
  expect(toolsByDomain.travelPresence[0]?.function.name).toEqual('travel_countries');
});

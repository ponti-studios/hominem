import { describe, expect, it } from 'vitest';

import { createInjection, createWorld, injectionPresets, type WorldEvent } from './world.js';

const world = createWorld(new Date('2026-11-05T17:05:00.000Z'));

function selectedGoalIds(event: WorldEvent): string[] {
  return world.goals
    .filter((goal) => goal.domains.some((domain) => event.changedDomains.includes(domain)))
    .map((goal) => goal.id)
    .sort();
}

function contextGoalIds(event: WorldEvent): string[] {
  return event.contexts.map((context) => context.goalId).sort();
}

describe('studio world', () => {
  it('anchors the story to a Thursday in a seven-day week', () => {
    expect(world.days).toHaveLength(7);
    expect(world.storyDayIndex).toBe(3);
    expect(new Date(world.storyNow).getUTCDay()).toBe(4);
  });

  it('assembles a context for every goal a trigger selects', () => {
    for (const event of world.events) {
      expect(contextGoalIds(event), event.id).toEqual(selectedGoalIds(event));
      for (const context of event.contexts) {
        expect(context.after.length, `${event.id}:${context.goalId}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps evidence ids unique across the deck', () => {
    const ids = world.events.flatMap((event) =>
      event.contexts.flatMap((context) =>
        [...context.before, ...context.after].map((item) => item.id),
      ),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds every injection with matching contexts and unique evidence', () => {
    for (const [index, preset] of injectionPresets.entries()) {
      const event = createInjection(preset.id, world, world.storyNow, index + 1);
      expect(event, preset.id).not.toBeNull();
      if (!event) continue;
      expect(contextGoalIds(event), preset.id).toEqual(selectedGoalIds(event));
      expect(event.injected).toBe(true);
      const ids = event.contexts.flatMap((context) => [...context.before, ...context.after]);
      expect(new Set(ids.map((item) => item.id)).size).toBe(ids.length);
    }
  });
});

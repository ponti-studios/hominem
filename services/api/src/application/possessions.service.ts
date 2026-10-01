import { db } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import {
  ContainerRepository,
  PossessionRepository,
  type ContainerRecord,
  type PossessionRecord,
  type PossessionSummary,
} from '@hominem/db/possessions';
import { runInTransaction } from '@hominem/db/transaction';

import type {
  ContainerCreateInput,
  ContainerUpdateInput,
  PossessionCreateInput,
  PossessionListQuery,
  PossessionSearchInput,
  PossessionUpdateInput,
} from '../schemas/possessions.schema';

// The single implementation behind the possessions routes. Writes that validate a reference
// (container ownership, nesting cycles) run in a transaction so a rejection leaves nothing behind.

export async function listPossessions(
  userId: string,
  query: PossessionListQuery,
): Promise<PossessionRecord[]> {
  return PossessionRepository.list(db, {
    userId,
    ...(query.status.length ? { statuses: query.status } : {}),
    ...(query.archived ? { archived: query.archived === 'true' } : {}),
    ...(query.containerId ? { containerId: query.containerId } : {}),
    ...(query.limit ? { limit: query.limit } : {}),
  });
}

export const createPossession = (
  userId: string,
  input: PossessionCreateInput,
): Promise<PossessionRecord> =>
  runInTransaction((trx) => PossessionRepository.create(trx, userId, input));

export const updatePossession = (
  userId: string,
  id: string,
  input: PossessionUpdateInput,
): Promise<PossessionRecord> =>
  runInTransaction((trx) => PossessionRepository.update(trx, userId, id, input));

export const removePossession = (userId: string, id: string): Promise<void> =>
  PossessionRepository.remove(db, userId, id);

export const listContainers = (userId: string): Promise<ContainerRecord[]> =>
  ContainerRepository.list(db, userId);

export const createContainer = (
  userId: string,
  input: ContainerCreateInput,
): Promise<ContainerRecord> =>
  runInTransaction((trx) => ContainerRepository.create(trx, userId, input));

export const updateContainer = (
  userId: string,
  id: string,
  input: ContainerUpdateInput,
): Promise<ContainerRecord> =>
  runInTransaction((trx) => ContainerRepository.update(trx, userId, id, input));

export const removeContainer = (userId: string, id: string): Promise<void> =>
  ContainerRepository.remove(db, userId, id);

// MCP-facing variants. A missing row is an expected outcome for a tool, so these return null/false
// instead of throwing; the REST routes keep using the throwing functions above.
// `missing` is the exact message of the target row's NotFoundError, so a missing *reference*
// (e.g. "Container not found" while updating a possession) still surfaces as a real error.
const orNull = async <T>(missing: string, run: () => Promise<T>): Promise<T | null> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotFoundError && error.message === missing) return null;
    throw error;
  }
};

export const searchPossessions = (
  userId: string,
  input: PossessionSearchInput,
): Promise<PossessionRecord[]> =>
  PossessionRepository.list(db, {
    userId,
    ...(input.status?.length ? { statuses: input.status } : {}),
    ...(input.archived !== undefined ? { archived: input.archived } : {}),
    ...(input.containerId ? { containerId: input.containerId } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.query ? { query: input.query } : {}),
    limit: input.limit,
  });

export const getPossession = (userId: string, id: string): Promise<PossessionRecord | null> =>
  PossessionRepository.get(db, userId, id);

export const summarizePossessions = (userId: string): Promise<PossessionSummary> =>
  PossessionRepository.summarize(db, userId);

export const movePossessions = (
  userId: string,
  ids: string[],
  containerId: string | null,
): Promise<{ moved: string[]; missing: string[] }> =>
  runInTransaction(async (trx) => {
    const moved = await PossessionRepository.move(trx, userId, [...new Set(ids)], containerId);
    const movedSet = new Set(moved);
    return { moved, missing: [...new Set(ids)].filter((id) => !movedSet.has(id)) };
  });

export const updatePossessionOrNull = (userId: string, id: string, input: PossessionUpdateInput) =>
  orNull('Possession not found', () => updatePossession(userId, id, input));

export const removePossessionIfExists = async (userId: string, id: string): Promise<boolean> =>
  (await orNull('Possession not found', () => removePossession(userId, id).then(() => true))) ??
  false;

export const listContainersLimited = (userId: string, limit: number): Promise<ContainerRecord[]> =>
  ContainerRepository.list(db, userId, { limit });

export const getContainer = (userId: string, id: string): Promise<ContainerRecord | null> =>
  ContainerRepository.get(db, userId, id);

// A container with its direct child containers and the possessions sitting in it.
export async function getContainerContents(userId: string, id: string, limit: number) {
  const container = await ContainerRepository.get(db, userId, id);
  if (!container) return null;
  const [children, possessions] = await Promise.all([
    ContainerRepository.list(db, userId, { parentContainerId: id, limit }),
    PossessionRepository.list(db, { userId, containerId: id, limit }),
  ]);
  return { container, children, possessions };
}

export const updateContainerOrNull = (userId: string, id: string, input: ContainerUpdateInput) =>
  orNull('Container not found', () => updateContainer(userId, id, input));

export const removeContainerIfExists = async (userId: string, id: string): Promise<boolean> =>
  (await orNull('Container not found', () => removeContainer(userId, id).then(() => true))) ??
  false;

import { db } from '@hominem/db/core';
import {
  ContainerRepository,
  PossessionRepository,
  type ContainerRecord,
  type PossessionRecord,
} from '@hominem/db/possessions';
import { runInTransaction } from '@hominem/db/transaction';

import type {
  ContainerCreateInput,
  ContainerUpdateInput,
  PossessionCreateInput,
  PossessionListQuery,
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

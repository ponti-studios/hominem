import type { Selectable, Session as DbSession, User as DbUser } from '@hominem/db';

export type User = Selectable<DbUser>;
export type Session = Selectable<DbSession>;

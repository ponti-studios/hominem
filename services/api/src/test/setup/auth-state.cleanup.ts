import { authDb } from '@hominem/db';

/** Clear Better Auth tables used by API auth tests. */
export async function cleanupAuthState(): Promise<void> {
  await authDb.deleteFrom('passkey').execute();
  await authDb.deleteFrom('session').execute();
  await authDb.deleteFrom('account').execute();
  await authDb.deleteFrom('verification').execute();
  await authDb.deleteFrom('user').execute();
}

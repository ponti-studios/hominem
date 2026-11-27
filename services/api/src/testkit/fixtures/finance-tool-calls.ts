// Short ways into finance MCP tools that several cases repeat. Register the tools in the test file.
import { callTool } from '../../mcp/tool-registry';
import { structuredContent } from './mcp-content';

type ListedAccount = { id?: string; name?: string; includeInNetWorth?: boolean };

export async function listedAccounts<Account extends object = ListedAccount>(
  userId: string,
  args: Record<string, unknown> = {},
) {
  const result = await callTool(userId, 'finance_accounts', args);
  return structuredContent<{ accounts?: Account[] }>(result).accounts ?? [];
}

/** Upserts one USD transaction through the tool and hands back its structured content. */
export async function upsertTransaction<Content extends object>(
  userId: string,
  input: { account: string; description: string } & Record<string, unknown>,
): Promise<Partial<Content>> {
  return structuredContent<Content>(
    await callTool(userId, 'finance_transaction_upsert', {
      postedOn: '2026-05-08',
      amountCents: -123400,
      currencyCode: 'USD',
      ...input,
    }),
  );
}

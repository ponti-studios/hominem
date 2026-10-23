import { writeFileSync } from 'node:fs';

/** Write the API's model-facing MCP catalog as deterministic JSON for offline consumers. */
const isolatedEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://catalog:catalog@127.0.0.1:1/catalog',
  REDIS_URL: 'redis://127.0.0.1:1',
  BETTER_AUTH_SECRET: 'catalog-export-only-secret-not-for-authentication',
  RESEND_API_KEY: 'catalog-export-only',
  RESEND_FROM_EMAIL: 'catalog@example.invalid',
  RESEND_FROM_NAME: 'Catalog Export',
  OPENROUTER_API_KEY: 'catalog-export-only',
};

Object.assign(process.env, isolatedEnvironment);

try {
  const [
    { ensureMcpToolsRegistered },
    { listTools },
    { describeCapability },
    { convertSchemaToJsonSchema },
  ] = await Promise.all([
    import('../src/mcp/register-tools'),
    import('../src/mcp/tool-registry'),
    import('../src/mcp/tool-planner'),
    import('@hominem/ai'),
  ]);

  await ensureMcpToolsRegistered();
  const catalog = listTools().map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: describeCapability(tool),
      parameters: convertSchemaToJsonSchema(tool.chatInputSchema ?? tool.inputSchema),
    },
  }));

  const outputIndex = process.argv.indexOf('--output');
  const outputPath = process.argv[outputIndex + 1];
  if (outputIndex < 0 || !outputPath) {
    throw new Error('Pass --output <path> for the generated catalog');
  }
  writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
  process.stdout.write('MCP eval catalog exported.\n');
  process.exit(0);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
}

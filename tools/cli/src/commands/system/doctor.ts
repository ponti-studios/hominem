import { Command } from '@oclif/core';
import fs from 'node:fs/promises';
import { z } from 'zod';

import { getConfigPath, loadConfigV2 } from '@/config';
import { validateWithZod } from '@/utils/zod-validation';

const outputSchema = z.object({
  checks: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['pass', 'warn', 'fail']),
      message: z.string(),
    }),
  ),
});

export default class SystemDoctor extends Command {
  static description = 'Run CLI diagnostics';
  static summary = 'Run CLI diagnostics';

  static override flags = {};

  static enableJsonFlag = true;

  async run(): Promise<z.infer<typeof outputSchema>> {
    const checks: Array<{ id: string; status: 'pass' | 'warn' | 'fail'; message: string }> = [];
    const configPath = getConfigPath();

    checks.push({
      id: 'runtime.node',
      status: 'pass',
      message: `node ${process.version}`,
    });

    try {
      await fs.access(configPath);
      const config = await loadConfigV2();
      checks.push({
        id: 'config.v2',
        status: config.version === 2 ? 'pass' : 'fail',
        message: `config version ${config.version}`,
      });
    } catch {
      checks.push({
        id: 'config.v2',
        status: 'warn',
        message: `config missing at ${configPath}; run 'hominem config init'`,
      });
    }

    const output = {
      checks,
    };

    validateWithZod(outputSchema, output);
    return output;
  }
}

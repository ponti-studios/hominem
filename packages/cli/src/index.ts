#!/usr/bin/env bun
import { runCli } from './cli.js';

await runCli(process.argv.slice(2));

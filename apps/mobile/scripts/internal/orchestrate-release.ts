import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type ReleaseVariant = 'preview' | 'production';

type JsonObject = Record<string, unknown>;

type BuildRecord = {
  id: string | null;
  platform: string | null;
  status: string | null;
  version: string | null;
  buildVersion: string | null;
  detailsPageUrl: string | null;
  artifactsUrl: string | null;
  raw: unknown;
};

type SubmissionRecord = {
  id: string | null;
  buildId: string | null;
  platform: string | null;
  status: string | null;
  detailsPageUrl: string | null;
  raw: unknown;
};

type ReleaseManifest = {
  variant: ReleaseVariant;
  startedAt: string;
  completedAt: string | null;
  releaseStatus: 'pending' | 'success' | 'failed';
  submitRequested: boolean;
  gitSha: string | null;
  gitRef: string | null;
  actor: string | null;
  build: {
    status: string;
    records: BuildRecord[];
    raw: unknown[];
  };
  submissions: {
    status: string;
    records: SubmissionRecord[];
    raw: unknown[];
  };
  errors: Array<{ message: string }>;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

const SUCCESS_BUILD_STATUSES = new Set(['finished']);
const SUCCESS_SUBMISSION_STATUSES = new Set(['finished', 'submitted', 'completed', 'success']);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileDir = resolve(scriptDir, '../..');
const releasesDir = resolve(mobileDir, 'artifacts/releases');

function titleForVariant(variant: ReleaseVariant) {
  return variant === 'preview' ? 'Preview Release' : 'Production Release';
}

function usage(): never {
  throw new Error(
    'usage: bun scripts/internal/orchestrate-release.ts <preview|production> [--submit]',
  );
}

function parseArgs(argv: string[]) {
  const [variant, ...flags] = argv;
  if (variant !== 'preview' && variant !== 'production') {
    usage();
  }

  let submit = false;
  for (const flag of flags) {
    if (flag === '--submit') {
      submit = true;
      continue;
    }

    if (flag === '--no-submit') {
      submit = false;
      continue;
    }

    usage();
  }

  return {
    variant,
    submit,
  } as const;
}

function appendGithubStepSummary(lines: string[]) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  appendFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

function writeGithubStepSummary(
  variant: ReleaseVariant,
  manifestPath: string,
  manifest: ReleaseManifest,
) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  try {
    const lines = [
      `## ${titleForVariant(variant)}`,
      '',
      `**Commit:** \`${process.env.GITHUB_SHA ?? manifest.gitSha ?? 'unknown'}\``,
      `**Branch:** \`${process.env.GITHUB_REF_NAME ?? process.env.GITHUB_REF ?? manifest.gitRef ?? 'unknown'}\``,
    ];

    if (variant === 'production') {
      lines.push(
        `**Triggered by:** \`${process.env.GITHUB_ACTOR ?? manifest.actor ?? 'unknown'}\``,
      );
    }

    lines.push(`**Release status:** ${manifest.releaseStatus}`);
    lines.push(`**Build status:** ${manifest.build.status}`);

    if (variant === 'production') {
      lines.push(`**Submission status:** ${manifest.submissions.status}`);
    }

    lines.push('', '### Builds');

    for (const build of manifest.build.records) {
      lines.push(
        `- ${build.platform ?? 'unknown'}: ${build.status ?? 'unknown'} (${build.id ?? 'no-id'})`,
      );
    }

    if (variant === 'production' && manifest.submissions.records.length > 0) {
      lines.push('', '### Submissions');

      for (const submission of manifest.submissions.records) {
        lines.push(
          `- ${submission.platform ?? 'unknown'}: ${submission.status ?? 'unknown'} (${submission.id ?? 'no-id'})`,
        );
      }
    }

    if (manifest.errors.length > 0) {
      lines.push('', '### Errors');

      for (const error of manifest.errors) {
        lines.push(`- ${error.message}`);
      }
    }

    lines.push('', `Manifest: \`${manifestPath}\``);
    appendGithubStepSummary(lines);
  } catch (error) {
    process.stderr.write(
      `[orchestrate-release] failed to write GitHub summary: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}

function readString(source: unknown, ...keys: string[]): string | null {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const record = source as JsonObject;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

function readNestedString(source: unknown, path: string[]): string | null {
  let current: unknown = source;

  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return null;
    }
    current = (current as JsonObject)[segment];
  }

  return typeof current === 'string' && current.length > 0 ? current : null;
}

function normalizeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

async function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return await new Promise<CommandResult>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: mobileDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        rejectPromise(
          new Error(
            `Command not found: ${command}. Install eas-cli before running release builds.`,
          ),
        );
        return;
      }

      rejectPromise(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(
          `${command} ${args.join(' ')} exited with code ${code}${stderr ? `\n${stderr.trim()}` : ''}`,
        ),
      );
    });
  });
}

async function getGitSha(): Promise<string | null> {
  try {
    const result = await runCommand('git', ['rev-parse', 'HEAD']);
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

function parseJson(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('Expected JSON output from EAS CLI, but stdout was empty.');
  }

  return JSON.parse(trimmed);
}

function normalizeBuildRecord(raw: unknown): BuildRecord {
  return {
    id: readString(raw, 'id'),
    platform: readString(raw, 'platform'),
    status: readString(raw, 'status'),
    version: readString(raw, 'appVersion', 'appVersionName'),
    buildVersion: readString(raw, 'appBuildVersion', 'buildVersion'),
    detailsPageUrl:
      readString(raw, 'detailsPageUrl', 'webpageUrl', 'dashboardUrl') ??
      readNestedString(raw, ['artifacts', 'buildUrl']),
    artifactsUrl:
      readNestedString(raw, ['artifacts', 'applicationArchiveUrl']) ??
      readNestedString(raw, ['artifacts', 'buildUrl']),
    raw,
  };
}

function normalizeSubmissionRecord(build: BuildRecord, raw: unknown): SubmissionRecord {
  return {
    id: readString(raw, 'id'),
    buildId: readString(raw, 'buildId') ?? build.id,
    platform: readString(raw, 'platform') ?? build.platform,
    status: readString(raw, 'status'),
    detailsPageUrl: readString(raw, 'detailsPageUrl', 'dashboardUrl', 'webpageUrl'),
    raw,
  };
}

function appendGithubOutput(name: string, value: string) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<__EOF__\n${value}\n__EOF__\n`);
}

async function writeManifest(manifestPath: string, manifest: ReleaseManifest) {
  await mkdir(releasesDir, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function submitBuild(build: BuildRecord, variant: ReleaseVariant) {
  if (!build.id || !build.platform) {
    throw new Error(
      `Cannot submit build without id and platform. Received ${JSON.stringify(build)}.`,
    );
  }

  const result = await runCommand('eas', [
    'submit',
    '--platform',
    build.platform,
    '--id',
    build.id,
    '--profile',
    variant,
    '--json',
    '--non-interactive',
    '--wait',
  ]);

  const parsed = parseJson(result.stdout);
  const record = normalizeArray(parsed)[0];
  return {
    raw: parsed,
    record: normalizeSubmissionRecord(build, record),
  };
}

async function main() {
  const { variant, submit } = parseArgs(process.argv.slice(2));
  const manifestPath = resolve(releasesDir, `${variant}-release-manifest.json`);
  const manifest: ReleaseManifest = {
    variant,
    startedAt: new Date().toISOString(),
    completedAt: null,
    releaseStatus: 'pending',
    submitRequested: submit,
    gitSha: await getGitSha(),
    gitRef: process.env.GITHUB_REF_NAME ?? process.env.GITHUB_REF ?? null,
    actor: process.env.GITHUB_ACTOR ?? null,
    build: {
      status: 'pending',
      records: [],
      raw: [],
    },
    submissions: {
      status: submit ? 'pending' : 'not-requested',
      records: [],
      raw: [],
    },
    errors: [],
  };

  appendGithubOutput('manifest_path', manifestPath);

  try {
    await writeManifest(manifestPath, manifest);

    const buildResult = await runCommand('eas', [
      'build',
      '--platform',
      'all',
      '--profile',
      variant,
      '--json',
      '--non-interactive',
      '--wait',
    ]);

    const parsedBuilds = normalizeArray(parseJson(buildResult.stdout));
    manifest.build.raw = parsedBuilds;
    manifest.build.records = parsedBuilds.map(normalizeBuildRecord);
    manifest.build.status = manifest.build.records.every(
      (record) => record.status && SUCCESS_BUILD_STATUSES.has(record.status),
    )
      ? 'finished'
      : 'failed';

    if (manifest.build.status !== 'finished') {
      throw new Error('One or more EAS builds did not finish successfully.');
    }

    if (submit) {
      const submissions: SubmissionRecord[] = [];
      const rawSubmissions: unknown[] = [];

      for (const build of manifest.build.records) {
        const submission = await submitBuild(build, variant);
        submissions.push(submission.record);
        rawSubmissions.push(submission.raw);
      }

      manifest.submissions.records = submissions;
      manifest.submissions.raw = rawSubmissions;
      manifest.submissions.status = submissions.every(
        (record) => record.status && SUCCESS_SUBMISSION_STATUSES.has(record.status),
      )
        ? 'finished'
        : 'failed';

      if (manifest.submissions.status !== 'finished') {
        throw new Error('One or more EAS submissions did not finish successfully.');
      }
    }

    manifest.releaseStatus = 'success';
    manifest.completedAt = new Date().toISOString();
    await writeManifest(manifestPath, manifest);
    writeGithubStepSummary(variant, manifestPath, manifest);
  } catch (error) {
    manifest.releaseStatus = 'failed';
    manifest.completedAt = new Date().toISOString();
    manifest.errors.push({
      message: error instanceof Error ? error.message : String(error),
    });
    await writeManifest(manifestPath, manifest);
    writeGithubStepSummary(variant, manifestPath, manifest);

    appendGithubOutput('release_status', manifest.releaseStatus);
    appendGithubOutput('build_status', manifest.build.status);
    appendGithubOutput(
      'build_ids',
      manifest.build.records
        .map((record) => record.id)
        .filter(Boolean)
        .join(','),
    );
    appendGithubOutput('submission_status', manifest.submissions.status);
    appendGithubOutput(
      'submission_ids',
      manifest.submissions.records
        .map((record) => record.id)
        .filter(Boolean)
        .join(','),
    );

    throw error;
  }

  appendGithubOutput('release_status', manifest.releaseStatus);
  appendGithubOutput('build_status', manifest.build.status);
  appendGithubOutput(
    'build_ids',
    manifest.build.records
      .map((record) => record.id)
      .filter(Boolean)
      .join(','),
  );
  appendGithubOutput('submission_status', manifest.submissions.status);
  appendGithubOutput(
    'submission_ids',
    manifest.submissions.records
      .map((record) => record.id)
      .filter(Boolean)
      .join(','),
  );

  process.stdout.write(`${manifestPath}\n`);
}

await main();

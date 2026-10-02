import type { ChatMessageJsonObject } from '@hominem/chat';
import type { z } from 'zod';

// The single source of truth for capability domains and the scopes built from them.
// A tool's `scopes` are always `${capability}:${action}` — narrowing to this template
// type (rather than `string[]`) turns a typo'd scope into a compile error instead of a
// tool that silently drops out of chat-tool routing at runtime.
export const CAPABILITIES = [
  'career',
  'collections',
  'finance',
  'health',
  'media',
  'memory',
  'notes',
  'people',
  'places',
  'possessions',
  'social',
  'tags',
  'task',
  'travel',
] as const;

export type Capability = (typeof CAPABILITIES)[number];
type ScopeAction = 'read' | 'write';
type Scope = `${Capability}:${ScopeAction}`;

export type CapabilityDependency = {
  tool: string;
  reason: string;
  provides: readonly string[];
};

export type CapabilityGuidance = {
  whenToUse?: string;
  whenNotToUse?: string;
  examples?: readonly string[];
  dependencies?: readonly CapabilityDependency[];
  produces?: readonly string[];
};

export interface CapabilityDefinition<
  Name extends string = string,
  InputSchema extends z.ZodType = z.ZodType,
  OutputSchema extends z.ZodType = z.ZodType,
> {
  name: Name;
  title: string;
  description: string;
  inputSchema: InputSchema;
  // The arguments a chat model is shown, when fewer than the tool accepts. Every call is still
  // validated against `inputSchema`; a key left out here is simply never offered to the model.
  chatInputSchema?: z.ZodType;
  outputSchema: OutputSchema;
  readOnly: boolean;
  scopes: readonly Scope[];
  resultCap: number;
  destructive?: boolean;
  idempotent?: boolean;
  openWorld?: boolean;
  invoking?: string;
  invoked?: string;
  requiresConfirmation?: boolean;
  // A write that depends on no existing record (e.g. creating a standalone task), so a chat
  // turn may call it without first running a read-only lookup. By default every write must
  // follow a read, so a model resolves real ids before it changes anything.
  standaloneWrite?: boolean;
  guidance?: CapabilityGuidance;
  // Extracts URI-addressable resources (e.g. an uploaded file's fileUrl) from
  // a tool's already-validated output, so callTool can surface them as
  // resource_link content blocks alongside the structured JSON — letting an
  // MCP-aware client discover/fetch the resource directly instead of reading
  // an opaque URL field. Only declare this for a tool whose output actually
  // contains a real URI-addressable resource.
  resourceLinks?: (output: unknown) => ReadonlyArray<{ uri: string; name: string }>;
  // `ChatMessageJsonObject` (not `Record<string, unknown>`) because a tool's preview
  // is persisted straight into `ChatMessageToolCallRecord.preview`, whose JSON-column
  // shape is the actual constraint here — narrowing to it here surfaces a
  // non-serializable preview value at the definition site instead of at the DB write.
  preview?: (
    ownerUserId: string,
    input: ChatMessageJsonObject,
  ) => Promise<ChatMessageJsonObject | null>;
}

export type CapabilityInput<T extends CapabilityDefinition> = z.infer<T['inputSchema']>;
export type CapabilityOutput<T extends CapabilityDefinition> = z.infer<T['outputSchema']>;

export function defineCapability<const T extends CapabilityDefinition>(definition: T): T {
  return definition;
}

export function parseCapabilityInput<TInput extends z.ZodType>(
  definition: { inputSchema: TInput },
  input: unknown,
): z.output<TInput> {
  return definition.inputSchema.parse(input);
}

export function parseCapabilityOutput<TOutput extends z.ZodType>(
  definition: { outputSchema: TOutput },
  output: unknown,
): z.output<TOutput> {
  return definition.outputSchema.parse(output);
}

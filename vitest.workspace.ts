import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	"./apps/api/vitest.config.ts",
	"./apps/hominem-api/vitest.config.mts",
	"./packages/utils/vitest.config.mts",
	"./scratchpad/vitest.config.mts",
]);

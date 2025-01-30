import * as schema from "./schema";
// import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import assert from "node:assert";

const DATABASE_URL =
	process.env.NODE_ENV === "test"
		? "postgres://postgres:postgres@localhost:4433/hominem-test"
		: process.env.DATABASE_URL;

assert(DATABASE_URL, "Missing DATABASE_URL");

export const db: NeonDatabase<typeof schema> = drizzle(DATABASE_URL, {
	schema,
});

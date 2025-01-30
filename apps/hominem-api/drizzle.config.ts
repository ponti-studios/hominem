// Load environment variables
import assert from "node:assert";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

assert(DATABASE_URL, "Missing DATABASE_URL");

import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dbCredentials: {
		url: DATABASE_URL,
	},
	dialect: "postgresql",
	schema: "./src/db/drizzle/schema.ts",
	out: "./src/db/drizzle",
});

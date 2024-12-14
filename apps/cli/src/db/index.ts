import { drizzle } from "drizzle-orm/libsql";
export { applications } from "./schema.ts";

export const db = drizzle("file:db.sqlite");

import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const notes = pgTable("notes", {
	id: uuid("id").primaryKey().defaultRandom(),
	content: text("content").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

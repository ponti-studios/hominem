import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	photoUrl: text("photo_url"),
	birthday: text("birthday"),
});

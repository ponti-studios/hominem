import { pgTable, text, uuid, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const noteTypeEnum = pgEnum("note_type", [
	"feeling",
	"thought",
	"other",
]);

// Tables
export const people = pgTable("people", {
	id: uuid("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	phone: text("phone"),
});

export const peopleNotes = pgTable("people_notes", {
	id: uuid("id").primaryKey(),
	personId: uuid("person_id").references(() => people.id),
	note: text("note").notNull(),
	type: noteTypeEnum("type").notNull(),
});

// Relations
export const peopleRelations = relations(people, ({ many }) => ({
	notes: many(peopleNotes),
}));

export const peopleNotesRelations = relations(peopleNotes, ({ one }) => ({
	person: one(people, {
		fields: [peopleNotes.personId],
		references: [people.id],
	}),
}));

// Types can be inferred from the tables if needed
export type Person = typeof people.$inferSelect;
export type PeopleNote = typeof peopleNotes.$inferSelect;

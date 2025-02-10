import {
	pgTable,
	text,
	varchar,
	integer,
	boolean,
	timestamp,
	json,
	uuid,
} from "drizzle-orm/pg-core";
import z from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const activities = pgTable("activities", {
	id: uuid("id").primaryKey(),
	title: varchar("title", { length: 100 }),
	description: text("description").notNull(),
	type: text("type"),
	duration: integer("duration"),
	durationType: text("durationType"),
	interval: text("interval").notNull(),
	score: integer("score"),
	metrics: json("metrics").notNull(),
	startDate: timestamp("startDate").notNull(),
	endDate: timestamp("endDate").notNull(),
	isCompleted: boolean("isCompleted").default(false),
	lastPerformed: timestamp("lastPerformed").notNull(),
	priority: integer("priority").notNull(),
	dependencies: json("dependencies").notNull(),
	resources: json("resources").notNull(),
	notes: text("notes").notNull(),
	dueDate: timestamp("dueDate").notNull(),
	status: text("status"),
	recurrenceRule: text("recurrenceRule").notNull(),
	completedInstances: integer("completedInstances").notNull(),
	streakCount: integer("streakCount").notNull(),
});

// Zod schemas
export const activityBaseSchema = z.object({
	id: z.string().optional(),
	title: z.string().max(100),
	description: z.string().max(500).optional(),
	type: z.enum(["BODY", "MIND", "WORK", "SOCIAL", "CREATIVE", "MAINTENANCE"]),
	duration: z.number(),
	durationType: z.enum(["MINUTES", "HOURS", "DAYS", "WEEKS"]),
	interval: z
		.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"])
		.optional(),
	score: z.number().min(1).max(10),
	metrics: z
		.object({
			energyLevel: z.number(),
			focusLevel: z.number(),
			enjoymentLevel: z.number(),
			productivity: z.number(),
		})
		.optional(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
	isCompleted: z.boolean().optional(),
	lastPerformed: z.date().optional(),
	priority: z.number().optional(),
	dependencies: z.array(z.string()).optional(),
	resources: z.array(z.string()).optional(),
	notes: z.string().optional(),
	dueDate: z.date().optional(),
	status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
	recurrenceRule: z.string().optional(),
	completedInstances: z.number().optional(),
	streakCount: z.number().optional(),
});

export const activityInsertSchema = createInsertSchema(activities);
export const activitySelectSchema = createSelectSchema(activities);

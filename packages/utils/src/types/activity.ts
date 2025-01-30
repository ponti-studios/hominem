/**
 * # Activity Management System
 *
 * An activity represents a task or action that contributes to personal or professional growth.
 * This system helps track, measure, and optimize how time is spent on various activities.
 *
 * ## Core Concepts
 * - Each activity has a specific type (physical, mental, creative, etc.)
 * - Activities can be recurring or one-time events
 * - Impact is measured through multiple metrics
 * - Activities can be linked to goals and outcomes
 */

import type { Tag } from "./tagging";

/**
 * ## Activity Categories
 *
 * These categories help classify activities based on their purpose and impact.
 */
export type ActivityCategory =
	| "BODY" // Physical activities, exercise, health
	| "MIND" // Mental activities, learning, meditation
	| "WORK" // Professional tasks
	| "SOCIAL" // Relationship building, networking
	| "CREATIVE" // Artistic endeavors
	| "MAINTENANCE"; // Life admin, chores

export type Interval =
	| "DAILY"
	| "WEEKLY"
	| "BIWEEKLY"
	| "MONTHLY"
	| "QUARTERLY"
	| "YEARLY";

export type DurationType = "MINUTES" | "HOURS" | "DAYS" | "WEEKS";

// Validation constants
export const ACTIVITY_CONSTANTS = {
	MAX_SCORE: 10,
	MIN_SCORE: 1,
	MAX_TITLE_LENGTH: 100,
	MAX_DESCRIPTION_LENGTH: 500,
} as const;

export interface ActivityMetrics {
	energyLevel: number; // 1-10 scale of energy required
	focusLevel: number; // 1-10 scale of focus required
	enjoymentLevel: number; // 1-10 scale of enjoyment
	productivity: number; // 1-10 scale of productive output
}

export interface Activity {
	id?: string;
	title: string;
	description?: string;
	type: ActivityCategory;
	duration: number;
	durationType: DurationType;
	interval?: Interval;
	score: number; // Impact score (1-10)
	metrics?: ActivityMetrics;
	startDate?: Date;
	endDate?: Date;
	isCompleted?: boolean;
	lastPerformed?: Date;
	priority?: number; // 1-5 scale
	tags?: Tag[];
	dependencies?: string[]; // IDs of activities that must be completed first
	resources?: string[]; // URLs or references needed
	notes?: string;
	dueDate?: Date | null;
	status: ActivityStatus;
}

// Utility types
export type ActivityStatus =
	| "NOT_STARTED"
	| "IN_PROGRESS"
	| "COMPLETED"
	| "CANCELLED";

export type RecurringActivity = Activity & {
	recurrenceRule: string; // iCal RRule format
	completedInstances?: number;
	streakCount?: number;
};

export type ActivityTag = {
	activityId: string;
	tagId: Tag["id"];
};

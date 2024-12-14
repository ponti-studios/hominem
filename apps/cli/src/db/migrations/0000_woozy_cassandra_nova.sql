CREATE TABLE `application_stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`company` text NOT NULL,
	`start_date` text DEFAULT '2024-12-14T21:08:39.723Z' NOT NULL,
	`end_date` text,
	`had_phone_screen` text DEFAULT 'FALSE' NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_active` text DEFAULT 'TRUE' NOT NULL,
	`link` text,
	`location` text DEFAULT 'Remote' NOT NULL,
	`position` text NOT NULL,
	`reference` text DEFAULT 'FALSE' NOT NULL,
	`stage` text DEFAULT 'Application' NOT NULL,
	`stages` blob DEFAULT '["Application"]' NOT NULL,
	`status` text DEFAULT 'Applied' NOT NULL
);

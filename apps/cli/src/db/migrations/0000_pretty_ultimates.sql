CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`status` text NOT NULL,
	`category` text NOT NULL,
	`parent_category` text NOT NULL,
	`excluded` integer DEFAULT false NOT NULL,
	`tags` text,
	`type` text NOT NULL,
	`account` text NOT NULL,
	`account_mask` text,
	`note` text,
	`recurring` text
);

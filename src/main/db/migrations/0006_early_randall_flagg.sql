CREATE TABLE `factory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `factory_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`qty_kg` real NOT NULL,
	`amount_paise` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `factory_items`(`id`) ON UPDATE no action ON DELETE no action
);

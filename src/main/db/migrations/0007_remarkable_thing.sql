CREATE TABLE `factory_production_run_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`raw_material_id` text NOT NULL,
	`qty_used_kg` real NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `factory_production_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`raw_material_id`) REFERENCES `factory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `factory_production_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`final_product_id` text NOT NULL,
	`date` text NOT NULL,
	`qty_produced_kg` real NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`final_product_id`) REFERENCES `factory_items`(`id`) ON UPDATE no action ON DELETE no action
);

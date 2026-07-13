PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_backup_log` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`type` text NOT NULL,
	`file_path` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_backup_log`("id", "date", "type", "file_path") SELECT "id", "date", "type", "file_path" FROM `backup_log`;--> statement-breakpoint
DROP TABLE `backup_log`;--> statement-breakpoint
ALTER TABLE `__new_backup_log` RENAME TO `backup_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_bulk_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`date` text NOT NULL,
	`qty_change_grams` integer NOT NULL,
	`reason` text NOT NULL,
	`notes` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_bulk_adjustments`("id", "product_id", "date", "qty_change_grams", "reason", "notes", "user_id", "created_at") SELECT "id", "product_id", "date", "qty_change_grams", "reason", "notes", "user_id", "created_at" FROM `bulk_adjustments`;--> statement-breakpoint
DROP TABLE `bulk_adjustments`;--> statement-breakpoint
ALTER TABLE `__new_bulk_adjustments` RENAME TO `bulk_adjustments`;--> statement-breakpoint
CREATE TABLE `__new_bulk_arrivals` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`date` text NOT NULL,
	`qty_grams` integer NOT NULL,
	`cost_per_kg_paise` integer,
	`total_amount_paise` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_bulk_arrivals`("id", "product_id", "date", "qty_grams", "cost_per_kg_paise", "total_amount_paise", "notes", "created_at") SELECT "id", "product_id", "date", "qty_grams", "cost_per_kg_paise", "total_amount_paise", "notes", "created_at" FROM `bulk_arrivals`;--> statement-breakpoint
DROP TABLE `bulk_arrivals`;--> statement-breakpoint
ALTER TABLE `__new_bulk_arrivals` RENAME TO `bulk_arrivals`;--> statement-breakpoint
CREATE TABLE `__new_bulk_stock` (
	`product_id` text PRIMARY KEY NOT NULL,
	`qty_grams` integer DEFAULT 0 NOT NULL,
	`avg_cost_per_kg` real,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_bulk_stock`("product_id", "qty_grams", "avg_cost_per_kg") SELECT "product_id", "qty_grams", "avg_cost_per_kg" FROM `bulk_stock`;--> statement-breakpoint
DROP TABLE `bulk_stock`;--> statement-breakpoint
ALTER TABLE `__new_bulk_stock` RENAME TO `bulk_stock`;--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "name") SELECT "id", "name" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE TABLE `__new_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`business_name` text,
	`phone` text,
	`address` text,
	`gst_no` text,
	`credit_balance_paise` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_customers`("id", "type", "name", "business_name", "phone", "address", "gst_no", "credit_balance_paise", "created_at") SELECT "id", "type", "name", "business_name", "phone", "address", "gst_no", "credit_balance_paise", "created_at" FROM `customers`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
CREATE TABLE `__new_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`payment_mode` text DEFAULT 'cash' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_expenses`("id", "date", "category", "amount_paise", "payment_mode", "notes", "created_at") SELECT "id", "date", "category", "amount_paise", "payment_mode", "notes", "created_at" FROM `expenses`;--> statement-breakpoint
DROP TABLE `expenses`;--> statement-breakpoint
ALTER TABLE `__new_expenses` RENAME TO `expenses`;--> statement-breakpoint
CREATE TABLE `__new_invoice_datetime_edit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`old_datetime` integer NOT NULL,
	`new_datetime` integer NOT NULL,
	`edited_by` text NOT NULL,
	`edited_at` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_invoice_datetime_edit_log`("id", "invoice_id", "old_datetime", "new_datetime", "edited_by", "edited_at") SELECT "id", "invoice_id", "old_datetime", "new_datetime", "edited_by", "edited_at" FROM `invoice_datetime_edit_log`;--> statement-breakpoint
DROP TABLE `invoice_datetime_edit_log`;--> statement-breakpoint
ALTER TABLE `__new_invoice_datetime_edit_log` RENAME TO `invoice_datetime_edit_log`;--> statement-breakpoint
CREATE TABLE `__new_invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`item_type` text NOT NULL,
	`variant_id` text,
	`product_id` text,
	`qty` integer NOT NULL,
	`unit` text NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`line_total_paise` integer NOT NULL,
	`unit_cost_snapshot` real,
	`line_profit_paise` integer,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_invoice_lines`("id", "invoice_id", "item_type", "variant_id", "product_id", "qty", "unit", "unit_price_paise", "line_total_paise", "unit_cost_snapshot", "line_profit_paise") SELECT "id", "invoice_id", "item_type", "variant_id", "product_id", "qty", "unit", "unit_price_paise", "line_total_paise", "unit_cost_snapshot", "line_profit_paise" FROM `invoice_lines`;--> statement-breakpoint
DROP TABLE `invoice_lines`;--> statement-breakpoint
ALTER TABLE `__new_invoice_lines` RENAME TO `invoice_lines`;--> statement-breakpoint
CREATE TABLE `__new_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_no` text NOT NULL,
	`created_at` integer NOT NULL,
	`invoice_datetime` integer NOT NULL,
	`business_date` text NOT NULL,
	`type` text NOT NULL,
	`customer_id` text,
	`subtotal_paise` integer NOT NULL,
	`discount_paise` integer DEFAULT 0 NOT NULL,
	`total_paise` integer NOT NULL,
	`payment_mode` text NOT NULL,
	`amount_paid_paise` integer NOT NULL,
	`balance_due_paise` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`user_id` text NOT NULL,
	`payment_split` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_invoices`("id", "invoice_no", "created_at", "invoice_datetime", "business_date", "type", "customer_id", "subtotal_paise", "discount_paise", "total_paise", "payment_mode", "amount_paid_paise", "balance_due_paise", "status", "user_id", "payment_split") SELECT "id", "invoice_no", "created_at", "invoice_datetime", "business_date", "type", "customer_id", "subtotal_paise", "discount_paise", "total_paise", "payment_mode", "amount_paid_paise", "balance_due_paise", "status", "user_id", "payment_split" FROM `invoices`;--> statement-breakpoint
DROP TABLE `invoices`;--> statement-breakpoint
ALTER TABLE `__new_invoices` RENAME TO `invoices`;--> statement-breakpoint
CREATE TABLE `__new_label_print_log` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`variant_id` text NOT NULL,
	`qty` integer NOT NULL,
	`price_printed_paise` integer NOT NULL,
	`type` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_label_print_log`("id", "date", "variant_id", "qty", "price_printed_paise", "type", "user_id", "created_at") SELECT "id", "date", "variant_id", "qty", "price_printed_paise", "type", "user_id", "created_at" FROM `label_print_log`;--> statement-breakpoint
DROP TABLE `label_print_log`;--> statement-breakpoint
ALTER TABLE `__new_label_print_log` RENAME TO `label_print_log`;--> statement-breakpoint
CREATE TABLE `__new_packing_run_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`packing_run_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`packets_count` integer NOT NULL,
	`unit_cost_at_pack` real,
	FOREIGN KEY (`packing_run_id`) REFERENCES `packing_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_packing_run_lines`("id", "packing_run_id", "variant_id", "packets_count", "unit_cost_at_pack") SELECT "id", "packing_run_id", "variant_id", "packets_count", "unit_cost_at_pack" FROM `packing_run_lines`;--> statement-breakpoint
DROP TABLE `packing_run_lines`;--> statement-breakpoint
ALTER TABLE `__new_packing_run_lines` RENAME TO `packing_run_lines`;--> statement-breakpoint
CREATE TABLE `__new_packing_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`product_id` text NOT NULL,
	`bulk_used_grams` integer NOT NULL,
	`user_id` text NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_packing_runs`("id", "date", "product_id", "bulk_used_grams", "user_id", "notes", "created_at") SELECT "id", "date", "product_id", "bulk_used_grams", "user_id", "notes", "created_at" FROM `packing_runs`;--> statement-breakpoint
DROP TABLE `packing_runs`;--> statement-breakpoint
ALTER TABLE `__new_packing_runs` RENAME TO `packing_runs`;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`invoice_id` text,
	`date` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`mode` text NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "customer_id", "invoice_id", "date", "amount_paise", "mode", "notes", "created_at") SELECT "id", "customer_id", "invoice_id", "date", "amount_paise", "mode", "notes", "created_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
CREATE TABLE `__new_ping_log` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_ping_log`("id", "value", "created_at") SELECT "id", "value", "created_at" FROM `ping_log`;--> statement-breakpoint
DROP TABLE `ping_log`;--> statement-breakpoint
ALTER TABLE `__new_ping_log` RENAME TO `ping_log`;--> statement-breakpoint
CREATE TABLE `__new_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`old_price_paise` integer NOT NULL,
	`new_price_paise` integer NOT NULL,
	`changed_at` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_price_history`("id", "target_type", "target_id", "old_price_paise", "new_price_paise", "changed_at", "user_id") SELECT "id", "target_type", "target_id", "old_price_paise", "new_price_paise", "changed_at", "user_id" FROM `price_history`;--> statement-breakpoint
DROP TABLE `price_history`;--> statement-breakpoint
ALTER TABLE `__new_price_history` RENAME TO `price_history`;--> statement-breakpoint
CREATE TABLE `__new_price_menu_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`retail_price_paise` integer NOT NULL,
	`wholesale_price_paise` integer NOT NULL,
	`effective_date` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_price_menu_entries`("id", "variant_id", "retail_price_paise", "wholesale_price_paise", "effective_date") SELECT "id", "variant_id", "retail_price_paise", "wholesale_price_paise", "effective_date" FROM `price_menu_entries`;--> statement-breakpoint
DROP TABLE `price_menu_entries`;--> statement-breakpoint
ALTER TABLE `__new_price_menu_entries` RENAME TO `price_menu_entries`;--> statement-breakpoint
CREATE TABLE `__new_product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`label` text NOT NULL,
	`weight_grams` integer NOT NULL,
	`barcode` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`retail_low_stock_pcs` integer DEFAULT 5 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_product_variants`("id", "product_id", "label", "weight_grams", "barcode", "enabled", "retail_low_stock_pcs") SELECT "id", "product_id", "label", "weight_grams", "barcode", "enabled", "retail_low_stock_pcs" FROM `product_variants`;--> statement-breakpoint
DROP TABLE `product_variants`;--> statement-breakpoint
ALTER TABLE `__new_product_variants` RENAME TO `product_variants`;--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_barcode_idx` ON `product_variants` (`barcode`);--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`bulk_low_stock_grams` integer DEFAULT 1000 NOT NULL,
	`wholesale_rate_per_kg_paise` integer DEFAULT 0 NOT NULL,
	`unit_type` text DEFAULT 'weight' NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "category_id", "enabled", "bulk_low_stock_grams", "wholesale_rate_per_kg_paise", "unit_type") SELECT "id", "name", "category_id", "enabled", "bulk_low_stock_grams", "wholesale_rate_per_kg_paise", "unit_type" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE TABLE `__new_purchase_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text,
	`date` text NOT NULL,
	`item_name` text NOT NULL,
	`qty` integer NOT NULL,
	`amount_paise` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_purchase_entries`("id", "supplier_id", "date", "item_name", "qty", "amount_paise", "notes", "created_at") SELECT "id", "supplier_id", "date", "item_name", "qty", "amount_paise", "notes", "created_at" FROM `purchase_entries`;--> statement-breakpoint
DROP TABLE `purchase_entries`;--> statement-breakpoint
ALTER TABLE `__new_purchase_entries` RENAME TO `purchase_entries`;--> statement-breakpoint
CREATE TABLE `__new_retail_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`date` text NOT NULL,
	`qty_change_pcs` integer NOT NULL,
	`reason` text NOT NULL,
	`notes` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_retail_adjustments`("id", "variant_id", "date", "qty_change_pcs", "reason", "notes", "user_id", "created_at") SELECT "id", "variant_id", "date", "qty_change_pcs", "reason", "notes", "user_id", "created_at" FROM `retail_adjustments`;--> statement-breakpoint
DROP TABLE `retail_adjustments`;--> statement-breakpoint
ALTER TABLE `__new_retail_adjustments` RENAME TO `retail_adjustments`;--> statement-breakpoint
CREATE TABLE `__new_retail_packet_stock` (
	`variant_id` text PRIMARY KEY NOT NULL,
	`qty_pcs` integer DEFAULT 0 NOT NULL,
	`avg_cost_per_pc` real,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_retail_packet_stock`("variant_id", "qty_pcs", "avg_cost_per_pc") SELECT "variant_id", "qty_pcs", "avg_cost_per_pc" FROM `retail_packet_stock`;--> statement-breakpoint
DROP TABLE `retail_packet_stock`;--> statement-breakpoint
ALTER TABLE `__new_retail_packet_stock` RENAME TO `retail_packet_stock`;--> statement-breakpoint
CREATE TABLE `__new_suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text
);
--> statement-breakpoint
INSERT INTO `__new_suppliers`("id", "name", "phone") SELECT "id", "name", "phone" FROM `suppliers`;--> statement-breakpoint
DROP TABLE `suppliers`;--> statement-breakpoint
ALTER TABLE `__new_suppliers` RENAME TO `suppliers`;--> statement-breakpoint
CREATE TABLE `__new_sync_log` (
	`id` text PRIMARY KEY NOT NULL,
	`synced_at` integer NOT NULL,
	`records_pushed` integer NOT NULL,
	`records_failed` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sync_log`("id", "synced_at", "records_pushed", "records_failed") SELECT "id", "synced_at", "records_pushed", "records_failed" FROM `sync_log`;--> statement-breakpoint
DROP TABLE `sync_log`;--> statement-breakpoint
ALTER TABLE `__new_sync_log` RENAME TO `sync_log`;--> statement-breakpoint
CREATE TABLE `__new_sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`operation` text NOT NULL,
	`created_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sync_queue`("id", "table_name", "record_id", "operation", "created_at", "attempts", "last_error", "status") SELECT "id", "table_name", "record_id", "operation", "created_at", "attempts", "last_error", "status" FROM `sync_queue`;--> statement-breakpoint
DROP TABLE `sync_queue`;--> statement-breakpoint
ALTER TABLE `__new_sync_queue` RENAME TO `sync_queue`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`pin_hash` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "role", "pin_hash") SELECT "id", "name", "role", "pin_hash" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;
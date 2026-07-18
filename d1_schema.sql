-- Run this script via Wrangler to create all necessary tables in D1
-- wrangler d1 execute spice-pos-sync --file=./d1_schema.sql

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  bulk_low_stock_grams INTEGER NOT NULL DEFAULT 1000,
  wholesale_rate_per_kg_paise INTEGER NOT NULL DEFAULT 0,
  unit_type TEXT NOT NULL DEFAULT 'weight'
);

CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  weight_grams INTEGER NOT NULL,
  barcode TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  retail_low_stock_pcs INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS bulk_stock (
  product_id INTEGER PRIMARY KEY,
  qty_grams INTEGER NOT NULL DEFAULT 0,
  avg_cost_per_kg REAL
);

CREATE TABLE IF NOT EXISTS retail_packet_stock (
  variant_id INTEGER PRIMARY KEY,
  qty_pcs INTEGER NOT NULL DEFAULT 0,
  avg_cost_per_pc REAL
);

CREATE TABLE IF NOT EXISTS price_menu_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id INTEGER NOT NULL,
  retail_price_paise INTEGER NOT NULL,
  wholesale_price_paise INTEGER NOT NULL,
  effective_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  business_name TEXT,
  phone TEXT,
  address TEXT,
  gst_no TEXT,
  credit_balance_paise INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bulk_arrivals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  qty_grams INTEGER NOT NULL,
  cost_per_kg_paise INTEGER,
  total_amount_paise INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bulk_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  qty_change_grams INTEGER NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS packing_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  bulk_used_grams INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS packing_run_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  packing_run_id INTEGER NOT NULL,
  variant_id INTEGER NOT NULL,
  packets_count INTEGER NOT NULL,
  unit_cost_at_pack REAL
);

CREATE TABLE IF NOT EXISTS retail_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  qty_change_pcs INTEGER NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  old_price_paise INTEGER NOT NULL,
  new_price_paise INTEGER NOT NULL,
  changed_at INTEGER NOT NULL,
  user_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  invoice_datetime INTEGER NOT NULL,
  business_date TEXT NOT NULL,
  type TEXT NOT NULL,
  customer_id INTEGER,
  subtotal_paise INTEGER NOT NULL,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL,
  payment_mode TEXT NOT NULL,
  amount_paid_paise INTEGER NOT NULL,
  balance_due_paise INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  user_id INTEGER NOT NULL,
  payment_split TEXT
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  variant_id INTEGER,
  product_id INTEGER,
  qty INTEGER NOT NULL,
  unit TEXT NOT NULL,
  unit_price_paise INTEGER NOT NULL,
  line_total_paise INTEGER NOT NULL,
  unit_cost_snapshot REAL,
  line_profit_paise INTEGER
);

CREATE TABLE IF NOT EXISTS invoice_datetime_edit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  old_datetime INTEGER NOT NULL,
  new_datetime INTEGER NOT NULL,
  edited_by INTEGER NOT NULL,
  edited_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  invoice_id INTEGER,
  date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  mode TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER,
  date TEXT NOT NULL,
  item_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS label_print_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  variant_id INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  price_printed_paise INTEGER NOT NULL,
  type TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pin_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS factory_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cost_per_kg_paise INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS factory_transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  qty_grams INTEGER NOT NULL,
  cost_per_kg_snapshot INTEGER,
  user_id TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS global_sync_state (
  id TEXT PRIMARY KEY,
  last_sync_time INTEGER NOT NULL
);

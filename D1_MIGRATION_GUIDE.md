# Cloudflare D1 Sync Migration Guide

The local application code and worker scaffolding for switching from Supabase to Cloudflare D1 has been completed. 
When you are ready to implement and deploy this in the cloud, follow these steps:

## 1. What was changed in the codebase

### 🔄 The New Cloudflare Worker
A new directory `sync-worker` has been created inside this repository. This contains a lightweight Hono API that acts as a secure bridge between your Electron application and your Cloudflare D1 SQLite database. It exposes `/pull`, `/push`, `/delete`, and `/state` endpoints.

### 🗄️ SQLite-Native Schema
We replaced the old `supabase_schema.sql` with `d1_schema.sql`. This new schema is fully compatible with Cloudflare D1's SQLite dialect, meaning no more complex type conversions for timestamps or booleans.

### 🖥️ Electron App Update
Your `src/main/services/sync.ts` file was completely rewritten to use native `fetch()` calls to communicate with your new Cloudflare Worker instead of using the `@supabase/supabase-js` library (which was removed).

---

## 2. Deployment Steps

To get your new backend running in the cloud, use the `wrangler` CLI provided by Cloudflare. 
**Note:** You must have a Cloudflare account and Node.js installed.

### Step 1: Login to Cloudflare
Open your terminal in the `sync-worker` directory and run:
```bash
cd sync-worker
npx wrangler login
```

### Step 2: Create the D1 Database
Run the following command to create your remote SQLite database:
```bash
npx wrangler d1 create spice-pos-sync
```
*Note: This command will output a `database_id` string. Copy this ID and paste it into the `sync-worker/wrangler.toml` file where indicated (replace the placeholder zeros).*

### Step 3: Apply the Schema
Apply your new SQLite schema to the cloud database:
```bash
npx wrangler d1 execute spice-pos-sync --file=../d1_schema.sql --remote
```

### Step 4: Deploy the Worker
Publish your API to the Cloudflare edge network:
```bash
npm install
npm run deploy
```
*Note: This will output the public URL of your new worker (e.g. `https://sync-worker.<your-username>.workers.dev`).*

---

## 3. Connecting Your App

Finally, update your `.env` file in the main `Spice-POS` repository with your new worker URL:

```env
VITE_SYNC_WORKER_URL=https://sync-worker.<your-username>.workers.dev
VITE_SYNC_API_KEY=DEV_SECRET_KEY_123
```

You are now fully migrated to Cloudflare D1! You can open your POS app and test the "Sync Cloud" functionality from the dashboard.

# SoleSync — Deployment Guide

## What You're Deploying

SoleSync is a multi-account eBay management dashboard for shoe sellers. It consists of three pieces:

| File | What It Does |
|------|-------------|
| `supabase-schema.sql` | Database tables, security policies, and helper functions |
| `ebay-edge-functions.ts` | Backend API: OAuth, listing sync, message sync, price comparison |
| `solesync-dashboard.jsx` | Frontend React dashboard (deploy on Lovable) |

---

## Step 1: Get eBay Developer Credentials (10 min)

1. Go to [developer.ebay.com](https://developer.ebay.com) and sign up
2. Click **"Hi [name]" → Application access keys**
3. Click **"Create a keyset"** → choose **Production**
4. Save these three values:
   - **App ID** (Client ID)
   - **Dev ID**
   - **Cert ID** (Client Secret)
5. Under your keyset, click **"User Tokens"** → **"Get a Token from eBay via Your Application"**
6. Set your **OAuth Redirect URI** (you'll update this after setting up Supabase):
   ```
   https://YOUR_PROJECT.supabase.co/functions/v1/ebay-oauth-callback
   ```
7. Select these **OAuth Scopes**:
   - `https://api.ebay.com/oauth/api_scope`
   - `https://api.ebay.com/oauth/api_scope/sell.inventory`
   - `https://api.ebay.com/oauth/api_scope/sell.account`
   - `https://api.ebay.com/oauth/api_scope/sell.fulfillment`
   - `https://api.ebay.com/oauth/api_scope/commerce.identity.readonly`

### eBay API Rate Limits
- Browse API: 5,000 calls/day
- Sell APIs: 5,000 calls/day
- Trading API (messages): 5,000 calls/day
- These are per-app, not per-account, so they're shared across all your connected seller accounts

---

## Step 2: Set Up Supabase (15 min)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Save your **Project URL** and **Anon Key** (Settings → API)
3. Also save your **Service Role Key** (keep this secret!)

### Run the Schema
1. Go to **SQL Editor** in your Supabase dashboard
2. Open `supabase-schema.sql` and paste the entire contents
3. Click **Run** — this creates all tables, indexes, RLS policies, and helper functions

### Enable Auth
1. Go to **Authentication → Providers**
2. Enable **Email** auth (or Google/GitHub if you prefer)
3. This is for YOUR login to the dashboard, not for eBay

### Set Up Scheduled Sync (Cron)
1. Go to **SQL Editor** and run:
```sql
-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run listing status check every hour
SELECT cron.schedule('update-ending-soon', '0 * * * *',
  $$SELECT update_ending_soon_status()$$
);
```

---

## Step 3: Deploy Edge Functions (20 min)

### Install Supabase CLI
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### Create Function Files
The `ebay-edge-functions.ts` file contains all the logic. Split it into individual functions:

```bash
# Create function directories
supabase functions new ebay-oauth-start
supabase functions new ebay-oauth-callback
supabase functions new sync-listings
supabase functions new sync-messages
supabase functions new price-compare
supabase functions new cron-sync
```

Copy the relevant handler from `ebay-edge-functions.ts` into each function's `index.ts`.

### Set Secrets
```bash
supabase secrets set EBAY_APP_ID="your-app-id"
supabase secrets set EBAY_CERT_ID="your-cert-id"
supabase secrets set EBAY_DEV_ID="your-dev-id"
supabase secrets set EBAY_REDIRECT_URI="https://YOUR_PROJECT.supabase.co/functions/v1/ebay-oauth-callback"
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set APP_URL="https://your-lovable-app.lovable.app"
```

### Deploy
```bash
supabase functions deploy ebay-oauth-start
supabase functions deploy ebay-oauth-callback
supabase functions deploy sync-listings
supabase functions deploy sync-messages
supabase functions deploy price-compare
supabase functions deploy cron-sync
```

### Set Up Auto-Sync Cron
In your Supabase SQL Editor:
```sql
SELECT cron.schedule('sync-ebay-accounts', '0 */2 * * *',
  $$SELECT net.http_post(
    'https://YOUR_PROJECT.supabase.co/functions/v1/cron-sync',
    '{}',
    '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_ANON_KEY'
    )
  );$$
);
```
This syncs all accounts every 2 hours automatically.

---

## Step 4: Deploy Frontend on Lovable (10 min)

1. Go to [lovable.dev](https://lovable.dev) and create a new project
2. Import `solesync-dashboard.jsx` as your main component
3. In the dashboard file, update the constants at the top:
   ```javascript
   const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
   ```
4. Add `@supabase/supabase-js` as a dependency
5. Tell Lovable to set up Supabase integration (it has built-in support)

### Connecting to Real Data
The dashboard ships with mock data so you can see it immediately. To switch to real data:

1. Replace the mock `ACCOUNTS`, `LISTINGS`, and `MESSAGES` arrays with Supabase queries
2. Add a `useEffect` that fetches from Supabase on load:
```javascript
useEffect(() => {
  const fetchData = async () => {
    const { data: accounts } = await supabase.from('ebay_accounts').select('*');
    const { data: listings } = await supabase.from('listings').select('*');
    const { data: messages } = await supabase.from('messages').select('*').order('received_at', { ascending: false });
    setAccounts(accounts);
    setListings(listings);
    setMessages(messages);
  };
  fetchData();
}, []);
```

3. Wire up the "Sync" buttons to call edge functions:
```javascript
const syncAccount = async (accountId) => {
  await fetch(`${EDGE_FUNCTION_URL}/sync-listings`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ account_id: accountId }),
  });
};
```

---

## Step 5: Connect Your eBay Accounts

1. Open your deployed app
2. Go to the **Accounts** tab
3. Click **"Connect New eBay Account"**
4. You'll be redirected to eBay's consent screen
5. Log in with your eBay seller account and authorize
6. You'll be redirected back — the account is now connected
7. Click **"Sync"** to pull in your listings
8. Repeat for each of your eBay seller accounts

---

## Architecture Overview

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   Lovable App    │────▶│  Supabase Backend    │────▶│   eBay API   │
│  (React/JSX)     │     │                      │     │              │
│                  │     │  - Edge Functions     │     │  - Browse    │
│  - Dashboard     │     │  - PostgreSQL DB      │     │  - Sell      │
│  - Inventory     │◀────│  - Row Level Security │◀────│  - Trading   │
│  - Messages      │     │  - Cron Jobs          │     │  - Finding   │
│  - Price Check   │     │  - Auth               │     │              │
└──────────────────┘     └─────────────────────┘     └──────────────┘
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| OAuth redirect fails | Check your Redirect URI matches exactly in eBay developer console |
| Token refresh errors | Verify EBAY_CERT_ID is correct; tokens expire after 2 hours |
| No listings showing | Click Sync; check sync_log table for errors |
| CORS errors | Edge functions include CORS headers; check Supabase function logs |
| Rate limited by eBay | Reduce cron frequency; eBay allows 5,000 calls/day per app |
| Messages not loading | eBay's message API requires the Trading API (XML); see comments in edge functions |

---

## What's Next

Once the basic system is running, consider adding:

- **Bulk relist** — select multiple expired listings and relist with one click
- **Profit calculator** — track cost basis per shoe and see margins
- **Price alerts** — get notified when similar shoes sell above/below thresholds
- **Auto-reprice** — automatically adjust prices based on market comps
- **Photo management** — bulk upload and organize shoe photos
- **Shipping labels** — integrate with USPS/UPS API for label generation
- **Sales analytics** — charts showing revenue, profit, sell-through rate over time

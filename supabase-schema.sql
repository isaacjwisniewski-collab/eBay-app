-- ============================================================================
-- SoleSync: Supabase Schema for Multi-Account eBay Shoe Management
-- ============================================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. EBAY ACCOUNTS (one user can have multiple eBay seller accounts)
-- ============================================================================
CREATE TABLE public.ebay_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- eBay identity
  ebay_user_id TEXT NOT NULL,          -- eBay username
  account_label TEXT NOT NULL,          -- friendly name (e.g., "KicksVault_SF")
  color TEXT DEFAULT '#3A7BE8',         -- UI color for distinguishing accounts
  
  -- OAuth tokens (encrypted at rest by Supabase)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  token_scope TEXT,
  
  -- eBay app credentials for this keyset
  ebay_app_id TEXT,
  ebay_cert_id TEXT,
  ebay_dev_id TEXT,
  environment TEXT DEFAULT 'PRODUCTION' CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  
  -- Sync state
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'never' CHECK (sync_status IN ('never', 'syncing', 'synced', 'error')),
  sync_error TEXT,
  
  -- Meta
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, ebay_user_id)
);

-- ============================================================================
-- 3. LISTINGS (unified inventory across all accounts)
-- ============================================================================
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.ebay_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- eBay listing identifiers
  ebay_item_id TEXT NOT NULL,           -- eBay's item ID
  ebay_listing_url TEXT,
  
  -- Product details
  title TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  sku TEXT,
  shoe_size DECIMAL(4,1),
  shoe_width TEXT,                      -- D, 2E, 4E, etc.
  color TEXT,
  condition TEXT,                       -- "New with Box", "Pre-owned - Excellent", etc.
  condition_id INTEGER,                 -- eBay condition enum
  description TEXT,
  
  -- Images
  image_urls TEXT[],                    -- array of image URLs
  primary_image_url TEXT,
  
  -- Pricing
  current_price DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  listing_type TEXT,                    -- 'FixedPrice', 'Auction'
  buy_it_now_price DECIMAL(10,2),
  starting_price DECIMAL(10,2),
  reserve_price DECIMAL(10,2),
  best_offer_enabled BOOLEAN DEFAULT FALSE,
  
  -- Auction state
  bid_count INTEGER DEFAULT 0,
  highest_bid DECIMAL(10,2),
  
  -- Engagement metrics
  watch_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  
  -- Listing lifecycle
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'ending_soon', 'sold', 'unsold', 'draft', 'cancelled')),
  listed_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  sold_price DECIMAL(10,2),
  
  -- Shipping
  shipping_cost DECIMAL(10,2),
  shipping_type TEXT,                   -- 'Free', 'Flat', 'Calculated'
  handling_time_days INTEGER,
  
  -- Category
  ebay_category_id TEXT,
  ebay_category_name TEXT,
  
  -- Cost tracking (for profit calculation)
  cost_basis DECIMAL(10,2),             -- what you paid for the shoe
  
  -- Meta
  raw_ebay_data JSONB,                  -- full eBay API response for reference
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_listings_user_id ON public.listings(user_id);
CREATE INDEX idx_listings_account_id ON public.listings(account_id);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_ends_at ON public.listings(ends_at);
CREATE INDEX idx_listings_brand ON public.listings(brand);
CREATE INDEX idx_listings_ebay_item_id ON public.listings(ebay_item_id);
CREATE INDEX idx_listings_status_ends ON public.listings(status, ends_at);

-- ============================================================================
-- 4. MESSAGES (buyer-seller communication across accounts)
-- ============================================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.ebay_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- eBay message identifiers
  ebay_message_id TEXT NOT NULL,
  ebay_item_id TEXT,                    -- linked listing
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  
  -- Participants
  buyer_username TEXT NOT NULL,
  sender TEXT NOT NULL,                 -- 'buyer' or 'seller'
  
  -- Content
  subject TEXT,
  body TEXT,
  
  -- Thread tracking
  thread_id TEXT,                       -- groups related messages
  in_reply_to TEXT,                     -- parent message ID
  
  -- State
  is_read BOOLEAN DEFAULT FALSE,
  is_replied BOOLEAN DEFAULT FALSE,
  is_flagged BOOLEAN DEFAULT FALSE,
  requires_response BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  
  -- Meta
  message_type TEXT DEFAULT 'question'  -- question, offer, claim, general
    CHECK (message_type IN ('question', 'offer', 'claim', 'general', 'order')),
  raw_ebay_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_account_id ON public.messages(account_id);
CREATE INDEX idx_messages_is_read ON public.messages(is_read);
CREATE INDEX idx_messages_received_at ON public.messages(received_at DESC);
CREATE INDEX idx_messages_thread_id ON public.messages(thread_id);

-- ============================================================================
-- 5. PRICE COMPARISONS (sold comps for pricing intelligence)
-- ============================================================================
CREATE TABLE public.price_comps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- What was searched
  search_query TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  shoe_size DECIMAL(4,1),
  condition TEXT,
  
  -- Linked to one of our listings (optional)
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  
  -- Comp data (from eBay Browse API - sold items)
  comp_ebay_item_id TEXT,
  comp_title TEXT,
  comp_sold_price DECIMAL(10,2),
  comp_sold_date TIMESTAMPTZ,
  comp_condition TEXT,
  comp_image_url TEXT,
  comp_listing_url TEXT,
  comp_shoe_size DECIMAL(4,1),
  comp_shipping_cost DECIMAL(10,2),
  
  -- Aggregate stats (computed per search)
  avg_sold_price DECIMAL(10,2),
  median_sold_price DECIMAL(10,2),
  min_sold_price DECIMAL(10,2),
  max_sold_price DECIMAL(10,2),
  total_sold_count INTEGER,
  
  -- Meta
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_comps_listing_id ON public.price_comps(listing_id);
CREATE INDEX idx_price_comps_brand_model ON public.price_comps(brand, model);
CREATE INDEX idx_price_comps_fetched_at ON public.price_comps(fetched_at DESC);

-- ============================================================================
-- 6. SYNC LOG (track API sync history for debugging)
-- ============================================================================
CREATE TABLE public.sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.ebay_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  sync_type TEXT NOT NULL CHECK (sync_type IN ('listings', 'messages', 'prices', 'full')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  
  items_fetched INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  
  error_message TEXT,
  duration_ms INTEGER,
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- 7. ROW LEVEL SECURITY (users can only see their own data)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebay_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_comps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- eBay Accounts: users can CRUD their own accounts
CREATE POLICY "Users can view own accounts" ON public.ebay_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.ebay_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.ebay_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.ebay_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Listings: users can CRUD their own listings
CREATE POLICY "Users can view own listings" ON public.listings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own listings" ON public.listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own listings" ON public.listings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own listings" ON public.listings
  FOR DELETE USING (auth.uid() = user_id);

-- Messages: users can CRUD their own messages
CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

-- Price Comps: users can CRUD their own comps
CREATE POLICY "Users can view own comps" ON public.price_comps
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own comps" ON public.price_comps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sync Log: users can view their own logs
CREATE POLICY "Users can view own sync logs" ON public.sync_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sync logs" ON public.sync_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_ebay_accounts_updated_at
  BEFORE UPDATE ON public.ebay_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-mark listings as "ending_soon" when within 3 days
CREATE OR REPLACE FUNCTION update_ending_soon_status()
RETURNS void AS $$
BEGIN
  UPDATE public.listings
  SET status = 'ending_soon'
  WHERE status = 'active'
    AND ends_at IS NOT NULL
    AND ends_at <= NOW() + INTERVAL '3 days'
    AND ends_at > NOW();
    
  UPDATE public.listings
  SET status = 'unsold'
  WHERE status IN ('active', 'ending_soon')
    AND ends_at IS NOT NULL
    AND ends_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 9. VIEWS (convenient queries for the dashboard)
-- ============================================================================

-- Dashboard stats per user
CREATE OR REPLACE VIEW public.dashboard_stats AS
SELECT
  l.user_id,
  COUNT(*) FILTER (WHERE l.status IN ('active', 'ending_soon')) AS active_count,
  COUNT(*) FILTER (WHERE l.status = 'ending_soon') AS ending_soon_count,
  COUNT(*) FILTER (WHERE l.status = 'sold') AS sold_count,
  COUNT(*) FILTER (WHERE l.status = 'unsold') AS unsold_count,
  COALESCE(SUM(l.current_price) FILTER (WHERE l.status IN ('active', 'ending_soon')), 0) AS inventory_value,
  COALESCE(AVG(l.current_price), 0) AS avg_price,
  COALESCE(SUM(l.sold_price) FILTER (WHERE l.status = 'sold'), 0) AS total_revenue,
  COUNT(*) FILTER (WHERE l.status = 'sold' AND l.cost_basis IS NOT NULL) AS items_with_cost,
  COALESCE(
    SUM(l.sold_price - l.cost_basis) FILTER (WHERE l.status = 'sold' AND l.cost_basis IS NOT NULL), 0
  ) AS total_profit
FROM public.listings l
GROUP BY l.user_id;

-- Unread message count per account
CREATE OR REPLACE VIEW public.unread_counts AS
SELECT
  m.user_id,
  m.account_id,
  a.account_label,
  COUNT(*) FILTER (WHERE NOT m.is_read) AS unread_count
FROM public.messages m
JOIN public.ebay_accounts a ON a.id = m.account_id
GROUP BY m.user_id, m.account_id, a.account_label;


-- ============================================================================
-- DONE! Your schema is ready.
-- 
-- Next steps:
-- 1. Set up your Supabase Edge Functions (see ebay-edge-functions.ts)
-- 2. Configure eBay OAuth redirect URL to your Supabase function URL
-- 3. Set up a cron job to call update_ending_soon_status() every hour
--    (use pg_cron or Supabase's scheduled functions)
-- ============================================================================

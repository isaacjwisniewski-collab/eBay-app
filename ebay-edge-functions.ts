// ============================================================================
// SoleSync: Supabase Edge Functions for eBay API Integration
// ============================================================================
//
// SETUP INSTRUCTIONS:
// 1. Install Supabase CLI: npm install -g supabase
// 2. In your Lovable project, run: supabase functions new ebay-api
// 3. Copy each function below into its own file under supabase/functions/
// 4. Set secrets:
//    supabase secrets set EBAY_APP_ID=your_app_id
//    supabase secrets set EBAY_CERT_ID=your_cert_id
//    supabase secrets set EBAY_DEV_ID=your_dev_id
//    supabase secrets set EBAY_REDIRECT_URI=https://juelixwikfbizbpxtwpx.supabase.co/functions/v1/ebay-oauth-callback
//    supabase secrets set SUPABASE_URL=https://juelixwikfbizbpxtwpx.supabase.co
//    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
// 5. Deploy: supabase functions deploy
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: eBay API helpers used across all functions
// ─────────────────────────────────────────────────────────────────────────────

// File: supabase/functions/_shared/ebay-client.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EBAY_API_BASE = "https://api.ebay.com";
const EBAY_AUTH_BASE = "https://auth.ebay.com";
const EBAY_SANDBOX_API_BASE = "https://api.sandbox.ebay.com";
const EBAY_SANDBOX_AUTH_BASE = "https://auth.sandbox.ebay.com";

export interface EbayAccount {
  id: string;
  user_id: string;
  ebay_user_id: string;
  account_label: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  ebay_app_id: string;
  ebay_cert_id: string;
  environment: "SANDBOX" | "PRODUCTION";
}

export function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

export function getApiBase(env: string) {
  return env === "SANDBOX" ? EBAY_SANDBOX_API_BASE : EBAY_API_BASE;
}

export function getAuthBase(env: string) {
  return env === "SANDBOX" ? EBAY_SANDBOX_AUTH_BASE : EBAY_AUTH_BASE;
}

// Refresh an expired OAuth token
export async function refreshEbayToken(account: EbayAccount): Promise<string> {
  const supabase = getSupabaseAdmin();
  const authBase = getAuthBase(account.environment);

  const appId = account.ebay_app_id || Deno.env.get("EBAY_APP_ID")!;
  const certId = account.ebay_cert_id || Deno.env.get("EBAY_CERT_ID")!;
  const credentials = btoa(`${appId}:${certId}`);

  const response = await fetch(`${authBase}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  // Update token in database
  const expiresAt = new Date(
    Date.now() + data.expires_in * 1000
  ).toISOString();
  await supabase
    .from("ebay_accounts")
    .update({
      access_token: data.access_token,
      token_expires_at: expiresAt,
      ...(data.refresh_token && { refresh_token: data.refresh_token }),
    })
    .eq("id", account.id);

  return data.access_token;
}

// Get a valid access token (refresh if expired)
export async function getValidToken(account: EbayAccount): Promise<string> {
  const expiresAt = new Date(account.token_expires_at);
  const now = new Date();

  // Refresh if token expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    return await refreshEbayToken(account);
  }

  return account.access_token;
}

// Make an authenticated eBay API request
export async function ebayFetch(
  account: EbayAccount,
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getValidToken(account);
  const apiBase = getApiBase(account.environment);

  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`eBay API error (${response.status}): ${error}`);
  }

  return response.json();
}


// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 1: OAuth Flow — Connect an eBay Account
// ─────────────────────────────────────────────────────────────────────────────

// File: supabase/functions/ebay-oauth-start/index.ts
// Purpose: Initiates the eBay OAuth consent flow for a seller account
// Call from frontend: window.open(`${SUPABASE_URL}/functions/v1/ebay-oauth-start?user_id=...`)

export async function handleOAuthStart(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  const accountLabel = url.searchParams.get("label") || "My eBay Account";

  if (!userId) {
    return new Response(JSON.stringify({ error: "user_id required" }), {
      status: 400,
    });
  }

  const appId = Deno.env.get("EBAY_APP_ID")!;
  const redirectUri = Deno.env.get("EBAY_REDIRECT_URI")!;

  // Scopes needed for selling, messages, and browsing
  const scopes = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.marketing",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
    "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.finances",
    "https://api.ebay.com/oauth/api_scope/sell.item",
  ].join(" ");

  // Encode state to pass through OAuth (user_id + label)
  const state = btoa(JSON.stringify({ userId, accountLabel }));

  const authUrl =
    `${EBAY_AUTH_BASE}/oauth2/authorize?` +
    `client_id=${appId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${encodeURIComponent(state)}`;

  return Response.redirect(authUrl, 302);
}


// File: supabase/functions/ebay-oauth-callback/index.ts
// Purpose: Handles the OAuth callback from eBay, exchanges code for tokens

export async function handleOAuthCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    return new Response("Missing code or state", { status: 400 });
  }

  const { userId, accountLabel } = JSON.parse(atob(stateParam));

  const appId = Deno.env.get("EBAY_APP_ID")!;
  const certId = Deno.env.get("EBAY_CERT_ID")!;
  const redirectUri = Deno.env.get("EBAY_REDIRECT_URI")!;
  const credentials = btoa(`${appId}:${certId}`);

  // Exchange authorization code for tokens
  const tokenResponse = await fetch(`${EBAY_AUTH_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    return new Response(`Token exchange failed: ${error}`, { status: 500 });
  }

  const tokenData = await tokenResponse.json();

  // Get the eBay user ID
  const userResponse = await fetch(`${EBAY_API_BASE}/commerce/identity/v1/user/`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    },
  });

  const userData = await userResponse.json();
  const ebayUserId = userData.username || userData.userId || "unknown";

  // Store in Supabase
  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(
    Date.now() + tokenData.expires_in * 1000
  ).toISOString();

  const { error } = await supabase.from("ebay_accounts").upsert(
    {
      user_id: userId,
      ebay_user_id: ebayUserId,
      account_label: accountLabel,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      token_scope: tokenData.scope,
      ebay_app_id: appId,
      ebay_cert_id: certId,
      ebay_dev_id: Deno.env.get("EBAY_DEV_ID"),
      sync_status: "never",
    },
    { onConflict: "user_id,ebay_user_id" }
  );

  if (error) {
    return new Response(`Database error: ${error.message}`, { status: 500 });
  }

  // Redirect back to app
  const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
  return Response.redirect(`${appUrl}/settings?connected=true`, 302);
}


// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 2: Sync Listings — Pull all active listings from eBay
// ─────────────────────────────────────────────────────────────────────────────

// File: supabase/functions/sync-listings/index.ts
// Purpose: Fetches all active listings from an eBay account and upserts them
// Call: POST /functions/v1/sync-listings { account_id: "..." }

export async function handleSyncListings(req: Request): Promise<Response> {
  const { account_id } = await req.json();
  const supabase = getSupabaseAdmin();

  // Get account details
  const { data: account, error: accountError } = await supabase
    .from("ebay_accounts")
    .select("*")
    .eq("id", account_id)
    .single();

  if (accountError || !account) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404 }
    );
  }

  // Log sync start
  const { data: syncLog } = await supabase
    .from("sync_log")
    .insert({
      account_id: account.id,
      user_id: account.user_id,
      sync_type: "listings",
      status: "started",
    })
    .select()
    .single();

  await supabase
    .from("ebay_accounts")
    .update({ sync_status: "syncing" })
    .eq("id", account_id);

  try {
    let allItems: any[] = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;

    // Paginate through all seller listings using the Sell API
    while (hasMore) {
      const data = await ebayFetch(
        account as EbayAccount,
        `/sell/inventory/v1/inventory_item?limit=${limit}&offset=${offset}`
      );

      const items = data.inventoryItems || [];
      allItems = allItems.concat(items);
      offset += limit;
      hasMore = items.length === limit;
    }

    // Also get active listing details via Trading API (for auction data, watchers, etc.)
    // Using the sell/fulfillment API for richer data
    let activeListings: any[] = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
      const data = await ebayFetch(
        account as EbayAccount,
        `/sell/marketing/v1/ad_campaign?limit=${limit}&offset=${offset}`
      );

      // For actual seller listings, use the Browse API search with seller filter
      // or the Trading API GetMyeBaySelling
      const listings = data.campaigns || [];
      activeListings = activeListings.concat(listings);
      offset += limit;
      hasMore = listings.length === limit;
    }

    // Alternative: Use the Finding API to get seller's listings
    const sellerListings = await ebayFetch(
      account as EbayAccount,
      `/buy/browse/v1/item_summary/search?` +
      `seller_ids=${account.ebay_user_id}&limit=200`
    );

    const itemSummaries = sellerListings.itemSummaries || [];

    // Upsert listings into database
    let created = 0;
    let updated = 0;

    for (const item of itemSummaries) {
      const listingData = {
        account_id: account.id,
        user_id: account.user_id,
        ebay_item_id: item.itemId,
        ebay_listing_url: item.itemWebUrl,
        title: item.title,
        brand: extractBrand(item.title),
        model: extractModel(item.title),
        shoe_size: extractSize(item.title),
        condition: item.condition,
        condition_id: item.conditionId ? parseInt(item.conditionId) : null,
        current_price: parseFloat(item.price?.value || "0"),
        currency: item.price?.currency || "USD",
        listing_type: item.buyingOptions?.includes("AUCTION")
          ? "Auction"
          : "FixedPrice",
        buy_it_now_price: item.buyingOptions?.includes("FIXED_PRICE")
          ? parseFloat(item.price?.value || "0")
          : null,
        bid_count: item.bidCount || 0,
        watch_count: 0, // Need separate API call for watch count
        image_urls: item.thumbnailImages?.map((img: any) => img.imageUrl) || [],
        primary_image_url: item.image?.imageUrl || null,
        status: "active",
        listed_at: item.itemCreationDate || new Date().toISOString(),
        ends_at: item.itemEndDate || null,
        shipping_cost: item.shippingOptions?.[0]?.shippingCost?.value
          ? parseFloat(item.shippingOptions[0].shippingCost.value)
          : null,
        shipping_type: item.shippingOptions?.[0]?.shippingCostType || null,
        ebay_category_id: item.categories?.[0]?.categoryId || null,
        ebay_category_name: item.categories?.[0]?.categoryName || null,
        raw_ebay_data: item,
      };

      const { data: existing } = await supabase
        .from("listings")
        .select("id")
        .eq("ebay_item_id", item.itemId)
        .eq("account_id", account.id)
        .single();

      if (existing) {
        await supabase
          .from("listings")
          .update(listingData)
          .eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("listings").insert(listingData);
        created++;
      }
    }

    // Update sync status
    await supabase
      .from("ebay_accounts")
      .update({
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq("id", account_id);

    // Update sync log
    if (syncLog) {
      await supabase
        .from("sync_log")
        .update({
          status: "completed",
          items_fetched: itemSummaries.length,
          items_created: created,
          items_updated: updated,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        fetched: itemSummaries.length,
        created,
        updated,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Log error
    await supabase
      .from("ebay_accounts")
      .update({ sync_status: "error", sync_error: error.message })
      .eq("id", account_id);

    if (syncLog) {
      await supabase
        .from("sync_log")
        .update({
          status: "failed",
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 3: Sync Messages — Pull buyer messages from eBay
// ─────────────────────────────────────────────────────────────────────────────

// File: supabase/functions/sync-messages/index.ts
// Purpose: Fetches recent messages from an eBay account
// Call: POST /functions/v1/sync-messages { account_id: "..." }

export async function handleSyncMessages(req: Request): Promise<Response> {
  const { account_id } = await req.json();
  const supabase = getSupabaseAdmin();

  const { data: account, error: accountError } = await supabase
    .from("ebay_accounts")
    .select("*")
    .eq("id", account_id)
    .single();

  if (accountError || !account) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404 }
    );
  }

  try {
    // Use the Post-Order API / Member Message API
    // Note: eBay has multiple message APIs depending on message type
    
    // Trading API - GetMyMessages (most comprehensive for seller messages)
    // This requires the Trading API with XML, so we'll use the REST equivalent
    
    // For the REST API, use the sell/fulfillment API for order-related messages
    // and the commerce/notification API for general messages
    
    // Approach: Use the Trading API via REST wrapper
    const messagesData = await ebayFetch(
      account as EbayAccount,
      `/sell/fulfillment/v1/order?filter=orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}&limit=50`
    );

    const orders = messagesData.orders || [];
    let messageCount = 0;

    // For each order, check for buyer messages
    for (const order of orders) {
      // Buyer messages come through the order's lineItems
      if (order.buyerCheckoutNotes) {
        const messageData = {
          account_id: account.id,
          user_id: account.user_id,
          ebay_message_id: `order_${order.orderId}`,
          ebay_item_id: order.lineItems?.[0]?.legacyItemId || null,
          buyer_username: order.buyer?.username || "unknown",
          sender: "buyer",
          subject: `Order note for ${order.lineItems?.[0]?.title || "item"}`,
          body: order.buyerCheckoutNotes,
          thread_id: `order_${order.orderId}`,
          is_read: false,
          requires_response: true,
          received_at: order.creationDate || new Date().toISOString(),
          message_type: "order",
          raw_ebay_data: order,
        };

        // Upsert message
        const { data: existing } = await supabase
          .from("messages")
          .select("id")
          .eq("ebay_message_id", messageData.ebay_message_id)
          .single();

        if (!existing) {
          await supabase.from("messages").insert(messageData);
          messageCount++;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // For full buyer-seller messaging, you'll also want to use the
    // Trading API's GetMyMessages call. This requires the XML API:
    //
    // POST https://api.ebay.com/ws/api.dll
    // Headers:
    //   X-EBAY-API-CALL-NAME: GetMyMessages
    //   X-EBAY-API-SITEID: 0
    //   X-EBAY-API-COMPATIBILITY-LEVEL: 1225
    //
    // Body (XML):
    // <?xml version="1.0" encoding="utf-8"?>
    // <GetMyMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
    //   <RequesterCredentials>
    //     <eBayAuthToken>{access_token}</eBayAuthToken>
    //   </RequesterCredentials>
    //   <FolderID>0</FolderID>
    //   <StartTime>{30_days_ago_iso}</StartTime>
    //   <EndTime>{now_iso}</EndTime>
    //   <DetailLevel>ReturnMessages</DetailLevel>
    // </GetMyMessagesRequest>
    //
    // Parse the XML response and upsert each message.
    // ─────────────────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({
        success: true,
        orders_checked: orders.length,
        new_messages: messageCount,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 4: Price Comparison — Find sold comps for a listing
// ─────────────────────────────────────────────────────────────────────────────

// File: supabase/functions/price-compare/index.ts
// Purpose: Searches eBay sold listings for comparable shoes
// Call: POST /functions/v1/price-compare { listing_id: "...", query: "Nike Air Max 90", size: 10 }

export async function handlePriceCompare(req: Request): Promise<Response> {
  const { listing_id, query, size, condition } = await req.json();
  const supabase = getSupabaseAdmin();

  // Get user's first active account for API access
  // (Browse API works with any valid token)
  const { data: accounts } = await supabase
    .from("ebay_accounts")
    .select("*")
    .eq("is_active", true)
    .limit(1);

  if (!accounts || accounts.length === 0) {
    return new Response(
      JSON.stringify({ error: "No connected eBay accounts" }),
      { status: 400 }
    );
  }

  const account = accounts[0] as EbayAccount;

  try {
    // Build search filter for sold items
    let searchUrl =
      `/buy/browse/v1/item_summary/search?` +
      `q=${encodeURIComponent(query)}&` +
      `filter=buyingOptions:{FIXED_PRICE|AUCTION},` +
      `conditions:{NEW|USED},` +
      `price:[10..1000],` +
      `priceCurrency:USD&` +
      `sort=-price&` +
      `limit=50`;

    // Note: The Browse API's search endpoint returns active listings.
    // For SOLD items, you need the Finding API's findCompletedItems:
    //
    // GET https://svcs.ebay.com/services/search/FindingService/v1
    //   ?OPERATION-NAME=findCompletedItems
    //   &SERVICE-VERSION=1.0.0
    //   &SECURITY-APPNAME={app_id}
    //   &RESPONSE-DATA-FORMAT=JSON
    //   &keywords={query}
    //   &itemFilter(0).name=SoldItemsOnly
    //   &itemFilter(0).value=true
    //   &itemFilter(1).name=Condition
    //   &itemFilter(1).value=New
    //   &sortOrder=EndTimeSoonest
    //   &paginationInput.entriesPerPage=50
    //
    // The Finding API uses the App ID directly (no user token needed).

    // For now, use Browse API for active comps (similar pricing reference)
    const searchData = await ebayFetch(account, searchUrl);
    const items = searchData.itemSummaries || [];

    // Calculate stats
    const prices = items
      .map((item: any) => parseFloat(item.price?.value || "0"))
      .filter((p: number) => p > 0)
      .sort((a: number, b: number) => a - b);

    const stats = {
      avg: prices.length > 0
        ? Math.round((prices.reduce((a: number, b: number) => a + b, 0) / prices.length) * 100) / 100
        : 0,
      median: prices.length > 0
        ? prices[Math.floor(prices.length / 2)]
        : 0,
      min: prices.length > 0 ? prices[0] : 0,
      max: prices.length > 0 ? prices[prices.length - 1] : 0,
      count: prices.length,
    };

    // Store comps in database
    const userId = account.user_id;
    const compsToInsert = items.slice(0, 20).map((item: any) => ({
      user_id: userId,
      search_query: query,
      brand: extractBrand(query),
      model: extractModel(query),
      shoe_size: size || null,
      condition: condition || null,
      listing_id: listing_id || null,
      comp_ebay_item_id: item.itemId,
      comp_title: item.title,
      comp_sold_price: parseFloat(item.price?.value || "0"),
      comp_sold_date: item.itemEndDate || null,
      comp_condition: item.condition,
      comp_image_url: item.image?.imageUrl || null,
      comp_listing_url: item.itemWebUrl,
      comp_shoe_size: extractSize(item.title),
      comp_shipping_cost: item.shippingOptions?.[0]?.shippingCost?.value
        ? parseFloat(item.shippingOptions[0].shippingCost.value)
        : 0,
      avg_sold_price: stats.avg,
      median_sold_price: stats.median,
      min_sold_price: stats.min,
      max_sold_price: stats.max,
      total_sold_count: stats.count,
    }));

    if (compsToInsert.length > 0) {
      await supabase.from("price_comps").insert(compsToInsert);
    }

    return new Response(
      JSON.stringify({
        success: true,
        query,
        stats,
        comps: items.slice(0, 20).map((item: any) => ({
          title: item.title,
          price: parseFloat(item.price?.value || "0"),
          condition: item.condition,
          image: item.image?.imageUrl,
          url: item.itemWebUrl,
          size: extractSize(item.title),
        })),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION 5: Cron — Scheduled sync for all accounts
// ─────────────────────────────────────────────────────────────────────────────

// File: supabase/functions/cron-sync/index.ts
// Purpose: Called by Supabase cron to sync all active accounts
// Set up in Supabase Dashboard → Database → Extensions → pg_cron:
//   SELECT cron.schedule('sync-ebay', '0 */2 * * *',
//     $$SELECT net.http_post(
//       'https://your-project.supabase.co/functions/v1/cron-sync',
//       '{}', '{}'::jsonb,
//       headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
//     );$$
//   );

export async function handleCronSync(req: Request): Promise<Response> {
  const supabase = getSupabaseAdmin();

  // Get all active accounts
  const { data: accounts } = await supabase
    .from("ebay_accounts")
    .select("id, user_id, account_label")
    .eq("is_active", true);

  if (!accounts || accounts.length === 0) {
    return new Response(JSON.stringify({ message: "No active accounts" }));
  }

  const results = [];

  for (const account of accounts) {
    try {
      // Sync listings
      const listingResult = await handleSyncListings(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({ account_id: account.id }),
        })
      );

      // Sync messages
      const messageResult = await handleSyncMessages(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({ account_id: account.id }),
        })
      );

      results.push({
        account: account.account_label,
        listings: await listingResult.json(),
        messages: await messageResult.json(),
      });
    } catch (error) {
      results.push({
        account: account.account_label,
        error: error.message,
      });
    }
  }

  // Update ending_soon statuses
  await supabase.rpc("update_ending_soon_status");

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Extract shoe details from listing titles
// ─────────────────────────────────────────────────────────────────────────────

function extractBrand(title: string): string | null {
  const brands = [
    "Nike", "Jordan", "Air Jordan", "New Balance", "Adidas",
    "Asics", "Puma", "Reebok", "Converse", "Vans",
    "Saucony", "Brooks", "Hoka", "On", "Salomon",
    "Yeezy", "Under Armour", "Timberland", "Dr. Martens",
  ];

  const lower = title.toLowerCase();
  for (const brand of brands) {
    if (lower.includes(brand.toLowerCase())) return brand;
  }
  return null;
}

function extractModel(title: string): string | null {
  // Remove brand and size info, return remaining as model
  const brand = extractBrand(title);
  if (!brand) return title;

  let model = title;
  model = model.replace(new RegExp(brand, "i"), "").trim();
  model = model.replace(/\b(size|sz|us|men'?s?|women'?s?|gs|td|ps)\s*\d+\.?\d*/gi, "").trim();
  model = model.replace(/\s+/g, " ").trim();
  return model || null;
}

function extractSize(title: string): number | null {
  // Match patterns like "Size 10", "Sz 10.5", "US 11", etc.
  const match = title.match(
    /(?:size|sz|us)\s*(\d+\.?\d*)/i
  );
  if (match) return parseFloat(match[1]);

  // Match standalone size patterns at end of title
  const endMatch = title.match(/\b(\d{1,2}\.5?)\s*$/);
  if (endMatch) {
    const size = parseFloat(endMatch[1]);
    if (size >= 4 && size <= 16) return size;
  }

  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN ROUTER (if deploying as a single function)
// ─────────────────────────────────────────────────────────────────────────────

// If you prefer separate functions, split each handler into its own
// supabase/functions/{name}/index.ts file. If you want a single function:

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let response: Response;

    switch (path) {
      case "ebay-oauth-start":
        response = await handleOAuthStart(req);
        break;
      case "ebay-oauth-callback":
        response = await handleOAuthCallback(req);
        break;
      case "sync-listings":
        response = await handleSyncListings(req);
        break;
      case "sync-messages":
        response = await handleSyncMessages(req);
        break;
      case "price-compare":
        response = await handlePriceCompare(req);
        break;
      case "cron-sync":
        response = await handleCronSync(req);
        break;
      default:
        response = new Response(
          JSON.stringify({
            error: "Unknown endpoint",
            available: [
              "ebay-oauth-start",
              "ebay-oauth-callback",
              "sync-listings",
              "sync-messages",
              "price-compare",
              "cron-sync",
            ],
          }),
          { status: 404 }
        );
    }

    // Add CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

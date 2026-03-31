import { getSupabaseAdmin, ebayFetch, extractBrand, extractSize } from "../_shared/ebay-client.ts";
import type { EbayAccount } from "../_shared/ebay-client.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const { listing_id, query, size, condition } = await req.json();
  const supabase = getSupabaseAdmin();
  const { data: accounts } = await supabase.from("ebay_accounts").select("*").eq("is_active", true).limit(1);
  if (!accounts || accounts.length === 0) return new Response(JSON.stringify({ error: "No connected eBay accounts" }), { status: 400, headers: corsHeaders });
  const account = accounts[0] as EbayAccount;
  try {
    const searchUrl = `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&filter=buyingOptions:{FIXED_PRICE|AUCTION},conditions:{NEW|USED},price:[10..1000],priceCurrency:USD&sort=-price&limit=50`;
    const searchData = await ebayFetch(account, searchUrl);
    const items = searchData.itemSummaries || [];
    const prices = items.map((item: any) => parseFloat(item.price?.value || "0")).filter((p: number) => p > 0).sort((a: number, b: number) => a - b);
    const sum = prices.reduce((a: number, b: number) => a + b, 0);
    const stats = { avg: prices.length > 0 ? Math.round((sum / prices.length) * 100) / 100 : 0, median: prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0, min: prices.length > 0 ? prices[0] : 0, max: prices.length > 0 ? prices[prices.length - 1] : 0, count: prices.length };
    const userId = account.user_id;
    const compsToInsert = items.slice(0, 20).map((item: any) => ({ user_id: userId, search_query: query, brand: extractBrand(query), shoe_size: size || null, condition: condition || null, listing_id: listing_id || null, comp_ebay_item_id: item.itemId, comp_title: item.title, comp_sold_price: parseFloat(item.price?.value || "0"), comp_sold_date: item.itemEndDate || null, comp_condition: item.condition, comp_image_url: item.image?.imageUrl || null, comp_listing_url: item.itemWebUrl, comp_shoe_size: extractSize(item.title), comp_shipping_cost: item.shippingOptions?.[0]?.shippingCost?.value ? parseFloat(item.shippingOptions[0].shippingCost.value) : 0, avg_sold_price: stats.avg, median_sold_price: stats.median, min_sold_price: stats.min, max_sold_price: stats.max, total_sold_count: stats.count }));
    if (compsToInsert.length > 0) { await supabase.from("price_comps").insert(compsToInsert); }
    return new Response(JSON.stringify({ success: true, query, stats, comps: items.slice(0, 20).map((item: any) => ({ title: item.title, price: parseFloat(item.price?.value || "0"), condition: item.condition, image: item.image?.imageUrl, url: item.itemWebUrl, size: extractSize(item.title) })) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

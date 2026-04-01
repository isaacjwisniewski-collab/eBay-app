import { getSupabaseAdmin, extractBrand, extractSize } from "../_shared/ebay-client.ts";
import type { EbayAccount } from "../_shared/ebay-client.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { account_id } = await req.json();
    const supabase = getSupabaseAdmin();
    const { data: account, error: accountError } = await supabase.from("ebay_accounts").select("*").eq("id", account_id).single();
    if (accountError || !account) return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: corsHeaders });
    await supabase.from("ebay_accounts").update({ sync_status: "syncing" }).eq("id", account_id);
    const token = account.access_token;
    let created = 0;
    let updated = 0;
    const parseItems = (xmlText: string, section: string, status: string) => {
      const regex = new RegExp(`<Item>([\\s\\S]*?)<\\/Item>`, "g");
      const sectionMatch = xmlText.match(new RegExp(`<${section}>[\\s\\S]*?<\\/${section}>`));
      if (!sectionMatch) return [];
      const items: any[] = [];
      let match;
      while ((match = regex.exec(sectionMatch[0])) !== null) {
        const xml = match[1];
        const get = (tag: string) => { const m = xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`)); return m ? m[1] : null; };
        items.push({ itemId: get("ItemID"), title: get("Title"), currentPrice: get("CurrentPrice"), bidCount: get("BidCount"), watchCount: get("WatchCount"), viewCount: get("ViewItemsCount"), listingType: get("ListingType"), endTime: get("EndTime"), startTime: get("StartTime"), url: get("ViewItemURL"), imageUrl: get("GalleryURL"), quantity: get("Quantity"), quantitySold: get("QuantitySold"), status });
      }
      return items;
    };
    const getTotalPages = (xmlText: string, section: string) => {
      const sectionMatch = xmlText.match(new RegExp(`<${section}>[\\s\\S]*?<\\/${section}>`));
      if (!sectionMatch) return 1;
      const m = sectionMatch[0].match(/<TotalNumberOfPages>(\d+)<\/TotalNumberOfPages>/);
      return m ? parseInt(m[1]) : 1;
    };
    const fetchPage = async (activeP: number, soldP: number, unsoldP: number) => {
      const xmlBody = `<?xml version="1.0" encoding="utf-8"?><GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials><ActiveList><Sort>TimeLeft</Sort><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${activeP}</PageNumber></Pagination></ActiveList><SoldList><Sort>EndTime</Sort><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${soldP}</PageNumber></Pagination></SoldList><UnsoldList><Sort>EndTime</Sort><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${unsoldP}</PageNumber></Pagination></UnsoldList><ErrorLanguage>en_US</ErrorLanguage><WarningLevel>High</WarningLevel></GetMyeBaySellingRequest>`;
      const response = await fetch("https://api.ebay.com/ws/api.dll", { method: "POST", headers: { "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "1271", "X-EBAY-API-CALL-NAME": "GetMyeBaySelling", "X-EBAY-API-IAF-TOKEN": `Bearer ${token}`, "Content-Type": "text/xml" }, body: xmlBody });
      return await response.text();
    };
    const firstPage = await fetchPage(1, 1, 1);
    const activeTotalPages = getTotalPages(firstPage, "ActiveList");
    const soldTotalPages = getTotalPages(firstPage, "SoldList");
    const unsoldTotalPages = getTotalPages(firstPage, "UnsoldList");
    let allItems = [...parseItems(firstPage, "ActiveList", "active"), ...parseItems(firstPage, "SoldList", "sold"), ...parseItems(firstPage, "UnsoldList", "unsold")];
    const maxPages = Math.max(activeTotalPages, soldTotalPages, unsoldTotalPages);
    for (let page = 2; page <= maxPages; page++) {
      const ap = page <= activeTotalPages ? page : activeTotalPages;
      const sp = page <= soldTotalPages ? page : soldTotalPages;
      const up = page <= unsoldTotalPages ? page : unsoldTotalPages;
      if (page > activeTotalPages && page > soldTotalPages && page > unsoldTotalPages) break;
      const xml = await fetchPage(ap, sp, up);
      if (page <= activeTotalPages) allItems.push(...parseItems(xml, "ActiveList", "active"));
      if (page <= soldTotalPages) allItems.push(...parseItems(xml, "SoldList", "sold"));
      if (page <= unsoldTotalPages) allItems.push(...parseItems(xml, "UnsoldList", "unsold"));
    }
    for (const item of allItems) {
      if (!item.itemId) continue;
      const title = item.title || "Unknown";
      const listingData = { account_id: account.id, user_id: account.user_id, ebay_item_id: item.itemId, ebay_listing_url: item.url || null, title: title, brand: extractBrand(title), shoe_size: extractSize(title), current_price: item.currentPrice ? parseFloat(item.currentPrice) : 0, currency: "USD", listing_type: item.listingType || "FixedPrice", bid_count: item.bidCount ? parseInt(item.bidCount) : 0, watch_count: item.watchCount ? parseInt(item.watchCount) : 0, view_count: item.viewCount ? parseInt(item.viewCount) : 0, status: item.status, listed_at: item.startTime || null, ends_at: item.endTime || null, primary_image_url: item.imageUrl || null, raw_ebay_data: item };
      const { data: existing } = await supabase.from("listings").select("id").eq("ebay_item_id", item.itemId).eq("account_id", account.id).maybeSingle();
      if (existing) { await supabase.from("listings").update(listingData).eq("id", existing.id); updated++; } else { await supabase.from("listings").insert(listingData); created++; }
    }
    await supabase.from("ebay_accounts").update({ sync_status: "synced", last_synced_at: new Date().toISOString(), sync_error: null }).eq("id", account_id);
    return new Response(JSON.stringify({ success: true, total: allItems.length, pages: { active: activeTotalPages, sold: soldTotalPages, unsold: unsoldTotalPages }, created, updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

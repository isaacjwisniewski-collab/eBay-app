import { getSupabaseAdmin, ebayFetch } from "../_shared/ebay-client.ts";
import type { EbayAccount } from "../_shared/ebay-client.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const { account_id } = await req.json();
  const supabase = getSupabaseAdmin();
  const { data: account, error: accountError } = await supabase.from("ebay_accounts").select("*").eq("id", account_id).single();
  if (accountError || !account) return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: corsHeaders });
  try {
    const messagesData = await ebayFetch(account as EbayAccount, `/sell/fulfillment/v1/order?filter=orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}&limit=50`);
    const orders = messagesData.orders || [];
    let messageCount = 0;
    for (const order of orders) {
      if (order.buyerCheckoutNotes) {
        const messageData = { account_id: account.id, user_id: account.user_id, ebay_message_id: `order_${order.orderId}`, ebay_item_id: order.lineItems?.[0]?.legacyItemId || null, buyer_username: order.buyer?.username || "unknown", sender: "buyer", subject: `Order note for ${order.lineItems?.[0]?.title || "item"}`, body: order.buyerCheckoutNotes, thread_id: `order_${order.orderId}`, is_read: false, requires_response: true, received_at: order.creationDate || new Date().toISOString(), message_type: "order", raw_ebay_data: order };
        const { data: existing } = await supabase.from("messages").select("id").eq("ebay_message_id", messageData.ebay_message_id).single();
        if (!existing) { await supabase.from("messages").insert(messageData); messageCount++; }
      }
    }
    return new Response(JSON.stringify({ success: true, orders_checked: orders.length, new_messages: messageCount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

import { getSupabaseAdmin } from "../_shared/ebay-client.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = getSupabaseAdmin();
  const baseUrl = new URL(req.url).origin;
  const { data: accounts } = await supabase.from("ebay_accounts").select("id, user_id, account_label").eq("is_active", true);
  if (!accounts || accounts.length === 0) return new Response(JSON.stringify({ message: "No active accounts" }), { headers: corsHeaders });
  const results = [];
  for (const account of accounts) {
    try {
      const listingRes = await fetch(`${baseUrl}/sync-listings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: account.id }) });
      const messageRes = await fetch(`${baseUrl}/sync-messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: account.id }) });
      results.push({ account: account.account_label, listings: await listingRes.json(), messages: await messageRes.json() });
    } catch (error) {
      results.push({ account: account.account_label, error: error.message });
    }
  }
  await supabase.rpc("update_ending_soon_status");
  return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

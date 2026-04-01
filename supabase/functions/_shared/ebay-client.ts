import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export interface EbayAccount {
  id: string; user_id: string; ebay_user_id: string; account_label: string; access_token: string; refresh_token: string; token_expires_at: string; ebay_app_id: string; ebay_cert_id: string; environment: "SANDBOX" | "PRODUCTION";
}
export function getSupabaseAdmin() {
  const url = Deno.env.get("SB_URL") || Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(url, key);
}
export function getApiBase(env: string) { return env === "SANDBOX" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com"; }
export function getAuthBase(env: string) { return env === "SANDBOX" ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com"; }
export async function refreshEbayToken(account: EbayAccount): Promise<string> {
  const supabase = getSupabaseAdmin();
  const appId = account.ebay_app_id || Deno.env.get("EBAY_APP_ID")!;
  const certId = account.ebay_cert_id || Deno.env.get("EBAY_CERT_ID")!;
  const credentials = btoa(`${appId}:${certId}`);
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: account.refresh_token }) });
  if (!response.ok) throw new Error(`Token refresh failed: ${await response.text()}`);
  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase.from("ebay_accounts").update({ access_token: data.access_token, token_expires_at: expiresAt, ...(data.refresh_token && { refresh_token: data.refresh_token }) }).eq("id", account.id);
  return data.access_token;
}
export async function getValidToken(account: EbayAccount): Promise<string> {
  const expiresAt = new Date(account.token_expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) return await refreshEbayToken(account);
  return account.access_token;
}
export async function ebayFetch(account: EbayAccount, endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getValidToken(account);
  const apiBase = getApiBase(account.environment);
  const response = await fetch(`${apiBase}${endpoint}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US", ...options.headers } });
  if (!response.ok) throw new Error(`eBay API error (${response.status}): ${await response.text()}`);
  return response.json();
}
export function extractBrand(title: string): string | null {
  const brands = ["Nike", "Jordan", "Air Jordan", "New Balance", "Adidas", "Asics", "Puma", "Reebok", "Converse", "Vans", "Saucony", "Hoka", "Salomon", "Yeezy"];
  const lower = title.toLowerCase();
  for (const brand of brands) { if (lower.includes(brand.toLowerCase())) return brand; }
  return null;
}
export function extractSize(title: string): number | null {
  const match = title.match(/(?:size|sz|us)\s*(\d+\.?\d*)/i);
  if (match) return parseFloat(match[1]);
  return null;
}

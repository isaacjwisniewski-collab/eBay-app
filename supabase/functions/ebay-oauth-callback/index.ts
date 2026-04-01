import { getSupabaseAdmin } from "../_shared/ebay-client.ts";
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (!code || !stateParam) return new Response("Missing code or state", { status: 400 });
  const { userId, accountLabel } = JSON.parse(atob(stateParam));
  const appId = Deno.env.get("EBAY_APP_ID")!;
  const certId = Deno.env.get("EBAY_CERT_ID")!;
  const redirectUri = Deno.env.get("EBAY_REDIRECT_URI")!;
  const credentials = btoa(`${appId}:${certId}`);
  const tokenResponse = await fetch("https://api.ebay.com/identity/v1/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }) });
  const tokenText = await tokenResponse.text();
  if (!tokenResponse.ok) return new Response(`Token failed: ${tokenText}`, { status: 500 });
  let tokenData;
  try { tokenData = JSON.parse(tokenText); } catch (e) { return new Response(`Token parse error: ${tokenText}`, { status: 500 }); }
  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 7200) * 1000).toISOString();
  const insertData = { user_id: userId, ebay_user_id: accountLabel, account_label: accountLabel, access_token: tokenData.access_token || "none", refresh_token: tokenData.refresh_token || "none", token_expires_at: expiresAt, ebay_app_id: appId, ebay_cert_id: certId, ebay_dev_id: Deno.env.get("EBAY_DEV_ID") || "none", environment: "PRODUCTION", sync_status: "never" };
  const { error } = await supabase.from("ebay_accounts").insert(insertData).select();
  if (error) return new Response(`DB error: ${JSON.stringify(error)}`, { status: 500 });
  const appUrl = Deno.env.get("APP_URL") || "https://potomac-trading-co.lovable.app";
  return Response.redirect(`${appUrl}/settings?connected=true`, 302);
});

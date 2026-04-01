import { getAuthBase } from "../_shared/ebay-client.ts";
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  const accountLabel = url.searchParams.get("label") || "My eBay Account";
  if (!userId) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 });
  const appId = Deno.env.get("EBAY_APP_ID")!;
  const redirectUri = Deno.env.get("EBAY_REDIRECT_URI")!;
  const authBase = getAuthBase("PRODUCTION");
  const scopes = "https://api.ebay.com/oauth/api_scope";
  const state = btoa(JSON.stringify({ userId, accountLabel }));
  const authUrl = `${authBase}/oauth2/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
  return Response.redirect(authUrl, 302);
});

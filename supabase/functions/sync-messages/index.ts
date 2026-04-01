import { getSupabaseAdmin } from "../_shared/ebay-client.ts";
Deno.serve(async (req: Request) => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { account_id } = await req.json();
    const supabase = getSupabaseAdmin();
    const { data: account } = await supabase.from("ebay_accounts").select("*").eq("id", account_id).single();
    if (!account) return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: corsHeaders });
    const token = account.access_token;
    const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date().toISOString();
    const callEbay = async (callName: string, body: string) => { const r = await fetch("https://api.ebay.com/ws/api.dll", { method: "POST", headers: { "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "1271", "X-EBAY-API-CALL-NAME": callName, "X-EBAY-API-IAF-TOKEN": `Bearer ${token}`, "Content-Type": "text/xml" }, body }); return await r.text(); };
    let created = 0;
    let total = 0;
    const errors: string[] = [];
    for (const msgType of ["AskSellerQuestion", "ResponseToASQQuestion"]) {
      for (const status of ["Unanswered", "Answered"]) {
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const xml = `<?xml version="1.0" encoding="utf-8"?><GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials><MailMessageType>${msgType}</MailMessageType><MessageStatus>${status}</MessageStatus><StartCreationTime>${startTime}</StartCreationTime><EndCreationTime>${endTime}</EndCreationTime><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></GetMemberMessagesRequest>`;
          const text = await callEbay("GetMemberMessages", xml);
          const exchangeRegex = /<MemberMessageExchange>([\s\S]*?)<\/MemberMessageExchange>/g;
          let exMatch;
          let pageCount = 0;
          while ((exMatch = exchangeRegex.exec(text)) !== null) {
            pageCount++;
            total++;
            const exXml = exMatch[1];
            const get = (src: string, tag: string) => { const m = src.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`)); return m ? m[1] : null; };
            const itemXml = exXml.match(/<Item>([\s\S]*?)<\/Item>/);
            const questionXml = exXml.match(/<Question>([\s\S]*?)<\/Question>/);
            if (!questionXml) continue;
            const q = questionXml[1];
            const messageId = get(q, "MessageID");
            if (!messageId) continue;
            const { data: existing } = await supabase.from("messages").select("id").eq("ebay_message_id", messageId).eq("account_id", account.id).maybeSingle();
            if (existing) continue;
            const itemId = itemXml ? get(itemXml[1], "ItemID") : null;
            const itemTitle = itemXml ? get(itemXml[1], "Title") : null;
            const itemPrice = itemXml ? get(itemXml[1], "CurrentPrice") : null;
            const itemUrl = itemXml ? get(itemXml[1], "ViewItemURL") : null;
            const senderName = get(q, "SenderID") || "unknown";
            const subject = get(q, "Subject") || "No subject";
            const body = get(q, "Body") || "";
            const creationDate = get(exXml, "CreationDate") || new Date().toISOString();
            const msgStatus = get(exXml, "MessageStatus") || "Unanswered";
            const messageData = { account_id: account.id, user_id: account.user_id, ebay_message_id: messageId, ebay_item_id: itemId, buyer_username: senderName, sender: "buyer", subject: subject, body: body, thread_id: messageId, is_read: msgStatus === "Answered", is_replied: msgStatus === "Answered", requires_response: msgStatus === "Unanswered", received_at: creationDate, message_type: body.match(/^\d+\??$/) ? "offer" : "question", raw_ebay_data: { itemTitle, itemPrice, itemUrl, messageStatus: msgStatus, questionType: get(q, "QuestionType") } };
            const { error } = await supabase.from("messages").insert(messageData);
            if (error) { errors.push(`${messageId}: ${error.message}`); } else { created++; }
          }
          hasMore = pageCount >= 200;
          page++;
        }
      }
    }
    return new Response(JSON.stringify({ success: true, total_found: total, created, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });
  }
});

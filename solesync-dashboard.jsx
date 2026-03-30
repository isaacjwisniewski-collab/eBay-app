import { useState, useEffect, useMemo, useCallback } from "react";

// ============================================================================
// SoleSync — Multi-Account eBay Shoe Management Dashboard
// ============================================================================
// 
// ✅ SUPABASE CONNECTED: juelixwikfbizbpxtwpx.supabase.co
//
// REMAINING SETUP:
// 1. Run supabase-schema.sql in your Supabase SQL Editor
// 2. Deploy edge functions (see ebay-edge-functions.ts)
// 3. Replace mock data arrays below with Supabase queries
// 4. Add @supabase/supabase-js to your Lovable dependencies
// ============================================================================

const SUPABASE_URL = "https://juelixwikfbizbpxtwpx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SfPphoEtixcMvi3HqUI6mQ_0M9G4qm4";
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`;

// ─── Mock Data (replace with Supabase queries) ─────────────────────────────
const ACCOUNTS = [
  { id: "acct_1", account_label: "KicksVault_SF", color: "#E85D3A", sync_status: "synced", last_synced_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "acct_2", account_label: "SoleMaster_West", color: "#2563EB", sync_status: "synced", last_synced_at: new Date(Date.now() - 7200000).toISOString() },
  { id: "acct_3", account_label: "RetroSneaks415", color: "#7C3AED", sync_status: "error", sync_error: "Token expired", last_synced_at: new Date(Date.now() - 86400000).toISOString() },
];

const BRANDS = ["Nike", "Jordan", "New Balance", "Adidas", "Asics", "Puma", "Reebok", "Converse"];
const MODELS = {
  Nike: ["Air Max 90", "Dunk Low", "Air Force 1", "Vapormax", "Blazer Mid", "Air Max 1", "Cortez"],
  Jordan: ["Retro 1 High OG", "Retro 4", "Retro 11", "Retro 3", "Retro 6", "Retro 5", "Retro 12"],
  "New Balance": ["550", "990v5", "990v6", "2002R", "574", "327", "1906R"],
  Adidas: ["Samba OG", "Gazelle", "Forum Low", "Superstar", "Ultra Boost", "Campus 00s"],
  Asics: ["Gel-Kayano 14", "Gel-1130", "Gel-NYC", "GT-2160"],
  Puma: ["Suede Classic", "RS-X", "Palermo", "Speedcat"],
  Reebok: ["Club C 85", "Classic Leather", "Question Mid"],
  Converse: ["Chuck 70 Hi", "One Star", "Run Star Hike"],
};
const SIZES = [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14];
const CONDITIONS = ["New with Box", "New without Box", "Pre-owned - Excellent", "Pre-owned - Good"];
const STATUSES = ["active", "active", "active", "active", "ending_soon", "ending_soon", "sold", "unsold"];

const seed = (i) => ((i * 9301 + 49297) % 233280) / 233280;
const generateListings = () => {
  const listings = [];
  for (let i = 0; i < 60; i++) {
    const brand = BRANDS[Math.floor(seed(i) * BRANDS.length)];
    const model = MODELS[brand][Math.floor(seed(i + 100) * MODELS[brand].length)];
    const account = ACCOUNTS[Math.floor(seed(i + 200) * ACCOUNTS.length)];
    const status = STATUSES[Math.floor(seed(i + 300) * STATUSES.length)];
    const daysLeft = status === "ending_soon" ? Math.floor(seed(i + 400) * 3) + 1 : status === "active" ? Math.floor(seed(i + 500) * 25) + 3 : 0;
    const endDate = new Date(); endDate.setDate(endDate.getDate() + daysLeft);
    const price = Math.floor(seed(i + 600) * 400) + 35;
    const size = SIZES[Math.floor(seed(i + 700) * SIZES.length)];
    listings.push({
      id: `listing_${i + 1}`, sku: `SS-${String(i + 1).padStart(4, "0")}`,
      title: `${brand} ${model}`, brand, model, shoe_size: size,
      condition: CONDITIONS[Math.floor(seed(i + 800) * CONDITIONS.length)],
      current_price: price, listing_type: seed(i + 900) > 0.7 ? "Auction" : "FixedPrice",
      watch_count: Math.floor(seed(i + 1000) * 25), bid_count: Math.floor(seed(i + 1100) * 8),
      view_count: Math.floor(seed(i + 1200) * 300) + 10,
      account, status, ends_at: endDate.toISOString(), daysLeft,
      listed_at: new Date(Date.now() - seed(i + 1300) * 30 * 86400000).toISOString(),
      cost_basis: Math.floor(price * (0.3 + seed(i + 1400) * 0.4)),
    });
  }
  return listings;
};

const generateMessages = () => {
  const buyers = ["sneaker_fan99", "kickz_collector", "j0rdan_luv", "size12feet", "sole_searcher", "bay_buyer_22", "retro_head", "shoe_dog_sf", "nb_fanatic", "dunk_hunter", "boost_addict", "vintage_kicks", "hype_beast_23", "clean_kicks_only"];
  const subjects = ["Is this still available?", "Can you do $XX shipped?", "What's the lowest you'll take?", "Are these authentic?", "Can I see more photos?", "Do you have size 11?", "Combined shipping for 2 pairs?", "When did you purchase these?", "Any flaws not shown?", "Will you ship internationally?", "Is the box included?", "Can you hold for 2 days?"];
  return Array.from({ length: 18 }, (_, i) => {
    const account = ACCOUNTS[Math.floor(seed(i + 2000) * ACCOUNTS.length)];
    const hoursAgo = Math.floor(seed(i + 2100) * 96);
    return {
      id: `msg_${i + 1}`, buyer_username: buyers[Math.floor(seed(i + 2200) * buyers.length)],
      subject: subjects[Math.floor(seed(i + 2300) * subjects.length)],
      body: subjects[Math.floor(seed(i + 2400) * subjects.length)] + " I'm very interested in this pair and would like to work something out.",
      account, received_at: new Date(Date.now() - hoursAgo * 3600000).toISOString(), hoursAgo,
      is_read: seed(i + 2500) > 0.45, is_replied: seed(i + 2600) > 0.6,
      listing_title: `${BRANDS[Math.floor(seed(i + 2700) * BRANDS.length)]} ${Object.values(MODELS).flat()[Math.floor(seed(i + 2800) * Object.values(MODELS).flat().length)]}`,
      message_type: ["question", "offer", "general"][Math.floor(seed(i + 2900) * 3)],
    };
  }).sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
};

const LISTINGS = generateListings();
const MESSAGES = generateMessages();

// ─── Price Comp Generator ──────────────────────────────────────────────────
const generateComps = (listing) => {
  const comps = [];
  for (let i = 0; i < 8; i++) {
    const priceDelta = (seed(i + listing.id.charCodeAt(8)) - 0.5) * 120;
    comps.push({
      title: `${listing.brand} ${listing.model} ${["Size " + listing.shoe_size, "Mens", "DS", "OG All"][Math.floor(seed(i + 3000) * 4)]}`,
      price: Math.max(25, Math.round(listing.current_price + priceDelta)),
      condition: CONDITIONS[Math.floor(seed(i + 3100) * CONDITIONS.length)],
      sold_date: new Date(Date.now() - seed(i + 3200) * 30 * 86400000).toISOString(),
      size: listing.shoe_size + (seed(i + 3300) > 0.7 ? (seed(i + 3400) > 0.5 ? 0.5 : -0.5) : 0),
    });
  }
  const prices = comps.map(c => c.price).sort((a, b) => a - b);
  return {
    comps: comps.sort((a, b) => new Date(b.sold_date) - new Date(a.sold_date)),
    stats: {
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      median: prices[Math.floor(prices.length / 2)],
      min: prices[0], max: prices[prices.length - 1], count: prices.length,
    }
  };
};

// ─── Icon Components ────────────────────────────────────────────────────────
const I = ({ d, size = 18, color = "currentColor", strokeWidth = 1.7 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}><path d={d} /></svg>
);
const Icons = {
  box: (p) => <I {...p} d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />,
  chat: (p) => <I {...p} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  warn: (p) => <I {...p} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />,
  search: (p) => <I {...p} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />,
  clock: (p) => <I {...p} d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" />,
  eye: (p) => <I {...p} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z" />,
  dollar: (p) => <I {...p} d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 010 7H6" />,
  trend: (p) => <I {...p} d="M23 6l-9.5 9.5-5-5L1 18" />,
  refresh: (p) => <I {...p} d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />,
  check: (p) => <I {...p} d="M20 6L9 17l-5-5" />,
  x: (p) => <I {...p} d="M18 6L6 18M6 6l12 12" />,
  link: (p) => <I {...p} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />,
  settings: (p) => <I {...p} d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />,
  chevR: (p) => <I {...p} d="M9 18l6-6-6-6" />,
  shoe: (p) => <I {...p} d="M2 18h20v-2c0-1.1-.4-2-1.5-2.5L16 11.5V7c0-1.1-.9-2-2-2h-1c-.6 0-1 .4-1 1v3L5.5 12C3.5 13 2 14.5 2 16v2z" />,
  bar: (p) => <I {...p} d="M18 20V10M12 20V4M6 20v-6" />,
  mail: (p) => <I {...p} d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" />,
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const FONT = `'DM Sans', sans-serif`;
const MONO = `'JetBrains Mono', monospace`;

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=JetBrains+Mono:wght@400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:${FONT};background:#08090C;color:#D4D6DC}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#252830;border-radius:4px}
@keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes si{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes spin{to{transform:rotate(360deg)}}
input,select,button{font-family:${FONT};outline:none}
select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
`;

const C = {
  bg: "#08090C", card: "#111318", cardHover: "#181B22", border: "#1C1F27",
  borderLight: "#252830", text: "#D4D6DC", textMuted: "#7A7F8C", textFaint: "#4B5060",
  white: "#F0F1F4", accent: "#E85D3A", accentDim: "#E85D3A20",
  green: "#34D399", greenDim: "#34D39918", greenBorder: "#1A3D2D",
  orange: "#FB923C", orangeDim: "#FB923C15", orangeBorder: "#3B2510",
  red: "#EF4444", redDim: "#EF444415",
  blue: "#3B82F6", blueDim: "#3B82F618",
  purple: "#8B5CF6", purpleDim: "#8B5CF618",
};

// ─── Reusable Components ────────────────────────────────────────────────────
const Badge = ({ bg, color, border, children, pulse: doPulse }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${border}`, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
    {doPulse && <span style={{ animation: "pu 1.5s infinite", display: "flex" }}><Icons.clock size={11} /></span>}
    {children}
  </span>
);

const StatusBadge = ({ status, daysLeft }) => {
  const m = { active: [C.greenDim, C.green, C.greenBorder, "Active"], ending_soon: [C.orangeDim, C.orange, C.orangeBorder, `${daysLeft}d left`], sold: [C.purpleDim, C.purple, "#2D2550", "Sold"], unsold: ["#1A1A1E", C.textMuted, C.borderLight, "Unsold"] };
  const [bg, color, border, label] = m[status] || m.unsold;
  return <Badge bg={bg} color={color} border={border} pulse={status === "ending_soon"}>{label}</Badge>;
};

const AcctTag = ({ account }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: account.color + "14", color: account.color, border: `1px solid ${account.color}25`, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: account.color }} />
    {account.account_label}
  </span>
);

const Btn = ({ children, variant = "default", onClick, style: s = {}, ...rest }) => {
  const base = { padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT, transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 6, border: "none", ...s };
  const variants = {
    default: { ...base, background: C.card, color: C.text, border: `1px solid ${C.borderLight}` },
    primary: { ...base, background: C.accent, color: "#FFF" },
    ghost: { ...base, background: "transparent", color: C.textMuted, border: `1px solid transparent` },
    danger: { ...base, background: C.redDim, color: C.red, border: `1px solid ${C.red}30` },
  };
  return <button style={variants[variant]} onClick={onClick} {...rest}>{children}</button>;
};

const Input = ({ icon, ...props }) => (
  <div style={{ position: "relative", flex: "1 1 200px", maxWidth: props.maxWidth || 300 }}>
    {icon && <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.textFaint }}>{icon}</span>}
    <input {...props} style={{ width: "100%", padding: icon ? "9px 12px 9px 34px" : "9px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, fontFamily: FONT, ...props.style }} />
  </div>
);

const Select = (props) => (
  <select {...props} style={{ padding: "9px 28px 9px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, cursor: "pointer", fontFamily: FONT, ...props.style }} />
);

const Card = ({ children, style: s = {}, ...rest }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: 18, animation: "fi 0.35s ease-out", ...s }} {...rest}>{children}</div>
);

// ─── Main App ───────────────────────────────────────────────────────────────
export default function SoleSync() {
  const [tab, setTab] = useState("inventory");
  const [search, setSearch] = useState("");
  const [acctFilter, setAcctFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("endDate");
  const [priceModal, setPriceModal] = useState(null); // listing for price comparison
  const [priceData, setPriceData] = useState(null);

  // Filter + sort listings
  const filtered = useMemo(() => {
    let r = [...LISTINGS];
    if (acctFilter !== "all") r = r.filter(l => l.account.id === acctFilter);
    if (statusFilter !== "all") r = r.filter(l => l.status === statusFilter);
    if (search) { const q = search.toLowerCase(); r = r.filter(l => l.title.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q) || l.brand.toLowerCase().includes(q)); }
    r.sort((a, b) => {
      if (sortBy === "endDate") return new Date(a.ends_at) - new Date(b.ends_at);
      if (sortBy === "priceHigh") return b.current_price - a.current_price;
      if (sortBy === "priceLow") return a.current_price - b.current_price;
      if (sortBy === "watchers") return b.watch_count - a.watch_count;
      if (sortBy === "views") return b.view_count - a.view_count;
      return 0;
    });
    return r;
  }, [acctFilter, statusFilter, search, sortBy]);

  const endingSoon = LISTINGS.filter(l => l.status === "ending_soon").sort((a, b) => a.daysLeft - b.daysLeft);
  const unreadMsgs = MESSAGES.filter(m => !m.is_read);

  const stats = useMemo(() => {
    const active = LISTINGS.filter(l => ["active", "ending_soon"].includes(l.status));
    const sold = LISTINGS.filter(l => l.status === "sold");
    return {
      total: LISTINGS.length,
      active: active.length,
      ending: endingSoon.length,
      sold: sold.length,
      value: active.reduce((s, l) => s + l.current_price, 0),
      revenue: sold.reduce((s, l) => s + l.current_price, 0),
      avgPrice: Math.round(LISTINGS.reduce((s, l) => s + l.current_price, 0) / LISTINGS.length),
      profit: sold.reduce((s, l) => s + (l.current_price - (l.cost_basis || 0)), 0),
    };
  }, []);

  const fmt = (iso) => { const d = new Date(iso); const h = Math.floor((Date.now() - d) / 3600000); return h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`; };
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtMoney = (n) => "$" + n.toLocaleString();

  // Open price comparison
  const openPriceComp = useCallback((listing) => {
    setPriceModal(listing);
    // In production, call: fetch(`${EDGE_FUNCTION_URL}/price-compare`, { method: "POST", body: JSON.stringify({ listing_id: listing.id, query: listing.title, size: listing.shoe_size }) })
    setPriceData(generateComps(listing));
  }, []);

  // ─── Tab styles ───
  const tabBtn = (id, icon, label, badge) => (
    <button onClick={() => setTab(id)} style={{
      display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9,
      background: tab === id ? C.card : "transparent", color: tab === id ? C.white : C.textMuted,
      border: tab === id ? `1px solid ${C.borderLight}` : "1px solid transparent",
      cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: FONT, transition: "all 0.2s",
    }}>
      {icon} {label}
      {badge > 0 && <span style={{ background: id === "alerts" ? C.orange : C.accent, color: id === "alerts" ? "#000" : "#FFF", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 9 }}>{badge}</span>}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      <style>{css}</style>

      {/* ═══ HEADER ═══ */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bg, position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, #F59E0B)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF" }}>
            <Icons.shoe size={18} />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: C.white, letterSpacing: "-0.03em" }}>SoleSync</h1>
            <p style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>Multi-Account eBay Manager</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {ACCOUNTS.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, background: a.sync_status === "error" ? C.redDim : C.card, border: `1px solid ${a.sync_status === "error" ? C.red + "30" : C.border}`, cursor: "pointer" }} title={`${a.account_label} — Last sync: ${fmt(a.last_synced_at)}`}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: a.color, boxShadow: `0 0 6px ${a.color}50` }} />
              <span style={{ fontSize: 11, color: a.sync_status === "error" ? C.red : C.textMuted, fontWeight: 500 }}>{a.account_label.split("_")[0]}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ═══ STATS ═══ */}
      <div style={{ padding: "18px 24px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {[
          { label: "Active", value: stats.active, color: C.green, icon: <Icons.box size={14} /> },
          { label: "Ending Soon", value: stats.ending, color: C.orange, icon: <Icons.clock size={14} /> },
          { label: "Sold", value: stats.sold, color: C.purple, icon: <Icons.check size={14} /> },
          { label: "Unread Msgs", value: unreadMsgs.length, color: C.accent, icon: <Icons.mail size={14} /> },
          { label: "Inventory Value", value: fmtMoney(stats.value), color: C.blue, icon: <Icons.dollar size={14} /> },
          { label: "Revenue", value: fmtMoney(stats.revenue), color: C.green, icon: <Icons.trend size={14} /> },
          { label: "Profit", value: fmtMoney(stats.profit), color: stats.profit > 0 ? C.green : C.red, icon: <Icons.bar size={14} /> },
        ].map((s, i) => (
          <Card key={i} style={{ padding: "12px 14px", animationDelay: `${i * 0.04}s`, animationFillMode: "both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <span style={{ color: s.color, opacity: 0.7 }}>{s.icon}</span>
              <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: MONO }}>{s.value}</span>
          </Card>
        ))}
      </div>

      {/* ═══ TABS ═══ */}
      <div style={{ padding: "16px 24px 0", display: "flex", gap: 5, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {tabBtn("inventory", <Icons.box size={15} />, "Inventory", 0)}
        {tabBtn("messages", <Icons.chat size={15} />, "Messages", unreadMsgs.length)}
        {tabBtn("alerts", <Icons.warn size={15} />, "Expiring", endingSoon.length)}
        {tabBtn("pricing", <Icons.dollar size={15} />, "Price Check", 0)}
        {tabBtn("settings", <Icons.settings size={15} />, "Accounts", 0)}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ padding: "16px 24px 50px" }}>

        {/* ── INVENTORY ── */}
        {tab === "inventory" && (
          <div style={{ animation: "fi 0.25s ease-out" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Input icon={<Icons.search size={15} />} placeholder="Search name, SKU, brand..." value={search} onChange={e => setSearch(e.target.value)} />
              <Select value={acctFilter} onChange={e => setAcctFilter(e.target.value)}>
                <option value="all">All Accounts</option>
                {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.account_label}</option>)}
              </Select>
              <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="ending_soon">Ending Soon</option>
                <option value="sold">Sold</option>
                <option value="unsold">Unsold</option>
              </Select>
              <Select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="endDate">Ending Soonest</option>
                <option value="priceHigh">Price: High→Low</option>
                <option value="priceLow">Price: Low→High</option>
                <option value="watchers">Most Watchers</option>
                <option value="views">Most Views</option>
              </Select>
              <span style={{ fontSize: 12, color: C.textFaint, marginLeft: "auto" }}>{filtered.length} of {LISTINGS.length}</span>
            </div>

            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["SKU", "Title", "Size", "Condition", "Price", "Type", "👁 Watch", "Views", "Account", "Status", "Ends", ""].map(h => (
                        <th key={h} style={{ padding: "11px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l, i) => (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}08`, cursor: "pointer", animation: `fi 0.25s ease-out ${i * 0.015}s both`, transition: "background 0.12s" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.cardHover}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "9px 12px", fontFamily: MONO, fontSize: 10, color: C.textFaint }}>{l.sku}</td>
                        <td style={{ padding: "9px 12px", fontWeight: 600, color: C.white, whiteSpace: "nowrap" }}>{l.title}</td>
                        <td style={{ padding: "9px 12px", color: C.textMuted, fontFamily: MONO }}>{l.shoe_size}</td>
                        <td style={{ padding: "9px 12px", color: C.textMuted, fontSize: 11, whiteSpace: "nowrap" }}>{l.condition}</td>
                        <td style={{ padding: "9px 12px", fontWeight: 700, color: C.green, fontFamily: MONO }}>${l.current_price}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <Badge bg={l.listing_type === "Auction" ? C.blueDim : C.card} color={l.listing_type === "Auction" ? C.blue : C.textMuted} border={l.listing_type === "Auction" ? C.blue + "30" : C.borderLight}>
                            {l.listing_type === "Auction" ? "Auction" : "BIN"}
                          </Badge>
                        </td>
                        <td style={{ padding: "9px 12px", color: l.watch_count > 8 ? C.orange : C.textFaint, fontWeight: l.watch_count > 8 ? 600 : 400 }}>
                          {l.watch_count}
                        </td>
                        <td style={{ padding: "9px 12px", color: C.textFaint }}>{l.view_count}</td>
                        <td style={{ padding: "9px 12px" }}><AcctTag account={l.account} /></td>
                        <td style={{ padding: "9px 12px" }}><StatusBadge status={l.status} daysLeft={l.daysLeft} /></td>
                        <td style={{ padding: "9px 12px", color: C.textMuted, fontSize: 11, whiteSpace: "nowrap" }}>{l.status === "sold" ? "—" : fmtDate(l.ends_at)}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <Btn variant="ghost" onClick={(e) => { e.stopPropagation(); openPriceComp(l); }} style={{ padding: "5px 8px", fontSize: 11 }}>
                            <Icons.dollar size={13} /> Comps
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── MESSAGES ── */}
        {tab === "messages" && (
          <div style={{ animation: "fi 0.25s ease-out" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
              <Select value={acctFilter} onChange={e => setAcctFilter(e.target.value)}>
                <option value="all">All Accounts</option>
                {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.account_label}</option>)}
              </Select>
              <Btn variant="default" style={{ marginLeft: "auto" }}><Icons.refresh size={14} /> Sync Messages</Btn>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {MESSAGES.filter(m => acctFilter === "all" || m.account.id === acctFilter).map((m, i) => (
                <Card key={m.id} style={{
                  padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer",
                  borderLeft: m.is_read ? `3px solid transparent` : `3px solid ${m.account.color}`,
                  animationName: "si", animationDelay: `${i * 0.03}s`, animationFillMode: "both",
                  transition: "background 0.12s",
                }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = C.card}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: m.account.color + "18", display: "flex", alignItems: "center", justifyContent: "center", color: m.account.color, flexShrink: 0, fontSize: 13, fontWeight: 800 }}>
                    {m.buyer_username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontWeight: m.is_read ? 400 : 700, color: m.is_read ? C.textMuted : C.white, fontSize: 13 }}>{m.buyer_username}</span>
                      <AcctTag account={m.account} />
                      {m.message_type === "offer" && <Badge bg={C.greenDim} color={C.green} border={C.greenBorder}>Offer</Badge>}
                      {!m.is_read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />}
                      <span style={{ marginLeft: "auto", fontSize: 10, color: C.textFaint, whiteSpace: "nowrap" }}>{fmt(m.received_at)}</span>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: m.is_read ? 400 : 600, color: m.is_read ? C.textFaint : C.text, marginBottom: 2 }}>{m.subject}</p>
                    <p style={{ fontSize: 11, color: C.textFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Re: {m.listing_title}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                    {m.is_replied ? <Badge bg={C.greenDim} color={C.green} border={C.greenBorder}><Icons.check size={10} /> Replied</Badge> : <Badge bg={C.orangeDim} color={C.orange} border={C.orangeBorder}>Needs Reply</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── ALERTS ── */}
        {tab === "alerts" && (
          <div style={{ animation: "fi 0.25s ease-out" }}>
            {endingSoon.length > 0 && (
              <Card style={{ marginBottom: 16, background: `linear-gradient(135deg, #1A1008, #14100D)`, border: `1px solid ${C.orangeBorder}`, display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: C.orangeDim, display: "flex", alignItems: "center", justifyContent: "center", color: C.orange }}><Icons.warn size={20} /></div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.orange }}>{endingSoon.length} Listings Expiring Within 3 Days</h3>
                  <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Review each listing — relist, adjust price, or let expire.</p>
                </div>
              </Card>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {endingSoon.map((l, i) => (
                <Card key={l.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", animationName: "si", animationDelay: `${i * 0.04}s`, animationFillMode: "both", borderLeft: `3px solid ${l.daysLeft <= 1 ? C.red : C.orange}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <span style={{ fontWeight: 700, color: C.white, fontSize: 13 }}>{l.title}</span>
                      <span style={{ fontSize: 11, color: C.textFaint }}>Sz {l.shoe_size}</span>
                      <AcctTag account={l.account} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11 }}>
                      <span style={{ color: C.green, fontWeight: 600, fontFamily: MONO }}>${l.current_price}</span>
                      <span style={{ color: C.textFaint }}>{l.watch_count} watchers</span>
                      <span style={{ color: C.textFaint }}>{l.bid_count} bids</span>
                      <span style={{ color: C.textFaint }}>{l.view_count} views</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginRight: 8 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: l.daysLeft <= 1 ? C.red : C.orange, fontFamily: MONO }}>{l.daysLeft}d</div>
                    <div style={{ fontSize: 10, color: C.textFaint }}>remaining</div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <Btn variant="default" style={{ fontSize: 11, padding: "6px 12px" }}>Relist</Btn>
                    <Btn onClick={() => openPriceComp(l)} style={{ fontSize: 11, padding: "6px 12px", background: C.accentDim, color: C.accent, border: `1px solid ${C.accent}30` }}>Reprice</Btn>
                  </div>
                </Card>
              ))}
            </div>
            {LISTINGS.filter(l => l.status === "unsold").length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: C.textFaint, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Unsold — Needs Attention</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {LISTINGS.filter(l => l.status === "unsold").map((l, i) => (
                    <Card key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", opacity: 0.85, animationDelay: `${i * 0.03}s`, animationFillMode: "both" }}>
                      <span style={{ fontWeight: 600, color: C.textMuted, fontSize: 12, flex: 1 }}>{l.title} <span style={{ color: C.textFaint, fontWeight: 400 }}>Sz {l.shoe_size}</span></span>
                      <span style={{ color: C.textFaint, fontFamily: MONO, fontSize: 12 }}>${l.current_price}</span>
                      <AcctTag account={l.account} />
                      <Btn variant="default" style={{ fontSize: 11, padding: "5px 10px" }}>Relist</Btn>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PRICING TAB ── */}
        {tab === "pricing" && (
          <div style={{ animation: "fi 0.25s ease-out" }}>
            <Card style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 8 }}>Price Check Tool</h3>
              <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>Search eBay sold listings to find comparable pricing for any shoe. Click "Comps" on any listing in your inventory, or search manually below.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <Input placeholder="e.g., Nike Dunk Low Panda" style={{ flex: 1, maxWidth: "none" }} onKeyDown={e => { if (e.key === "Enter" && e.target.value) openPriceComp({ title: e.target.value, brand: e.target.value.split(" ")[0], model: e.target.value, shoe_size: 10, current_price: 150, id: "manual" }); }} />
                <Btn variant="primary"><Icons.search size={14} /> Search Comps</Btn>
              </div>
            </Card>
            {!priceData && (
              <div style={{ textAlign: "center", padding: 60, color: C.textFaint }}>
                <Icons.dollar size={40} color={C.textFaint} />
                <p style={{ marginTop: 12, fontSize: 14 }}>Search for a shoe above or click "Comps" on any inventory listing</p>
              </div>
            )}
            {priceData && priceModal && (
              <div style={{ animation: "fi 0.3s ease-out" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: C.white }}>{priceModal.title}</h3>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Size {priceModal.shoe_size} — Your price: <span style={{ color: C.green, fontWeight: 600, fontFamily: MONO }}>${priceModal.current_price}</span></p>
                  </div>
                  <Btn variant="ghost" onClick={() => { setPriceModal(null); setPriceData(null); }}><Icons.x size={16} /></Btn>
                </div>

                {/* Stats cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Avg Price", value: fmtMoney(priceData.stats.avg), color: C.blue, delta: priceModal.current_price - priceData.stats.avg },
                    { label: "Median", value: fmtMoney(priceData.stats.median), color: C.purple, delta: priceModal.current_price - priceData.stats.median },
                    { label: "Low", value: fmtMoney(priceData.stats.min), color: C.orange },
                    { label: "High", value: fmtMoney(priceData.stats.max), color: C.green },
                    { label: "Comps Found", value: priceData.stats.count, color: C.text },
                  ].map((s, i) => (
                    <Card key={i} style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</span>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: MONO, marginTop: 4 }}>{s.value}</div>
                      {s.delta !== undefined && (
                        <span style={{ fontSize: 10, color: s.delta > 0 ? C.green : s.delta < 0 ? C.red : C.textFaint, fontWeight: 600 }}>
                          {s.delta > 0 ? "+" : ""}{fmtMoney(Math.round(s.delta))} vs yours
                        </span>
                      )}
                    </Card>
                  ))}
                </div>

                {/* Price position bar */}
                <Card style={{ marginBottom: 16, padding: "14px 18px" }}>
                  <span style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your Price Position</span>
                  <div style={{ position: "relative", height: 32, marginTop: 10, background: C.bg, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, transform: "translateY(-50%)", background: `linear-gradient(90deg, ${C.green}, ${C.blue}, ${C.orange}, ${C.red})`, borderRadius: 2, opacity: 0.4 }} />
                    {priceData.comps.map((c, i) => {
                      const pos = ((c.price - priceData.stats.min) / (priceData.stats.max - priceData.stats.min)) * 100;
                      return <div key={i} style={{ position: "absolute", left: `${Math.min(98, Math.max(2, pos))}%`, top: "50%", transform: "translate(-50%, -50%)", width: 6, height: 6, borderRadius: "50%", background: C.textFaint, opacity: 0.5 }} />;
                    })}
                    {(() => {
                      const pos = ((priceModal.current_price - priceData.stats.min) / (priceData.stats.max - priceData.stats.min)) * 100;
                      return <div style={{ position: "absolute", left: `${Math.min(95, Math.max(5, pos))}%`, top: "50%", transform: "translate(-50%, -50%)", width: 14, height: 14, borderRadius: "50%", background: C.accent, border: `2px solid ${C.white}`, boxShadow: `0 0 10px ${C.accent}80`, zIndex: 2 }} />;
                    })()}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: C.textFaint }}>
                    <span>${priceData.stats.min}</span>
                    <span style={{ color: C.accent, fontWeight: 600 }}>You: ${priceModal.current_price}</span>
                    <span>${priceData.stats.max}</span>
                  </div>
                </Card>

                {/* Comp list */}
                <h4 style={{ fontSize: 12, fontWeight: 700, color: C.textFaint, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em" }}>Comparable Sales</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {priceData.comps.map((c, i) => {
                    const diff = c.price - priceModal.current_price;
                    return (
                      <Card key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", animationDelay: `${i * 0.03}s`, animationFillMode: "both" }}>
                        <span style={{ flex: 1, fontSize: 12, color: C.text, fontWeight: 500 }}>{c.title}</span>
                        <span style={{ fontSize: 11, color: C.textFaint }}>Sz {c.size}</span>
                        <span style={{ fontSize: 11, color: C.textFaint }}>{c.condition}</span>
                        <span style={{ fontSize: 11, color: C.textFaint }}>{fmtDate(c.sold_date)}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: MONO, minWidth: 50, textAlign: "right" }}>${c.price}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: diff > 0 ? C.red : diff < 0 ? C.green : C.textFaint, minWidth: 50, textAlign: "right" }}>
                          {diff > 0 ? "+" : ""}{diff === 0 ? "—" : `$${diff}`}
                        </span>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS / ACCOUNTS ── */}
        {tab === "settings" && (
          <div style={{ animation: "fi 0.25s ease-out", maxWidth: 700 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 16 }}>Connected eBay Accounts</h2>

            {ACCOUNTS.map((a, i) => (
              <Card key={a.id} style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", animationDelay: `${i * 0.05}s`, animationFillMode: "both" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: a.color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: a.color, boxShadow: `0 0 8px ${a.color}50` }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: C.white, fontSize: 14 }}>{a.account_label}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    Last synced: {fmt(a.last_synced_at)}
                    {a.sync_status === "error" && <span style={{ color: C.red, marginLeft: 8 }}>Error: {a.sync_error}</span>}
                  </div>
                </div>
                <Badge bg={a.sync_status === "synced" ? C.greenDim : a.sync_status === "error" ? C.redDim : C.card}
                  color={a.sync_status === "synced" ? C.green : a.sync_status === "error" ? C.red : C.textMuted}
                  border={a.sync_status === "synced" ? C.greenBorder : a.sync_status === "error" ? C.red + "30" : C.borderLight}>
                  {a.sync_status === "synced" ? "Connected" : a.sync_status === "error" ? "Error" : "Pending"}
                </Badge>
                <Btn variant="default" style={{ fontSize: 11, padding: "6px 12px" }}><Icons.refresh size={13} /> Sync</Btn>
              </Card>
            ))}

            <Btn variant="primary" style={{ marginTop: 12 }} onClick={() => {
              // In production: window.open(`${EDGE_FUNCTION_URL}/ebay-oauth-start?user_id=YOUR_USER_ID&label=NewAccount`)
              alert("This will open eBay's OAuth consent screen.\n\nIn production, set your EDGE_FUNCTION_URL and user_id.");
            }}>
              + Connect New eBay Account
            </Btn>

            <Card style={{ marginTop: 28, background: `linear-gradient(135deg, ${C.card}, #151820)`, border: `1px solid ${C.borderLight}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 8 }}>Setup Guide</h3>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8 }}>
                <p style={{ marginBottom: 10 }}>To connect your real eBay accounts:</p>
                {[
                  "Register at developer.ebay.com and create an application",
                  "Get your App ID, Cert ID, and Dev ID from the developer dashboard",
                  "Set your OAuth Redirect URI to your Supabase edge function URL",
                  "Add your credentials as Supabase secrets (see ebay-edge-functions.ts)",
                  "Run the SQL schema in your Supabase SQL Editor",
                  "Deploy the edge functions with: supabase functions deploy",
                  "Click 'Connect New eBay Account' above to start the OAuth flow",
                ].map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: C.accent + "20", color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ═══ PRICE COMPARISON MODAL (overlay) ═══ */}
      {priceModal && tab !== "pricing" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => { setPriceModal(null); setPriceData(null); }}>
          <div style={{ background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 16, padding: 24, maxWidth: 620, width: "100%", maxHeight: "80vh", overflowY: "auto", animation: "fi 0.3s ease-out" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.white }}>{priceModal.title}</h3>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Sz {priceModal.shoe_size} — Your price: <span style={{ color: C.green, fontWeight: 700, fontFamily: MONO }}>${priceModal.current_price}</span></p>
              </div>
              <Btn variant="ghost" onClick={() => { setPriceModal(null); setPriceData(null); }}><Icons.x size={18} /></Btn>
            </div>

            {priceData && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "Average", value: fmtMoney(priceData.stats.avg), color: C.blue },
                    { label: "Median", value: fmtMoney(priceData.stats.median), color: C.purple },
                    { label: "Range", value: `${fmtMoney(priceData.stats.min)} – ${fmtMoney(priceData.stats.max)}`, color: C.text },
                  ].map((s, i) => (
                    <div key={i} style={{ background: C.bg, borderRadius: 9, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: MONO, marginTop: 3 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Comparable Sales ({priceData.stats.count})</div>
                {priceData.comps.map((c, i) => {
                  const diff = c.price - priceModal.current_price;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < priceData.comps.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <span style={{ flex: 1, fontSize: 12, color: C.text }}>{c.title}</span>
                      <span style={{ fontSize: 10, color: C.textFaint }}>Sz {c.size}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: MONO }}>${c.price}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: diff > 0 ? C.red : C.green, minWidth: 44, textAlign: "right" }}>{diff > 0 ? "+" : ""}${diff}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

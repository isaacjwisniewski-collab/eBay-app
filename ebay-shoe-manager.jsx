import { useState, useEffect, useMemo } from "react";

// ─── Mock Data (replace with eBay API calls) ───────────────────────────────
const ACCOUNTS = [
  { id: "acct_1", name: "KicksVault_SF", color: "#E85D3A" },
  { id: "acct_2", name: "SoleMaster_West", color: "#3A7BE8" },
  { id: "acct_3", name: "RetroSneaks415", color: "#8B5CF6" },
];

const generateListings = () => {
  const brands = ["Nike", "Jordan", "New Balance", "Adidas", "Asics", "Puma", "Reebok", "Converse"];
  const models = {
    Nike: ["Air Max 90", "Dunk Low", "Air Force 1", "Vapormax", "Blazer Mid"],
    Jordan: ["Retro 1 High", "Retro 4", "Retro 11", "Retro 3", "Retro 6"],
    "New Balance": ["550", "990v5", "2002R", "574", "327"],
    Adidas: ["Samba OG", "Gazelle", "Forum Low", "Superstar", "Ultra Boost"],
    Asics: ["Gel-Kayano 14", "Gel-1130", "Gel-NYC", "GT-2160"],
    Puma: ["Suede Classic", "RS-X", "Palermo"],
    Reebok: ["Club C 85", "Classic Leather", "Question Mid"],
    Converse: ["Chuck 70 Hi", "One Star", "Run Star Hike"],
  };
  const sizes = [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13];
  const conditions = ["New with Box", "New without Box", "Pre-owned - Excellent", "Pre-owned - Good"];
  const statuses = ["active", "active", "active", "active", "ending_soon", "ending_soon", "sold", "unsold"];

  const listings = [];
  for (let i = 0; i < 48; i++) {
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const model = models[brand][Math.floor(Math.random() * models[brand].length)];
    const account = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const daysLeft = status === "ending_soon" ? Math.floor(Math.random() * 3) + 1 : status === "active" ? Math.floor(Math.random() * 25) + 3 : 0;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysLeft);
    const price = Math.floor(Math.random() * 350) + 45;

    listings.push({
      id: `listing_${i + 1}`,
      sku: `SKU-${String(i + 1).padStart(4, "0")}`,
      title: `${brand} ${model}`,
      brand,
      size: sizes[Math.floor(Math.random() * sizes.length)],
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      price,
      watchers: Math.floor(Math.random() * 20),
      bids: Math.floor(Math.random() * 8),
      views: Math.floor(Math.random() * 200) + 10,
      account,
      status,
      endDate: endDate.toISOString(),
      daysLeft,
      listedDate: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    });
  }
  return listings;
};

const generateMessages = () => {
  const buyers = ["sneaker_fan99", "kickz_collector", "j0rdan_luv", "size12feet", "sole_searcher", "bay_buyer_22", "retro_head", "shoe_dog_sf", "nb_fanatic", "dunk_hunter", "boost_addict", "vintage_kicks"];
  const subjects = [
    "Is this still available?",
    "Can you do $XX shipped?",
    "What's the lowest you'll take?",
    "Are these authentic?",
    "Can I see more photos?",
    "Do you have size 11?",
    "Combined shipping for 2 pairs?",
    "When did you purchase these?",
    "Any flaws not shown?",
    "Will you ship internationally?",
    "Can you hold these for me?",
    "Is the box included?",
  ];
  const messages = [];
  for (let i = 0; i < 15; i++) {
    const account = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    const hoursAgo = Math.floor(Math.random() * 72);
    messages.push({
      id: `msg_${i + 1}`,
      buyer: buyers[Math.floor(Math.random() * buyers.length)],
      subject: subjects[Math.floor(Math.random() * subjects.length)],
      preview: subjects[Math.floor(Math.random() * subjects.length)] + " I'm very interested in this pair.",
      account,
      timestamp: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
      hoursAgo,
      read: Math.random() > 0.4,
      listingTitle: `${["Nike", "Jordan", "New Balance", "Adidas"][Math.floor(Math.random() * 4)]} ${["Air Max 90", "Retro 1 High", "550", "Samba OG"][Math.floor(Math.random() * 4)]}`,
    });
  }
  return messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

const LISTINGS = generateListings();
const MESSAGES = generateMessages();

// ─── Icons ──────────────────────────────────────────────────────────────────
const Icon = ({ type, size = 18 }) => {
  const s = { width: size, height: size, display: "inline-block", verticalAlign: "middle" };
  const icons = {
    inventory: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>,
    messages: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    alert: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    search: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    clock: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    eye: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    tag: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    chevron: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    dot: <svg style={{...s, width: 8, height: 8}} viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>,
    shoe: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h20v-2c0-1.1-.4-2-1.5-2.5L16 11.5V7c0-1.1-.9-2-2-2h-1c-.6 0-1 .4-1 1v3L5.5 12C3.5 13 2 14.5 2 16v2z"/></svg>,
  };
  return icons[type] || null;
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const fonts = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');
`;

const globalStyles = `
  ${fonts}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; background: #0C0E12; color: #E2E4E9; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2A2D35; border-radius: 3px; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
`;

export default function EbayShoeManager() {
  const [activeTab, setActiveTab] = useState("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("endDate");

  const filteredListings = useMemo(() => {
    let result = [...LISTINGS];
    if (accountFilter !== "all") result = result.filter((l) => l.account.id === accountFilter);
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) => l.title.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (sortBy === "endDate") return new Date(a.endDate) - new Date(b.endDate);
      if (sortBy === "price") return b.price - a.price;
      if (sortBy === "watchers") return b.watchers - a.watchers;
      return 0;
    });
    return result;
  }, [accountFilter, statusFilter, searchQuery, sortBy]);

  const endingSoon = LISTINGS.filter((l) => l.status === "ending_soon");
  const unreadMessages = MESSAGES.filter((m) => !m.read);

  const stats = useMemo(() => ({
    total: LISTINGS.length,
    active: LISTINGS.filter((l) => l.status === "active" || l.status === "ending_soon").length,
    sold: LISTINGS.filter((l) => l.status === "sold").length,
    endingSoon: endingSoon.length,
    totalValue: LISTINGS.filter((l) => l.status !== "sold").reduce((s, l) => s + l.price, 0),
    avgPrice: Math.round(LISTINGS.reduce((s, l) => s + l.price, 0) / LISTINGS.length),
  }), []);

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 3600000);
    if (diff < 1) return "Just now";
    if (diff < 24) return `${diff}h ago`;
    return `${Math.floor(diff / 24)}d ago`;
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const StatusBadge = ({ status, daysLeft }) => {
    const colors = {
      active: { bg: "#132B1A", text: "#4ADE80", border: "#1A3D24" },
      ending_soon: { bg: "#3B1A0B", text: "#FB923C", border: "#4D2510" },
      sold: { bg: "#1A1A2E", text: "#818CF8", border: "#252547" },
      unsold: { bg: "#1F1F1F", text: "#9CA3AF", border: "#2A2A2A" },
    };
    const c = colors[status] || colors.unsold;
    const label = status === "ending_soon" ? `${daysLeft}d left` : status === "active" ? "Active" : status === "sold" ? "Sold" : "Unsold";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}`, letterSpacing: "0.02em" }}>
        {status === "ending_soon" && <span style={{ animation: "pulse 1.5s infinite" }}><Icon type="clock" size={12} /></span>}
        {label}
      </span>
    );
  };

  const AccountTag = ({ account }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: account.color + "18", color: account.color, border: `1px solid ${account.color}30` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: account.color }} />
      {account.name}
    </span>
  );

  const tabStyle = (tab) => ({
    display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10,
    background: activeTab === tab ? "#1C1F26" : "transparent",
    color: activeTab === tab ? "#FFF" : "#6B7280",
    border: activeTab === tab ? "1px solid #2A2D35" : "1px solid transparent",
    cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s",
    fontFamily: "'DM Sans', sans-serif",
  });

  const cardStyle = {
    background: "#14161B", border: "1px solid #1E2028", borderRadius: 14, padding: 20,
    animation: "fadeIn 0.4s ease-out",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0C0E12", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{globalStyles}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1E2028", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0C0E12", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #E85D3A, #FB923C)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon type="shoe" size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#FFF", letterSpacing: "-0.02em" }}>SoleSync</h1>
            <p style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>Multi-Account eBay Manager</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ACCOUNTS.map((a) => (
            <span key={a.id} style={{ width: 10, height: 10, borderRadius: "50%", background: a.color, border: "2px solid #0C0E12", boxShadow: `0 0 8px ${a.color}40` }} title={a.name} />
          ))}
          <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 4 }}>{ACCOUNTS.length} accounts</span>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ padding: "20px 28px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Listings", value: stats.total, color: "#E2E4E9" },
          { label: "Active", value: stats.active, color: "#4ADE80" },
          { label: "Ending Soon", value: stats.endingSoon, color: "#FB923C" },
          { label: "Sold", value: stats.sold, color: "#818CF8" },
          { label: "Inventory Value", value: `$${stats.totalValue.toLocaleString()}`, color: "#E85D3A" },
          { label: "Avg Price", value: `$${stats.avgPrice}`, color: "#3A7BE8" },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, padding: "14px 16px", animation: `fadeIn 0.4s ease-out ${i * 0.05}s both` }}>
            <p style={{ fontSize: 11, color: "#6B7280", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ padding: "20px 28px 0", display: "flex", gap: 6 }}>
        <button style={tabStyle("inventory")} onClick={() => setActiveTab("inventory")}>
          <Icon type="inventory" /> Inventory
        </button>
        <button style={tabStyle("messages")} onClick={() => setActiveTab("messages")}>
          <Icon type="messages" /> Messages
          {unreadMessages.length > 0 && (
            <span style={{ background: "#E85D3A", color: "#FFF", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 10, marginLeft: 2 }}>
              {unreadMessages.length}
            </span>
          )}
        </button>
        <button style={tabStyle("alerts")} onClick={() => setActiveTab("alerts")}>
          <Icon type="alert" /> Expiring
          {endingSoon.length > 0 && (
            <span style={{ background: "#FB923C", color: "#000", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 10, marginLeft: 2 }}>
              {endingSoon.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "16px 28px 40px" }}>

        {/* ── INVENTORY TAB ── */}
        {activeTab === "inventory" && (
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            {/* Filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6B7280" }}>
                  <Icon type="search" size={16} />
                </span>
                <input
                  type="text" placeholder="Search by name or SKU..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid #1E2028", background: "#14161B", color: "#E2E4E9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
                />
              </div>
              <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #1E2028", background: "#14161B", color: "#E2E4E9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                <option value="all">All Accounts</option>
                {ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #1E2028", background: "#14161B", color: "#E2E4E9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="ending_soon">Ending Soon</option>
                <option value="sold">Sold</option>
                <option value="unsold">Unsold</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #1E2028", background: "#14161B", color: "#E2E4E9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                <option value="endDate">Sort: Ending Soonest</option>
                <option value="price">Sort: Price High→Low</option>
                <option value="watchers">Sort: Most Watchers</option>
              </select>
              <span style={{ fontSize: 13, color: "#6B7280", marginLeft: "auto" }}>
                {filteredListings.length} listings
              </span>
            </div>

            {/* Listing Table */}
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1E2028" }}>
                      {["SKU", "Title", "Size", "Condition", "Price", "Watchers", "Views", "Account", "Status", "Ends"].map((h) => (
                        <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredListings.map((l, i) => (
                      <tr key={l.id}
                        style={{ borderBottom: "1px solid #1E202810", cursor: "pointer", animation: `fadeIn 0.3s ease-out ${i * 0.02}s both`, transition: "background 0.15s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#1C1F26"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6B7280" }}>{l.sku}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#FFF", whiteSpace: "nowrap" }}>{l.title}</td>
                        <td style={{ padding: "10px 14px", color: "#9CA3AF" }}>{l.size}</td>
                        <td style={{ padding: "10px 14px", color: "#9CA3AF", fontSize: 12, whiteSpace: "nowrap" }}>{l.condition}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#4ADE80", fontFamily: "'JetBrains Mono', monospace" }}>${l.price}</td>
                        <td style={{ padding: "10px 14px", color: l.watchers > 5 ? "#FB923C" : "#6B7280" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Icon type="eye" size={13} /> {l.watchers}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#6B7280" }}>{l.views}</td>
                        <td style={{ padding: "10px 14px" }}><AccountTag account={l.account} /></td>
                        <td style={{ padding: "10px 14px" }}><StatusBadge status={l.status} daysLeft={l.daysLeft} /></td>
                        <td style={{ padding: "10px 14px", color: "#9CA3AF", fontSize: 12, whiteSpace: "nowrap" }}>{l.status === "sold" ? "—" : formatDate(l.endDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── MESSAGES TAB ── */}
        {activeTab === "messages" && (
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #1E2028", background: "#14161B", color: "#E2E4E9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                <option value="all">All Accounts</option>
                {ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {MESSAGES.filter((m) => accountFilter === "all" || m.account.id === accountFilter).map((m, i) => (
                <div key={m.id}
                  style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer", borderLeft: m.read ? "3px solid transparent" : `3px solid ${m.account.color}`, animation: `slideIn 0.3s ease-out ${i * 0.04}s both`, transition: "background 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#1C1F26"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#14161B"}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: m.account.color + "20", display: "flex", alignItems: "center", justifyContent: "center", color: m.account.color, flexShrink: 0, fontSize: 14, fontWeight: 700 }}>
                    {m.buyer[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: m.read ? 400 : 700, color: m.read ? "#9CA3AF" : "#FFF", fontSize: 14 }}>{m.buyer}</span>
                      <AccountTag account={m.account} />
                      {!m.read && <span style={{ color: "#E85D3A" }}><Icon type="dot" /></span>}
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#6B7280", whiteSpace: "nowrap" }}>{formatTime(m.timestamp)}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: m.read ? 400 : 600, color: m.read ? "#6B7280" : "#E2E4E9", marginBottom: 3 }}>{m.subject}</p>
                    <p style={{ fontSize: 12, color: "#4B5563", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Re: {m.listingTitle}
                    </p>
                  </div>
                  <span style={{ color: "#2A2D35", alignSelf: "center" }}><Icon type="chevron" /></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {activeTab === "alerts" && (
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            <div style={{ ...cardStyle, marginBottom: 16, background: "linear-gradient(135deg, #3B1A0B, #1A1008)", border: "1px solid #4D2510", display: "flex", alignItems: "center", gap: 14, padding: "18px 22px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FB923C20", display: "flex", alignItems: "center", justifyContent: "center", color: "#FB923C" }}>
                <Icon type="alert" size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#FB923C" }}>{endingSoon.length} Listings Expiring Soon</h3>
                <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>These listings end within 3 days. Review and decide to relist, lower price, or let expire.</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {endingSoon.sort((a, b) => a.daysLeft - b.daysLeft).map((l, i) => (
                <div key={l.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", animation: `slideIn 0.3s ease-out ${i * 0.05}s both`, borderLeft: l.daysLeft <= 1 ? "3px solid #EF4444" : "3px solid #FB923C" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: "#FFF", fontSize: 14 }}>{l.title}</span>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>Size {l.size}</span>
                      <AccountTag account={l.account} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
                      <span style={{ color: "#4ADE80", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>${l.price}</span>
                      <span style={{ color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}><Icon type="eye" size={12} /> {l.watchers} watchers</span>
                      <span style={{ color: "#6B7280" }}>{l.bids} bids</span>
                      <span style={{ color: "#6B7280" }}>{l.views} views</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: l.daysLeft <= 1 ? "#EF4444" : "#FB923C", fontFamily: "'JetBrains Mono', monospace" }}>
                      {l.daysLeft}d
                    </p>
                    <p style={{ fontSize: 11, color: "#6B7280" }}>remaining</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #2A2D35", background: "#1C1F26", color: "#E2E4E9", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      Relist
                    </button>
                    <button style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #E85D3A40", background: "#E85D3A20", color: "#E85D3A", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      Lower Price
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Unsold items */}
            {LISTINGS.filter(l => l.status === "unsold").length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#6B7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Unsold — Needs Attention</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {LISTINGS.filter((l) => l.status === "unsold").map((l, i) => (
                    <div key={l.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", opacity: 0.8, animation: `fadeIn 0.3s ease-out ${i * 0.04}s both` }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, color: "#9CA3AF", fontSize: 13 }}>{l.title}</span>
                        <span style={{ marginLeft: 8, fontSize: 12, color: "#6B7280" }}>Size {l.size}</span>
                      </div>
                      <span style={{ color: "#6B7280", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>${l.price}</span>
                      <AccountTag account={l.account} />
                      <button style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #2A2D35", background: "#1C1F26", color: "#E2E4E9", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                        Relist
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* API Setup Banner */}
      <div style={{ margin: "0 28px 40px", ...cardStyle, background: "linear-gradient(135deg, #14161B, #1A1D25)", border: "1px solid #2A2D35", padding: "20px 24px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#FFF", marginBottom: 8 }}>Connect Your eBay Accounts</h3>
        <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, marginBottom: 12 }}>
          This dashboard is running with sample data. To connect your real eBay accounts, you'll need to set up eBay API credentials and a Supabase backend.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["1. Register at developer.ebay.com", "2. Create an app keyset", "3. Set up OAuth consent", "4. Connect Supabase backend"].map((step, i) => (
            <span key={i} style={{ padding: "6px 12px", borderRadius: 8, background: "#1C1F26", border: "1px solid #2A2D35", fontSize: 12, color: "#9CA3AF" }}>{step}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

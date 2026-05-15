import { FC, useEffect, useState } from "react";
import { Page } from "@/components/Page";
import { Link } from "@/components/Link/Link";
import {
  getResolvedMarkets,
  getDisputes,
  ResolvedMarket,
  type Dispute,
} from "@shared/api/client";
import { LoadingScreen } from "@shared/components/LoadingScreen";

const categoryLabel: Record<string, string> = {
  sports: "Sports",
  gaming: "Gaming",
  weather: "Weather",
  entertainment: "Entertainment",
  economy: "Economy",
  other: "Other",
};

function shareText(title: string, text: string) {
  if (navigator.share) {
    navigator.share({ title, text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).catch(() => {});
  }
}

function EvidencePanel({ m }: { m: ResolvedMarket }) {
  const [expanded, setExpanded] = useState(false);
  const [disputeSheet, setDisputeSheet] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const hasEvidence = !!m.evidence?.url || !!m.evidence?.note;
  const hasDispute = m.objectionCount > 0;

  function openDisputeSheet(e: React.MouseEvent) {
    e.preventDefault();
    setDisputeSheet(true);
    if (disputes.length === 0) {
      getDisputes(m.id)
        .then(setDisputes)
        .catch(() => {});
    }
  }

  if (!hasEvidence && !hasDispute) return null;

  return (
    <div
      style={{
        borderTop: "1px solid var(--glass-border)",
        paddingTop: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      onClick={(e) => e.preventDefault()}
    >
      {/* Dispute banner — tappable */}
      {hasDispute && (
        <button
          onClick={openDisputeSheet}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            borderRadius: 8,
            background: m.outcomeChanged
              ? "rgba(239,68,68,0.08)"
              : "rgba(245,158,11,0.08)",
            border: `1px solid ${m.outcomeChanged ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
          }}
        >
          {m.outcomeChanged ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <polyline points="9 11 12 14 22 4" />
            </svg>
          )}
          <span
            style={{
              flex: 1,
              fontSize: "0.72rem",
              fontWeight: 700,
              color: m.outcomeChanged ? "#ef4444" : "#d97706",
              lineHeight: 1.4,
            }}
          >
            {m.objectionCount} objection{m.objectionCount !== 1 ? "s" : ""} filed
            {m.outcomeChanged ? " — outcome was revised after review" : " — original outcome upheld"}
          </span>
          {/* chevron */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: m.outcomeChanged ? "#ef4444" : "#d97706", flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Evidence row */}
      {hasEvidence && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={(e) => { e.preventDefault(); setExpanded((v) => !v); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(217,119,6,0.08)",
              border: "1px solid rgba(217,119,6,0.3)",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              color: "#d97706",
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {/* document icon */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Evidence
            {/* chevron */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {expanded && (
            <div
              style={{
                background: "var(--bg-secondary)",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {m.evidence.note && (
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {m.evidence.note}
                </p>
              )}
              {m.evidence.url && (
                <a
                  href={m.evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", fontWeight: 700, color: "#2775d0", textDecoration: "none", wordBreak: "break-all" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View Source
                </a>
              )}
              {m.evidence.submittedAt && (
                <div style={{ fontSize: "0.68rem", color: "var(--text-subtle)" }}>
                  Submitted{" "}
                  {new Date(m.evidence.submittedAt).toLocaleDateString("en-BT", { timeZone: "Asia/Thimphu", year: "numeric", month: "short", day: "numeric" })}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  shareText(
                    m.title,
                    `Resolution evidence for "${m.title}"${m.evidence.url ? `\n${m.evidence.url}` : ""}`,
                  );
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--glass-border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 700 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dispute detail sheet */}
      {disputeSheet && (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDisputeSheet(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)", borderRadius: "16px 16px 0 0", width: "100%", maxHeight: "70vh", overflowY: "auto", padding: "20px 16px 32px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)" }}>
                {m.objectionCount} Objection{m.objectionCount !== 1 ? "s" : ""}
              </span>
              <button
                onClick={(e) => { e.preventDefault(); setDisputeSheet(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {m.outcomeChanged ? "The original outcome was revised following a dispute review." : "All objections were reviewed and the original outcome was upheld."}
            </p>
            {disputes.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-subtle)", textAlign: "center", padding: "20px 0" }}>Loading…</p>
            )}
            {disputes.map((d) => (
              <div key={d.id} style={{ borderTop: "1px solid var(--glass-border)", padding: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-subtle)", marginBottom: 4 }}>
                  <span>Bond: Nu {Number(d.bondAmount).toLocaleString()}</span>
                  <span>{new Date(d.createdAt).toLocaleDateString("en-BT", { month: "short", day: "numeric" })}</span>
                </div>
                {d.reason && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{d.reason}</p>
                )}
              </div>
            ))}
            <button
              onClick={(e) => {
                e.preventDefault();
                shareText(
                  m.title,
                  `"${m.title}" had ${m.objectionCount} objection${m.objectionCount !== 1 ? "s" : ""} on Oro${m.outcomeChanged ? " — outcome was revised after review" : " — original outcome upheld"}.`,
                );
              }}
              style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--bg-secondary)", border: "1px solid var(--glass-border)", borderRadius: 10, padding: "10px", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, fontWeight: 700 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const CATEGORIES = ["All", "Sports", "Gaming", "Weather", "Entertainment", "Economy", "Other"] as const;

export const ResolvedMarketsPage: FC = () => {
  const [markets, setMarkets] = useState<ResolvedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [disputeFilter, setDisputeFilter] = useState<"all" | "disputed" | "clean">("all");

  useEffect(() => {
    getResolvedMarkets()
      .then(setMarkets)
      .catch((e: any) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = markets.filter((m) => {
    if (query && !m.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (category !== "All" && (categoryLabel[m.category ?? ""] ?? m.category) !== category) return false;
    if (disputeFilter === "disputed" && m.objectionCount === 0) return false;
    if (disputeFilter === "clean" && m.objectionCount > 0) return false;
    return true;
  });

  if (loading) return <LoadingScreen message="Loading resolution record…" />;

  if (error) {
    return (
      <Page back={true}>
        <div
          style={{
            padding: "40px 16px",
            textAlign: "center",
            color: "var(--color-danger)",
          }}
        >
          <strong>Error</strong>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            {error}
          </p>
        </div>
      </Page>
    );
  }

  return (
    <Page back={true}>
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          padding: "0 0 100px",
        }}
      >
        <div className="mesh-bg" />
        <div
          style={{
            padding: "48px 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              color: "var(--text-subtle)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Resolution Record — {filtered.length} market
            {filtered.length !== 1 ? "s" : ""}
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search markets…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px 10px 34px",
                borderRadius: 10,
                border: "1px solid var(--glass-border)",
                background: "var(--bg-card)",
                color: "var(--text-main)",
                fontSize: "0.85rem",
                fontWeight: 500,
                outline: "none",
              }}
            />
          </div>

          {/* Category pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: `1px solid ${category === c ? "var(--color-primary)" : "var(--glass-border)"}`,
                  background: category === c ? "rgba(59,130,246,0.12)" : "var(--bg-card)",
                  color: category === c ? "var(--color-primary)" : "var(--text-muted)",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Dispute filter */}
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "disputed", "clean"] as const).map((f) => {
              const label = f === "all" ? "All" : f === "disputed" ? "⚠ Disputed" : "✓ Clean";
              const active = disputeFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setDisputeFilter(f)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: `1px solid ${active ? (f === "disputed" ? "rgba(245,158,11,0.5)" : f === "clean" ? "rgba(34,197,94,0.5)" : "var(--color-primary)") : "var(--glass-border)"}`,
                    background: active ? (f === "disputed" ? "rgba(245,158,11,0.1)" : f === "clean" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)") : "var(--bg-card)",
                    color: active ? (f === "disputed" ? "#f59e0b" : f === "clean" ? "#22c55e" : "var(--color-primary)") : "var(--text-muted)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && markets.length > 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 500 }}>
              No markets match your filters.
            </div>
          )}

          {filtered.length === 0 && markets.length === 0 && (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>📜</div>
              <div
                style={{
                  fontWeight: 900,
                  color: "var(--text-main)",
                  fontSize: "1.1rem",
                  marginBottom: 8,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.02em",
                }}
              >
                No resolved markets yet
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 500 }}>
                Settled markets will appear here once markets close and resolve.
              </div>
            </div>
          )}

          {filtered.map((m) => (
            <Link
              key={m.id}
              to={`/market/${m.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${m.objectionCount > 0 ? (m.outcomeChanged ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)") : "var(--glass-border)"}`,
                  borderRadius: "var(--radius-lg)",
                  padding: "18px",
                  boxShadow: "var(--shadow-premium)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Title + category */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 900,
                      color: "var(--text-main)",
                      fontSize: "0.95rem",
                      lineHeight: 1.3,
                      flex: 1,
                    }}
                  >
                    {m.title}
                  </span>
                  {m.category && (
                    <span
                      style={{
                        background: "var(--bg-secondary)",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        color: "var(--text-subtle)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {categoryLabel[m.category] ?? m.category}
                    </span>
                  )}
                </div>

                {/* Winner */}
                {m.winner && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span
                      style={{
                        fontWeight: 800,
                        color: "#31eb78ff",
                        fontSize: "0.85rem",
                      }}
                    >
                      {m.winner.label}
                    </span>
                  </div>
                )}

                {/* Resolution criteria */}
                {m.resolutionCriteria && (
                  <p
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-subtle)",
                      lineHeight: 1.5,
                      margin: 0,
                      fontStyle: "italic",
                    }}
                  >
                    "{m.resolutionCriteria}"
                  </p>
                )}

                {/* Stats row */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                    }}
                  >
                    Nu {Number(m.totalPool).toLocaleString()} pool
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                    }}
                  >
                    {m.participantCount} predictor{m.participantCount !== 1 ? "s" : ""}
                  </div>
                  {m.resolvedAt && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        fontWeight: 700,
                      }}
                    >
                      {new Date(m.resolvedAt).toLocaleDateString("en-BT", {
                        timeZone: "Asia/Thimphu",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>

                {/* Evidence + dispute panel */}
                <EvidencePanel m={m} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Page>
  );
};

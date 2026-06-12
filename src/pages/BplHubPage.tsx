import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMarkets, type Market } from "@shared/api/client";
import { Clock, CalendarDays } from "lucide-react";
import { TmaBetModal } from "@/components/TmaBetModal";
import { Page } from "@/components/Page";
import { LoadingScreen } from "@shared/components/LoadingScreen";
import { isWCMarket, calcProb } from "./WorldCupHubPage";

// ── Helpers (mirrored from PWA — keep in sync) ────────────────────────────────

const ACCENT = "#29abe2"; // BPL blue

// 2026 season clubs — used for market detection and as the banner fallback strip
export const BPL_CLUBS = [
  { name: "Paro FC", short: "Paro" },
  { name: "Thimphu City FC", short: "Thimphu City" },
  { name: "Transport United FC", short: "Transport Utd" },
  { name: "Drukpa FC", short: "Drukpa" },
  { name: "RTC FC", short: "RTC" },
  { name: "Tensung FC", short: "Tensung" },
  { name: "Thimphu FC", short: "Thimphu" },
  { name: "Tsirang FC", short: "Tsirang" },
  { name: "Ugyen Academy FC", short: "Ugyen Acad" },
  { name: "BFF Academy U20", short: "BFF Acad" },
];

const CLUB_KEYWORDS = [
  "drukpa", "paro fc", "transport utd", "transport united", "rtc fc",
  "tsirang", "tensung", "ugyen academy", "bff academy",
  "thimphu city", "thimphu fc",
];

export function isBplMarket(m: Market): boolean {
  if (isWCMarket(m)) return false;
  // covers bpl-match / bpl-winner / bpl-topscorer and legacy "Premier League (BPL)"
  if (m.subcategory?.toLowerCase().includes("bpl")) return true;
  if ((m.settlementSource ?? "").toLowerCase().includes("bhutanfootball"))
    return true;
  const title = m.title.toLowerCase();
  if (title.includes("bhutan premier league")) return true;
  return CLUB_KEYWORDS.some((k) => title.includes(k));
}

// Crest priority: per-outcome imageUrl (set in the admin form), then the
// market-level images (imageUrl = first outcome, imageUrlAlt = second)
export function getBplCrest(market: Market, outcomeIdx: number): string | null {
  const outcome = market.outcomes?.[outcomeIdx] as
    | { imageUrl?: string | null }
    | undefined;
  if (outcome?.imageUrl) return outcome.imageUrl;
  if (outcomeIdx === 0) return market.imageUrl;
  if (outcomeIdx === 1) return market.imageUrlAlt;
  return null;
}

export function shortClubName(label: string): string {
  const known = BPL_CLUBS.find(
    (c) => c.name.toLowerCase() === label.toLowerCase().trim(),
  );
  if (known) return known.short;
  return label
    .replace(/\bfc\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMatchTeams(title: string): { team1: string; team2: string } {
  const m = title.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*[–—\-:?]|\s*\(|\s+(?:who|which|will)\b|$)/i);
  if (m) return { team1: m[1].trim(), team2: m[2].trim() };
  return { team1: "Team A", team2: "Team B" };
}

function useClosesAt(closesAt: string | null | undefined): string {
  const [label, setLabel] = React.useState("");
  React.useEffect(() => {
    if (!closesAt) return;
    const tick = () => {
      const ms = new Date(closesAt).getTime() - Date.now();
      if (ms <= 0) { setLabel("Closed"); return; }
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const mn = Math.floor((ms % 3_600_000) / 60_000);
      if (d > 0) setLabel(`${d}d ${h}h`);
      else if (h > 0) setLabel(`${h}h ${mn}m`);
      else setLabel(`${mn}m`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [closesAt]);
  return label;
}

export function Crest({
  src,
  label,
  size,
}: {
  src: string | null;
  label: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.06)" }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: "linear-gradient(135deg, #29abe2 0%, #1e3a8a 100%)",
        border: "1.5px solid rgba(255,255,255,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 900,
        color: "#fff",
      }}
    >
      {label.trim().charAt(0).toUpperCase()}
    </div>
  );
}

function BplMatchCard({
  market,
  onBet,
}: {
  market: Market;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const resolving = market.status === "resolving";
  const totalPool = Number(market.totalPool ?? 0) ||
    (market.outcomes ?? []).reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);
  const { team1, team2 } = parseMatchTeams(market.title);
  return (
    <div style={{ background: "var(--bg-card, #1a1a1a)", border: "1px solid var(--glass-border, rgba(255,255,255,0.08))", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #fff)", lineHeight: 1.35, flex: 1, minWidth: 0, marginRight: 8 }}>
          {market.title}
        </div>
        {resolving ? (
          <div style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
            Resolving
          </div>
        ) : closes && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
            <Clock size={10} />
            <span>{closes}</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "18px 16px 12px", background: "linear-gradient(135deg, rgba(11,29,58,0.55) 0%, rgba(29,111,168,0.35) 100%)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Crest src={getBplCrest(market, 0)} label={team1} size={44} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main, #fff)", marginTop: 4 }}>{shortClubName(team1)}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text-muted, #888)", background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 10px" }}>VS</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Crest src={getBplCrest(market, 1)} label={team2} size={44} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main, #fff)", marginTop: 4 }}>{shortClubName(team2)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "10px 12px 0" }}>
        {market.outcomes?.map((outcome) => {
          const prob = calcProb(market, outcome.id);
          return (
            <button
              key={outcome.id}
              disabled={resolving}
              onClick={() => onBet(market.id, outcome.id)}
              style={{ flex: 1, padding: "9px 4px", background: "rgba(41,171,226,0.07)", border: "1px solid rgba(41,171,226,0.25)", borderRadius: 10, cursor: resolving ? "default" : "pointer", opacity: resolving ? 0.55 : 1, textAlign: "center" }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, color: ACCENT }}>{Math.round(prob * 100)}%</div>
              <div style={{ fontSize: 11, color: "var(--text-muted, #888)", fontWeight: 600, marginTop: 2 }}>{shortClubName(outcome.label)}</div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px 12px" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
          Nu {totalPool.toLocaleString()} pool
        </span>
        {market.settlementSource && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>
            · Resolves via bhutanfootball.org
          </span>
        )}
      </div>
    </div>
  );
}

function BplSeasonMarket({
  market,
  onBet,
}: {
  market: Market;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const resolving = market.status === "resolving";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {market.title}
        </div>
        {resolving ? (
          <div style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
            Resolving
          </div>
        ) : closes && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
            <Clock size={10} />
            <span>{closes}</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(market.outcomes ?? []).map((outcome, idx) => {
          const prob = calcProb(market, outcome.id);
          return (
            <div
              key={outcome.id}
              style={{
                background: "linear-gradient(135deg, rgba(41,171,226,0.04) 0%, var(--bg-card, #1a1a1a) 60%)",
                border: "1px solid rgba(41,171,226,0.14)",
                borderRadius: 14,
                padding: "11px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Crest src={getBplCrest(market, idx)} label={outcome.label} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main, #fff)", marginBottom: 2 }}>{outcome.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                  Nu {Number(outcome.totalBetAmount).toLocaleString()} pool
                </div>
              </div>
              <div style={{ background: "rgba(41,171,226,0.1)", border: "1px solid rgba(41,171,226,0.25)", borderRadius: 9, padding: "5px 9px", textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: ACCENT, lineHeight: 1 }}>{Math.round(prob * 100)}%</div>
                <div style={{ fontSize: 9, color: "rgba(41,171,226,0.6)", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>win</div>
              </div>
              {!resolving && (
                <button
                  onClick={() => onBet(market.id, outcome.id)}
                  style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 900, cursor: "pointer", flexShrink: 0 }}
                >
                  Predict
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type ActiveBet = { marketId: string; outcomeId: string };

export function BplHubPage() {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "tomorrow">("all");

  useEffect(() => {
    getMarkets()
      .then((d) =>
        setMarkets(
          d.filter(
            (m) =>
              m.status === "open" ||
              m.status === "upcoming" ||
              m.status === "resolving",
          ),
        ),
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const bplMarkets = markets.filter(isBplMarket);
  const matchMarkets = bplMarkets
    .filter((m) => /\bvs\b/i.test(m.title))
    .sort((a, b) => {
      const ta = a.bettingClosesAt ? new Date(a.bettingClosesAt).getTime() : a.closesAt ? new Date(a.closesAt).getTime() : Infinity;
      const tb = b.bettingClosesAt ? new Date(b.bettingClosesAt).getTime() : b.closesAt ? new Date(b.closesAt).getTime() : Infinity;
      return ta - tb;
    });
  const seasonMarkets = bplMarkets.filter((m) => !/\bvs\b/i.test(m.title));
  const totalPool = bplMarkets.reduce((s, m) => s + Number(m.totalPool ?? 0), 0);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const dayAfterTomorrow = new Date(tomorrowStart.getTime() + 86_400_000);

  const filteredMatchMarkets = matchMarkets.filter((m) => {
    if (timeFilter === "all") return true;
    const ref = m.bettingClosesAt
      ? new Date(m.bettingClosesAt)
      : m.closesAt
        ? new Date(m.closesAt)
        : m.opensAt
          ? new Date(m.opensAt)
          : null;
    if (!ref) return false;
    if (timeFilter === "today") return ref >= todayStart && ref < tomorrowStart;
    return ref >= tomorrowStart && ref < dayAfterTomorrow;
  });

  const activeMarket = activeBet ? markets.find((m) => m.id === activeBet.marketId) : null;

  if (loading) return <LoadingScreen message="Loading Premier League…" />;

  return (
    <Page>
      <div style={{ minHeight: "100vh", background: "var(--bg-main, #0f0f0f)" }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          style={{
            backgroundImage: "url('/bpl-banner.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            padding: "20px 24px 22px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Legibility overlay — dark on the left under the title, clear over the trophy */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, rgba(5,12,28,0.8) 0%, rgba(5,12,28,0.45) 55%, rgba(5,12,28,0.15) 100%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", maxWidth: 860, margin: "0 auto", textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#fff",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              ←
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                BoB Bhutan Premier League
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.1, fontFamily: "var(--font-display, sans-serif)" }}>
                Prediction Hub
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, position: "relative", maxWidth: 860, margin: "18px auto 0" }}>
            {[
              { label: "Match predictions", val: String(matchMarkets.length) },
              { label: "Season predictions", val: String(seasonMarkets.length) },
              { label: "Total pool", val: `Nu ${totalPool.toLocaleString()}` },
            ].map(({ label, val }) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  textAlign: "center",
                  background: "rgba(5,12,28,0.72)",
                  borderRadius: 10,
                  padding: "8px 4px",
                  border: "1px solid rgba(41,171,226,0.35)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{val}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div style={{ padding: "20px 16px 100px", maxWidth: 860, margin: "0 auto" }}>
          {seasonMarkets.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              {seasonMarkets.map((market) => (
                <BplSeasonMarket
                  key={market.id}
                  market={market}
                  onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
                />
              ))}
            </div>
          )}

          {matchMarkets.length === 0 && seasonMarkets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>⚽</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>No Premier League markets yet</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "rgba(255,255,255,0.35)" }}>Check back when the next fixtures are announced</div>
            </div>
          ) : (
            <>
              {/* Time filter chips */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {(["all", "today", "tomorrow"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTimeFilter(f)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: "none",
                      background: timeFilter === f ? ACCENT : "rgba(41,171,226,0.12)",
                      color: timeFilter === f ? "#000" : "rgba(255,255,255,0.7)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <CalendarDays size={12} />
                    {f === "all" ? "All" : f === "today" ? "Today" : "Tomorrow"}
                  </button>
                ))}
              </div>

              {filteredMatchMarkets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>⚽</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>No matches scheduled for this day</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {filteredMatchMarkets.map((market) => (
                    <BplMatchCard
                      key={market.id}
                      market={market}
                      onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Bet modal ────────────────────────────────────────────────── */}
        {activeMarket && activeBet && (
          <TmaBetModal
            isOpen={true}
            onClose={() => setActiveBet(null)}
            market={activeMarket}
            outcomeId={activeBet.outcomeId}
            onSuccess={() => setActiveBet(null)}
            onFailure={(e: string) => console.error(e)}
            onGoToWallet={() => navigate("/wallet")}
          />
        )}
      </div>
    </Page>
  );
}

import { useState, useEffect, memo, type FC } from "react";
import type { Market, Outcome } from "@shared/api/client";
import { getCategoryVisual } from "@shared/helpers/visuals";

// ── Grouped multi-binary market card (Polymarket-style) ─────────────────────
// One card per groupId: the umbrella question as the title, one row per
// candidate (each candidate is its own Yes/No child market on the backend),
// with the candidate's image, chance % and Yes/No quick-bet buttons.

const YES_COLOR = "#22c55e";
const NO_COLOR = "#ef4444";

function useCountdown(targetAt: string | null): string {
  const [label, setLabel] = useState("Open");
  useEffect(() => {
    if (!targetAt) return;
    const tick = () => {
      const ms = new Date(targetAt).getTime() - Date.now();
      if (ms <= 0) {
        setLabel("Expired");
        return;
      }
      const h = Math.floor(ms / 3_600_000),
        m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(
        h > 24
          ? `${Math.floor(h / 24)}d left`
          : h > 0
            ? `${h}h ${m}m left`
            : `${m}m left`,
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [targetAt]);
  return label;
}

/** Candidate display name: metadata.candidate, else the title suffix after "—". */
export function candidateName(m: Market): string {
  const meta = m.metadata?.candidate;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  const parts = m.title.split("—");
  return parts.length > 1 ? parts[parts.length - 1].trim() : m.title;
}

function findOutcome(m: Market, label: "yes" | "no"): Outcome | undefined {
  return m.outcomes?.find((o) => o.label?.trim().toLowerCase() === label);
}

/** Chance % of an outcome (LMSR prob, else Laplace-smoothed pool share). */
function chanceOf(m: Market, o: Outcome | undefined): number {
  if (!o) return 50;
  const lmsr = (m.outcomes ?? []).map((x) => Number(x.lmsrProbability) || 0);
  if (lmsr.length && lmsr.every((p) => p > 0)) {
    const sum = lmsr.reduce((a, b) => a + b, 0);
    return ((Number(o.lmsrProbability) || 0) / sum) * 100;
  }
  const prior = 1000;
  const n = m.outcomes.length || 1;
  const totalPool = Number(m.totalPool);
  const smoothedAmount = Number(o.totalBetAmount) + prior / n;
  return (smoothedAmount / (totalPool + prior)) * 100;
}


function outcomeOdds(m: Market, o: Outcome): number | null {
  const totalPool = Number(m.totalPool);
  const outcomePool = Number(o.totalBetAmount) || 0;
  const edge = Number(m.houseEdgePct) || 0;
  if (totalPool <= 0 || outcomePool <= 0) return null;
  return Math.min(99, (totalPool * (1 - edge / 100)) / outcomePool);
}

interface GroupedMarketCardProps {
  /** All sibling markets sharing one groupId (each a Yes/No candidate market). */
  markets: Market[];
  onBet: (marketId: string, outcomeId: string) => void;
}

export const GroupedMarketCard: FC<GroupedMarketCardProps> = memo(
  ({ markets, onBet }) => {
    const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
    const first = markets[0];
    const title = (first.groupTitle || first.title).trim();
    const vis = getCategoryVisual(first.category);
    const groupPool = markets.reduce((s, m) => s + Number(m.totalPool), 0);
    // Countdown to the earliest close among the children
    const earliestClose = markets.reduce<string | null>(
      (acc, m) =>
        m.closesAt && (!acc || new Date(m.closesAt) < new Date(acc))
          ? m.closesAt
          : acc,
      null,
    );
    const countdown = useCountdown(earliestClose);

    const rows = markets
      .map((m) => {
        const yes = findOutcome(m, "yes") ?? m.outcomes?.[0];
        const no = findOutcome(m, "no") ?? m.outcomes?.[1];
        return {
          market: m,
          name: candidateName(m),
          pct: chanceOf(m, yes),
          yes,
          no,
        };
      })
      .sort((a, b) => b.pct - a.pct);

    const betButton = (
      m: Market,
      o: Outcome | undefined,
      label: string,
      color: string,
    ) => {
      const disabled = !o || o.isEliminated || m.status !== "open";
      const odds = o ? outcomeOdds(m, o) : null;
      return (
        <button
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (o) onBet(m.id, o.id);
          }}
          style={{
            position: "relative",
            flexShrink: 0,
            width: 52,
            padding: "5px 0",
            borderRadius: "var(--radius-md)",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            background: `${color}1c`,
            boxShadow: `inset 0 0 0 1px ${color}45`,
            color,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            lineHeight: 1.15,
            opacity: disabled ? 0.4 : 1,
            transition: "background 0.15s ease, transform 0.12s ease",
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.95)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 900,
              maxWidth: 48,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              padding: "0 2px",
            }}
          >
            {o?.label ?? label}
          </span>
          {o && (
            <span style={{ fontSize: "0.55rem", fontWeight: 700, opacity: 0.8 }}>
              {odds ? `${odds.toFixed(2)}x` : "—"}
            </span>
          )}
        </button>
      );
    };

    return (
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          boxSizing: "border-box",
          position: "relative",
          boxShadow:
            "6px 6px 16px rgba(0,0,0,0.3), -3px -3px 10px rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flex: 1,
          }}
        >
          {/* Header: category badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            {first.category && (
              <span
                style={{
                  fontSize: "0.58rem",
                  fontWeight: 800,
                  color: vis.accentColor,
                  background: `${vis.accentColor}18`,
                  border: `1px solid ${vis.accentColor}40`,
                  padding: "1px 7px",
                  borderRadius: 99,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {first.category}
              </span>
            )}
            <span
              style={{
                fontSize: "0.58rem",
                fontWeight: 800,
                color: "var(--text-subtle)",
                border: "1px solid var(--border)",
                padding: "1px 7px",
                borderRadius: 99,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {rows.length} candidates
            </span>
          </div>

          {/* Umbrella title */}
          <h3
            style={{
              fontSize: "0.95rem",
              fontWeight: 800,
              lineHeight: 1.35,
              color: "var(--text-main)",
              margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h3>

          {/* Candidate rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map(({ market: m, name, pct, yes, no }) => {
              const avatarUrl = !imgErrors[m.id] ? m.imageUrl : null;
              const barWidth = Math.max(4, Math.min(100, pct));
              return (
                <div
                  key={m.id}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 8px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255,255,255,0.02)",
                    boxShadow: "inset 0 0 0 1px var(--border)",
                    overflow: "hidden",
                  }}
                >
                  {/* Chance fill bar */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${barWidth}%`,
                      background: `linear-gradient(90deg, ${vis.accentColor}30 0%, ${vis.accentColor}14 60%, transparent 100%)`,
                      transition: "width 1s ease",
                      pointerEvents: "none",
                    }}
                  />
                  {/* Candidate avatar */}
                  {avatarUrl ? (
                    <div
                      style={{
                        position: "relative",
                        flexShrink: 0,
                        width: 30,
                        height: 30,
                        borderRadius: 7,
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <img
                        src={avatarUrl}
                        alt={name}
                        onError={() =>
                          setImgErrors((prev) => ({ ...prev, [m.id]: true }))
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "center top",
                          display: "block",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        position: "relative",
                        flexShrink: 0,
                        width: 30,
                        height: 30,
                        borderRadius: "var(--radius-full)",
                        background: vis.gradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1.5px solid rgba(255,255,255,0.15)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#fff",
                          textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Name + chance */}
                  <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        lineHeight: 1.25,
                        color: "var(--text-main)",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        wordBreak: "break-word",
                      }}
                    >
                      {name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 800,
                        color: "var(--text-subtle)",
                      }}
                    >
                      <span style={{ color: vis.accentColor, fontWeight: 900 }}>
                        {pct.toFixed(0)}%
                      </span>{" "}
                      chance
                    </span>
                  </div>

                  {betButton(m, yes, "Yes", YES_COLOR)}
                  {betButton(m, no, "No", NO_COLOR)}
                </div>
              );
            })}
          </div>

          {/* Settlement source */}
          {first.settlementSource && (
            <div
              style={{
                fontSize: "0.68rem",
                color: "var(--text-subtle)",
                fontWeight: 600,
              }}
            >
              Resolves via{" "}
              {(() => {
                try {
                  const url = new URL(first.settlementSource!);
                  return (
                    <a
                      href={first.settlementSource!}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "inherit",
                        textDecoration: "underline",
                        wordBreak: "break-all",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {url.hostname.replace(/^www\./, "")}
                    </a>
                  );
                } catch {
                  return first.settlementSource;
                }
              })()}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.68rem",
              color: "var(--text-subtle)",
              fontWeight: 700,
              paddingTop: 8,
              borderTop: "1px solid var(--border)",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                color: "var(--color-success)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {groupPool > 0 ? (
                <>
                  <span style={{ fontSize: "0.78rem", fontWeight: 900 }}>
                    Nu {groupPool.toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: "0.58rem",
                      opacity: 0.7,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Pool
                  </span>
                </>
              ) : (
                <span style={{ fontSize: "0.78rem", opacity: 0.7 }}>
                  No predictions yet
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {countdown}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const url = `${window.location.origin}/market/${first.id}`;
                  const text = `Check out this prediction market: ${title}`;
                  if (navigator.share) {
                    navigator.share({ title, text, url }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(url);
                    alert("Link copied to clipboard!");
                  }
                }}
                style={{
                  background: "var(--bg-secondary)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 9px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  color: "var(--text-muted)",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-main)";
                  e.currentTarget.style.color = "var(--text-main)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-secondary)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

GroupedMarketCard.displayName = "GroupedMarketCard";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Market } from "@shared/api/client";
import {
  WC_KNOCKOUT,
  findMarketForSlot,
  type BracketSlot,
} from "@shared/data/wcKnockout";

const ACCENT = "#A78BFA";

// Card geometry — a fixed block height per Round-of-32 slot lets every column
// share one height so fewer-match rounds space out and visually "bracket".
const CARD_MIN_H = 76;
const BLOCK_H = 128; // Round-of-32 cell height = card (~110px) + vertical gap
const COL_W = 188;
const GAP = 44; // horizontal space between rounds (room for connector elbows)
const STRIP_W = 44; // width of a collapsed round (thin strip)
const HEADER_H = 16; // round-label line height (kept fixed so card rows align)
const HEADER_MB = 10; // gap below the round label

interface Props {
  /** wc-match markets (already filtered) used to populate slots by kickoff time */
  markets: Market[];
  onBet: (marketId: string, outcomeId: string) => void;
  getFlag: (country: string) => string;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TeamRow({
  name,
  flag,
  onClick,
}: {
  name: string;
  flag: string;
  onClick?: () => void;
}) {
  const tappable = !!onClick;
  return (
    <button
      type="button"
      disabled={!tappable}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        width: "100%",
        padding: "3px 4px",
        background: tappable ? "rgba(167,139,250,0.07)" : "transparent",
        border: tappable
          ? "1px solid rgba(167,139,250,0.22)"
          : "1px solid transparent",
        borderRadius: 7,
        cursor: tappable ? "pointer" : "default",
        textAlign: "left",
      }}
    >
      {flag ? (
        <img
          src={flag}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ width: 18, height: 18, borderRadius: 3, objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <span style={{ fontSize: 13, flexShrink: 0, opacity: 0.5 }}>🛡️</span>
      )}
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: name === "TBD" ? "var(--text-muted, #888)" : "var(--text-main, #fff)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </span>
    </button>
  );
}

export function WorldCupBracket({ markets, onBet, getFlag }: Props) {

  // Measure each card's position so we can draw real bracket connector lines
  // between a card and the next-round card it feeds into (cards 2i & 2i+1 → i).
  const innerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [paths, setPaths] = useState<string[]>([]);

  // How many leading rounds are folded into thin strips. ‹ expands, › collapses.
  const [collapsedCount, setCollapsedCount] = useState(0);
  const maxCollapsed = WC_KNOCKOUT.length - 1; // always keep ≥1 round expanded

  // Spacing is relative to the FIRST expanded round, so collapsing earlier
  // rounds compresses the bracket vertically (the remaining cards pack up into
  // view instead of staying spread across the full Round-of-32 height).
  const bodyHeight = WC_KNOCKOUT[collapsedCount].slots.length * BLOCK_H;

  useLayoutEffect(() => {
    const compute = () => {
      const inner = innerRef.current;
      if (!inner) return;
      const base = inner.getBoundingClientRect();
      const next: string[] = [];
      for (let ri = 0; ri < WC_KNOCKOUT.length - 1; ri++) {
        const round = WC_KNOCKOUT[ri];
        const nextRound = WC_KNOCKOUT[ri + 1];
        round.slots.forEach((slot, i) => {
          const fromEl = cardRefs.current.get(slot.id);
          const toSlot = nextRound.slots[Math.floor(i / 2)];
          const toEl = toSlot && cardRefs.current.get(toSlot.id);
          if (!fromEl || !toEl) return;
          const f = fromEl.getBoundingClientRect();
          const t = toEl.getBoundingClientRect();
          const x1 = f.right - base.left;
          const y1 = f.top - base.top + f.height / 2;
          const x2 = t.left - base.left;
          const y2 = t.top - base.top + t.height / 2;
          const mx = (x1 + x2) / 2;
          // horizontal out → vertical → horizontal into the next card (elbow)
          next.push(`M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`);
        });
      }
      setPaths(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [markets, collapsedCount]);

  const renderSlot = (slot: BracketSlot) => {
    const market = findMarketForSlot(slot, markets);
    const locked =
      !!market && (market.status === "closed" || market.status === "resolving");

    let team1 = "TBD";
    let team2 = "TBD";
    let out1: string | undefined;
    let out2: string | undefined;
    if (market) {
      // The two outcomes ARE the teams — admin names them when creating the
      // match (e.g. "Germany", "France"). Tapping a row bets on that outcome.
      const o = market.outcomes ?? [];
      if (o[0]) {
        team1 = o[0].label;
        out1 = o[0].id;
      }
      if (o[1]) {
        team2 = o[1].label;
        out2 = o[1].id;
      }
    }

    const dateIso = market?.bettingClosesAt ?? market?.closesAt ?? slot.kickoff;
    const canBet = !!market && !locked;
    const pool = Number(market?.totalPool) || 0;

    return (
      <div
        key={slot.id}
        ref={(el) => {
          if (el) cardRefs.current.set(slot.id, el);
          else cardRefs.current.delete(slot.id);
        }}
        style={{
          minHeight: CARD_MIN_H,
          width: COL_W,
          background: "var(--bg-card, #1a1a1a)",
          border: `1px solid ${market ? "rgba(167,139,250,0.3)" : "var(--glass-border, rgba(255,255,255,0.08))"}`,
          borderRadius: 12,
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted, #888)",
            marginBottom: 1,
          }}
        >
          {fmtDate(dateIso)}
          {locked && (
            <span style={{ color: "#fbbf24", marginLeft: 6 }}>• Locked</span>
          )}
        </div>
        <TeamRow
          name={team1}
          flag={team1 === "TBD" ? "" : getFlag(team1)}
          onClick={canBet && out1 ? () => onBet(market!.id, out1!) : undefined}
        />
        <TeamRow
          name={team2}
          flag={team2 === "TBD" ? "" : getFlag(team2)}
          onClick={canBet && out2 ? () => onBet(market!.id, out2!) : undefined}
        />
        {market && (
          <div
            style={{
              marginTop: 2,
              paddingTop: 5,
              borderTop: "1px solid var(--glass-border, rgba(255,255,255,0.07))",
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(255,255,255,0.4)",
              textAlign: "right",
            }}
          >
            Nu {pool.toLocaleString()} pool
          </div>
        )}
      </div>
    );
  };

  const chevronStyle: CSSProperties = {
    flexShrink: 0,
    marginTop: 2,
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "1px solid var(--glass-border, rgba(255,255,255,0.15))",
    background: "var(--bg-card, #1a1a1a)",
    color: ACCENT,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
      {/* Snap one round per scroll. scroll-snap-stop:always means even a fast
          flick / momentum scroll settles on the very next round — never skips. */}
      <style>{`
        .wc-bracket-scroll { scroll-snap-type: x mandatory; scroll-padding-left: 0; }
        .wc-bracket-round { scroll-snap-align: start; scroll-snap-stop: always; }
      `}</style>
      <button
        type="button"
        aria-label="Expand an earlier round"
        disabled={collapsedCount === 0}
        onClick={() => setCollapsedCount((c) => Math.max(0, c - 1))}
        style={{
          ...chevronStyle,
          opacity: collapsedCount === 0 ? 0.35 : 1,
          cursor: collapsedCount === 0 ? "default" : "pointer",
        }}
      >
        ‹
      </button>
      <div
        ref={scrollRef}
        className="wc-bracket-scroll"
        style={{ flex: 1, overflowX: "auto", paddingBottom: 12, WebkitOverflowScrolling: "touch", display: "flex", justifyContent: "safe center" }}
      >
        <div ref={innerRef} style={{ display: "flex", gap: GAP, minWidth: "min-content", position: "relative" }}>
        {/* Connector lines (drawn behind the cards) */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
            zIndex: 0,
          }}
        >
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="rgba(167,139,250,0.35)"
              strokeWidth={1.5}
            />
          ))}
        </svg>
        {WC_KNOCKOUT.map((round, ri) => {
          // Leading rounds fold into a thin clickable strip. Tap a strip to
          // expand back to that round.
          if (ri < collapsedCount) {
            return (
              <div
                key={round.key}
                className="wc-bracket-round"
                onClick={() => setCollapsedCount(ri)}
                title={`Expand ${round.label}`}
                style={{ flexShrink: 0, width: STRIP_W, cursor: "pointer" }}
              >
                <div style={{ height: HEADER_H, marginBottom: HEADER_MB }} />
                <div
                  style={{
                    height: bodyHeight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg-card, #1a1a1a)",
                    border: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
                    borderRadius: 12,
                  }}
                >
                  <span
                    style={{
                      writingMode: "vertical-rl",
                      fontSize: 11,
                      fontWeight: 800,
                      color: ACCENT,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {round.label}
                  </span>
                </div>
              </div>
            );
          }
          // Cell height doubles each round RELATIVE to the first expanded round,
          // so the leftmost visible round packs its cards tightly (BLOCK_H) and
          // every expanded column shares the same total height (= bodyHeight).
          const cellHeight = BLOCK_H * Math.pow(2, ri - collapsedCount);
          return (
            <div key={round.key} className="wc-bracket-round" style={{ flexShrink: 0 }}>
              {/* Round header */}
              <div
                style={{
                  height: HEADER_H,
                  fontSize: 12,
                  fontWeight: 800,
                  color: ACCENT,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  textAlign: "center",
                  marginBottom: HEADER_MB,
                  width: COL_W,
                }}
              >
                {round.label}
              </div>
              {/* Slots */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {round.slots.map((slot) => (
                  <div
                    key={slot.id}
                    style={{
                      height: cellHeight,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {renderSlot(slot)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        </div>
      </div>
      <button
        type="button"
        aria-label="Collapse the earliest round"
        disabled={collapsedCount >= maxCollapsed}
        onClick={() => setCollapsedCount((c) => Math.min(maxCollapsed, c + 1))}
        style={{
          ...chevronStyle,
          opacity: collapsedCount >= maxCollapsed ? 0.35 : 1,
          cursor: collapsedCount >= maxCollapsed ? "default" : "pointer",
        }}
      >
        ›
      </button>
    </div>
  );
}

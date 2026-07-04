import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Check } from "lucide-react";
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
const MOBILE_COL_W = "min(80vw, 300px)";
const GAP = 44; // horizontal space between rounds (room for connector elbows)
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
  won = false,
}: {
  name: string;
  flag: string;
  onClick?: () => void;
  won?: boolean;
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
        background: won
          ? "rgba(34,197,94,0.12)"
          : tappable
            ? "rgba(167,139,250,0.07)"
            : "transparent",
        border: won
          ? "1px solid rgba(34,197,94,0.45)"
          : tappable
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
          flex: 1,
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
      {won && (
        <Check
          size={14}
          strokeWidth={3}
          color="#22c55e"
          style={{ flexShrink: 0 }}
          aria-label="Winner"
        />
      )}
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

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches,
  );
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const gap = isMobile ? 12 : GAP;

 
  const [viewportW, setViewportW] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setViewportW(scrollRef.current?.clientWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isMobile]);
  // Card fills the viewport minus a fixed peek gap, so the next round pokes in
  // ~(PEEK − gap) px at the right edge. Falls back to a vw-based guess pre-measure.
  const PEEK = 44;
  const mobileColW =
    viewportW > 0 ? `${Math.max(220, viewportW - PEEK)}px` : MOBILE_COL_W;

  // Recompute the connector elbows from live card positions. Kept stable so the
  // per-frame animation loop below can reuse it while a transition is running.
  const computePaths = useCallback(() => {
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
  }, []);

  useLayoutEffect(() => {
    computePaths();
    const ro = new ResizeObserver(computePaths);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", computePaths);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", computePaths);
    };
  }, [computePaths, markets, collapsedCount, isMobile, viewportW]);

  // While a collapse/expand transition plays, the cards move via CSS (width and
  // height easing) — layout the browser drives, not React. Re-measure the elbow
  // paths every frame for the transition window so the connectors track the
  // cards smoothly, then stop (no idle rAF loop = cheap).
  const ANIM_MS = 460;
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      computePaths();
      if (ts - start < ANIM_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [collapsedCount, computePaths]);

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [collapsedCount]);

  const slotWinner = new Map<string, string>();
  WC_KNOCKOUT.forEach((round) => {
    round.slots.forEach((slot) => {
      const m = findMarketForSlot(slot, markets);
      if (
        m &&
        (m.status === "resolved" || m.status === "settled") &&
        m.resolvedOutcomeId
      ) {
        const win = (m.outcomes ?? []).find((o) => o.id === m.resolvedOutcomeId);
        if (win) slotWinner.set(slot.id, win.label);
      }
    });
  });
  // slotId → [feeder1 id, feeder2 id] from the previous round.
  const feeders = new Map<string, [string, string]>();
  for (let ri = 1; ri < WC_KNOCKOUT.length; ri++) {
    const prev = WC_KNOCKOUT[ri - 1];
    WC_KNOCKOUT[ri].slots.forEach((slot, j) => {
      const f1 = prev.slots[2 * j];
      const f2 = prev.slots[2 * j + 1];
      if (f1 && f2) feeders.set(slot.id, [f1.id, f2.id]);
    });
  }

  const renderSlot = (slot: BracketSlot) => {
    const market = findMarketForSlot(slot, markets);
    const settled =
      !!market && (market.status === "resolved" || market.status === "settled");
    const locked =
      !!market && (market.status === "closed" || market.status === "resolving");
    const winnerId = settled ? market.resolvedOutcomeId : null;

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
    // No market yet (or unnamed teams): project the winners advancing from the
    // two feeder matches so a decided team visibly moves into the next round.
    const fed = feeders.get(slot.id);
    if (fed) {
      if (team1 === "TBD") team1 = slotWinner.get(fed[0]) ?? "TBD";
      if (team2 === "TBD") team2 = slotWinner.get(fed[1]) ?? "TBD";
    }

    const dateIso = market?.bettingClosesAt ?? market?.closesAt ?? slot.kickoff;
    const canBet = !!market && !locked && !settled;
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
          width: isMobile ? "100%" : COL_W,
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
          {settled ? (
            <span style={{ color: "#22c55e", marginLeft: 6 }}>• Decided</span>
          ) : (
            locked && (
              <span style={{ color: "#fbbf24", marginLeft: 6 }}>• Locked</span>
            )
          )}
        </div>
        <TeamRow
          name={team1}
          flag={team1 === "TBD" ? "" : getFlag(team1)}
          onClick={canBet && out1 ? () => onBet(market!.id, out1!) : undefined}
          won={!!winnerId && winnerId === out1}
        />
        <TeamRow
          name={team2}
          flag={team2 === "TBD" ? "" : getFlag(team2)}
          onClick={canBet && out2 ? () => onBet(market!.id, out2!) : undefined}
          won={!!winnerId && winnerId === out2}
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

  // Swipe = chevron. A horizontal drag advances (‹›) one round, matching the
  // buttons exactly, so dragging the bracket left/right pages through the rounds.
  // Pointer events (not touch) so it works for touch, mouse-drag and pen alike.
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_MIN = 40; // px of horizontal travel needed to count as a page swipe
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // Ignore taps and mostly-vertical drags (let the page scroll normally).
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) setCollapsedCount((c) => Math.min(maxCollapsed, c + 1)); // ← next
    else setCollapsedCount((c) => Math.max(0, c - 1)); // → previous
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
        .wc-bracket-scroll { scroll-snap-type: x mandatory; scroll-padding-left: 0; scroll-behavior: smooth; }
        .wc-bracket-round {
          scroll-snap-align: start;
          scroll-snap-stop: always;
          overflow: hidden;
          /* width eases as a round folds to a strip / unfolds to full cards */
          transition: width 420ms cubic-bezier(0.22, 0.61, 0.36, 1);
          will-change: width;
        }
        /* per-slot cell height eases when the tree re-spaces (heights halve/double) */
        .wc-h-anim { transition: height 420ms cubic-bezier(0.22, 0.61, 0.36, 1); }
        /* the vertical strip label fades in as its round collapses */
        .wc-fade-in { animation: wcFadeIn 360ms ease both; }
        @keyframes wcFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .wc-bracket-scroll { scroll-behavior: auto; }
          .wc-bracket-round, .wc-h-anim { transition: none; }
          .wc-fade-in { animation: none; }
        }
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
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{
          flex: 1,
          // The whole bracket is a pager (swipe/drag = chevron), so free
          // horizontal scroll is off; vertical page scroll still passes through.
          overflowX: "hidden",
          paddingBottom: 12,
          touchAction: "pan-y",
          display: "flex",
          justifyContent: isMobile ? "flex-start" : "safe center",
        }}
      >
        <div ref={innerRef} style={{ display: "flex", gap, minWidth: "min-content", position: "relative" }}>
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
          // Earlier (already-played) rounds fold into thin strips; every round
          // from collapsedCount onward stays expanded as real cards. On mobile
          // those expanded columns are ~peek width and scroll-snap, so the next
          // round peeks at the right edge and you can swipe between rounds.
          const asStrip = ri < collapsedCount;
          // Rounds you've advanced past are hidden entirely (no thin strip) — the
          // ‹ button brings them back. The remaining rounds shift left to fill.
          if (asStrip) return null;
          // Cell height doubles each round RELATIVE to the first expanded round,
          // so the leftmost visible round packs its cards tightly (BLOCK_H) and
          // every expanded column shares the same total height (= bodyHeight).
          const cellHeight = BLOCK_H * Math.pow(2, ri - collapsedCount);
          return (
            <div
              key={round.key}
              className="wc-bracket-round"
              style={{ flexShrink: 0, width: isMobile ? mobileColW : COL_W }}
            >
              {/* Round header */}
              <div
                key="header"
                style={{
                  height: HEADER_H,
                  fontSize: 12,
                  fontWeight: 800,
                  color: ACCENT,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  textAlign: "center",
                  marginBottom: HEADER_MB,
                  width: isMobile ? "100%" : COL_W,
                }}
              >
                {round.label}
              </div>
              {/* Slots */}
              <div key="cols" style={{ display: "flex", flexDirection: "column" }}>
                {round.slots.map((slot) => (
                  <div
                    key={slot.id}
                    className="wc-h-anim"
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

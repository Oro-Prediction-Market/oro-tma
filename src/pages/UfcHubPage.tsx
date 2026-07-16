import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMarkets, type Market } from "@shared/api/client";
import { Clock, CalendarDays } from "lucide-react";
import { TmaBetModal } from "@/components/TmaBetModal";
import { Page } from "@/components/Page";
import { LoadingScreen } from "@shared/components/LoadingScreen";
import { isWCMarket, calcProb, calcOdds } from "./WorldCupHubPage";
import { isDrawOutcome } from "./BplHubPage";

// ── Helpers (mirrored from PWA — keep in sync) ────────────────────────────────

const ACCENT = "#d20a0a"; // UFC red
const RED = "#d20a0a"; // left fighter corner
const RED_DIM = "#8f0707";
const BLUE = "#2563eb"; // right fighter corner
const BLUE_DIM = "#173e9e";
const GOLD = "#fbbf24"; // Nu currency accent

export const UFC_FIGHTERS = [
  { name: "Jon Jones", short: "Jones" },
  { name: "Islam Makhachev", short: "Makhachev" },
  { name: "Alex Pereira", short: "Pereira" },
  { name: "Ilia Topuria", short: "Topuria" },
  { name: "Alexander Volkanovski", short: "Volkanovski" },
  { name: "Israel Adesanya", short: "Adesanya" },
  { name: "Charles Oliveira", short: "Oliveira" },
  { name: "Max Holloway", short: "Holloway" },
  { name: "Sean O'Malley", short: "O'Malley" },
  { name: "Valentina Shevchenko", short: "Shevchenko" },
  { name: "Zhang Weili", short: "Zhang" },
  { name: "Dricus du Plessis", short: "du Plessis" },
];

export function isUfcMarket(m: Market): boolean {
  if (m.category === "political") return false;
  if (isWCMarket(m)) return false;
  const sub = (m.subcategory ?? "").toLowerCase();
  // covers ufc-fight / ufc-event / mma tags set in the admin form
  if (sub.includes("ufc") || sub.includes("mma")) return true;
  if ((m.settlementSource ?? "").toLowerCase().includes("ufc")) return true;
  const title = m.title.toLowerCase();
  return /\bufc\b/.test(title) || title.includes("octagon");
}

// Avatar priority: per-outcome imageUrl (set in the admin form), then the
// market-level images (imageUrl = first outcome, imageUrlAlt = second).
export function getUfcAvatar(market: Market, fighterIdx: number): string | null {
  const fighterOutcomes = (market.outcomes ?? []).filter(
    (o) => !isDrawOutcome(o.label ?? ""),
  );
  const outcome = fighterOutcomes[fighterIdx];
  if (outcome?.imageUrl) return outcome.imageUrl;
  if (fighterIdx === 0) return market.imageUrl;
  if (fighterIdx === 1) return market.imageUrlAlt;
  return null;
}

// "Jon Jones" → "Jones"; single-word names pass through unchanged
export function shortFighterName(label: string): string {
  const parts = label.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : label.trim();
}

function parseFightNames(title: string): { fighter1: string; fighter2: string } {
  const m = title.match(/^(?:ufc\s*\d*\s*[:\-–—]?\s*)?(.+?)\s+vs\.?\s+(.+?)(?:\s*[–—\-:?]|\s*\(|\s+(?:who|which|will)\b|$)/i);
  if (m) return { fighter1: m[1].trim(), fighter2: m[2].trim() };
  return { fighter1: "Fighter A", fighter2: "Fighter B" };
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

export function FighterAvatar({
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
        loading="lazy"
        decoding="async"
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
        background: "linear-gradient(135deg, #d20a0a 0%, #450a0a 100%)",
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

function UfcFightCard({
  market,
  onBet,
}: {
  market: Market;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const navigate = useNavigate();
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const resolving = market.status === "resolving";
  const locked = resolving || market.status === "closed";
  const settleEta = useClosesAt(resolving ? market.disputeDeadlineAt : null);
  const totalPool = Number(market.totalPool ?? 0) ||
    (market.outcomes ?? []).reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);

  const fighters = (market.outcomes ?? []).filter((o) => !isDrawOutcome(o.label ?? ""));
  const [fa, fb] = fighters;
  if (!fa || !fb) return null;

  const titleNames = parseFightNames(market.title);
  const nameOf = (label: string, idx: number) =>
    /^(yes|no)$/i.test(label.trim())
      ? (idx === 0 ? titleNames.fighter1 : titleNames.fighter2)
      : label;

  const pctA = Math.round(calcProb(market, fa.id) * 100);
  const pctB = 100 - pctA;

  const eventLabel = (market.title.match(/^\s*UFC\s+([^:–—-]{1,14})\s*[:–—-]/i)?.[1] ?? "FIGHT NIGHT").toUpperCase();

  const renderSide = (outcome: typeof fa, idx: number, color: string, colorDim: string, pct: number) => {
    const name = shortFighterName(nameOf(outcome.label, idx));
    const left = idx === 0;
    
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: left ? "flex-start" : "flex-end", zIndex: 10, minWidth: 0 }}>
        {/* Letter Box */}
        <div style={{ width: 24, height: 24, borderRadius: 4, background: color, color: "#fff", fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6, boxShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
          {name.trim().charAt(0).toUpperCase()}
        </div>
        
        {/* Fighter Name */}
        <div style={{ fontSize: 22, fontWeight: 900, fontStyle: "italic", color: "#fff", textTransform: "uppercase", letterSpacing: "-0.5px", textShadow: "0 2px 8px rgba(0,0,0,0.8)", textAlign: left ? "left" : "right", width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: left ? 0 : 12 }}>
          {name}
        </div>
        
        {/* Pool */}
        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginTop: 2, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
          <span style={{ color: GOLD, fontWeight: 800 }}>Nu</span> {Number(outcome.totalBetAmount ?? 0).toLocaleString()} pool
        </div>
        
        {/* Win % */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: color, textShadow: "0 2px 8px rgba(0,0,0,0.6)", lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>win</span>
        </div>
        
        {/* Predict Button */}
        <button
          disabled={locked}
          onClick={(e) => { e.stopPropagation(); onBet(market.id, outcome.id); }}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "10px 0",
            background: `linear-gradient(180deg, ${color} 0%, ${colorDim} 100%)`,
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            cursor: locked ? "default" : "pointer",
            opacity: locked ? 0.5 : 1,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          PREDICT
        </button>
      </div>
    );
  };

  return (
    <div
      onClick={() => navigate(`/market/${market.id}`)}
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.1)",
        background: "#0d0b0c",
      }}
    >
      {/* Dark background image of arena */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/ufc-card-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.6 }} />
      
      {/* Background fighters */}
      {getUfcAvatar(market, 0) && (
         <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "65%", height: "75%", backgroundImage: `url(${getUfcAvatar(market, 0)})`, backgroundSize: "contain", backgroundPosition: "bottom center", backgroundRepeat: "no-repeat", opacity: 0.8, maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", filter: "blur(3px)" }} />
      )}
      {getUfcAvatar(market, 1) && (
         <div style={{ position: "absolute", top: "-10%", right: "-10%", width: "65%", height: "75%", backgroundImage: `url(${getUfcAvatar(market, 1)})`, backgroundSize: "contain", backgroundPosition: "bottom center", backgroundRepeat: "no-repeat", opacity: 0.8, maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", filter: "blur(3px)" }} />
      )}
      
      {/* Gradient overlay to make text readable */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(13,11,12,0) 0%, rgba(13,11,12,0.4) 40%, rgba(13,11,12,0.9) 80%, #0d0b0c 100%)" }} />

      {/* Top Badges */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 }}>
         {/* UFC Badge */}
         <div style={{ position: "absolute", top: 0, left: 0, background: "linear-gradient(180deg, #d20a0a 0%, #8f0707 100%)", padding: "8px 16px 12px", borderBottomRightRadius: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontStyle: "italic", color: "#fff", lineHeight: 1, letterSpacing: "-1px" }}>UFC</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#fff", fontStyle: "italic", letterSpacing: "0.05em", marginTop: 2 }}>{eventLabel}</div>
         </div>
         
         {/* Countdown Pill */}
         <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
            {locked ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {settleEta && settleEta !== "Closed" && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{settleEta}</span>
                )}
                <span style={{ fontSize: 10, fontWeight: 800, color: GOLD, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 12, padding: "4px 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {resolving ? "Resolving" : "Closed"}
                </span>
              </div>
            ) : closes ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(210,10,10,0.4)", borderRadius: 20, padding: "5px 12px" }}>
                <Clock size={12} color="#ff4d4d" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#ff4d4d" }}>{closes}</span>
              </div>
            ) : null}
         </div>
      </div>

      {/* Main Content */}
      <div style={{ position: "relative", zIndex: 10, paddingTop: 160, paddingLeft: 16, paddingRight: 16, paddingBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
           {renderSide(fa, 0, RED, RED_DIM, pctA)}
           
           {/* Center VS */}
           <div style={{ width: 60, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40, flexShrink: 0 }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                 {/* Slanted red glow */}
                 <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%) rotate(15deg)", width: 4, height: 60, background: "rgba(255,50,50,0.8)", boxShadow: "0 0 20px 8px rgba(255,0,0,0.6)" }} />
                 {/* VS text */}
                 <span style={{ position: "relative", display: "inline-block", padding: "8px", lineHeight: 1.2, fontSize: 36, fontWeight: 900, transform: "skewX(-15deg)", background: "linear-gradient(180deg, #ffffff 0%, #a0a0a0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-1px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
                   VS
                 </span>
              </div>
              
              {/* Octagon + Fist */}
              <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                 <svg width="52" height="52" viewBox="0 0 100 100">
                   {/* Octagon outline, flat corners like the UFC cage */}
                   <polygon points="31,6 69,6 94,31 94,69 69,94 31,94 6,69 6,31" fill="rgba(0,0,0,0.55)" stroke="#ffffff" strokeWidth="4.5" strokeLinejoin="miter" />
                   {/* Oncoming fist 👊 — Twemoji artwork (CC-BY 4.0) as monochrome vector */}
                   <g transform="translate(50,50) scale(1.55) translate(-18,-18.5)">
                     <path fill="#ffffff" d="M32.942 11.244c-.041-.609-.284-1.18-.674-1.644l-.357-2.057c-.376-2.006-2.232-3.386-4.262-3.169L4.259 8.11C2.377 8.312.909 9.833.774 11.721l1.761 11.147c.305 2.169 2.151 3.788 4.341 3.813.677.008 1.238.017 1.463.027l9.483.463c-.363.483-.822 1.08-.822 1.718v.052c0 1.581 1.771 3.06 3.353 3.06h7.282c.76 0 1.488-.4 2.025-.938l4.424-4.472c.583-.584.887-1.416.832-2.24l-1.974-13.107z" />
                     <path fill="#0d0b0c" d="M8.217 26.623c-.474 0-.895-.338-.983-.821L5.174 14.47c-.099-.543.262-1.064.805-1.163.546-.097 1.064.262 1.163.805l2.06 11.332c.099.543-.262 1.063-.805 1.162-.061.012-.121.017-.18.017zm6.181 0c-.517 0-.955-.398-.996-.923l-1.03-13.393c-.043-.551.37-1.031.92-1.074.549-.044 1.031.371 1.074.92l1.03 13.392c.043.551-.37 1.032-.92 1.074-.026.003-.053.004-.078.004zm7.207 1.106c-.508 0-.757-.001-.951-1.062l-.044-.003c.001-.055.007-.108.017-.161-.174-1.068-.309-3.069-.561-6.817-.235-3.49-.486-7.552-.486-8.485 0-.552.447-1 1-1 .553 0 1 .448 1 1 0 1.533.795 13.324.981 15.145.032.097.049.2.049.308 0 .266-.108.557-.295.744s-.444.331-.71.331z" />
                     <path fill="#0d0b0c" d="M25.178 28.684H18.52c-.552 0-1-.447-1-1s.448-1 1-1h6.658c1.458 0 2.644-1.186 2.644-2.644V11.201c0-.552.447-1 1-1s1 .448 1 1V24.04c-.001 2.561-2.084 4.644-4.644 4.644z" />
                   </g>
                 </svg>
              </div>
           </div>
           
           {renderSide(fb, 1, BLUE, BLUE_DIM, pctB)}
        </div>
        
        {/* Total Pool */}
        <div style={{ textAlign: "center", marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>TOTAL POOL</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginTop: 2 }}>
              <span style={{ color: GOLD }}>Nu</span> {totalPool.toLocaleString()}
            </div>
        </div>
      </div>
    </div>
  );
}

function UfcEventMarket({
  market,
  onBet,
}: {
  market: Market;
  onBet: (marketId: string, outcomeId: string) => void;
}) {
  const navigate = useNavigate();
  const closes = useClosesAt(market.bettingClosesAt ?? market.closesAt);
  const resolving = market.status === "resolving";
  const locked = resolving || market.status === "closed";
  const settleEta = useClosesAt(resolving ? market.disputeDeadlineAt : null);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {market.title}
        </div>
        {locked ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {settleEta && settleEta !== "Closed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                <Clock size={10} />
                <span>{settleEta}</span>
              </div>
            )}
            <div style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {resolving ? "Resolving" : "Closed"}
            </div>
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
          const odds = calcOdds(market, outcome.id);
          return (
            <div
              key={outcome.id}
              onClick={() => navigate(`/market/${market.id}`)}
              style={{
                background: "linear-gradient(135deg, rgba(210,10,10,0.05) 0%, var(--bg-card, #1a1a1a) 60%)",
                border: "1px solid rgba(210,10,10,0.18)",
                borderRadius: 14,
                padding: "11px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <FighterAvatar src={getUfcAvatar(market, idx)} label={outcome.label} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main, #fff)", marginBottom: 2 }}>{outcome.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                  Nu {Number(outcome.totalBetAmount).toLocaleString()} pool
                </div>
              </div>
              <div style={{ background: "rgba(210,10,10,0.12)", border: "1px solid rgba(210,10,10,0.3)", borderRadius: 9, padding: "5px 9px", textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#ff4d4d", lineHeight: 1 }}>{Math.round(prob * 100)}%</div>
                <div style={{ fontSize: 9, color: "rgba(255,77,77,0.6)", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>win</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>
                    {odds ? `${odds.toFixed(2)}x` : "—"}
                  </div>
                </div>
                {!locked && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onBet(market.id, outcome.id); }}
                    style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 900, cursor: "pointer", flexShrink: 0 }}
                  >
                    Predict
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Vector rebuild of the ufchub.jpg ribbon — scales crisply at any page width.
// Geometry: skewed red block (slope matches a -20° slash), charcoal bar behind.
export function UfcRibbon() {
  const FONT = "'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif";
  return (
    <svg
      viewBox="0 0 1200 108"
      width="100%"
      style={{ display: "block" }}
      role="img"
      aria-label="UFC Prediction Hub — Ultimate Fighting Championship"
    >
      {/* Charcoal bar */}
      <rect x="0" y="0" width="1200" height="108" fill="#232327" />
      {/* Red block with slanted right edge + darker accent slash */}
      <polygon points="0,0 430,0 390,108 0,108" fill="#d20a0a" />
      <polygon points="430,0 456,0 416,108 390,108" fill="#8f0707" />
      {/* UFC wordmark — x leaves room for the overlaid back arrow */}
      <text
        x="130"
        y="76"
        fontFamily={FONT}
        fontSize="58"
        fontWeight="900"
        fontStyle="italic"
        letterSpacing="-1"
        fill="#ffffff"
      >
        UFC
      </text>
      {/* Divider slash — clear space on both sides of it */}
      <line x1="278" y1="24" x2="256" y2="84" stroke="#ffffff" strokeWidth="3" opacity="0.9" />
      {/* PREDICTION HUB, two lines — textLength pins the fit across fonts */}
      <text x="300" y="50" fontFamily={FONT} fontSize="20" fontWeight="800" fontStyle="italic" fill="#ffffff" textLength="106" lengthAdjust="spacingAndGlyphs">
        PREDICTION
      </text>
      <text x="297" y="78" fontFamily={FONT} fontSize="20" fontWeight="800" fontStyle="italic" fill="#ffffff">
        HUB
      </text>
      {/* Right lockup — textLength keeps it inside the charcoal area */}
      <text
        x="820"
        y="66"
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="28"
        fontWeight="900"
        fontStyle="italic"
        fill="#f4f4f5"
        textLength="600"
        lengthAdjust="spacingAndGlyphs"
      >
        ULTIMATE FIGHTING CHAMPIONSHIP
      </text>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type ActiveBet = { marketId: string; outcomeId: string };

export function UfcHubPage() {
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
              m.status === "closed" ||
              m.status === "resolving",
          ),
        ),
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ufcMarkets = markets.filter(isUfcMarket);
  
  const isFightMarket = (m: Market) => {
    const nonDrawOutcomes = (m.outcomes ?? []).filter((o) => !isDrawOutcome(o.label ?? ""));
    if (nonDrawOutcomes.length !== 2) return false;
    const isBinary = nonDrawOutcomes.every(o => /^(yes|no)$/i.test((o.label ?? "").trim()));
    if (isBinary) {
      return /\bvs\b/i.test(m.title);
    }
    return true;
  };

  const fightMarkets = ufcMarkets
    .filter(isFightMarket)
    .sort((a, b) => {
      const ta = a.bettingClosesAt ? new Date(a.bettingClosesAt).getTime() : a.closesAt ? new Date(a.closesAt).getTime() : Infinity;
      const tb = b.bettingClosesAt ? new Date(b.bettingClosesAt).getTime() : b.closesAt ? new Date(b.closesAt).getTime() : Infinity;
      return ta - tb;
    });
  const eventMarkets = ufcMarkets.filter((m) => !isFightMarket(m));
  const totalPool = ufcMarkets.reduce((s, m) => s + Number(m.totalPool ?? 0), 0);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const dayAfterTomorrow = new Date(tomorrowStart.getTime() + 86_400_000);

  const filteredFightMarkets = fightMarkets.filter((m) => {
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

  if (loading) return <LoadingScreen message="Loading UFC…" />;

  return (
    <Page>
      <div style={{ minHeight: "100vh", background: "var(--bg-main, #0f0f0f)" }}>
        {/* ── Header — UFC Prediction Hub ribbon + stats ─────────────── */}
        <div
          style={{
            background: "linear-gradient(180deg, #1e0b0b 0%, #131313 100%)",
            paddingBottom: 20,
          }}
        >
          {/* Full-bleed banner: ribbon at the very top, back arrow overlaid in
              the red section, stats band on the same charcoal panel */}
          <div style={{ background: "#232327", paddingBottom: 14 }}>
            <div style={{ position: "relative" }}>
              <UfcRibbon />
              <button
                onClick={() => navigate(-1)}
                aria-label="Go back"
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(0,0,0,0.28)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 15,
                  padding: 0,
                }}
              >
                ←
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, maxWidth: 860, margin: "12px auto 0", padding: "0 16px" }}>
              {[
                { label: "Fight predictions", val: String(fightMarkets.length) },
                { label: "Event predictions", val: String(eventMarkets.length) },
                { label: "Total pool", val: `Nu ${totalPool.toLocaleString()}` },
              ].map(({ label, val }) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    background: "rgba(0,0,0,0.35)",
                    borderRadius: 10,
                    padding: "8px 4px",
                    border: "1px solid rgba(210,10,10,0.4)",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{val}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div style={{ padding: "20px 16px 100px", maxWidth: 860, margin: "0 auto" }}>
          {eventMarkets.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              {eventMarkets.map((market) => (
                <UfcEventMarket
                  key={market.id}
                  market={market}
                  onBet={(marketId, outcomeId) => setActiveBet({ marketId, outcomeId })}
                />
              ))}
            </div>
          )}

          {fightMarkets.length === 0 && eventMarkets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🥊</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>No UFC markets yet</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "rgba(255,255,255,0.35)" }}>Check back when the next fight card is announced</div>
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
                      background: timeFilter === f ? ACCENT : "rgba(210,10,10,0.14)",
                      color: timeFilter === f ? "#fff" : "rgba(255,255,255,0.7)",
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

              {filteredFightMarkets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🥊</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>No fights scheduled for this day</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                  {filteredFightMarkets.map((market) => (
                    <UfcFightCard
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

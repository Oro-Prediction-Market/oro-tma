import { FC, useState } from "react";
import { Share2, Check, Link2 } from "lucide-react";
import type { Market } from "@shared/api/client";

declare global {
  interface Window {
    Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } };
  }
}

export interface MarketShareOutcome {
  /** Outcome / candidate name */
  label: string;
  /** Chance %, 0–100 */
  pct: number;
  /** Optional per-outcome colour (e.g. UFC red/blue, price up/down). */
  color?: string;
  /** Optional avatar / logo for the option. */
  image?: string | null;
}

export type MarketShareTheme = "default" | "epl" | "ucl" | "ufc" | "esports" | "btc" | "ter";

interface MarketShareCardProps {
  marketTitle: string;
  /** Passed in any order — the card sorts by pct and shows the top few. */
  outcomes: MarketShareOutcome[];
  /** Category / market accent colour — themes the card to match its market. */
  accentColor?: string;
  /** Total pool in Nu, shown as a subtle stat when > 0. */
  poolAmount?: number;
  /** Market id — makes the shared link a deep link that opens THIS market. */
  marketId?: string;
  botUsername?: string;
  referralId?: string;
  theme?: MarketShareTheme;
}

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME as string;
const MAX_OUTCOMES = 4;

/**
 * Honest per-outcome chance % for a market — the same pool-share formula the
 * cards/detail views use (Laplace-smoothed pool share once bets exist, else
 * normalised LMSR). Returns one entry per outcome, in the market's own order.
 */
export function marketOutcomeChances(market: Market): MarketShareOutcome[] {
  const outcomes = market.outcomes ?? [];
  const prior = 1000;
  const n = outcomes.length || 1;
  const totalPool =
    Number(market.totalPool) ||
    outcomes.reduce((s, o) => s + Number(o.totalBetAmount ?? 0), 0);
  const lmsr = outcomes.map((x) => Number(x.lmsrProbability) || 0);
  const lmsrSum = lmsr.reduce((a, b) => a + b, 0);
  const lmsrUsable = lmsr.length > 0 && lmsr.every((p) => p > 0);
  return outcomes.map((o) => {
    let pct: number;
    if (totalPool > 0) {
      pct = ((Number(o.totalBetAmount) + prior / n) / (totalPool + prior)) * 100;
    } else if (lmsrUsable) {
      pct = ((Number(o.lmsrProbability) || 0) / lmsrSum) * 100;
    } else {
      pct = ((Number(o.totalBetAmount) + prior / n) / (totalPool + prior)) * 100;
    }
    return {
      label: (o.label ?? "").trim() || "—",
      pct,
      image: o.imageUrl ?? undefined,
    };
  });
}

/** Build the Telegram startapp deep link: referral credit + opens this market. */
function buildDeepLink(opts: {
  botUsername?: string;
  referralId?: string;
  marketId?: string;
}): string {
  const bot = opts.botUsername ?? BOT_USERNAME;
  const ref = opts.referralId?.trim();
  const mkt = opts.marketId?.trim();
  let startParam = "";
  if (ref && mkt) startParam = `ref_${ref}_m_${mkt}`;
  else if (ref) startParam = `ref_${ref}`;
  else if (mkt) startParam = `m_${mkt}`;
  return `https://t.me/${bot}?startapp=${startParam}`;
}

/**
 * Compact, shareable market card. Renders as a small HTML card (no image
 * generation) and shares the market's deep link — tapping Share sends the link,
 * which opens THIS market with referral credit.
 */
export const MarketShareCard: FC<MarketShareCardProps> = (props) => {
  const [copied, setCopied] = useState(false);
  const accent = props.accentColor || "#22d3ee";
  const theme = props.theme || "default";
  const outcomes = [...props.outcomes]
    .sort((a, b) => b.pct - a.pct)
    .slice(0, MAX_OUTCOMES);
  const showAvatars = outcomes.some((o) => !!o.image);
  const deepLink = buildDeepLink(props);
  const fav = outcomes[0];
  const shareText = `🔮 Predict this on Oro:\n"${props.marketTitle}"${
    fav ? `\n\n${fav.label} leading at ${Math.round(fav.pct)}%` : ""
  }\n\nThink you can call it? 👇`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Oro Prediction Market",
          text: shareText,
          url: deepLink,
        });
        return;
      }
      const tg = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`;
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(tg);
        return;
      }
      window.open(tg, "_blank");
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError")
        console.warn("Share failed:", err);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const themeStyle: Record<MarketShareTheme, React.CSSProperties> = {
    default: { background: "linear-gradient(135deg, #0f1117 0%, #1a1f2e 100%)", border: "1px solid rgba(255,255,255,0.08)" },
    epl: { background: "radial-gradient(circle at 100% 0%, rgba(0,255,133,0.20), transparent 34%), linear-gradient(135deg, #38003c 0%, #1a0020 55%, #0a0410 100%)", border: "1px solid rgba(0,255,133,0.34)", boxShadow: "inset 0 3px 0 #e90052" },
    ucl: { background: "radial-gradient(circle at 85% 12%, rgba(43,107,255,0.42), transparent 29%), radial-gradient(circle at 12% 100%, rgba(224,69,123,0.20), transparent 32%), linear-gradient(135deg, #0c1746 0%, #0a1235 56%, #070d29 100%)", border: "1px solid rgba(43,107,255,0.52)", boxShadow: "inset 0 2px 0 rgba(232,199,102,0.72)" },
    ufc: { background: "linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(15,14,17,0.66) 34%, rgba(10,10,12,0.78) 100%)", border: "1px solid rgba(255,255,255,0.24)", backdropFilter: "blur(16px) saturate(130%)", WebkitBackdropFilter: "blur(16px) saturate(130%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.13), 0 10px 28px rgba(0,0,0,0.22)" },
    esports: { background: "radial-gradient(circle at 50% -10%, rgba(242,197,117,0.19), transparent 45%), linear-gradient(180deg, #16150f 0%, #0f0e0b 100%)", border: "1px solid rgba(190,158,89,0.58)", clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)" },
    btc: { background: "linear-gradient(145deg, rgba(247,147,26,0.15) 0%, rgba(20,20,31,0.82) 35%, rgba(12,12,20,0.9) 100%)", border: "1px solid rgba(247,147,26,0.32)", backdropFilter: "blur(16px) saturate(125%)", WebkitBackdropFilter: "blur(16px) saturate(125%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 28px rgba(0,0,0,0.24)" },
    ter: { background: "linear-gradient(145deg, rgba(244,175,57,0.16) 0%, rgba(26,21,11,0.82) 35%, rgba(14,11,6,0.92) 100%)", border: "1px solid rgba(244,175,57,0.36)", backdropFilter: "blur(16px) saturate(125%)", WebkitBackdropFilter: "blur(16px) saturate(125%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 28px rgba(0,0,0,0.24)" },
  };
  const leagueLabel: Record<MarketShareTheme, string> = { default: "🔮 ORO · PREDICTION MARKET", epl: "PREMIER LEAGUE · ORO", ucl: "✦ UEFA CHAMPIONS LEAGUE · ORO", ufc: "UFC · FIGHT MARKET", esports: "ESPORTS WORLD CUP · ORO", btc: "₿ BITCOIN · PRICE MARKET", ter: "TER · PRICE MARKET" };
  const outcomeFill = (o: MarketShareOutcome, index: number) => {
    if (theme === "ufc") return index === 0 ? "#d20a0a" : index === 1 ? "#2563eb" : "#6b7280";
    if (theme === "epl") return index === 0 ? "#00ff85" : "#e90052";
    if (theme === "ucl") return index === 0 ? "#2b6bff" : "#e0457b";
    if (theme === "esports") return "#be9e59";
    if (theme === "btc") return "#f7931a";
    if (theme === "ter") return "#F4AF39";
    return o.color || accent;
  };
  const shareButtonBackground: Record<MarketShareTheme, string> = { default: "linear-gradient(135deg, #2563eb, #1d4ed8)", epl: "linear-gradient(135deg, #00c968, #00a854)", ucl: "linear-gradient(135deg, #2b6bff, #173e9e)", ufc: "#f5f5f5", esports: "radial-gradient(122% 179% at 50% 0%, #f2c575 0%, #987c4b 41%, #4e442d 93%)", btc: "linear-gradient(135deg, #f7931a, #d86f09)", ter: "linear-gradient(135deg, #F4AF39, #c47d15)" };

  return (
    <div
      style={{
        maxWidth: 500,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Compact preview card */}
      <div
        style={{
          borderRadius: 16,
          padding: 16,
          ...themeStyle[theme],
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: theme === "esports" ? "#f2c575" : accent,
            marginBottom: 8,
            fontFamily: theme === "esports" ? '"Quantico", system-ui, sans-serif' : undefined,
          }}
        >
          {leagueLabel[theme]}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.25,
            marginBottom: 14,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            fontFamily: theme === "esports" ? '"Quantico", system-ui, sans-serif' : undefined,
            textTransform: theme === "esports" ? "uppercase" : undefined,
          }}
        >
          {props.marketTitle}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {outcomes.map((o, i) => {
            const pct = Math.max(0, Math.min(100, o.pct));
            const barColor = o.color || outcomeFill(o, i);
            return (
              <div
                key={`${o.label}-${i}`}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: theme === "ufc" ? "8px 9px" : 0, background: theme === "ufc" ? `${barColor}18` : theme === "esports" ? "rgba(255,255,255,0.025)" : undefined, border: theme === "ufc" ? `1px solid ${barColor}66` : theme === "esports" ? "1px solid rgba(190,158,89,0.2)" : undefined, clipPath: theme === "esports" ? "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" : undefined }}
              >
                {showAvatars &&
                  (o.image ? (
                    <img
                      src={o.image}
                      alt=""
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                        border: `1.5px solid ${barColor}`,
                        background: "rgba(255,255,255,0.06)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 800,
                        color: theme === "ufc" ? "#fff" : barColor,
                        background: `${barColor}22`,
                        border: `1.5px solid ${barColor}55`,
                      }}
                    >
                      {(o.label[0] || "?").toUpperCase()}
                    </div>
                  ))}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.9)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {o.label}
                    </span>
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: barColor,
                        flexShrink: 0,
                      }}
                    >
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(4, pct)}%`,
                        borderRadius: 3,
                        background: theme === "esports" ? "linear-gradient(90deg, #987c4b, #f2c575)" : barColor,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {props.poolAmount != null && props.poolAmount > 0 && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.07)",
              fontSize: 11,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            Nu {Math.round(props.poolAmount).toLocaleString()} in the pool
          </div>
        )}
      </div>

      {/* Actions — share the LINK (no image) */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleShare}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "11px",
            background: shareButtonBackground[theme],
            color: theme === "esports" || theme === "ufc" ? "#17130b" : "#fff",
            border: "none",
            borderRadius: theme === "esports" ? 0 : 12,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Share2 size={16} />
          Share
        </button>
        <button
          onClick={handleCopy}
          title="Copy link"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "11px 14px",
            background: theme === "esports" ? "rgba(190,158,89,0.10)" : "rgba(255,255,255,0.06)",
            color: theme === "esports" ? "#f2c575" : "var(--text-main)",
            border: theme === "esports" ? "1px solid rgba(190,158,89,0.5)" : "1px solid rgba(255,255,255,0.1)",
            borderRadius: theme === "esports" ? 0 : 12,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {copied ? <Check size={15} /> : <Link2 size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
};

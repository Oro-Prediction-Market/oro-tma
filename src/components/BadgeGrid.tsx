import { useState } from "react";
import { Target, Swords, Lock, CheckCircle2, Medal, Crown } from "lucide-react";

// ── Collectible badge images ──────────────────────────────────────────────────
// Volume
import imgFirstCall from "@shared/assets/collectibles/volumebadges/firstcall.png";
import imgTripleThreat from "@shared/assets/collectibles/volumebadges/triplethreat.png";
import imgSharpStart from "@shared/assets/collectibles/volumebadges/sharpstart.png";
import imgTenDeep from "@shared/assets/collectibles/volumebadges/tendeep.png";
import imgCommitted from "@shared/assets/collectibles/volumebadges/committed.png";
import imgCenturion from "@shared/assets/collectibles/volumebadges/centurian.png";
// Accuracy
import imgAboveAverage from "@shared/assets/collectibles/accuraybadges/aboveaverage.png";
import imgEagleEye from "@shared/assets/collectibles/accuraybadges/eagleeye.png";
import imgSharpened from "@shared/assets/collectibles/accuraybadges/sharpened.png";
import imgOracle from "@shared/assets/collectibles/accuraybadges/oracle.png";
import imgElectrified from "@shared/assets/collectibles/accuraybadges/electrified.png";
import imgGodlike from "@shared/assets/collectibles/accuraybadges/godlike.png";
// Correct calls
import imgRightOnce from "@shared/assets/collectibles/correctcallsbadges/rightonce.png";
import imgDoubleDigit from "@shared/assets/collectibles/correctcallsbadges/doubledigit.png";
import imgThinkTank from "@shared/assets/collectibles/correctcallsbadges/thinktank.png";
import imgHalfCentury from "@shared/assets/collectibles/correctcallsbadges/halfcentury.png";
// Tiers
import imgRookie from "@shared/assets/collectibles/tierbadges/rookie.png";
import imgSharpshooter from "@shared/assets/collectibles/tierbadges/sharpshooter.png";
import imgHotHand from "@shared/assets/collectibles/tierbadges/hothand.png";
import imgLegend from "@shared/assets/collectibles/tierbadges/legend.png";
// Profile
import imgVerified from "@shared/assets/collectibles/profilebadges/verified.png";
import imgBankrolled from "@shared/assets/collectibles/profilebadges/bankrolled.png";
import imgConnected from "@shared/assets/collectibles/profilebadges/connected.png";
import imgHighScore from "@shared/assets/collectibles/profilebadges/highscore.png";
// Referral
import imgConnector from "@shared/assets/collectibles/referralbadges/connector.png";
import imgAmbassador from "@shared/assets/collectibles/referralbadges/ambassador.png";
import imgInfluencer from "@shared/assets/collectibles/referralbadges/influencer.png";
import imgKingmaker from "@shared/assets/collectibles/referralbadges/kingmaker.png";
// Duels
import imgChallenger from "@shared/assets/collectibles/duelbadges/challenger.png";
import imgOnFire from "@shared/assets/collectibles/duelbadges/onfire.png";
import imgDuelMaster from "@shared/assets/collectibles/duelbadges/duelmaster.png";
import imgDeadEye from "@shared/assets/collectibles/duelbadges/deadeye.png";
import imgPackLeader from "@shared/assets/collectibles/duelbadges/packleader.png";
import imgDuelOracle from "@shared/assets/collectibles/duelbadges/dueloracle.png";
// Season events (one badge per competition per season — new image + entry each year)
import imgEplSeason from "@shared/assets/collectibles/eventbadges/premierleague-2026-27.png";
import imgUclSeason from "@shared/assets/collectibles/eventbadges/championsleague-2026-27.png";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CollectibleBadge = {
  id: string;
  img?: string; // image path — if present, renders instead of icon
  icon: React.ReactNode;
  name: string;
  /** What the user needs to do to unlock it */
  requirement: string;
  unlocked: boolean;
  legendary?: boolean; // special styling for the impossible one
  /** Times earned — renders a ×N badge when > 1 (e.g. multi-month podiums). */
  count?: number;
  /** Fills the icon bubble when a badge has no artwork yet (icon-only badges),
   *  so it reads as a finished medallion rather than a bare icon on grey. */
  tint?: string;
};

/**
 * Monthly leaderboard podium tallies from the backend's `monthlyPodiumStats`:
 * how many months the user finished #1 / #2 / #3. Powers the Monthly
 * Champion/Runner-Up/Third collectibles — these can't be computed client-side
 * from the user's own stats, so the backend persists and serves the counts.
 */
export type MonthlyPodiumStats = {
  gold: number;
  silver: number;
  bronze: number;
};

/**
 * Season-scoped EPL/UCL prediction tallies for the season collectible badges,
 * from the backend's `seasonBadgeStats["<season>"]`. Counts only that season's
 * settled predictions, so a badge reflects one season and can't be topped up
 * later. Undefined = no data available (badge stays locked).
 */
export type SeasonBadgeStats = {
  eplSettled: number;
  eplWins: number;
  uclSettled: number;
  uclWins: number;
};

/** The season whose badges are currently earnable. Bump + add badges next year. */
export const CURRENT_FOOTBALL_SEASON = "2026-27";

// Season badge unlock: enough settled predictions AND a high win-rate, within
// the season window (the window is already enforced by the backend counting).
const SEASON_MIN_SETTLED = 15;
const SEASON_MIN_WINRATE = 0.6;

// ── Badge definitions ─────────────────────────────────────────────────────────

export function buildBadges(
  total: number,
  correct: number,
  tier: string,
  score: number,
  hasPhone: boolean,
  hasDK: boolean,
  referrals: number,
  season?: SeasonBadgeStats,
  podiums?: MonthlyPodiumStats,
): CollectibleBadge[] {
  const acc = total > 0 ? correct / total : 0;

  // Monthly leaderboard podium finishes (server-persisted, not stat-derived).
  const golds = podiums?.gold ?? 0;
  const silvers = podiums?.silver ?? 0;
  const bronzes = podiums?.bronze ?? 0;

  // Season football badges (2026/27). Win-rate only counts settled predictions.
  const eplWinRate =
    season && season.eplSettled > 0 ? season.eplWins / season.eplSettled : 0;
  const uclWinRate =
    season && season.uclSettled > 0 ? season.uclWins / season.uclSettled : 0;
  const eplSeasonUnlocked =
    !!season &&
    season.eplSettled >= SEASON_MIN_SETTLED &&
    eplWinRate >= SEASON_MIN_WINRATE;
  const uclSeasonUnlocked =
    !!season &&
    season.uclSettled >= SEASON_MIN_SETTLED &&
    uclWinRate >= SEASON_MIN_WINRATE;

  return [
    // ── Volume ──
    {
      id: "first_call",
      img: imgFirstCall,
      icon: <Target size={18} color="#3b82f6" />,
      name: "First Call",
      requirement: "Make your first prediction",
      unlocked: total >= 1,
    },
    {
      id: "triple",
      img: imgTripleThreat,
      icon: <Target size={18} color="#f97316" />,
      name: "Triple Threat",
      requirement: "Make 3 predictions",
      unlocked: total >= 3,
    },
    {
      id: "sharp_start",
      img: imgSharpStart,
      icon: <Target size={18} color="#eab308" />,
      name: "Sharp Start",
      requirement: "Make 5 predictions",
      unlocked: total >= 5,
    },
    {
      id: "ten_deep",
      img: imgTenDeep,
      icon: <Target size={18} color="#22c55e" />,
      name: "Ten Deep",
      requirement: "Make 10 predictions",
      unlocked: total >= 10,
    },
    {
      id: "committed",
      img: imgCommitted,
      icon: <Target size={18} color="#06b6d4" />,
      name: "Committed",
      requirement: "Make 25 predictions",
      unlocked: total >= 25,
    },
    {
      id: "centurion",
      img: imgCenturion,
      icon: <Target size={18} color="#a855f7" />,
      name: "Centurion",
      requirement: "Make 100 predictions",
      unlocked: total >= 100,
    },
    // ── Accuracy ──
    {
      id: "above_avg",
      img: imgAboveAverage,
      icon: <Target size={18} color="#3b82f6" />,
      name: "Above Average",
      requirement: "50%+ accuracy (5+ picks)",
      unlocked: total >= 5 && acc >= 0.5,
    },
    {
      id: "eagle_eye",
      img: imgEagleEye,
      icon: <Target size={18} color="#0ea5e9" />,
      name: "Eagle Eye",
      requirement: "60%+ accuracy (10+ picks)",
      unlocked: total >= 10 && acc >= 0.6,
    },
    {
      id: "sharpened",
      img: imgSharpened,
      icon: <Target size={18} color="#10b981" />,
      name: "Sharpened",
      requirement: "70%+ accuracy (15+ picks)",
      unlocked: total >= 15 && acc >= 0.7,
    },
    {
      id: "oracle",
      img: imgOracle,
      icon: <Target size={18} color="#8b5cf6" />,
      name: "Oracle",
      requirement: "75%+ accuracy (20+ picks)",
      unlocked: total >= 20 && acc >= 0.75,
    },
    {
      id: "electrified",
      img: imgElectrified,
      icon: <Target size={18} color="#f59e0b" />,
      name: "Electrified",
      requirement: "80%+ accuracy (30+ picks)",
      unlocked: total >= 30 && acc >= 0.8,
    },
    {
      id: "godlike",
      img: imgGodlike,
      icon: <Target size={18} color="#f59e0b" />,
      name: "Godlike",
      requirement: "85%+ accuracy (50+ picks)",
      unlocked: total >= 50 && acc >= 0.85,
    },
    // ── Correct calls ──
    {
      id: "right_once",
      img: imgRightOnce,
      icon: <CheckCircle2 size={18} color="#22c55e" />,
      name: "Right Once",
      requirement: "Get 1 correct prediction",
      unlocked: correct >= 1,
    },
    {
      id: "double_digit",
      img: imgDoubleDigit,
      icon: <Target size={18} color="#14b8a6" />,
      name: "Double Digit",
      requirement: "Get 10 correct predictions",
      unlocked: correct >= 10,
    },
    {
      id: "think_tank",
      img: imgThinkTank,
      icon: <Target size={18} color="#6366f1" />,
      name: "Think Tank",
      requirement: "Get 25 correct predictions",
      unlocked: correct >= 25,
    },
    {
      id: "half_century",
      img: imgHalfCentury,
      icon: <Target size={18} color="#ec4899" />,
      name: "Half Century",
      requirement: "Get 50 correct predictions",
      unlocked: correct >= 50,
    },
    // ── Tiers ──
    {
      id: "rookie",
      img: imgRookie,
      icon: <Target size={18} color="#84cc16" />,
      name: "Rookie",
      requirement: "Join Oro — you're already here!",
      unlocked: true,
    },
    {
      id: "sharpshooter",
      img: imgSharpshooter,
      icon: <Swords size={18} color="#3b82f6" />,
      name: "Sharpshooter",
      requirement: "Reach Sharpshooter tier",
      unlocked: ["sharpshooter", "hot_hand", "legend"].includes(tier),
    },
    {
      id: "hot_hand",
      img: imgHotHand,
      icon: <Target size={18} color="#ef4444" />,
      name: "Hot Hand",
      requirement: "Reach Hot Hand tier",
      unlocked: ["hot_hand", "legend"].includes(tier),
    },
    {
      id: "legend",
      img: imgLegend,
      icon: <Target size={18} color="#f59e0b" />,
      name: "Legend",
      requirement: "Reach Legend tier",
      unlocked: tier === "legend",
    },
    // ── Profile ──
    {
      id: "verified",
      img: imgVerified,
      icon: <Target size={18} color="#6366f1" />,
      name: "Verified",
      requirement: "Verify your phone via Oro bot",
      unlocked: hasPhone,
    },
    {
      id: "bankrolled",
      img: imgBankrolled,
      icon: <Target size={18} color="#0ea5e9" />,
      name: "Bankrolled",
      requirement: "Link your DK Bank account",
      unlocked: hasDK,
    },
    {
      id: "connected",
      img: imgConnected,
      icon: <Target size={18} color="#10b981" />,
      name: "Connected",
      requirement: "Link both phone and DK Bank",
      unlocked: hasPhone && hasDK,
    },
    {
      id: "high_score",
      img: imgHighScore,
      icon: <Target size={18} color="#f59e0b" />,
      name: "High Score",
      requirement: "Reach 70%+ reputation score",
      unlocked: score >= 0.7,
    },
    // ── Referrals ──
    {
      id: "ref_5",
      img: imgConnector,
      icon: <Target size={18} color="#22c55e" />,
      name: "Connector",
      requirement: "Refer 5 friends to Oro",
      unlocked: referrals >= 5,
    },
    {
      id: "ref_50",
      img: imgAmbassador,
      icon: <Target size={18} color="#3b82f6" />,
      name: "Ambassador",
      requirement: "Refer 50 friends to Oro",
      unlocked: referrals >= 50,
    },
    {
      id: "ref_100",
      img: imgInfluencer,
      icon: <Target size={18} color="#a855f7" />,
      name: "Influencer",
      requirement: "Refer 100 friends to Oro",
      unlocked: referrals >= 100,
    },
    // ── The impossible one ──
    {
      id: "ref_1000",
      img: imgKingmaker,
      icon: <Target size={20} color="#fff" />,
      name: "Kingmaker",
      requirement:
        "Refer 1,000 friends — unlocks an animated golden ring on your leaderboard profile",
      unlocked: referrals >= 1000,
      legendary: true,
    },
    // ── Duels ──
    {
      id: "duel_challenger",
      img: imgChallenger,
      icon: <Swords size={18} color="#f59e0b" />,
      name: "Challenger",
      requirement: "Get your 1st correct prediction",
      unlocked: correct >= 1,
    },
    {
      id: "duel_on_fire",
      img: imgOnFire,
      icon: <Target size={18} color="#f97316" />,
      name: "On Fire",
      requirement: "Get 3 correct predictions",
      unlocked: correct >= 3,
    },
    {
      id: "duel_master",
      img: imgDuelMaster,
      icon: <Target size={18} color="#eab308" />,
      name: "Duel Master",
      requirement: "Get 5 correct predictions",
      unlocked: correct >= 5,
    },
    {
      id: "duel_sharp",
      img: imgDeadEye,
      icon: <Target size={18} color="#22c55e" />,
      name: "Dead-Eye",
      requirement: "Get 10 correct predictions",
      unlocked: correct >= 10,
    },
    {
      id: "duel_pack",
      img: imgPackLeader,
      icon: <Target size={18} color="#3b82f6" />,
      name: "Pack Leader",
      requirement: "Make 25 total predictions",
      unlocked: total >= 25,
    },
    {
      id: "duel_oracle",
      img: imgDuelOracle,
      icon: <Target size={18} color="#a855f7" />,
      name: "Duel Oracle",
      requirement: "Get 25 correct predictions",
      unlocked: correct >= 25,
    },
    // ── Season events (per competition, per season) ──
    {
      id: "epl_season_2026_27",
      img: imgEplSeason,
      icon: <Medal size={18} color="#37003c" />,
      name: "Premier League 2026/27",
      requirement:
        "Win 60%+ of 15+ Premier League predictions in the 2026/27 season",
      unlocked: eplSeasonUnlocked,
    },
    {
      id: "ucl_season_2026_27",
      img: imgUclSeason,
      icon: <Medal size={18} color="#1e3a8a" />,
      name: "Champions League 2026/27",
      requirement:
        "Win 60%+ of 15+ Champions League predictions in the 2026/27 season",
      unlocked: uclSeasonUnlocked,
    },
    // ── Monthly leaderboard podium (earned by finishing top-3 in a month) ──
    {
      id: "monthly_champion",
      icon: <Crown size={24} color="#7c4a03" fill="#fde68a" />,
      name: "Monthly Champion",
      requirement: "Finish #1 on the monthly leaderboard",
      unlocked: golds > 0,
      count: golds,
      tint: "radial-gradient(circle at 32% 28%, #fef3c7, #fbbf24 45%, #b45309)",
    },
    {
      id: "monthly_runner_up",
      icon: <Medal size={24} color="#475569" fill="#f1f5f9" />,
      name: "Monthly Runner-Up",
      requirement: "Finish #2 on the monthly leaderboard",
      unlocked: silvers > 0,
      count: silvers,
      tint: "radial-gradient(circle at 32% 28%, #f8fafc, #cbd5e1 45%, #64748b)",
    },
    {
      id: "monthly_third",
      icon: <Medal size={24} color="#5b2c0d" fill="#f5cfa8" />,
      name: "Monthly Third",
      requirement: "Finish #3 on the monthly leaderboard",
      unlocked: bronzes > 0,
      count: bronzes,
      tint: "radial-gradient(circle at 32% 28%, #f3d3b3, #d08b52 45%, #8a5327)",
    },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BadgeGridProps {
  totalPredictions: number;
  correctPredictions: number;
  reputationTier: string;
  reputationScore: number;
  hasPhone: boolean;
  hasDKBank: boolean;
  /** Total accepted referrals — requires backend field `referralCount` on AuthUser */
  referralCount?: number;
  /** Season EPL/UCL tallies from `seasonBadgeStats["2026-27"]` (season badges). */
  seasonStats?: SeasonBadgeStats;
  /** Monthly leaderboard podium counts from `monthlyPodiumStats`. */
  podiumStats?: MonthlyPodiumStats;
  featuredIds?: string[];
  onToggleFeatured?: (id: string) => void;
}

export function BadgeGrid({
  totalPredictions,
  correctPredictions,
  reputationTier,
  reputationScore,
  hasPhone,
  hasDKBank,
  referralCount = 0,
  seasonStats,
  podiumStats,
  featuredIds = [],
  onToggleFeatured,
}: BadgeGridProps) {
  const badges = buildBadges(
    totalPredictions,
    correctPredictions,
    reputationTier,
    reputationScore,
    hasPhone,
    hasDKBank,
    referralCount,
    seasonStats,
    podiumStats,
  );

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const total = badges.length;
  const [tapped, setTapped] = useState<string | null>(null);

  return (
    // Dismiss tooltip when tapping outside
    <div onClick={() => setTapped(null)}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Medal size={16} color="#f59e0b" />
          <span
            style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)" }}
          >
            Collectibles
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: unlockedCount > 0 ? "#f59e0b" : "var(--text-subtle)",
            background:
              unlockedCount > 0
                ? "rgba(245,158,11,0.12)"
                : "var(--bg-secondary)",
            padding: "2px 10px",
            borderRadius: 99,
          }}
        >
          {unlockedCount}/{total} unlocked
        </span>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10,
          overflow: "visible",
        }}
      >
        {badges.map((b) => (
          <div
            key={b.id}
            onClick={(e) => {
              e.stopPropagation();
              if (b.unlocked && onToggleFeatured) onToggleFeatured(b.id); else setTapped((prev) => (prev === b.id ? null : b.id));
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              position: "relative",
            }}
          >
            {/* Tooltip — shown on tap, always readable regardless of lock state */}
            {tapped === b.id && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: b.legendary
                    ? "linear-gradient(135deg, #1a1a2e, #16213e)"
                    : "#1f2937",
                  border: b.legendary
                    ? "1px solid rgba(255,215,0,0.4)"
                    : "none",
                  color: "#f9fafb",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: 10,
                  zIndex: 20,
                  pointerEvents: "none",
                  boxShadow: b.legendary
                    ? "0 4px 20px rgba(255,215,0,0.25)"
                    : "0 4px 16px rgba(0,0,0,0.5)",
                  textAlign: "center",
                  width: 160,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    marginBottom: 3,
                    color: b.legendary ? "#ffd700" : "#fff",
                  }}
                >
                  {b.unlocked ? "✓ " : "🔒 "}
                  {b.name}
                </div>
                <div style={{ opacity: 0.85, fontSize: 10, lineHeight: 1.4 }}>
                  {b.unlocked ? "Unlocked!" : b.requirement}
                </div>
              </div>
            )}

            {/* Icon bubble */}
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: b.legendary ? 14 : 12,
                background: b.legendary
                  ? b.unlocked
                    ? "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)"
                    : "linear-gradient(135deg, #374151, #1f2937)"
                  : b.unlocked
                    ? b.tint && !b.img
                      ? b.tint
                      : "var(--bg-secondary)"
                    : "var(--bg-secondary)",
                border: featuredIds.includes(b.id) ? "2px solid #fbbf24" : b.legendary
                  ? b.unlocked
                    ? "2px solid #ffd700"
                    : "1.5px dashed #4b5563"
                  : b.unlocked
                    ? tapped === b.id
                      ? "1.5px solid #f59e0b"
                      : "1.5px solid #f59e0b44"
                    : "1.5px solid transparent",
                display: "flex",
                position: "relative",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxShadow:
                  featuredIds.includes(b.id)
                    ? "0 0 0 3px rgba(251,191,36,0.22), 0 0 16px rgba(245,158,11,0.5)"
                    : b.legendary && b.unlocked
                    ? "0 0 16px rgba(255,215,0,0.5)"
                    : b.unlocked
                      ? "0 0 8px rgba(245,158,11,0.18)"
                      : "none",
                opacity: b.unlocked ? 1 : 0.45,
                filter: b.unlocked ? "none" : "grayscale(0.7)",
                transition: "all 0.15s",
                animation:
                  b.legendary && b.unlocked
                    ? "legendaryPulse 2.5s ease-in-out infinite"
                    : "none",
              }}
            >
              {b.unlocked ? (
                b.img ? (
                  <img
                    src={b.img}
                    alt={b.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  b.icon
                )
              ) : (
                <Lock size={14} color="#6b7280" />
              )}
              {featuredIds.includes(b.id) && <span style={{ position: "absolute", right: 2, bottom: 2, width: 15, height: 15, borderRadius: "50%", background: "#fbbf24", color: "#111827", fontSize: 11, fontWeight: 900, lineHeight: "15px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.5)" }}>✓</span>}
              {b.unlocked && (b.count ?? 0) > 1 && <span style={{ position: "absolute", right: 1, top: 1, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "#111827", color: "#fbbf24", fontSize: 10, fontWeight: 900, lineHeight: "15px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.5)" }}>×{b.count}</span>}
            </div>

            {/* Name — always readable, not faded out */}
            <span
              style={{
                fontSize: 9,
                fontWeight: b.legendary ? 800 : 600,
                color:
                  b.legendary && b.unlocked
                    ? "#f59e0b"
                    : tapped === b.id
                      ? "var(--text-main)"
                      : "var(--text-subtle)",
                textAlign: "center",
                lineHeight: 1.2,
                maxWidth: 44,
                transition: "color 0.15s",
              }}
            >
              {b.name}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes legendaryPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(255,215,0,0.4); }
          50%       { box-shadow: 0 0 22px rgba(255,215,0,0.75); }
        }
      `}</style>
    </div>
  );
}

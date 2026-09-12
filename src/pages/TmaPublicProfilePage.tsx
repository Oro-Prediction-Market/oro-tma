import { type ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  ChevronRight,
  Target,
  Trophy,
} from "lucide-react";
import { SAVED_ACCENT } from "@shared/components/SaveMarketButton";
import { Page } from "@/components/Page";
import { LoadingScreen } from "@shared/components/LoadingScreen";
import { getPublicProfile, avatarFallback, type PublicProfile } from "@shared/api/client";
import {
  buildBadges,
  CURRENT_FOOTBALL_SEASON,
  type CollectibleBadge,
} from "@/components/BadgeGrid";
import { tierMeta } from "@shared/reputation/tiers";

export function TmaPublicProfilePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    getPublicProfile(id)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [id]);

  if (!profile) return <LoadingScreen message="Loading predictor..." />;

  const name = profile.username
    ? `@${profile.username}`
    : `${profile.firstName ?? "Predictor"}${profile.lastName ? ` ${profile.lastName}` : ""}`;
  const badges = getFeaturedBadges(profile);
  const statCards = getStatCards(profile, () =>
    navigate(`/saved/${profile.id}`),
  );

  return (
    <Page>
      <main style={{ padding: "16px 16px 30px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: 0,
            padding: "4px 0",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 7,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={16} />
          Back to leaderboard
        </button>

        <section
          style={{
            padding: 20,
            borderRadius: 24,
            background:
              "radial-gradient(circle at 18% 14%, rgba(57,229,141,0.13), transparent 28%), radial-gradient(circle at 88% 8%, rgba(155,92,255,0.22), transparent 32%), linear-gradient(135deg,#2852ce,#121d42)",
            border: "1px solid rgba(115,160,255,.42)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                overflow: "hidden",
                background: "linear-gradient(135deg,#75d6ff,#2e9ce8)",
                display: "grid",
                placeItems: "center",
                fontSize: 23,
                fontWeight: 900,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  onError={avatarFallback(profile.id)}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 20,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </h1>
              {/* Was `Trophy {tier.replace("_"," ")}` — the icon had been typed
                  as bare text, so the tier read "Trophy Prophet", and the raw
                  column value under textTransform:capitalize turned hot_hand
                  into "Hot hand". tierMeta is the same source the badges and
                  leaderboard use, so a tier now looks identical everywhere. */}
              {(() => {
                const tier = tierMeta(profile.reputationTier);
                return (
                  <b
                    style={{
                      fontSize: 11,
                      color: tier.color,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <tier.Icon size={12} />
                    {tier.label}
                  </b>
                );
              })()}
            </div>
          </div>

          {badges.length > 0 && <SignatureCrest badges={badges} />}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              borderTop: "1px solid rgba(255,255,255,.2)",
              marginTop: 18,
              paddingTop: 13,
            }}
          >
            <Metric label="Win rate" value={`${profile.winRate}%`} color="#44e59b" />
            <Metric label="Predictions" value={String(profile.totalPredictions)} />
            <Metric
              label="Insight score"
              value={String(Math.round((profile.reputationScore ?? 0) * 100))}
              color="#fbbf24"
            />
          </div>
        </section>

        {/* One card per row on a phone, two once there is room for them.
            Side by side on a 390px screen each tile got ~175px, which wrapped
            "Saved Markets" onto two lines and cut its subtitle off mid-word.

            A media query rather than auto-fit/minmax: this page has no
            max-width wrapper, so on a wide Telegram Desktop window auto-fit
            would happily lay out a THIRD column. 640px is the breakpoint the
            own-profile grid already uses. */}
        <style>{`
          .pub-stat-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-top: 14px;
          }
          @media (min-width: 640px) {
            .pub-stat-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          }
        `}</style>
        <div className="pub-stat-grid">
          {statCards.map((card) => (
            <CompactStatCard key={card.title} {...card} />
          ))}
        </div>
      </main>
    </Page>
  );
}

function getFeaturedBadges(profile: PublicProfile) {
  const featuredIds = profile.featuredAchievementIds ?? [];
  const badges = buildBadges(
    profile.totalPredictions,
    profile.correctPredictions,
    profile.reputationTier,
    Number(profile.reputationScore ?? 0),
    false,
    false,
    0,
    profile.seasonBadgeStats?.[CURRENT_FOOTBALL_SEASON],
    profile.monthlyPodiumStats,
  ).filter((badge) => featuredIds.includes(badge.id));

  const priority = ["duel_oracle", "duel_master", "duel_on_fire"];
  return [...badges].sort((a, b) => {
    const aRank = priority.includes(a.id) ? priority.indexOf(a.id) : priority.length;
    const bRank = priority.includes(b.id) ? priority.indexOf(b.id) : priority.length;
    return aRank - bRank;
  });
}

function getStatCards(
  profile: PublicProfile,
  onOpenSaved: () => void,
) {
  return [
    ...((profile.betStreak ?? 0) > 0
      ? [
          {
            icon: <CalendarDays size={14} />,
            title: `${profile.betStreak}-day bet streak`,
            text: "Consecutive days betting",
            color: "#38bdf8",
            bg: "rgba(56,189,248,.14)",
          },
        ]
      : []),
    {
      icon: <Target size={14} />,
      title: "Sharp calls",
      text: `${profile.winRate}% resolved accuracy`,
      color: "#44e59b",
      bg: "rgba(57,229,141,.13)",
    },
    ...(profile.contrarianBadge
      ? [
          {
            icon: <Trophy size={14} />,
            title: "Crowd breaker",
            text: `${profile.contrarianWins} contrarian wins`,
            color: "#fbbf24",
            bg: "rgba(247,185,40,.14)",
          },
        ]
      : []),
    ...(profile.recentCalls?.[0]
      ? [
          {
            icon: <Target size={14} />,
            title: `Last call: ${profile.recentCalls[0].status}`,
            text: profile.recentCalls[0].outcomeLabel,
            color:
              profile.recentCalls[0].status === "won"
                ? "#22c55e"
                : profile.recentCalls[0].status === "lost"
                  ? "#f87171"
                  : "#fbbf24",
            bg: "rgba(248,113,113,.14)",
          },
        ]
      : []),
    // Last, so it fills whichever slot the optional cards above leave free
    // rather than pushing them around. The only tile that goes anywhere.
    {
      icon: <Bookmark size={14} />,
      title: "Saved Markets",
      // Kept short so it survives the one-line ellipsis on a phone, where
      // "N markets they are watching" truncated mid-phrase.
      text: profile.savedMarketCount
        ? `Watching ${profile.savedMarketCount} market${profile.savedMarketCount === 1 ? "" : "s"}`
        : "Nothing saved yet",
      color: SAVED_ACCENT,
      bg: "rgba(6,182,212,.14)",
      onClick: onOpenSaved,
    },
  ];
}

function Metric({
  label,
  value,
  color = "white",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          color: "#a9badf",
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <b style={{ fontSize: 17, color }}>{value}</b>
    </div>
  );
}

function SignatureCrest({ badges }: { badges: CollectibleBadge[] }) {
  return (
    <section
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 18,
        padding: 10,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.13)",
        background: "rgba(3,7,18,0.22)",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {badges.slice(0, 3).map((badge) => (
          <div
            key={badge.id}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              background: badge.tint && !badge.img ? badge.tint : "var(--bg-secondary)",
              border: `1.5px solid ${badge.legendary ? "rgba(255,215,0,0.8)" : "rgba(245,158,11,0.68)"}`,
              boxShadow: badge.legendary ? "0 0 16px rgba(255,215,0,0.5)" : "0 0 8px rgba(245,158,11,0.18)",
            }}
          >
            {badge.img ? (
              <img src={badge.img} alt={badge.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              badge.icon
            )}
            {(badge.count ?? 0) > 1 && (
              <span style={{ position: "absolute", right: 1, top: 1, minWidth: 14, height: 14, padding: "0 3px", borderRadius: 7, background: "#111827", color: "#fbbf24", fontSize: 9, fontWeight: 900, lineHeight: "14px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.5)" }}>
                ×{badge.count}
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>
          Featured collectibles
        </div>
        <div style={{ marginTop: 3, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.62)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {badges.slice(0, 3).map((badge) => badge.name).join(", ")}
        </div>
      </div>
    </section>
  );
}

/**
 * One tile in the profile's stat grid.
 *
 * Renders as a button when it has somewhere to go — the saved-markets tile is
 * the only one that does — so a tappable card keeps the exact border, padding
 * and icon of the cards beside it instead of being a lookalike that drifts.
 */
function CompactStatCard({
  icon,
  title,
  text,
  color,
  bg,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  color: string;
  bg: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "section";
  return (
    <Tag
      onClick={onClick}
      style={{
        minHeight: 74,
        padding: 11,
        borderRadius: 14,
        border: `1px solid ${color}55`,
        background: "var(--bg-card)",
        display: "grid",
        gridTemplateColumns: onClick
          ? "28px minmax(0,1fr) 14px"
          : "28px minmax(0,1fr)",
        gap: 9,
        alignItems: "center",
        width: "100%",
        textAlign: "left",
        font: "inherit",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 10,
          background: bg,
          color,
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <strong
          style={{
            display: "block",
            color: "var(--text-main)",
            fontSize: 12,
            lineHeight: 1.15,
          }}
        >
          {title}
        </strong>
        <span
          style={{
            display: "block",
            marginTop: 3,
            color: "var(--text-muted)",
            fontSize: 10,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
      </div>
      {onClick && <ChevronRight size={14} color="var(--text-subtle)" />}
    </Tag>
  );
}

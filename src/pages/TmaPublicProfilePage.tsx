import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Target, Trophy } from "lucide-react";
import { Page } from "@/components/Page";
import { LoadingScreen } from "@shared/components/LoadingScreen";
import { getPublicProfile, avatarFallback, type PublicProfile } from "@shared/api/client";
import {
  buildBadges,
  CURRENT_FOOTBALL_SEASON,
  type CollectibleBadge,
} from "@/components/BadgeGrid";

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
  const statCards = getStatCards(profile);

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
              <b
                style={{
                  fontSize: 11,
                  color: "#fbbf24",
                  textTransform: "capitalize",
                }}
              >
                Trophy {profile.reputationTier.replace("_", " ")}
              </b>
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2,minmax(0,1fr))",
            gap: 10,
            marginTop: 14,
          }}
        >
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
  ).filter((badge) => featuredIds.includes(badge.id));

  const priority = ["duel_oracle", "duel_master", "duel_on_fire"];
  return [...badges].sort((a, b) => {
    const aRank = priority.includes(a.id) ? priority.indexOf(a.id) : priority.length;
    const bRank = priority.includes(b.id) ? priority.indexOf(b.id) : priority.length;
    return aRank - bRank;
  });
}

function getStatCards(profile: PublicProfile) {
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
  const [main, ...supporting] = badges;

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 104px",
        gap: 16,
        alignItems: "center",
        marginTop: 18,
        padding: 14,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.13)",
        background: "rgba(3,7,18,0.22)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: "#fbbf24",
            fontSize: 10,
            fontWeight: 900,
            textTransform: "uppercase",
          }}
        >
          Signature badge
        </div>
        <h2 style={{ margin: "5px 0 0", fontSize: 18, lineHeight: 1.1 }}>
          {main.name}
        </h2>
        <p
          style={{
            margin: "7px 0 0",
            color: "rgba(255,255,255,0.66)",
            fontSize: 11,
            lineHeight: 1.35,
          }}
        >
          {supporting.length > 0
            ? `Backed by ${supporting.map((badge) => badge.name).join(" and ")}.`
            : main.requirement}
        </p>
      </div>
      <div style={{ position: "relative", width: 104, height: 112 }}>
        {supporting.slice(0, 2).map((badge, index) => (
          <BadgeFrame
            key={badge.id}
            badge={badge}
            size={34}
            style={{
              position: "absolute",
              left: 2,
              top: index === 0 ? 10 : undefined,
              bottom: index === 1 ? 6 : undefined,
              zIndex: 1,
            }}
          />
        ))}
        <BadgeFrame
          badge={main}
          size={86}
          style={{ position: "absolute", right: 0, top: 8, zIndex: 2 }}
        />
      </div>
    </section>
  );
}

function BadgeFrame({
  badge,
  size,
  style,
}: {
  badge: CollectibleBadge;
  size: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size > 60 ? 24 : 11,
        padding: size > 60 ? 7 : 3,
        background: "#050812",
        border: `1.5px solid ${badgeBorderColor(badge.id)}`,
        boxShadow: "0 12px 26px rgba(0,0,0,0.32)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        ...style,
      }}
    >
      {badge.img ? (
        <img
          src={badge.img}
          alt={badge.name}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        badge.icon
      )}
    </div>
  );
}

function badgeBorderColor(id: string) {
  if (id === "duel_on_fire") return "rgba(249,115,22,.78)";
  if (id === "duel_oracle") return "rgba(155,92,255,.78)";
  return "rgba(247,185,40,.68)";
}

function CompactStatCard({
  icon,
  title,
  text,
  color,
  bg,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  color: string;
  bg: string;
}) {
  return (
    <section
      style={{
        minHeight: 74,
        padding: 11,
        borderRadius: 14,
        border: `1px solid ${color}55`,
        background: "var(--bg-card)",
        display: "grid",
        gridTemplateColumns: "28px minmax(0,1fr)",
        gap: 9,
        alignItems: "center",
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
    </section>
  );
}

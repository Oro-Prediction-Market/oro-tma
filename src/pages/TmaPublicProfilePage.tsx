import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Flame, Target, Trophy } from "lucide-react";
import { Page } from "@/components/Page";
import { LoadingScreen } from "@shared/components/LoadingScreen";
import { getPublicProfile, type PublicProfile } from "@shared/api/client";
import { buildBadges } from "@/components/BadgeGrid";

export function TmaPublicProfilePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => { getPublicProfile(id).then(setProfile).catch(() => setProfile(null)); }, [id]);
  if (!profile) return <LoadingScreen message="Loading predictor…" />;

  const name = profile.username ? `@${profile.username}` : `${profile.firstName ?? "Predictor"}${profile.lastName ? ` ${profile.lastName}` : ""}`;
  const badges = buildBadges(profile.totalPredictions, profile.correctPredictions, profile.reputationTier, Number(profile.reputationScore ?? 0), false, false, 0).filter((badge) => profile.featuredAchievementIds?.includes(badge.id));
  const cards = [
    { icon: <Flame />, title: `${profile.streak}-day prediction streak`, text: "Keep the calls coming.", color: "#f97316" },
    { icon: <Target />, title: `${profile.correctPredictions} correct predictions`, text: `${profile.winRate}% accuracy across resolved markets.`, color: "#24c77b" },
    ...(profile.contrarianBadge ? [{ icon: <Trophy />, title: `${profile.contrarianBadge} Contrarian`, text: `${profile.contrarianWins} against-the-crowd wins.`, color: "#fbbf24" }] : []),
    ...(profile.recentCalls?.[0] ? [{ icon: <Target />, title: "Latest call", text: `${profile.recentCalls[0].outcomeLabel} · ${profile.recentCalls[0].status}`, color: profile.recentCalls[0].status === "won" ? "#22c55e" : profile.recentCalls[0].status === "lost" ? "#f87171" : "#fbbf24" }] : []),
  ];

  return <Page><main style={{ padding: "16px 16px 30px" }}>
    <button onClick={() => navigate(-1)} style={{ background: "none", border: 0, padding: "4px 0", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 7, cursor: "pointer", marginBottom: 16 }}><ArrowLeft size={16} />Back to leaderboard</button>
    <section style={{ padding: 20, borderRadius: 24, background: "linear-gradient(120deg,#2852ce,#121d42)", border: "1px solid rgba(115,160,255,.42)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}><div style={{ width: 58, height: 58, borderRadius: "50%", overflow: "hidden", background: "#61c46b", display: "grid", placeItems: "center", fontSize: 23, fontWeight: 900 }}>{profile.photoUrl ? <img src={profile.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : name[0]}</div><div><h1 style={{ margin: 0, fontSize: 20 }}>{name}</h1><b style={{ fontSize: 11, color: "#fbbf24", textTransform: "capitalize" }}>🏆 {profile.reputationTier.replace("_", " ")}</b></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: "1px solid rgba(255,255,255,.2)", marginTop: 18, paddingTop: 13 }}>{[["Win rate", `${profile.winRate}%`, "#44e59b"], ["Predictions", String(profile.totalPredictions), "white"], ["Insight score", String(Math.round((profile.reputationScore ?? 0) * 100)), "#fbbf24"]].map(([label, value, color]) => <div key={label}><div style={{ fontSize: 9, textTransform: "uppercase", color: "#a9badf", fontWeight: 800 }}>{label}</div><b style={{ fontSize: 17, color }}>{value}</b></div>)}</div>
    </section>
    {badges.length > 0 && <section style={{ marginTop: 14, padding: "8px 10px", borderRadius: 13, background: "var(--bg-card)", border: "1px solid var(--glass-border)" }}><div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(badges.length, 3)}, minmax(0,1fr))`, gap: 6 }}>{badges.map((badge) => <div key={badge.id} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, lineHeight: 1.1 }}><div style={{ width: 50, height: 50, padding: 3, margin: "auto", borderRadius: 15, background: "#0a101b", border: "2px solid rgba(177,128,79,.72)" }}>{badge.img ? <img src={badge.img} alt={badge.name} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", borderRadius: 10 }} /> : "🏆"}</div><div style={{ marginTop: 4 }}>{badge.name}</div></div>)}</div></section>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 14 }}>{cards.map((card) => <section key={card.title} style={{ minHeight: 94, padding: 13, borderRadius: 15, border: `1px solid ${card.color}55`, background: "var(--bg-card)" }}><div style={{ color: card.color }}>{card.icon}</div><b style={{ display: "block", marginTop: 8, fontSize: 13, lineHeight: 1.2 }}>{card.title}</b><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.25 }}>{card.text}</div></section>)}</div>
  </main></Page>;
}

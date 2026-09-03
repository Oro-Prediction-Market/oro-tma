import { useEffect, useState } from "react";
import { X, Trophy, Target } from "lucide-react";
import { getPublicProfile, avatarFallback, type PublicProfile } from "@shared/api/client";
import { buildBadges, CURRENT_FOOTBALL_SEASON } from "@/components/BadgeGrid";

export function PublicProfileDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    if (!userId) return;
    setProfile(null);
    getPublicProfile(userId).then(setProfile).catch(() => setProfile(null));
  }, [userId]);

  if (!userId) return null;
  const name = profile?.username ? `@${profile.username}` : `${profile?.firstName ?? "Predictor"}${profile?.lastName ? ` ${profile.lastName}` : ""}`;
  const badges = profile && buildBadges(profile.totalPredictions, profile.correctPredictions, profile.reputationTier, Number(profile.reputationScore ?? 0), false, false, 0, profile.seasonBadgeStats?.[CURRENT_FOOTBALL_SEASON], profile.monthlyPodiumStats);

  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center", padding: 16 }}>
    <div onClick={(event) => event.stopPropagation()} style={{ width: "min(390px,100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "linear-gradient(145deg,#182235,#0d1421)", border: "1px solid var(--glass-border)", borderRadius: 22, padding: 22, position: "relative" }}>
      <button onClick={onClose} style={{ position: "absolute", right: 12, top: 12, background: "none", border: 0, color: "var(--text-muted)" }}><X size={20} /></button>
      {!profile ? <div style={{ padding: 40, textAlign: "center" }}>Loading predictor…</div> : <>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 58, height: 58, borderRadius: "50%", overflow: "hidden", background: "var(--bg-secondary)", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 21 }}>{profile.photoUrl ? <img src={profile.photoUrl} onError={avatarFallback(profile.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : name[0]}</div>
          <div><b style={{ fontSize: 19 }}>{name}</b><div style={{ color: "var(--color-primary)", fontSize: 11, textTransform: "uppercase", fontWeight: 800 }}>{profile.reputationTier.replace("_", " ")} predictor</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 20 }}>{[[<Trophy size={14} />, "Rank", profile.rank ? `#${profile.rank}` : "—"], [<Target size={14} />, "Win rate", `${profile.winRate}%`]].map(([icon, label, value]) =><div key={String(label)} style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,.05)", textAlign: "center" }}><div style={{ color: "var(--color-primary)" }}>{icon}</div><b>{value}</b><div style={{ fontSize: 9, color: "var(--text-subtle)", textTransform: "uppercase" }}>{label}</div></div>)}</div>
        <div style={{ marginTop: 14, fontSize: 13, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}><span>Predictions</span><b style={{ color: "var(--text-main)" }}>{profile.correctPredictions} / {profile.totalPredictions} correct</b></div>
        {!!profile.featuredAchievementIds?.length && <section style={{ marginTop: 18, padding: "8px 10px", borderRadius: 13, background: "var(--bg-card)", border: "1px solid var(--glass-border)" }}><div style={{ fontSize: 9, fontWeight: 800, color: "#f59e0b", textTransform: "uppercase" }}>Featured achievements</div><div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(profile.featuredAchievementIds.length, 3)}, minmax(0, 1fr))`, gap: 6, marginTop: 7 }}>{profile.featuredAchievementIds.map((id) => { const badge = badges?.find((item) => item.id === id); return <div key={id} style={{ width: "100%", textAlign: "center", fontSize: 8, fontWeight: 700, lineHeight: 1.1, color: "var(--text-main)" }}><div style={{ position: "relative", width: 50, height: 50, margin: "auto", padding: badge?.tint && !badge?.img ? 0 : 3, borderRadius: 15, overflow: "hidden", background: badge?.tint && !badge?.img ? badge.tint : "#0a101b", border: "2px solid rgba(177,128,79,.72)", boxShadow: "0 3px 10px rgba(0,0,0,.32)" }}>{badge?.img ? <img src={badge.img} alt={badge.name} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", borderRadius: 10 }} /> : <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: 26 }}>{badge?.icon ?? "🏆"}</div>}{(badge?.count ?? 0) > 1 && <span style={{ position: "absolute", right: 2, top: 2, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "#111827", color: "#fbbf24", fontSize: 9, fontWeight: 900, lineHeight: "15px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.5)" }}>×{badge?.count}</span>}</div><div style={{ marginTop: 4 }}>{badge?.name ?? id.replace(/_/g, " ")}</div></div>; })}</div></section>}
      </>}
    </div>
  </div>;
}

import { FC, useEffect, useState } from "react";
import {
  getMyNotifications,
  markNotificationsSeen,
  type UserNotification,
} from "@shared/api/client";

/**
 * On app open, fetches the user's unseen in-app notifications and shows each as
 * a celebratory modal (one at a time). Dismissing marks it seen so it never
 * pops again. System-generated only for now (e.g. season prize wins). Degrades
 * silently if the endpoint isn't available yet.
 */
export const SystemNotificationModal: FC = () => {
  const [queue, setQueue] = useState<UserNotification[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMyNotifications()
      .then((list) => {
        // Achievement badges have their own dedicated popup on the profile
        // page, so this generic modal only handles the rest (e.g. prizes).
        const shown = list.filter((n) => n.type !== "achievement");
        if (!cancelled && shown.length) setQueue(shown);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const current = queue[index];
  if (!current) return null;

  const isPrize = current.type === "season_prize";
  const accent = isPrize ? "#f5a623" : "#3b82f6";
  const emoji = isPrize ? "🏆" : "🔔";
  const remaining = queue.length - index;

  const dismiss = () => {
    markNotificationsSeen([current.id]).catch(() => {});
    setIndex((i) => i + 1);
  };

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 4000,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          borderRadius: 22,
          padding: "28px 22px 22px",
          background: "linear-gradient(160deg, #131c31, #0b1120)",
          border: `1px solid ${accent}44`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px ${accent}22`,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Tier glow behind the icon */}
        <div
          style={{
            position: "absolute",
            top: -60,
            left: "50%",
            transform: "translateX(-50%)",
            width: 220,
            height: 220,
            background: `radial-gradient(circle, ${accent}33, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            fontSize: 52,
            lineHeight: 1,
            marginBottom: 12,
            filter: `drop-shadow(0 6px 16px ${accent}66)`,
          }}
        >
          {emoji}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "#fff",
            marginBottom: 8,
            lineHeight: 1.25,
          }}
        >
          {current.title}
        </div>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.72)",
            marginBottom: 22,
            whiteSpace: "pre-line",
          }}
        >
          {current.body}
        </div>
        <button
          onClick={dismiss}
          style={{
            width: "100%",
            padding: "13px 0",
            borderRadius: 14,
            border: "none",
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            color: "#0b0f17",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: `0 8px 22px ${accent}44`,
          }}
        >
          {remaining > 1 ? "Next" : "Got it 🎉"}
        </button>
        {queue.length > 1 && (
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {index + 1} of {queue.length}
          </div>
        )}
      </div>
    </div>
  );
};

import { FC } from "react";
import { Share, Send, Trophy, Sparkles, TrendingDown } from "lucide-react";
import { useAuth } from "@shared/hooks/useAuth";
import { trackEvent } from "@shared/api/client";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}

interface ShareCTAProps {
  type: "win" | "lose" | "predict" | "profile";
  amount?: number;
  marketTitle?: string;
  reputation?: string;
}

export const ShareCTA: FC<ShareCTAProps> = ({
  type,
  amount,
  marketTitle,
  reputation,
}) => {
  const { user } = useAuth();

  const botUsername = "OroPredictBot";
  const refLink = `https://t.me/${botUsername}?startapp=ref_${user?.telegramId || user?.id || ""}`;

  const handleShare = () => {
    trackEvent({ eventType: "share.tap", platform: "tma", meta: { context: type } });
    let shareText = "";

    if (type === "win") {
      shareText = `🔥 Just bagged Nu ${amount?.toLocaleString() || "some money"} on Oro! 💸\n\nMarket: "${marketTitle}"\n\nThink you can predict better? Prove it 👇\n${refLink}`;
    } else if (type === "lose") {
      shareText = `📊 Missed this one — "${marketTitle}"\n\nThink you can call it better? Come prove it on Oro 👇\n${refLink}`;
    } else if (type === "predict") {
      shareText = `🧠 I'm predicting on:\n"${marketTitle}"\n\nLet's see who's got the best foresight. Join the pool 👇\n${refLink}`;
    } else if (type === "profile") {
      const tierLabel =
        reputation === "expert"
          ? "Legend"
          : reputation === "reliable"
            ? "Hot Hand"
            : reputation === "regular"
              ? "Sharpshooter"
              : "Rookie";
      shareText = `🏆 My prediction rank on Oro: ${tierLabel} 👑\n\nCan you beat my stats? Start building your own streak 👇\n${refLink}`;
    }

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(shareText)}`;

    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.glowBg} />

      <div style={styles.content}>
        <div style={styles.iconWrapper}>
          {type === "win" && <Trophy size={20} color="#f59e0b" />}
          {type === "lose" && <TrendingDown size={20} color="#9ca3af" />}
          {type === "predict" && <Sparkles size={20} color="#3b82f6" />}
          {type === "profile" && <Share size={20} color="#10b981" />}
        </div>

        <div style={styles.textSection}>
          <h4 style={styles.title}>
            {type === "win" && "Share Your Win!"}
            {type === "lose" && "Share Your Pick"}
            {type === "predict" && "Share Your Prediction"}
            {type === "profile" && "Challenge Friends"}
          </h4>
          <p style={styles.subtitle}>
            Share via Telegram and earn referral perks
          </p>
        </div>

        <button style={styles.button} onClick={handleShare}>
          <Send size={14} style={{ marginRight: 6 }} />
          Share
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    padding: "16px",
    marginTop: "16px",
    marginBottom: "16px",
    minWidth: "100%",
  },
  glowBg: {
    position: "absolute",
    top: "-50%",
    left: "-50%",
    width: "200%",
    height: "200%",
    background:
      "radial-gradient(circle at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  content: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    zIndex: 1,
  },
  iconWrapper: {
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "12px",
    padding: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  textSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  title: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 800,
    color: "var(--text-main)",
  },
  subtitle: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-subtle)",
  },
  button: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#2775d0",
    color: "#fff",
    border: "none",
    borderRadius: "20px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 0.1s ease, background 0.2s ease",
  },
};

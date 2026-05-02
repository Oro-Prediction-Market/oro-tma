import { FC } from "react";
import { Users } from "lucide-react";

interface ChallengeAFriendProps {
  pickedOutcomeLabel: string;
  opposingOutcomeLabel?: string;
  marketTitle: string;
  marketId: string;
  referralId?: string;
  botUsername?: string;
}

const BOT_USERNAME = "OroPredictBot";

export const ChallengeAFriend: FC<ChallengeAFriendProps> = ({
  pickedOutcomeLabel,
  opposingOutcomeLabel,
  marketTitle,
  marketId,
  referralId,
  botUsername = BOT_USERNAME,
}) => {
  const refLink = `https://t.me/${botUsername}/app?startapp=ref_${referralId ?? ""}_m_${marketId}`;

  // If there's a known opposing outcome, taunt with it; otherwise generic
  const opposingLabel = opposingOutcomeLabel
    ? `Will you bet on **${opposingOutcomeLabel}**?`
    : "Think you can do better?";

  const challengeText = `I just bet on **${pickedOutcomeLabel}** in:\n"${marketTitle}"\n\n${opposingLabel} Prove it 👇\n${refLink}`;

  const handleChallenge = () => {
    // Opens Telegram forward-to-friend sheet
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(challengeText)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <button
      onClick={handleChallenge}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "12px 16px",
        background:
          "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))",
        border: "1px solid rgba(245,158,11,0.35)",
        borderRadius: 12,
        color: "#f59e0b",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: "-0.01em",
        transition: "transform 0.1s ease, opacity 0.15s ease",
      }}
      onMouseDown={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
      }
      onMouseUp={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
      }
    >
      <Users size={15} />
      Challenge a Friend
    </button>
  );
};

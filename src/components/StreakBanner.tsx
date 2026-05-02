import { FC } from "react";
import { Flame, Zap } from "lucide-react";

interface StreakBannerProps {
  /** Current consecutive-day streak count */
  streakCount: number;
  /** Day 1–7 within the current cycle */
  dayInCycle: number;
  /** Days remaining until the 1.2x boost fires */
  nextBoostInDays: number;
  /** Whether the boost was just triggered on this bet */
  boostJustActivated?: boolean;
}

const TOTAL_DAYS = 7;

export const StreakBanner: FC<StreakBannerProps> = ({
  streakCount,
  dayInCycle,
  nextBoostInDays,
  boostJustActivated = false,
}) => {
  if (streakCount === 0) return null;

  const dots = Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const dayNum = i + 1;
    const filled = dayNum <= dayInCycle;
    const isToday = dayNum === dayInCycle;
    const isBoostDay = dayNum === TOTAL_DAYS;
    return { dayNum, filled, isToday, isBoostDay };
  });

  return (
    <div
      style={{
        borderRadius: 14,
        padding: "14px 16px",
        background: boostJustActivated
          ? "linear-gradient(135deg, rgba(245,158,11,0.22), rgba(251,191,36,0.12))"
          : "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.08))",
        border: boostJustActivated
          ? "1px solid rgba(245,158,11,0.5)"
          : "1px solid rgba(239,68,68,0.25)",
        marginTop: 8,
        animation: boostJustActivated
          ? "tmaSuccessPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards"
          : undefined,
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Flame size={16} color={boostJustActivated ? "#f59e0b" : "#ef4444"} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: boostJustActivated ? "#f59e0b" : "#ef4444",
            }}
          >
            {boostJustActivated
              ? "🔥 Day-7 Boost Activated!"
              : `${streakCount}-day streak`}
          </span>
        </div>
        {!boostJustActivated && (
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              fontWeight: 600,
            }}
          >
            {nextBoostInDays === 0
              ? "Boost ready!"
              : `+1.2× in ${nextBoostInDays}d`}
          </span>
        )}
      </div>

      {/* Day dots */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        {dots.map(({ dayNum, filled, isToday, isBoostDay }) => (
          <div
            key={dayNum}
            style={{
              flex: 1,
              height: isBoostDay ? 28 : 22,
              borderRadius: isBoostDay ? 8 : 6,
              background: filled
                ? isBoostDay
                  ? "linear-gradient(135deg, #f59e0b, #fbbf24)"
                  : "linear-gradient(135deg, #ef4444, #f97316)"
                : "rgba(255,255,255,0.07)",
              border: isToday
                ? "2px solid rgba(255,255,255,0.5)"
                : isBoostDay && !filled
                  ? "1.5px dashed rgba(245,158,11,0.5)"
                  : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.3s ease",
              position: "relative",
            }}
            title={isBoostDay ? `Day 7 — 1.2× payout boost` : `Day ${dayNum}`}
          >
            {isBoostDay && (
              <Zap
                size={12}
                color={filled ? "#fff" : "rgba(245,158,11,0.6)"}
                fill={filled ? "#fff" : "none"}
              />
            )}
          </div>
        ))}
      </div>

      {/* Subtitle */}
      {!boostJustActivated && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            lineHeight: 1.4,
          }}
        >
          Bet every day for 7 days and get a{" "}
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>
            1.2× payout boost
          </span>{" "}
          on day 7.
        </p>
      )}
    </div>
  );
};

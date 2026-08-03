import type { DisputeInfo, DisputeSide } from "../../shared/api/client";

/**
 * The bond + side controls for a market's resolution contest.
 * - First objector: types a bond (≥ minBond) and objects.
 * - Everyone after: the bond is fixed (they match the first objector) and they
 *   may either OBJECT (outcome is wrong) or SUPPORT (defend the outcome).
 *
 * Purely presentational — the page owns `bond`/`side` state and the submit.
 */
export interface DisputeContestControls {
  info: DisputeInfo | null;
  bond: number;
  setBond: (n: number) => void;
  side: DisputeSide;
  setSide: (s: DisputeSide) => void;
}

export function DisputeContestFields({
  info,
  bond,
  setBond,
  side,
  setSide,
  accent = "#f59e0b",
  light = false,
}: DisputeContestControls & { accent?: string; light?: boolean }) {
  const bondFixed = !!info?.bondFixed;
  const minBond = info?.minBond ?? 10;
  const required = info?.bondRequired ?? null;
  // The first participant must object — defending is unlocked once an
  // objection exists.
  const canDefend = bondFixed || (info?.objectCount ?? 0) > 0;

  const textMuted = light ? "#78716c" : "rgba(255,255,255,0.55)";
  const label = light ? "#57534e" : "rgba(255,255,255,0.7)";
  const surface = light ? "#fff" : "rgba(255,255,255,0.06)";
  const border = light ? "#e7e5e4" : "rgba(255,255,255,0.14)";

  const pill = (active: boolean, color: string) => ({
    flex: 1,
    padding: "9px 8px",
    borderRadius: 10,
    fontSize: "0.72rem",
    fontWeight: 800 as const,
    border: `1.5px solid ${active ? color : border}`,
    background: active ? color + "22" : surface,
    color: active ? color : textMuted,
    transition: "all .15s",
  });

  const heading = {
    fontSize: "0.68rem",
    fontWeight: 800 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: label,
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Side selector */}
      <div style={{ display: "grid", gap: 6 }}>
        <span style={heading}>Your position</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setSide("object")}
            style={{ ...pill(side === "object", "#f43f5e"), cursor: "pointer" }}
          >
            Outcome is wrong
          </button>
          <button
            type="button"
            onClick={() => canDefend && setSide("support")}
            disabled={!canDefend}
            style={{
              ...pill(side === "support", "#10b981"),
              opacity: canDefend ? 1 : 0.45,
              cursor: canDefend ? "pointer" : "not-allowed",
            }}
          >
            Defend the outcome
          </button>
        </div>
        {!canDefend && (
          <span style={{ fontSize: "0.66rem", color: textMuted }}>
            You can defend the outcome only after someone has objected.
          </span>
        )}
      </div>

      {/* Bond */}
      <div style={{ display: "grid", gap: 6 }}>
        <span style={heading}>{bondFixed ? "Bond (fixed)" : "Your bond"}</span>
        {bondFixed ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: 10,
              background: surface,
              border: `1.5px solid ${border}`,
            }}
          >
            <span
              style={{ fontSize: "0.72rem", color: textMuted, fontWeight: 600 }}
            >
              Everyone matches the first objector
            </span>
            <span style={{ fontSize: "1rem", fontWeight: 900, color: accent }}>
              Nu {(required ?? minBond).toLocaleString()}
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 10,
              background: surface,
              border: `1.5px solid ${border}`,
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: 900, color: accent }}>
              Nu
            </span>
            <input
              type="number"
              min={minBond}
              step={1}
              value={Number.isFinite(bond) ? bond : ""}
              onChange={(e) => setBond(Number(e.target.value))}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "1rem",
                fontWeight: 800,
                color: light ? "#1c1917" : "#fff",
                width: "100%",
              }}
            />
            <span
              style={{
                fontSize: "0.64rem",
                color: textMuted,
                whiteSpace: "nowrap",
              }}
            >
              min {minBond}
            </span>
          </div>
        )}
        {info?.bondNote && (
          <span
            style={{ fontSize: "0.66rem", color: textMuted, lineHeight: 1.5 }}
          >
            {info.bondNote}
          </span>
        )}
      </div>
    </div>
  );
}

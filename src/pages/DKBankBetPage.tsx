import { FC, useState, useEffect } from "react";
import dkBankLogo from "@shared/assets/dk-blue.png";
import { useParams } from "react-router-dom";
import { Placeholder } from "@telegram-apps/telegram-ui";
import { Page } from "@/components/Page";
import { getMarket, placeBet, type Market } from "@shared/api/client";
import { formatNu } from "@shared/api/dkbank";
import { useAuth } from "@shared/hooks/useAuth";
import { DKBankConfirmModal } from "@/components/DKBankConfirmModal";
import config from "@shared/config";
import { LoadingScreen } from "@shared/components/LoadingScreen";

const configMinBet = config.payments.dkBank.minBet;

const QUICK_AMOUNTS_DEFAULT = [100, 200, 500, 1000];
const QUICK_AMOUNTS_TER = [10, 25, 50, 100];

/** Returns true if the user's chosen outcome has an intelligence signal < 50%
 *  — meaning they're going against Expert consensus. */
function isContrarianPick(
  market: Market,
  outcomeId: string | null,
): { isContrarian: boolean; expertPct: number; rawPct: number } {
  if (!outcomeId) return { isContrarian: false, expertPct: 0, rawPct: 0 };
  const outcome = market.outcomes.find((o) => o.id === outcomeId);
  if (!outcome) return { isContrarian: false, expertPct: 0, rawPct: 0 };
  const totalPool = Number(market.totalPool);
  const rawPct =
    totalPool > 0
      ? (Number(outcome.totalBetAmount) / totalPool) * 100
      : 100 / market.outcomes.length;
  // intelligenceProb is the rep-weighted LMSR signal
  const expertPct =
    outcome.intelligenceProb != null ? outcome.intelligenceProb * 100 : rawPct;
  return { isContrarian: expertPct < 50, expertPct, rawPct };
}

export const DKBankBetPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(
    null,
  );
  const [amount, setAmount] = useState("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [betSuccess, setBetSuccess] = useState(false);

  const fetchMarketData = () => {
    if (!id) return;
    getMarket(id)
      .then(setMarket)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMarketData();
  }, [id]);

  const handlePaymentSuccess = async () => {
    if (!selectedOutcomeId || !amount || !market) return;
    if (user) {
      try {
        await placeBet(market.id, {
          outcomeId: selectedOutcomeId,
          amount: parseFloat(amount),
        });
        window.dispatchEvent(new CustomEvent("oro:balance-changed"));
      } catch (betErr: any) {
        console.warn("Bet registration warning:", betErr.message);
      }
    }
    setBetSuccess(true);
    const updated = await getMarket(market.id);
    setMarket(updated);
    setAmount("");
    setSelectedOutcomeId(null);
  };

  if (loading) return <Page back><LoadingScreen message="Loading market…" fullPage={false} /></Page>;

  if (error || !market) {
    return (
      <Page back>
        <Placeholder header="Error" description={error || "Market not found"} />
      </Page>
    );
  }

  const canBet = market.status === "open";
  const minBet = market.externalSource === "ter" ? 10 : configMinBet;
  const QUICK_AMOUNTS =
    market.externalSource === "ter" ? QUICK_AMOUNTS_TER : QUICK_AMOUNTS_DEFAULT;
  const selectedOutcome = market.outcomes.find(
    (o) => o.id === selectedOutcomeId,
  );
  const betAmount = parseFloat(amount) || 0;
  const hasIntelligence = market.outcomes.some(
    (o) => o.intelligenceProb != null,
  );
  const contrarianInfo = isContrarianPick(market, selectedOutcomeId);

  let winAmount = 0;
  let priceImpact: { from: number; to: number } | null = null;

  if (selectedOutcome && betAmount >= minBet) {
    const totalPool = Number(market.totalPool) || 0;
    const outcomePool = Number(selectedOutcome.totalBetAmount) || 0;
    const newOutcomePool = outcomePool + betAmount;
    const newTotalPool = totalPool + betAmount;
    const houseEdge = Number(market.houseEdgePct) / 100;
    if (newOutcomePool > 0 && !isNaN(newOutcomePool) && !isNaN(newTotalPool)) {
      winAmount = (betAmount / newOutcomePool) * newTotalPool * (1 - houseEdge);
    }

    // Price impact: LMSR softmax before and after this bet
    const b = Number(market.liquidityParam) || 1000;
    const shares = market.outcomes.map((o) => Number(o.totalBetAmount));
    const newShares = shares.map((s, i) =>
      market.outcomes[i].id === selectedOutcome.id ? s + betAmount : s,
    );
    const lmsrProb = (vals: number[], idx: number) => {
      const max = Math.max(...vals);
      const exps = vals.map((v) => Math.exp((v - max) / b));
      const total = exps.reduce((a, c) => a + c, 0);
      return exps[idx] / total;
    };
    const selectedIdx = market.outcomes.findIndex(
      (o) => o.id === selectedOutcome.id,
    );
    const before = lmsrProb(shares, selectedIdx);
    const after = lmsrProb(newShares, selectedIdx);
    if (Math.abs(after - before) >= 0.005) {
      priceImpact = { from: before, to: after };
    }
  }

  const isReady = !!selectedOutcomeId && betAmount >= minBet;

  return (
    <Page back>
      {/* Flex column filling the true visible viewport height */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          background: "var(--bg-main)",
        }}
      >
        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "48px 16px 16px",
            maxWidth: 480,
            width: "100%",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          {/* Question */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-subtle)",
                marginBottom: 8,
              }}
            >
              {market.status === "open" ? "Open · Pick a side" : market.status}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1.3,
                color: "var(--text-main)",
              }}
            >
              {market.title}
            </div>
          </div>

          {/* Outcome buttons — show RAW parimutuel odds only, no intelligence signal */}
          {canBet && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 12,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--text-subtle)",
                  }}
                >
                  PICK A SIDE
                </div>
                {!selectedOutcomeId && hasIntelligence && (
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--text-subtle)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>👁</span> Pick first — signal reveals after
                  </div>
                )}
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {market.outcomes.map((outcome, idx) => {
                  const isSelected = selectedOutcomeId === outcome.id;
                  const totalPool = Number(market.totalPool);
                  // Always show raw parimutuel percentage before the user picks
                  const rawPct =
                    totalPool > 0
                      ? (Number(outcome.totalBetAmount) / totalPool) * 100
                      : 100 / market.outcomes.length;
                  const colors = [
                    "#22c55e",
                    "#ef4444",
                    "#f59e0b",
                    "#3b82f6",
                    "#8b5cf6",
                  ];
                  const color = colors[idx % colors.length];
                  return (
                    <button
                      key={outcome.id}
                      onClick={() => setSelectedOutcomeId(outcome.id)}
                      style={{
                        padding: "14px 14px 12px",
                        borderRadius: 12,
                        border: isSelected
                          ? `2px solid ${color}`
                          : "2px solid var(--border)",
                        background: isSelected
                          ? `${color}14`
                          : "var(--bg-secondary)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            color: isSelected ? color : "var(--text-main)",
                          }}
                        >
                          {outcome.label}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: 15, color }}>
                          {rawPct.toFixed(0)}%
                        </span>
                      </div>
                      <div
                        style={{
                          background: "var(--border)",
                          height: 6,
                          borderRadius: 6,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            background: color,
                            width: `${rawPct}%`,
                            height: "100%",
                            borderRadius: 6,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Intelligence signal reveal — only shown AFTER the user has picked */}
              {selectedOutcomeId && hasIntelligence && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: contrarianInfo.isContrarian
                      ? "rgba(245,158,11,0.08)"
                      : "rgba(59,130,246,0.07)",
                    border: contrarianInfo.isContrarian
                      ? "1px solid rgba(245,158,11,0.35)"
                      : "1px solid rgba(59,130,246,0.25)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text-subtle)",
                      marginBottom: 8,
                    }}
                  >
                    Expert signal (revealed)
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {market.outcomes.map((outcome, idx) => {
                      const colors = [
                        "#22c55e",
                        "#ef4444",
                        "#f59e0b",
                        "#3b82f6",
                        "#8b5cf6",
                      ];
                      const color = colors[idx % colors.length];
                      const expertPct =
                        outcome.intelligenceProb != null
                          ? outcome.intelligenceProb * 100
                          : Number(market.totalPool) > 0
                            ? (Number(outcome.totalBetAmount) /
                                Number(market.totalPool)) *
                              100
                            : 100 / market.outcomes.length;
                      const isChosen = outcome.id === selectedOutcomeId;
                      return (
                        <div
                          key={outcome.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: isChosen ? 800 : 500,
                              color: isChosen ? color : "var(--text-muted)",
                              width: 90,
                              flexShrink: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {outcome.label}
                          </div>
                          <div
                            style={{
                              flex: 1,
                              background: "var(--border)",
                              height: 5,
                              borderRadius: 5,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                background: color,
                                width: `${expertPct}%`,
                                height: "100%",
                                borderRadius: 5,
                                opacity: isChosen ? 1 : 0.45,
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: isChosen ? color : "var(--text-subtle)",
                              width: 34,
                              textAlign: "right",
                              flexShrink: 0,
                            }}
                          >
                            {expertPct.toFixed(0)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Contrarian callout */}
                  {contrarianInfo.isContrarian && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>🦅</span>
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: "#f59e0b",
                          }}
                        >
                          Contrarian pick — Expert signal says{" "}
                          {contrarianInfo.expertPct.toFixed(0)}%
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-subtle)",
                            marginTop: 2,
                          }}
                        >
                          You're going against consensus. If you're right,
                          you'll earn a Contrarian win — tracked separately on
                          your profile.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          {canBet && selectedOutcomeId && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 12,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-subtle)",
                  marginBottom: 8,
                }}
              >
                Amount (Nu.)
              </div>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <span
                  style={{
                    position: "absolute",
                    left: 13,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-subtle)",
                    pointerEvents: "none",
                  }}
                >
                  Nu
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Min ${minBet}`}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 34px",
                    background: "var(--bg-secondary)",
                    border: "2px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--text-main)",
                    fontSize: 20,
                    fontWeight: 700,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Quick amounts */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                }}
              >
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q.toString())}
                    style={{
                      padding: "9px 0",
                      borderRadius: 10,
                      border:
                        amount === q.toString()
                          ? "2px solid #3b82f6"
                          : "2px solid var(--border)",
                      background:
                        amount === q.toString()
                          ? "rgba(59,130,246,0.12)"
                          : "var(--bg-secondary)",
                      color:
                        amount === q.toString()
                          ? "#3b82f6"
                          : "var(--text-muted)",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Win amount + price impact */}
              {winAmount > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(22,163,74,0.1)",
                      border: "1px solid #86efac",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--text-subtle)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Est. payout if win
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: "#16a34a",
                        }}
                      >
                        {formatNu(winAmount)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--text-subtle)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Outcome
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#16a34a",
                        }}
                      >
                        {selectedOutcome?.label}
                      </div>
                    </div>
                  </div>
                  {priceImpact && (
                    <div
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        background: "rgba(59,130,246,0.08)",
                        border: "1px solid rgba(59,130,246,0.25)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ color: "#3b82f6" }}>↑</span>
                      Your prediction moves {selectedOutcome?.label} from{" "}
                      <strong style={{ color: "var(--text-main)" }}>
                        {Math.round(priceImpact.from * 100)}%
                      </strong>
                      {" → "}
                      <strong style={{ color: "#3b82f6" }}>
                        {Math.round(priceImpact.to * 100)}%
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Success state */}
          {betSuccess && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "32px 20px",
                textAlign: "center",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#16a34a",
                  marginBottom: 6,
                }}
              >
                Position Opened!
              </div>
              <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>
                Your payment was confirmed and your position has been
                registered.
              </div>
            </div>
          )}

          {!canBet && (
            <Placeholder
              header={
                market.status === "upcoming" ? "Opening Soon" : "Market Closed"
              }
              description={
                market.status === "upcoming"
                  ? "This market will open soon."
                  : "This market is no longer accepting positions."
              }
            />
          )}
        </div>

        {/* Confirm button — always visible at the bottom of the flex column */}
        {canBet && !betSuccess && (
          <div
            style={{
              flexShrink: 0,
              padding: "12px 16px",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
              background: "var(--bg-card)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              disabled={!isReady}
              onClick={() => setIsPaymentModalOpen(true)}
              style={{
                width: "100%",
                padding: "15px",
                borderRadius: 12,
                border: "none",
                background: isReady ? "#3b82f6" : "var(--bg-secondary)",
                color: isReady ? "#fff" : "var(--text-subtle)",
                fontSize: 15,
                fontWeight: 700,
                cursor: isReady ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              {isReady ? (
                <>
                  Pay {formatNu(betAmount)} via
                  <span
                    style={{
                      background: "#fff",
                      borderRadius: 4,
                      padding: "1px 5px",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <img
                      src={dkBankLogo}
                      alt="DK Bank"
                      style={{ height: 14, width: "auto" }}
                    />
                  </span>
                  on {selectedOutcome?.label}
                </>
              ) : selectedOutcomeId ? (
                `Enter at least Nu. ${minBet}`
              ) : (
                "Pick a side to continue"
              )}
            </button>
          </div>
        )}
      </div>

      <DKBankConfirmModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        market={market}
        outcomeId={selectedOutcomeId ?? ""}
        amount={betAmount}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          handlePaymentSuccess();
        }}
        onFailure={(err: string) => console.error("Payment failed:", err)}
      />
    </Page>
  );
};

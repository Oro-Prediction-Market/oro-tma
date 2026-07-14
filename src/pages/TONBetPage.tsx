import { FC, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  useTonWallet,
  useTonConnectUI,
  TonConnectButton,
} from "@tonconnect/ui-react";
import {
  Section,
  Cell,
  List,
  Placeholder,
  Button,
  Input,
  Caption,
  Title,
  Text,
} from "@telegram-apps/telegram-ui";
import { Page } from "@/components/Page";
import { getMarket, placeBetWithWallet, Market } from "@shared/api/client";
import { calcProb } from "./WorldCupHubPage";
import { LoadingScreen } from "@shared/components/LoadingScreen";

export const TONBetPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(
    null,
  );
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await getMarket(id);
        setMarket(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleSendTON = async () => {
    if (!selectedOutcomeId || !market || !wallet) return;

    setSending(true);
    try {
      const tonAmount = parseFloat(amount);
      if (tonAmount <= 0) throw new Error("Amount must be positive");

      // Send TON payment
      const PLATFORM_WALLET = "EQD..."; // TODO
      const nanoAmount = (tonAmount * 1_000_000_000).toString();

      const tx = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: PLATFORM_WALLET,
            amount: nanoAmount,
            payload: btoa(`bet:${market.id}:${selectedOutcomeId}`),
          },
        ],
      });

      // Register prediction
      await placeBetWithWallet(market.id, {
        outcomeId: selectedOutcomeId,
        amount: tonAmount,
        walletAddress: wallet.account.address,
        txHash: tx.boc,
      });

      alert("✅ Position opened successfully!");

      const updated = await getMarket(market.id);
      setMarket(updated);
      setAmount("");
      setSelectedOutcomeId(null);
    } catch (err: any) {
      alert("❌ Failed: " + (err.message || "Transaction cancelled"));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Page back={true}><LoadingScreen message="Loading market…" fullPage={false} /></Page>;

  if (error || !market) {
    return (
      <Page back={true}>
        <Placeholder header="Error" description={error || "Market not found"} />
      </Page>
    );
  }

  const canBet = market.status === "open";

  return (
    <Page back={true}>
      <List>
        {/* Market info */}
        <Section header="Market Details">
          <div style={{ padding: "1rem" }}>
            <Title level="2" weight="1">
              {market.title}
            </Title>
            {market.description && (
              <Caption
                level="1"
                style={{ marginTop: "0.5rem", display: "block" }}
              >
                {market.description}
              </Caption>
            )}
            <Caption
              level="2"
              style={{ marginTop: "0.5rem", display: "block" }}
            >
              Pool: <strong>{market.totalPool} TON</strong> · Status:{" "}
              <strong>{market.status.toUpperCase()}</strong>
            </Caption>
          </div>
        </Section>

        {/* TON Wallet connection */}
        {!wallet && (
          <Section header="Connect Your Wallet">
            <Placeholder
              header="TON Wallet Required"
              description={
                <>
                  <Text>
                    Connect your TON wallet to make predictions with Toncoin
                  </Text>
                  <TonConnectButton style={{ marginTop: "1rem" }} />
                </>
              }
            />
          </Section>
        )}

        {/* Wallet connected */}
        {wallet && (
          <Section header="Your Wallet">
            <Cell
              subtitle={`${wallet.account.address.slice(0, 8)}...${wallet.account.address.slice(-6)}`}
            >
              <strong>TON Wallet Connected</strong>
            </Cell>
          </Section>
        )}

        {/* Outcomes */}
        <Section header="Select Outcome">
          {market.outcomes.map((outcome) => {
            const isSelected = selectedOutcomeId === outcome.id;

            // calcProb: normalized LMSR when every outcome has one, else
            // smoothed pool share (uniform prior before any bets)
            const probability =
              calcProb(market, outcome.id) || 1 / market.outcomes.length;
            const probabilityPercent = Math.round(probability * 100);
            // No fabricated multiplier before the first bet
            const decimalOdds =
              Number(market.totalPool) > 0 && probability > 0
                ? `${(1 / probability).toFixed(2)}x`
                : "—";

            return (
              <Cell
                key={outcome.id}
                onClick={() =>
                  canBet && wallet && setSelectedOutcomeId(outcome.id)
                }
                subtitle={`${probabilityPercent}% · ${decimalOdds} · Pool: ${outcome.totalBetAmount} TON`}
                after={
                  canBet && wallet ? (
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => setSelectedOutcomeId(outcome.id)}
                    />
                  ) : null
                }
                style={{
                  backgroundColor: isSelected
                    ? "rgba(0, 122, 255, 0.1)"
                    : undefined,
                  cursor: canBet && wallet ? "pointer" : "default",
                  opacity: canBet ? 1 : 0.6,
                }}
              >
                {outcome.label}
              </Cell>
            );
          })}
        </Section>

        {/* Bet form */}
        {canBet && wallet && (
          <Section header="Enter Your Position">
            <div style={{ padding: "1rem" }}>
              <Input
                header="Amount in TON"
                placeholder="0.5"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!selectedOutcomeId}
              />

              <Caption
                level="2"
                style={{ marginTop: "0.5rem", display: "block" }}
              >
                Platform fee: {market.houseEdgePct}% · Min bet: 0.1 TON
              </Caption>
              <Button
                size="l"
                stretched
                loading={sending}
                disabled={
                  !selectedOutcomeId || 
                  !amount ||
                  Number(amount) < 0.1
                }
                onClick={handleSendTON}
                style={{ marginTop: "1rem" }}
              >
                {sending ? "Sending..." : `Send ${amount || "0"} TON`}
              </Button>
            </div>
          </Section>
        )}

        {!canBet && (
          <Section>
            <Placeholder
              header={
                market.status === "upcoming" ? "Not Open Yet" : "Market Closed"
              }
              description={
                market.status === "upcoming"
                  ? "This market will open soon"
                  : "This market is no longer accepting positions"
              }
            />
          </Section>
        )}
      </List>
    </Page>
  );
};

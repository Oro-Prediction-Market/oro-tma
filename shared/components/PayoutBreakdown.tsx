import { useState } from 'react';
import type { Market } from '@shared/api/client';

function Row({ label, value, muted, bold, green }: {
  label: string; value: string;
  muted?: boolean; bold?: boolean; green?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
      <span style={{ fontSize: 11, color: muted ? '#9ca3af' : '#6b7280' }}>{label}</span>
      <span style={{ fontSize: bold ? 12 : 11, fontWeight: bold ? 700 : 500, color: green ? '#16a34a' : '#374151' }}>
        {value}
      </span>
    </div>
  );
}

export function PayoutBreakdown({ market, outcomeId, betAmount }: {
  market: Market;
  outcomeId: string;
  betAmount: number;
}) {
  const [open, setOpen] = useState(false);

  const outcome = market.outcomes.find((o) => o.id === outcomeId);
  if (!outcome || betAmount <= 0) return null;

  const houseEdgePct = parseFloat(market.houseEdgePct) || 0;
  const curOutcomePool = Number(outcome.totalBetAmount);
  const curTotalPool = Number(market.totalPool);
  const newOutcomePool = curOutcomePool + betAmount;
  const newTotalPool = curTotalPool + betAmount;
  const yourShare = newOutcomePool > 0 ? betAmount / newOutcomePool : 0;
  const grossPayout = yourShare * newTotalPool;
  const houseDeduction = grossPayout * (houseEdgePct / 100);
  const netPayout = grossPayout - houseDeduction;
  const profit = netPayout - betAmount;

  const nu = (n: number) => `Nu ${n.toFixed(2)}`;
  const nuInt = (n: number) => `Nu ${Math.round(n).toLocaleString()}`;

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11, fontWeight: 600, color: '#6b7280',
        }}
      >
        <span>How is this calculated?</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          marginTop: 8, background: '#f8fafc', borderRadius: 8,
          border: '1px solid #e5e7eb', padding: '12px 14px',
        }}>
          {/* Pool state */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Pool state
          </div>
          <Row label={`[${outcome?.label}] pool`} value={nuInt(curOutcomePool)} />
          <Row label="Total pool" value={nuInt(curTotalPool)} />

          <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0' }} />

          {/* After your bet */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            After your bet of {nu(betAmount)}
          </div>
          <Row label={`[${outcome?.label}] pool`} value={nuInt(newOutcomePool)} />
          <Row label="Total pool" value={nuInt(newTotalPool)} />
          <Row label="Your share" value={`${Math.round(yourShare * 100)}%`} />

          <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0' }} />

          {/* Calculation */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Calculation
          </div>
          <Row label="Gross payout" value={nu(grossPayout)} />
          <Row label={`Platform fee (${houseEdgePct}%)`} value={`−${nu(houseDeduction)}`} muted />
          <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
          <Row label="Est. payout if win" value={nu(netPayout)} bold green />
          <Row label="Est. profit" value={`+${nu(profit)}`} bold green />

          {/* Estimate disclaimer — parimutuel payouts are not fixed */}
          <div style={{
            marginTop: 10, padding: '7px 10px', background: '#eff6ff',
            borderRadius: 6, border: '1px solid #bfdbfe',
          }}>
            <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.6 }}>
              This is an <strong>estimate</strong>, not a fixed payout. The winning
              pool is shared among all winners, so your final amount changes as
              more people predict and is settled from the total pool at close.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

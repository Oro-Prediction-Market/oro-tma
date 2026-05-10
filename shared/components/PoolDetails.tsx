import { useState, useEffect } from 'react';
import type { Market } from '@shared/api/client';

const OUTCOME_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

function useRelativeTime(date: Date | null): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!date) return;
    const tick = () => {
      const secs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (secs < 10) setLabel('just now');
      else if (secs < 60) setLabel(`${secs}s ago`);
      else if (secs < 3600) setLabel(`${Math.floor(secs / 60)}m ago`);
      else setLabel(`${Math.floor(secs / 3600)}h ago`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [date]);
  return label;
}

export function PoolDetails({ market, lastUpdated }: { market: Market; lastUpdated?: Date | null }) {
  const [open, setOpen] = useState(false);
  const relativeTime = useRelativeTime(lastUpdated ?? null);
  const totalPool = Number(market.totalPool);

  const outcomes = market.outcomes.map((o, i) => ({
    ...o,
    pct: totalPool > 0 ? (Number(o.totalBetAmount) / totalPool) * 100 : 100 / market.outcomes.length,
    color: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
  }));

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)',
          transition: 'color 0.2s ease',
          fontFamily: 'var(--font-primary)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-main)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        {open ? 'Hide details' : 'Pool stats'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 12,
          background: 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--glass-border)',
          padding: '16px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 50, minWidth: 260,
          animation: 'slideUp 0.2s ease-out',
        }}>
          <style>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Pool
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {outcomes.map((o) => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-main)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: o.color }}>{o.pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: 4, borderRadius: 2, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ width: `${o.pct}%`, height: '100%', background: o.color, transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 2, fontWeight: 600 }}>
                    Nu {Number(o.totalBetAmount).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ height: 1, background: 'var(--glass-border)', margin: '12px 0' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Total Staked</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>Nu {totalPool.toLocaleString()}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontWeight: 600 }}>Platform fee</span>
            <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontWeight: 600 }}>{market.houseEdgePct}%</span>
          </div>

          {relativeTime && (
            <div style={{ fontSize: 9, color: 'var(--text-subtle)', marginTop: 8, textAlign: 'right', fontStyle: 'italic' }}>
              Synced {relativeTime}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ArrowUpCircle, MessageCircle, Share2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  getSuggestions,
  getSuggestionQuota,
  createSuggestion,
  voteSuggestion,
  type MarketSuggestion,
  type SuggestionQuota,
} from '@shared/api/client';
import {
  useSuggestionsSocket,
  type SuggestionVoted,
  type SuggestionAdded,
} from '../hooks/useSuggestionsSocket';

type Suggestion = MarketSuggestion;

/** "1 Sep" — when this user's monthly suggestion slot opens again. */
function formatResetDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'next month';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const TITLE_BOX_RATIO = 0.72;
const CHROME_H = 38; // category row + vote row + breathing room

function fitTitle(title: string, orbSize: number): { fontSize: number; lines: number } {
  const boxW = orbSize * TITLE_BOX_RATIO;
  const boxH = orbSize * TITLE_BOX_RATIO - CHROME_H;
  const longestWord = title
    .split(/\s+/)
    .reduce((max, w) => Math.max(max, w.length), 1);

  for (let fontSize = 13; fontSize >= 8; fontSize -= 0.5) {
    const charW = fontSize * 0.55; // ≈ average glyph width at weight 800
    if (longestWord * charW > boxW) continue;
    const perLine = Math.max(1, Math.floor(boxW / charW));
    // +1 line of slack: ragged word wrapping never packs lines perfectly full.
    const lines = Math.ceil(title.length / perLine) + 1;
    if (lines * fontSize * 1.2 <= boxH) return { fontSize, lines };
  }
  // Nothing fits cleanly — smallest legible size, clamped with an ellipsis.
  return { fontSize: 8, lines: Math.max(2, Math.floor(boxH / 9.6)) };
}

interface OracleOrbitProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OracleOrbit: React.FC<OracleOrbitProps> = ({ isOpen, onClose }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [orbs, setOrbs] = useState<{ id: string; x: number; y: number; size: number; delay: number }[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<SuggestionQuota | null>(null);
  const [voting, setVoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Set after a successful submit — the suggestion is invisible until the super
  // admin approves it, so we say so rather than pretending it joined the orbit.
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');

  /** Where each orb already sits, so a re-layout doesn't move it. */
  const placedRef = useRef<Map<string, { x: number; y: number; delay: number }>>(
    new Map(),
  );

  // Load the orbit each time it opens so votes cast elsewhere show up.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getSuggestions(), getSuggestionQuota().catch(() => null)])
      .then(([list, q]) => {
        if (cancelled) return;
        setSuggestions(list);
        setQuota(q);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load suggestions. Pull down to retry.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleVote = async (id: string) => {
    if (voting) return;
    const current = suggestions.find((s) => s.id === id);
    if (!current || current.votedByMe) return;
    setVoting(true);
    // Optimistic — the server is idempotent, so a lost response can't double-count.
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, votes: s.votes + 1, votedByMe: true } : s,
      ),
    );
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#3b82f6', '#f59e0b'],
    });
    try {
      const res = await voteSuggestion(id);
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, votes: res.votes, votedByMe: res.votedByMe } : s,
        ),
      );
    } catch {
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, votes: Math.max(0, s.votes - 1), votedByMe: false }
            : s,
        ),
      );
    } finally {
      setVoting(false);
    }
  };

  // ── Live updates ───────────────────────────────────────────────────────────
  // Votes are broadcast to every open orbit, so a count changes under your eyes
  // without a refetch. Counts only ever rise, so Math.max keeps an out-of-order
  // delivery (or a stale echo of your own optimistic vote) from ticking it back.
  const handleRemoteVote = useCallback((e: SuggestionVoted) => {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === e.id ? { ...s, votes: Math.max(s.votes, e.votes) } : s,
      ),
    );
  }, []);

  // A suggestion the admin just approved joins the orbit in place. `votedByMe`
  // is per-viewer and never broadcast, so it starts false — the one person who
  // proposed it will see their vote on the next open.
  const handleRemoteAdd = useCallback((e: SuggestionAdded) => {
    setSuggestions((prev) =>
      prev.some((s) => s.id === e.id) ? prev : [...prev, { ...e, votedByMe: false }],
    );
  }, []);

  useSuggestionsSocket(isOpen, handleRemoteVote, handleRemoteAdd);

  useEffect(() => {
    if (isOpen) {
      const VIEWPORT_W = 390; // Typical mobile width
      const VIEWPORT_H = 700; // Typical mobile height
      const placedOrbs: typeof orbs = [];

      // Size orbs against the busiest suggestion in the set, not an absolute
      // vote target — real counts are single digits, so any fixed denominator
      // pins every orb to the minimum and the title clips mid-word.
      const maxVotes = Math.max(1, ...suggestions.map((s) => s.votes));

      suggestions.forEach(s => {
        let bestCandidate = null;
        let minOverlap = Infinity;
        // Votes set the base size; a long question then buys extra room rather
        // than being shrunk to fit a size it was never going to fit.
        const lengthBump = Math.min(34, Math.max(0, s.title.length - 42) * 0.8);
        const orbSize = Math.round(118 + (s.votes / maxVotes) * 46 + lengthBump);

        // An orb that's already on screen keeps its spot. Live votes re-run this
        // effect, and re-rolling the random placement would make every orb jump
        // across the screen each time anyone votes.
        const held = placedRef.current.get(s.id);
        if (held) {
          placedOrbs.push({ id: s.id, ...held, size: orbSize });
          return;
        }

        // Keep the whole circle on screen, clear of the header and the
        // "Ask the Crowd" button — bigger orbs need a bigger inset.
        const marginX = ((orbSize / 2 + 10) / VIEWPORT_W) * 100;
        const marginTop = ((orbSize / 2 + 130) / VIEWPORT_H) * 100;
        const marginBottom = ((orbSize / 2 + 150) / VIEWPORT_H) * 100;
        const spanX = Math.max(0, 100 - marginX * 2);
        const spanY = Math.max(0, 100 - marginTop - marginBottom);

        // Try up to 50 times to find a non-overlapping spot
        for (let tries = 0; tries < 50; tries++) {
          const candidateX = marginX + Math.random() * spanX;
          const candidateY = marginTop + Math.random() * spanY;

          let maxCollision = 0;
          let hasOverlap = false;

          for (const other of placedOrbs) {
            // Distance in pixels (approximate)
            const dx = ((candidateX - other.x) / 100) * VIEWPORT_W;
            const dy = ((candidateY - other.y) / 100) * VIEWPORT_H;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const minSafeDist = (orbSize / 2 + other.size / 2) + 15; // 15px padding
            
            if (distance < minSafeDist) {
              hasOverlap = true;
              maxCollision = Math.max(maxCollision, minSafeDist - distance);
            }
          }

          if (!hasOverlap) {
            bestCandidate = { id: s.id, x: candidateX, y: candidateY, size: orbSize, delay: Math.random() * 5 };
            break;
          } else if (maxCollision < minOverlap) {
            minOverlap = maxCollision;
            bestCandidate = { id: s.id, x: candidateX, y: candidateY, size: orbSize, delay: Math.random() * 5 };
          }
        }

        if (bestCandidate) {
          placedOrbs.push(bestCandidate);
          const { x, y, delay } = bestCandidate;
          placedRef.current.set(bestCandidate.id, { x, y, delay });
        }
      });

      setOrbs(placedOrbs);
    } else {
      setSelectedId(null);
      setIsCasting(false);
      // Fresh scatter next time the orbit opens.
      placedRef.current.clear();
    }
  }, [isOpen, suggestions]);

  if (!isOpen) return null;

  const selectedSuggestion = suggestions.find(s => s.id === selectedId);

  const handleClose = () => {
    setSelectedId(null);
    setIsCasting(false);
    onClose();
  };

  const handleCast = async () => {
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSuggestion({ title: newTitle.trim() });
      setIsCasting(false);
      setNewTitle('');
      setSubmittedNotice(
        'Sent for review. It joins the orbit once it’s approved — we’ll message you.',
      );
      setQuota((q) =>
        q ? { ...q, used: q.used + 1, canSuggest: q.used + 1 < q.limit } : q,
      );
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.8 },
        colors: ['#3b82f6', '#22c55e', '#f59e0b'],
      });
    } catch (err: any) {
      setError(err?.message ?? 'Could not send your suggestion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'orbitEntrance 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        overflow: 'hidden'
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 16,
          right: 16,
          padding: 10,
          borderRadius: 22,
          background: 'rgba(15, 23, 42, 0.42)',
          border: '1px solid rgba(255,255,255,0.14)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          zIndex: 300
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Community</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 700, marginTop: 3 }}>Feed Page</div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                marginTop: 5,
                padding: '3px 7px',
                borderRadius: 99,
                background: 'rgba(34,197,94,0.12)',
                color: '#69eeb0',
                fontSize: 9,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              live orbit
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
          }}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 301,
            pointerEvents: 'auto',
            flexShrink: 0
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* ── Orbit Space ── */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      >
        {orbs.map((orb) => {
          const sug = suggestions.find((s) => s.id === orb.id);
          const title = sug?.title ?? '';
          const fitted = fitTitle(title, orb.size);
          return (
          <div
            key={orb.id}
            onClick={() => setSelectedId(orb.id)}
            style={{
              position: 'absolute',
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: orb.size,
              height: orb.size,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              zIndex: selectedId === orb.id ? 100 : 5,
              opacity: (selectedId || isCasting) && selectedId !== orb.id ? 0.3 : 1,
              pointerEvents: (selectedId || isCasting) && selectedId !== orb.id ? 'none' : 'auto',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.72)',
                border: '2.5px solid rgba(96, 165, 250, 0.52)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                textAlign: 'center',
                animation: `orbFloat 8s ease-in-out infinite ${orb.delay}s, orbPulse 4s ease-in-out infinite ${orb.delay}s`,
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: selectedId === orb.id ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 900, color: 'rgba(191,219,254,0.78)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.03em' }}>
                {sug?.category ?? 'other'}
              </div>
              <div
                style={{
                  // Bounded to the circle's inscribed square, at the largest
                  // size that fits the whole title — see fitTitle().
                  maxWidth: orb.size * TITLE_BOX_RATIO,
                  fontSize: fitted.fontSize,
                  fontWeight: 800,
                  color: '#fff',
                  lineHeight: 1.2,
                  textShadow: '0 1px 8px rgba(0,0,0,0.72)',
                  display: '-webkit-box',
                  WebkitLineClamp: fitted.lines,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  // Break on word edges only. `hyphens: auto` would split
                  // "minister" into "minis-ter" inside the curve.
                  overflowWrap: 'break-word',
                }}
              >
                {title}
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowUpCircle size={10} color="#22c55e" />
                <span style={{ fontSize: 10, fontWeight: 900, color: '#22c55e' }}>{sug?.votes ?? 0}</span>
              </div>
            </div>
          </div>
          );
        })}

        {!loading && orbs.length === 0 && !isCasting && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '0 40px',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
              {error ? 'Couldn’t load the orbit' : 'No questions in orbit yet'}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.62)', fontWeight: 600, lineHeight: 1.5 }}>
              {error ?? 'Be the first — ask the crowd what market Oro should run next.'}
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Card ── */}
      {selectedSuggestion && (
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: 16,
            right: 16,
            background: 'var(--bg-card)',
            borderRadius: 24,
            padding: '24px 20px',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            animation: 'orbitEntrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            zIndex: 150
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>
                Suggestion by {selectedSuggestion.creator}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.3 }}>
                {selectedSuggestion.title}
              </div>
            </div>
            <button
               onClick={() => setSelectedId(null)}
               style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
          
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
            {selectedSuggestion.description}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => handleVote(selectedSuggestion.id)}
              disabled={selectedSuggestion.votedByMe || voting}
              style={{
                flex: 2,
                background: selectedSuggestion.votedByMe
                  ? 'var(--bg-secondary)'
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: 14,
                padding: '14px',
                color: selectedSuggestion.votedByMe ? 'var(--text-muted)' : '#fff',
                fontSize: 14,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: selectedSuggestion.votedByMe
                  ? 'none'
                  : '0 8px 16px rgba(34, 197, 94, 0.25)',
                cursor: selectedSuggestion.votedByMe ? 'default' : 'pointer'
              }}
            >
              <ArrowUpCircle size={18} />
              {selectedSuggestion.votedByMe ? 'Backed' : 'Back this Prophecy'}
            </button>
            <button
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border)',
                borderRadius: 14,
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Casting Form ── */}
      {isCasting && (
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: 16,
            right: 16,
            background: 'var(--bg-card)',
            borderRadius: 24,
            padding: '28px 20px',
            border: '1.5px solid #3b82f6',
            boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.4)',
            animation: 'orbitEntrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            zIndex: 150
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
             <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--text-main)' }}>New Prophecy</h3>
             <button
               onClick={() => setIsCasting(false)}
               style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
             >
               <X size={20} />
             </button>
          </div>
          
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: 8 }}>Proposition</label>
            <input 
              autoFocus
              type="text"
              placeholder="e.g. Will Mars be colonized by 2040?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                borderRadius: 12,
                padding: '14px',
                color: 'var(--text-main)',
                fontSize: 14,
                outline: 'none',
                fontWeight: 600
              }}
            />
          </div>

          <button
            onClick={handleCast}
            disabled={!newTitle.trim()}
            style={{
              width: '100%',
              background: newTitle.trim() ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'var(--text-subtle)',
              border: 'none',
              borderRadius: 14,
              padding: '16px',
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
              boxShadow: newTitle.trim() ? '0 10px 20px rgba(59, 130, 246, 0.3)' : 'none',
              transition: 'all 0.3s'
            }}
          >
            Release into Orbit
          </button>
        </div>
      )}

      {/* ── Suggest New Button ── */}
      {!selectedId && !isCasting && (
        <div
          style={{
            position: 'absolute',
            bottom: 34,
            left: 16,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {submittedNotice && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 14,
                background: 'rgba(34,197,94,0.14)',
                border: '1px solid rgba(34,197,94,0.35)',
                color: '#86efac',
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'center',
                lineHeight: 1.45,
              }}
            >
              {submittedNotice}
            </div>
          )}
          <button
            onClick={() => setIsCasting(true)}
            disabled={quota ? !quota.canSuggest : false}
            style={{
              padding: '16px 32px',
              borderRadius: 30,
              background:
                quota && !quota.canSuggest
                  ? 'rgba(255,255,255,0.12)'
                  : 'linear-gradient(135deg, #2775d0, #1a5bb5)',
              border: 'none',
              color: quota && !quota.canSuggest ? 'rgba(255,255,255,0.6)' : '#fff',
              fontSize: 15,
              fontWeight: 800,
              boxShadow:
                quota && !quota.canSuggest
                  ? 'none'
                  : '0 10px 25px rgba(39, 117, 208, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: quota && !quota.canSuggest ? 'default' : 'pointer',
            }}
          >
            <MessageCircle size={20} />
            {quota && !quota.canSuggest
              ? `Next suggestion ${formatResetDate(quota.resetsAt)}`
              : 'Ask the Crowd'}
          </button>
        </div>
      )}
    </div>
  );
};

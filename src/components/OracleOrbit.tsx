import React, { useState, useEffect } from 'react';
import { X, ArrowUpCircle, MessageCircle, Share2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Suggestion {
  id: string;
  title: string;
  votes: number;
  category: string;
  creator: string;
  description: string;
}

const MOCK_SUGGESTIONS: Suggestion[] = [
  {
    id: '1',
    title: 'Will Bitcoin hit $100k by year end?',
    votes: 1240,
    category: 'Finance',
    creator: '@crypto_king',
    description: 'The market is heating up and institutional adoption is at an all-time high. Will the psychological barrier be broken?'
  },
  {
    id: '2',
    title: 'Will GTA VI be delayed to 2026?',
    votes: 850,
    category: 'Gaming',
    creator: '@rockstar_fan',
    description: 'Rumors are swirling about development hurdles. Is the 2025 window realistic?'
  },
  {
    id: '3',
    title: 'Will the Lakers win the 2024 Cup?',
    votes: 2100,
    category: 'Sports',
    creator: '@hoops_master',
    description: 'They have the momentum and the health. Can they pull off another legendary run?'
  },
  {
    id: '4',
    title: 'Will AI reach AGI by 2027?',
    votes: 1560,
    category: 'Tech',
    creator: '@silicon_valley',
    description: 'Sam Altman says it\'s closer than we think. What does the community believe?'
  },
  {
    id: '5',
    title: 'Will Elon Musk step down from X?',
    votes: 3200,
    category: 'Business',
    creator: '@tech_guru',
    description: 'Pressure is mounting from investors. Is a new CEO on the horizon?'
  }
];

interface OracleOrbitProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OracleOrbit: React.FC<OracleOrbitProps> = ({ isOpen, onClose }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [orbs, setOrbs] = useState<{ id: string; x: number; y: number; size: number; delay: number }[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(MOCK_SUGGESTIONS);

  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    if (isOpen) {
      const VIEWPORT_W = 390; // Typical mobile width
      const VIEWPORT_H = 700; // Typical mobile height
      const placedOrbs: typeof orbs = [];

      suggestions.forEach(s => {
        let bestCandidate = null;
        let minOverlap = Infinity;
        const orbSize = Math.max(80, Math.min(140, (s.votes / 3500) * 100 + 80));
        
        // Try up to 50 times to find a non-overlapping spot
        for (let tries = 0; tries < 50; tries++) {
          const candidateX = Math.random() * 65 + 17.5; // Slightly wider range 17.5% - 82.5%
          const candidateY = Math.random() * 45 + 27.5; // Slightly wider range 27.5% - 72.5%
          
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

        if (bestCandidate) placedOrbs.push(bestCandidate);
      });

      setOrbs(placedOrbs);
    } else {
      setSelectedId(null);
      setIsCasting(false);
    }
  }, [isOpen, suggestions]);

  if (!isOpen) return null;

  const selectedSuggestion = suggestions.find(s => s.id === selectedId);

  const handleCast = () => {
    if (!newTitle.trim()) return;
    
    const newSug: Suggestion = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTitle,
      votes: 1,
      category: 'User Post',
      creator: '@you',
      description: 'A new prophecy cast into the orbit by the community.'
    };

    setSuggestions(prev => [newSug, ...prev]);
    setIsCasting(false);
    setNewTitle('');
    
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.8 },
      colors: ['#3b82f6', '#22c55e', '#f59e0b']
    });
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
          top: 0,
          left: 0,
          right: 0,
          padding: '24px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #2775d0, #1a5bb5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(39, 117, 208, 0.4)'
            }}
          >
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>Community</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Feed Page</div>
          </div>
        </div>
        <button
          onClick={onClose}
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
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* ── Orbit Space ── */}
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        {orbs.map((orb, idx) => (
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
                background: 'rgba(30, 41, 59, 0.4)',
                border: '2.5px solid rgba(39, 117, 208, 0.4)',
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
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                {suggestions[idx]?.category ?? 'Other'}
              </div>
              <div 
                style={{ 
                  fontSize: orb.size > 110 ? 12 : 10, 
                  fontWeight: 700, 
                  color: '#fff', 
                  lineHeight: 1.2,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {suggestions[idx]?.title ?? ''}
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowUpCircle size={10} color="#22c55e" />
                <span style={{ fontSize: 10, fontWeight: 900, color: '#22c55e' }}>{suggestions[idx]?.votes ?? 0}</span>
              </div>
            </div>
          </div>
        ))}
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
              onClick={() => {
                confetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 },
                  colors: ['#22c55e', '#3b82f6', '#f59e0b']
                });
              }}
              style={{
                flex: 2,
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: 14,
                padding: '14px',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 16px rgba(34, 197, 94, 0.25)',
                cursor: 'pointer'
              }}
            >
              <ArrowUpCircle size={18} />
              Back this Prophecy
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
        <button
          onClick={() => setIsCasting(true)}
          style={{
            position: 'absolute',
            bottom: 40,
            padding: '16px 32px',
            borderRadius: 30,
            background: 'linear-gradient(135deg, #2775d0, #1a5bb5)',
            border: 'none',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            boxShadow: '0 10px 25px rgba(39, 117, 208, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            animation: 'pulseGlow 2s ease-in-out infinite'
          }}
        >
          <MessageCircle size={20} />
          Ask the Crowd
        </button>
      )}
    </div>
  );
};



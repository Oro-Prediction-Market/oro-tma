import { useState } from "react";
import {
  CONSENT_BODY,
  CONSENT_CHECKS,
  CONSENT_LINKS_TOKEN,
} from "../consent/consentText";

/**
 * The consent form every user accepts before using Oro.
 *
 * Deliberately blocking: no close button, no backdrop dismiss, no Escape. A
 * consent you can wave away is not a consent, and the whole point of this gate
 * is that the server can later answer "did this user agree?" with something
 * better than an assumption. Declining is an explicit choice that signs the
 * user out; it is not the same as ignoring the form.
 *
 * Built as its own fixed overlay rather than on `BottomSheet`, whose backdrop
 * has `onClick={onClose}` hardwired with no opt-out — making that dismissable
 * component non-dismissable would have changed it for the two other features
 * that use it. This follows `OnboardingModal` instead, which is already a
 * blocking overlay for the same reason.
 *
 * Props are primitive on purpose — no user object, no API client. This file is
 * hand-copied into both frontends and must compile against the Telegram app,
 * which has no `shared/currency/`, so anything richer would break its build.
 * The two apps also reach Terms and Privacy differently — separate pages in the
 * PWA, one tabbed page in Telegram — so those are callbacks, not routes.
 */

export interface ConsentGateProps {
  open: boolean;
  /** Record the acceptance. Rejecting leaves the form open with an error. */
  onAccept: () => Promise<void> | void;
  /** Declining signs the user out — the account stays, unusable, until consent. */
  onDecline: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

export function ConsentGate({
  open,
  onAccept,
  onDecline,
  onOpenTerms,
  onOpenPrivacy,
}: ConsentGateProps) {
  const [checked, setChecked] = useState<boolean[]>(() =>
    CONSENT_CHECKS.map(() => false),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const allChecked = checked.every(Boolean);

  const accept = async () => {
    if (!allChecked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAccept();
    } catch {
      // Staying open is the correct failure mode: closing on a failed write
      // would let someone through with nothing recorded, which is the exact
      // situation this gate exists to end.
      setError("Could not record your consent. Please try again.");
      setBusy(false);
    }
  };

  const linkStyle = {
    color: "var(--color-primary, #2775d0)",
    textDecoration: "underline",
    textUnderlineOffset: 2,
    cursor: "pointer",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Consent to Oro's terms"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        // No onClick: this overlay does not dismiss.
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-card, #14162b)",
          border: "1px solid var(--border, rgba(255,255,255,0.1))",
          borderRadius: "var(--radius-lg, 16px)",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ padding: "18px 20px 12px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 900,
              color: "var(--text-main, #fff)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
            }}
          >
            Before you start
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "0.8rem",
              color: "var(--text-muted, #94a3b8)",
              lineHeight: 1.5,
            }}
          >
            Please read how Oro works and confirm you agree.
          </p>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 20px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {CONSENT_BODY.map((p) => (
            <div key={p.heading} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-subtle, #64748b)",
                  marginBottom: 3,
                }}
              >
                {p.heading}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  lineHeight: 1.6,
                  color: "var(--text-main, #e2e8f0)",
                }}
              >
                {p.body}
              </div>
            </div>
          ))}

          <div
            style={{
              height: 1,
              background: "var(--border, rgba(255,255,255,0.1))",
              margin: "4px 0 14px",
            }}
          />

          {CONSENT_CHECKS.map((text, i) => {
            const [before, after] = text.split(CONSENT_LINKS_TOKEN);
            return (
              <label
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor: "pointer",
                  marginBottom: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={(e) =>
                    setChecked((prev) => {
                      const next = [...prev];
                      next[i] = e.target.checked;
                      return next;
                    })
                  }
                  style={{
                    marginTop: 2,
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    accentColor: "var(--color-primary, #2775d0)",
                    cursor: "pointer",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.8rem",
                    lineHeight: 1.5,
                    color: "var(--text-muted, #cbd5e1)",
                  }}
                >
                  {after === undefined ? (
                    text
                  ) : (
                    <>
                      {before}
                      <a
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenTerms();
                        }}
                        style={linkStyle}
                      >
                        Terms and Conditions
                      </a>
                      {" and "}
                      <a
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenPrivacy();
                        }}
                        style={linkStyle}
                      >
                        Privacy Policy
                      </a>
                      {after}
                    </>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        <div
          style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid var(--border, rgba(255,255,255,0.1))",
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#ef4444",
                marginBottom: 8,
              }}
            >
              {error}
            </div>
          )}
          <button
            onClick={accept}
            disabled={!allChecked || busy}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: "var(--radius-md, 10px)",
              border: "none",
              background: "var(--color-primary, #2775d0)",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 800,
              cursor: allChecked && !busy ? "pointer" : "default",
              opacity: allChecked && !busy ? 1 : 0.4,
            }}
          >
            {busy ? "Saving…" : "I consent"}
          </button>
          <button
            onClick={onDecline}
            disabled={busy}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "10px 0",
              borderRadius: "var(--radius-md, 10px)",
              border: "none",
              background: "none",
              color: "var(--text-subtle, #64748b)",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
            }}
          >
            Decline and sign out
          </button>
        </div>
      </div>
    </div>
  );
}

import type { CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import "./NbaBanner.css";

const TEAMS = ["Celtics", "Lakers", "Warriors", "Thunder", "Knicks", "Nuggets", "Bucks", "Cavaliers", "76ers", "Mavericks", "Heat", "Spurs"];

interface NbaBannerProps {
  onClick?: () => void;
  onBack?: () => void;
  showCta?: boolean;
  variant?: "feed" | "hub";
  style?: CSSProperties;
  className?: string;
}

/** One court and visual identity for the feed and the hub masthead. */
export function NbaBanner({ onClick, onBack, showCta = true, variant = "feed", style, className }: NbaBannerProps) {
  const hub = variant === "hub";
  return (
    <div
      className={["nbab", hub && "nbab--hub", onClick && "nbab--interactive", className].filter(Boolean).join(" ")}
      style={style}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? "Explore the NBA hub" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <NbaCourt />
      <div className="nbab__shade" aria-hidden="true" />
      <div className="nbab__top">
        {onBack && <button type="button" className="nbab__back" aria-label="Go back" onClick={(event) => { event.stopPropagation(); onBack(); }}><ArrowLeft size={20} strokeWidth={2.25} /></button>}
        <span className="nbab__season"><span />2026/27 SEASON</span>
      </div>
      <div className="nbab__content">
        <div className="nbab__eyebrow">THE GAME IS YOURS</div>
        <div className="nbab__title">NBA<span className="nbab__title-dot">.</span></div>
        <div className="nbab__tagline">Big games. Bold calls.</div>
        <div className="nbab__description">{hub ? "Every game, every night. · Times in Bhutan" : "Step onto the court. Pick your winner."}</div>
      </div>
      {!hub && showCta && <div className="nbab__footer">
        <div className="nbab__ticker" aria-hidden="true">
          <div className="nbab__ticker-track">{[0, 1].map((copy) => <div className="nbab__ticker-group" key={copy}>{TEAMS.map((team) => <span key={team}>{team}<i>✦</i></span>)}</div>)}</div>
        </div>
        <span className="nbab__cta">Predict <span aria-hidden="true">↗</span></span>
      </div>}
    </div>
  );
}

/**
 * The banner's court and its shading, on their own so other NBA surfaces (the
 * market detail header) can stand on the same floor. Place inside an element
 * with the `nbab` class, which positions and clips it.
 */
export function NbaCourt() {
  return (
    <>
      <div className="nbab__arena" aria-hidden="true">
        <div className="nbab__court">
          <svg viewBox="0 0 940 500" preserveAspectRatio="none">
            <rect x="20" y="20" width="900" height="460" rx="2" />
            <path d="M470 20V480" />
            <circle cx="470" cy="250" r="60" />
            <circle cx="470" cy="250" r="9" />
            <path className="nbab__paint" d="M20 170H200V330H20ZM920 170H740V330H920Z" />
            <circle cx="200" cy="250" r="60" />
            <circle cx="740" cy="250" r="60" />
            <path d="M20 50H80A225 225 0 0 1 80 450H20M920 50H860A225 225 0 0 0 860 450H920" />
            <path d="M55 220V280M885 220V280" />
            <circle cx="70" cy="250" r="8" />
            <circle cx="870" cy="250" r="8" />
          </svg>
        </div>
      </div>
    </>
  );
}

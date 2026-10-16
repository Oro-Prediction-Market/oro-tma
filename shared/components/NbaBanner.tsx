import type { CSSProperties } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import "./NbaBanner.css";
import { SegmentDisplay } from "./SegmentDisplay";

const TEAMS = ["Celtics", "Lakers", "Warriors", "Thunder", "Knicks", "Nuggets", "Bucks", "Cavaliers", "76ers", "Mavericks", "Heat", "Spurs"];

interface NbaBannerProps {
  onClick?: () => void;
  onBack?: () => void;
  showCta?: boolean;
  style?: CSSProperties;
  className?: string;
}

/** The logo and the headline, for the feed card. */
function NbaHeadline() {
  return (
    <>
      <div className="nbac__brand">
        <img className="nbac__logo" src="/nba-logo.webp" alt="" width={86} height={166} decoding="async" />
        <span className="nbac__wordmark">NBA</span>
      </div>
      <div className="nbac__title">Step onto the court.<br />Pick your <em>winner.</em></div>
    </>
  );
}

/** The feed's NBA card: the hub cover's look, and the way into the hub. */
export function NbaBanner({ onClick, onBack, showCta = true, style, className }: NbaBannerProps) {
  return (
    <div
      className={["nbac nbac--card", onClick && "nbac--interactive", className].filter(Boolean).join(" ")}
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
      <div className="nbac__art" aria-hidden="true" />
      <div className="nbac__inner">
        <div className="nbac__top">
          {onBack && <button type="button" className="nbab__back" aria-label="Go back" onClick={(event) => { event.stopPropagation(); onBack(); }}><ArrowLeft size={20} strokeWidth={2.25} /></button>}
          <span className="nbac__season"><span /><SegmentDisplay value="2026/27" className="nbac__season-year" /><span className="nbac__season-word">Season</span></span>
        </div>
        <NbaHeadline />
      </div>
      {showCta && <div className="nbac__footer">
        <div className="nbac__ticker" aria-hidden="true">
          <div className="nbac__ticker-track">{[0, 1].map((copy) => <div className="nbac__ticker-group" key={copy}>{TEAMS.map((team) => <span key={team}>{team}<i>✦</i></span>)}</div>)}</div>
        </div>
        <span className="nbac__cta">Predict now <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" /></span>
      </div>}
    </div>
  );
}

export interface NbaHubStat {
  label: string;
  value: string;
  /** Shown in the live red while there is something live. */
  live?: boolean;
  onClick?: () => void;
}

/**
 * The hub's cover: the arena photo on the right, fading into the night-navy
 * page on the left where the lockup sits, and the hub's three counters
 * along the bottom.
 */
export function NbaHubCover({ onBack, stats }: { onBack?: () => void; stats: NbaHubStat[] }) {
  return (
    <header className="nbac nbac--hub">
      <div className="nbac__art" aria-hidden="true" />
      {/* The back arrow sits in the cover's top-left corner, apart from the content column. */}
      {onBack && <div className="nbac__bar">
        <button type="button" className="nbab__back" aria-label="Go back" onClick={onBack}><ArrowLeft size={20} strokeWidth={2.25} /></button>
      </div>}
      <div className="nbac__inner">
        <div className={onBack ? "nbac__top nbac__top--back" : "nbac__top"}>
          <div className="nbac__lockup">
            <img src="/nba-logo.webp" alt="" width={86} height={166} decoding="async" />
            <div>
              <h1 className="nbac__lockup-name">NBA</h1>
              <div className="nbac__lockup-sub"><span />2026/27 Season</div>
            </div>
          </div>
        </div>
        <div className="nbac__hero">
          <p className="nbac__tagline">Follow the action. Predict the outcomes.</p>
        </div>
        <div className="nbac__stats">
          {stats.map((s) => (
            <button key={s.label} type="button" className="nbac__stat" onClick={s.onClick} disabled={!s.onClick}>
              {/* The number, scoreboard-style, where an icon would sit. */}
              <SegmentDisplay value={s.value} className={s.live ? "nbac__stat-value nbac__stat-value--live" : "nbac__stat-value"} />
              <span className="nbac__stat-label">{s.label}</span>
              {s.onClick && <ChevronRight className="nbac__stat-chevron" size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

import type { CSSProperties } from "react";

/**
 * Numbers drawn as a seven-segment scoreboard, unlit segments faintly visible
 * behind the lit ones like a real arena clock. Sized by font-size (a digit is
 * 1em tall) and coloured by `color`, so it drops into text like a font would.
 *
 * Digits, ":", "-" and "/" are drawn; anything else (a space, "AM") is left to the
 * surrounding text, so pass only the numeric part.
 */

const W = 60;
const H = 100;
const T = 11; // segment thickness
const G = 2.5; // gap between segments

/** A horizontal segment, pointed at both ends, centred on y. */
const hSeg = (y: number) => {
  const x1 = T / 2 + G;
  const x2 = W - T / 2 - G;
  const h = T / 2;
  return `${x1},${y} ${x1 + h},${y - h} ${x2 - h},${y - h} ${x2},${y} ${x2 - h},${y + h} ${x1 + h},${y + h}`;
};
/** A vertical segment, pointed at both ends, centred on x, from y1 to y2. */
const vSeg = (x: number, y1: number, y2: number) => {
  const h = T / 2;
  return `${x},${y1} ${x + h},${y1 + h} ${x + h},${y2 - h} ${x},${y2} ${x - h},${y2 - h} ${x - h},${y1 + h}`;
};

const L = T / 2;
const R = W - T / 2;
const TOP = T / 2;
const MID = H / 2;
const BOT = H - T / 2;
const SEGMENTS = {
  a: hSeg(TOP),
  b: vSeg(R, TOP + G, MID - G),
  c: vSeg(R, MID + G, BOT - G),
  d: hSeg(BOT),
  e: vSeg(L, MID + G, BOT - G),
  f: vSeg(L, TOP + G, MID - G),
  g: hSeg(MID),
} as const;
type Seg = keyof typeof SEGMENTS;
const ALL = Object.keys(SEGMENTS) as Seg[];

const LIT: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  "–": "g",
};

function Digit({ ch }: { ch: string }) {
  const lit = LIT[ch] ?? "";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ height: "1em", width: "0.6em", overflow: "visible" }}
      aria-hidden
    >
      {ALL.map((s) => (
        <polygon
          key={s}
          points={SEGMENTS[s]}
          fill="currentColor"
          opacity={lit.includes(s) ? 1 : 0.09}
        />
      ))}
    </svg>
  );
}

function Colon() {
  return (
    <svg
      viewBox={`0 0 20 ${H}`}
      style={{ height: "1em", width: "0.2em", overflow: "visible" }}
      aria-hidden
    >
      <rect x="4" y="26" width="12" height="12" rx="2" fill="currentColor" />
      <rect x="4" y="62" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function Slash() {
  return (
    <svg
      viewBox={`0 0 36 ${H}`}
      style={{ height: "1em", width: "0.36em", overflow: "visible" }}
      aria-hidden
    >
      <polygon points="26,4 34,4 10,96 2,96" fill="currentColor" />
    </svg>
  );
}

export function SegmentDisplay({
  value,
  className,
  style,
}: {
  value: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className}
      role="img"
      aria-label={value}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.1em",
        lineHeight: 1,
        // A slight forward lean and a glow, as on a lit scoreboard.
        transform: "skewX(-6deg)",
        filter: "drop-shadow(0 0 0.12em currentColor)",
        ...style,
      }}
    >
      {[...value].map((ch, i) =>
        ch === ":" ? (
          <Colon key={i} />
        ) : ch === "/" ? (
          <Slash key={i} />
        ) : ch === " " ? (
          <span key={i} style={{ width: "0.25em" }} />
        ) : (
          <Digit key={i} ch={ch} />
        ),
      )}
    </span>
  );
}

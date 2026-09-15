/**
 * The consent every user accepts before using Oro.
 *
 * Kept in one file so the wording can be replaced without touching the gate,
 * the endpoint or the migration: edit the strings, bump `CONSENT_VERSION`, and
 * the stored version tells you who agreed to which text.
 *
 * The wording is deliberately not new. Each line below already existed
 * somewhere in the product and was reviewed there — the pool mechanics from the
 * FAQ (`FaqModal.tsx`), the payout caveat from `PayoutBreakdown.tsx`, the risk
 * of total loss from Terms §12.1, and the three declarations verbatim from the
 * Telegram signup wizard, which asked for them and then discarded the answer.
 * Inventing fresh legal phrasing here would have put unreviewed text in front
 * of every user.
 *
 * Hand-copied byte-identical into both frontends.
 */

/**
 * Bump when the text below changes materially.
 *
 * "0" is reserved: it marks the rows the introducing migration granted consent
 * to rather than collected it from, and the server refuses it from a client.
 */
export const CONSENT_VERSION = "1.0";

/**
 * How Oro works, in the fewest words that still say it.
 *
 * One short line each, no headings and no paragraphs: this is read once, by
 * someone who wants to get into the app, on a phone. A screen of prose is
 * scrolled past, and consent to text nobody read is worth little. Everything
 * here is the plain-English version of wording that already exists in the FAQ,
 * `PayoutBreakdown` and Terms §12.1; the full detail is a tap away on the
 * Terms page rather than inlined.
 */
export const CONSENT_BODY: string[] = [
  "Oro is a prediction market. You stake on what you think will happen.",
  // The mechanism is named once, in brackets, because ST asked for it
  // explicitly — but the sentence still reads without knowing the word.
  "Every stake on a market goes into one shared pool (a parimutuel pool).",
  "When the market closes, the pool — minus Oro's fee — is split between everyone who got it right.",
  "Odds move as other people predict, so any payout you see beforehand is an estimate, not a promise.",
  "You can lose everything you stake. Only use money you can afford to lose.",
];

/**
 * The three declarations.
 *
 * Plain-English rewrites of the wording the Telegram signup wizard used, which
 * was dense enough that ticking it without reading was the likely outcome. The
 * meaning is unchanged — agreement to the Terms, eligibility where you live,
 * and truthful details — but this is the half of the form with legal weight, so
 * the original phrasing is worth a second opinion before it ships.
 *
 * The first carries the Terms and Privacy link, which the gate renders in place
 * of the {links} marker — the two apps route there differently, so the
 * destination is the gate's problem, not this file's.
 */
export const CONSENT_CHECKS: string[] = [
  "I have read and agree to Oro's {links}.",
  "I'm allowed to use Oro where I live.",
  "The details I gave are true.",
];

/** The marker inside the first check, replaced with the Terms/Privacy links. */
export const CONSENT_LINKS_TOKEN = "{links}";

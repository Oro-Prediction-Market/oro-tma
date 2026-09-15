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

export interface ConsentParagraph {
  heading: string;
  body: string;
}

/** What Oro is and how it settles — the summary the user reads before agreeing. */
export const CONSENT_BODY: ConsentParagraph[] = [
  {
    heading: "What Oro is",
    body: "Oro is a prediction market platform. You stake on what you think will happen, and the platform aggregates everyone's positions into a consensus forecast. Oro is not a bank, a broker, or an investment service, and nothing on it is financial advice.",
  },
  {
    heading: "How the pool works",
    body: "Oro runs a parimutuel pool. All stakes on a market go into a single shared pool. When the market resolves, the total pool minus the platform fee is distributed proportionally among everyone who predicted the winning outcome.",
  },
  {
    heading: "Why your payout moves",
    body: "Odds shift in real time as more people predict. The more people who pick the same outcome as you, the smaller each person's share of the pool — and the lower your payout. Any figure shown before you confirm is an estimate, and your final amount is settled from the pool at close.",
  },
  {
    heading: "The platform fee",
    body: "Oro deducts a platform fee from each pool before it is distributed. The fee applying to a market is shown on that market before you confirm a prediction.",
  },
  {
    heading: "How markets are settled",
    body: "Each market states the source its outcome is settled from, and is resolved against that source after it closes. Where a resolution is disputed, the dispute process in the Terms applies.",
  },
  {
    heading: "The risk",
    body: "Participation involves the risk of total loss of the funds you commit to a position. Only take part with money you can afford to lose. Past accuracy on Oro does not guarantee future accuracy.",
  },
];

/**
 * The three declarations, verbatim from the Telegram signup wizard.
 *
 * The first contains the Terms and Privacy link, which the gate renders in
 * place of the {links} marker — the two apps route there differently, so the
 * destination is the gate's problem, not this file's.
 */
export const CONSENT_CHECKS: string[] = [
  "I confirm that I have read, understood, and agree to be bound by the {links} of this platform.",
  "I confirm that I am eligible to participate in this platform and that my participation is permitted under the laws, regulations, and policies applicable in my country or jurisdiction of residence.",
  "I declare that the information provided by me during onboarding is true, accurate, and complete.",
];

/** The marker inside the first check, replaced with the Terms/Privacy links. */
export const CONSENT_LINKS_TOKEN = "{links}";

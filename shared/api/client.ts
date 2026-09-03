// ─────────────────────────────────────────────────────────────────────────────
// API client — all requests to the NestJS backend go through here
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// JWT lives only in memory — Telegram re-authenticates via initData on every open.
// Never persisted to localStorage or sessionStorage to prevent XSS token theft.
let _token: string | null = null;

export function setToken(token: string) {
  _token = token;
}

export function getToken(): string | null {
  return _token;
}

export function clearToken() {
  _token = null;
}

// Decode a JWT payload without a library — returns null if malformed
export function decodeTokenPayload(token: string): Record<string, any> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

// Returns true if the stored token exists and has not expired
export function isTokenValid(): boolean {
  const token = getToken();
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return false;
  // exp is in seconds; give a 30-second buffer
  return payload.exp * 1000 > Date.now() + 30_000;
}

/**
 * URL for the CORS-friendly avatar proxy. Telegram's photo hosts don't send
 * CORS headers on the image itself, so the share-card <canvas> can't draw them
 * directly without tainting (which breaks PNG export). This backend route
 * re-serves the photo from our origin with proper CORS.
 */
export function avatarUrl(userId: string): string {
  return `${API_URL}/users/avatar/${encodeURIComponent(userId)}`;
}

/**
 * `onError` for an avatar <img> whose `src` is the user's stored `photoUrl`.
 *
 * Stored photo URLs go stale — a Telegram Bot API file link dies after ~1hr and
 * is only refreshed at login, which a long Mini App session never reaches — so
 * a dead link would otherwise paint a broken-image icon. On failure we retry
 * once through {@link avatarUrl}, which re-resolves the photo server-side and
 * always answers with an image (falling back to generated initials).
 *
 * Deliberately a fallback rather than the primary `src`: pointing every avatar
 * at our own backend puts a healthy photo behind an extra hop and makes ONE
 * endpoint the single point of failure for every avatar in the app.
 */
export function avatarFallback(userId: string) {
  return (event: { currentTarget: HTMLImageElement }) => {
    const img = event.currentTarget;
    if (img.dataset.avatarRetried) return; // proxy failed too — stop, no loop
    img.dataset.avatarRetried = "1";
    img.src = avatarUrl(userId);
  };
}

// ─── In-app notifications ─────────────────────────────────────────────────────

export interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

/** Unseen in-app notifications for the current user (popped once on app open). */
export function getMyNotifications(): Promise<UserNotification[]> {
  return request<UserNotification[]>("/users/me/notifications").catch(() => []);
}

/** Mark notifications seen (by id, or all unseen when omitted) so they don't pop again. */
export function markNotificationsSeen(
  ids?: string[],
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/users/me/notifications/seen", {
    method: "POST",
    body: JSON.stringify(ids?.length ? { ids } : {}),
  })
    .catch(() => ({ ok: false }))
    .then((r) => {
      bustCache("/users/me/notifications");
      return r;
    });
}

/** Report unlocked achievement badges so the backend creates a one-time
 *  notification per new badge. `seenIds` baselines already-acknowledged badges. */
export function syncAchievements(
  badges: { id: string; name: string; requirement?: string }[],
  seenIds: string[] = [],
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/users/me/achievements/sync", {
    method: "POST",
    body: JSON.stringify({ badges, seenIds }),
  })
    .catch(() => ({ ok: false }))
    .then((r) => {
      bustCache("/users/me/notifications");
      return r;
    });
}

/**
 * Relay a support message through the backend, which forwards it to Oro's
 * support inbox. The destination address lives only on the server — it never
 * appears in the frontend, so it can't be scraped or reveal the operator.
 */
export async function sendFeedback(
  email: string,
  message: string,
): Promise<{ ok: true }> {
  return request<{ ok: true }>("/feedback", {
    method: "POST",
    body: JSON.stringify({ email, message }),
  });
}

// ─── In-memory GET cache (stale-while-revalidate, 15s TTL) ───────────────────
const _cache = new Map<
  string,
  { data: unknown; expiresAt: number; inflight?: Promise<unknown> }
>();
const CACHE_TTL_MS = 5_000;

export function bustCache(pathPrefix?: string) {
  if (!pathPrefix) {
    _cache.clear();
    return;
  }
  for (const key of _cache.keys()) {
    if (key.startsWith(pathPrefix)) _cache.delete(key);
  }
}

async function fetchAndCache<T>(
  path: string,
  options: RequestInit,
  cacheKey: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("oro:unauthorized"));
    const err = await res.json().catch(() => ({ message: "Unauthorized" }));
    throw new Error(err.message || "Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  const data: T = await res.json();
  _cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

// Base fetch wrapper — automatically attaches Bearer token
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isGet = !options.method || options.method.toUpperCase() === "GET";
  const cacheKey = isGet ? `${path}::${_token ?? ""}` : null;

  if (cacheKey) {
    const hit = _cache.get(cacheKey);
    if (hit) {
      if (hit.expiresAt > Date.now()) return hit.data as T;
      // Stale — serve cached value but revalidate in background
      if (!hit.inflight) {
        hit.inflight = fetchAndCache<T>(path, options, cacheKey).catch(
          () => undefined,
        );
      }
      return hit.data as T;
    }
    return fetchAndCache<T>(path, options, cacheKey);
  }

  // Non-GET: never cache, bust any cached version of this path
  bustCache(path);
  return fetchAndCache<T>(path, options, `__nocache__${Date.now()}`);
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface TelegramProfile {
  telegramId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

export interface AuthUser {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  isAdmin: boolean;
  balance: string;
  creditsBalance?: number;
  createdAt?: string;
  // DK Bank linking fields
  dkCid?: string | null;
  dkAccountName?: string | null;
  telegramLinkedAt?: string | null;
  // Boolean flags — hashes are never sent to the client
  isDkPhoneLinked?: boolean;
  isPhoneVerified?: boolean;
  // Reputation
  reputationScore?: number | null;
  reputationTier?: string;
  totalPredictions?: number;
  correctPredictions?: number;
  categoryScores?: Record<string, { correct: number; total: number }> | null;
  // Contrarian badge
  contrarianBadge?: "bronze" | "silver" | "gold" | null;
  contrarianWins?: number;
  contrarianAttempts?: number;
  // Daily bet streak
  betStreakCount?: number;
  dayInCycle?: number;
  nextBoostInDays?: number;
  boostReady?: boolean;
  // Referrals
  referralCount?: number;
  featuredAchievementIds?: string[];
  // Season-scoped EPL/UCL tallies for the season collectible badges, keyed by
  // season (e.g. "2026-27"). Counts only that season's settled predictions.
  seasonBadgeStats?: Record<
    string,
    { eplSettled: number; eplWins: number; uclSettled: number; uclWins: number }
  >;
}

export interface AuthResponse {
  token: string;
  user: AuthUser | null;
  isNewUser?: boolean;
  requiresKYC?: boolean;
  telegramProfile?: TelegramProfile;
  referralCode?: string;
}

/** Login / register using Telegram initData (HMAC validated on server) */
export async function loginWithTelegram(
  initData: string,
  referralCode?: string,
): Promise<AuthResponse> {
  const result = await request<AuthResponse>("/auth/telegram", {
    method: "POST",
    body: JSON.stringify({
      initData,
      ...(referralCode ? { referralCode } : {}),
    }),
  });
  // Only persist the token when fully authenticated (not pre-KYC)
  if (!result.requiresKYC && result.user) {
    setToken(result.token);
  }
  return result;
}

/** Check whether a username is available during onboarding. */
export async function checkUsernameAvailable(
  username: string,
): Promise<{ available: boolean }> {
  return request<{ available: boolean }>(
    `/users/check/username/${encodeURIComponent(username)}`,
  );
}

/** Send OTP to phone/email via Telegram bot during onboarding. Requires pre-KYC token. */
export async function sendOnboardOtp(
  data: { phoneNumber?: string; email?: string; cid?: string },
  preKycToken: string,
): Promise<{ sent: boolean }> {
  const headers = { Authorization: `Bearer ${preKycToken}` };
  const res = await fetch(`${API_URL}/users/send-onboard-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Complete onboarding registration. Requires pre-KYC token. Returns full JWT + user. */
export async function registerTelegramUser(
  data: {
    username: string;
    fullName: string;
    otp: string;
    phoneNumber?: string;
    email?: string;
    referralCode?: string;
    photoUrl?: string;
  },
  preKycToken: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/users/telegram/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${preKycToken}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const result: { token: string; user: AuthUser } = await res.json();
  setToken(result.token);
  return result;
}

/** Login / register using DK Bank CID — for PWA users without Telegram */
export async function loginWithDKBank(
  cid: string,
  password?: string,
): Promise<AuthResponse> {
  const result = await request<AuthResponse>("/auth/dkbank", {
    method: "POST",
    body: JSON.stringify({ cid, ...(password ? { password } : {}) }),
  });
  setToken(result.token);
  return result;
}

/**
 * Check whether the account for a given CID has a PWA password set.
 * Used by the PWA login form to know whether to show the password field.
 */
export async function getPwaStatus(
  cid: string,
): Promise<{ hasPassword: boolean }> {
  return request<{ hasPassword: boolean }>(
    `/auth/pwa-status?cid=${encodeURIComponent(cid)}`,
  );
}

/**
 * Set or change the PWA login password from inside the TMA.
 * Requires a valid JWT (TMA session).
 */
export async function setPwaPassword(
  password: string,
): Promise<{ ok: boolean; message: string }> {
  return request("/auth/set-pwa-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

/**
 * Link a DK Bank CID to the currently authenticated Telegram user.
 * Requires a valid JWT. Stores dkPhoneHash on the user row so that
 * the bot's /verify phone check can compare Telegram phone == DK phone.
 */
export async function linkDKBank(cid: string): Promise<AuthResponse> {
  const result = await request<AuthResponse>("/auth/link-dkbank", {
    method: "POST",
    body: JSON.stringify({ cid }),
  });
  // Bust the /users/me cache so the next getMe() call reflects the newly
  // linked DK Bank account instead of returning the 15s stale snapshot.
  bustCache("/users/me");
  return result;
}

/**
 * Verify phone from Telegram.WebApp.requestContact() inside the TMA.
 * The hash is signed by Telegram with the bot token — the backend verifies
 * this signature before trusting the phone number.
 */
export async function verifyPhoneTma(params: {
  phoneNumber: string;
  userId: number;
  authDate: number;
  hash: string;
}): Promise<{
  linked: boolean;
  requiresAccountVerification?: boolean;
  message: string;
}> {
  const result = await request<{
    linked: boolean;
    requiresAccountVerification?: boolean;
    message: string;
  }>("/auth/verify-phone-tma", {
    method: "POST",
    body: JSON.stringify(params),
  });
  bustCache("/users/me");
  return result;
}

/**
 * Fallback verification for users whose Telegram phone differs from their
 * DK Bank registered phone (e.g. Bhutanese users abroad with a foreign SIM).
 * User proves account ownership by entering their full DK Bank account number.
 */
export async function verifyDKAccount(
  accountNumber: string,
): Promise<{ verified: boolean; message: string }> {
  const result = await request<{ verified: boolean; message: string }>(
    "/auth/verify-dk-account",
    {
      method: "POST",
      body: JSON.stringify({ accountNumber }),
    },
  );
  bustCache("/users/me");
  return result;
}

// ─── Bank account linking (new flow: CID → OTP to DK phone → verify) ─────────

export interface LinkedBankAccount {
  id: string;
  cid: string;
  accountNumber: string | null;
  accountName: string | null;
  maskedPhone: string | null;
  isDefault: boolean;
  verifiedAt: string | null;
}

export async function linkBankAccount(
  cid: string,
  phone?: string,
): Promise<{ accountName: string; maskedPhone: string; requiresOtp: boolean }> {
  // Whether an OTP is required is decided by the server (it skips only when the
  // DK-registered phone matches the user's already-verified phone). The client
  // must honour `requiresOtp` in the response rather than asserting a skip.
  return request("/payments/bank/link", {
    method: "POST",
    body: JSON.stringify({
      cid,
      ...(phone ? { phone } : {}),
    }),
  });
}

export async function verifyBankLink(otp: string): Promise<LinkedBankAccount> {
  return request("/payments/bank/verify", {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}

export function getLinkedBankAccounts(): Promise<LinkedBankAccount[]> {
  return request("/payments/bank/accounts");
}

// ─── Markets ─────────────────────────────────────────────────────────────────

export interface Outcome {
  id: string;
  label: string;
  totalBetAmount: string;
  currentOdds: string;
  lmsrProbability?: number;
  reputationSignal?: number | null;
  intelligenceProb?: number | null;
  isWinner: boolean;
  /** True once this outcome is eliminated (e.g. a team knocked out). No new bets accepted. */
  isEliminated?: boolean;
  marketId: string;
  imageUrl?: string | null;
}

export interface SignalMeta {
  participantCount: number;
  reputationDepth: number;
  maturityScore: number;
  composite: number;
}

export interface Market {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageUrlAlt: string | null;
  status:
    | "upcoming"
    | "open"
    | "closed"
    | "resolving"
    | "resolved"
    | "settled"
    | "cancelled";
  liquidityParam: string;
  totalPool: string;
  houseEdgePct: string;
  opensAt: string | null;
  closesAt: string | null;
  bettingClosesAt: string | null;
  resolvedAt: string | null;
  proposedOutcomeId: string | null;
  resolvedOutcomeId: string | null;
  disputeDeadlineAt: string | null;
  resolutionCriteria: string | null;
  category: string | null;
  subcategory: string | null;
  externalSource: string | null;
  externalMarketType: string | null;
  settlementSource: string | null;
  /** Non-null for grouped multi-binary events (e.g. political races): all
   *  sibling Yes/No candidate markets share one groupId. */
  groupId: string | null;
  /** Umbrella event title shared by all markets in the group. */
  groupTitle: string | null;
  metadata: Record<string, any> | null;
  evidenceNote: string | null;
  signalMeta: SignalMeta | null;
  /** Admin-pinned featured flag — hub feature slots prefer this market. */
  isFeatured: boolean;
  createdAt: string;
  outcomes: Outcome[];
}

export type DisputeSide = "object" | "support";
export type DisputeBondStatus =
  | "locked"
  | "rewarded"
  | "forfeited"
  | "not_applicable";

export interface Dispute {
  id: string;
  userId: string;
  marketId: string;
  bondAmount: string;
  reason: string | null;
  /** "object" challenges the proposal; "support" defends it. */
  side: DisputeSide;
  /** true = this side won, false = lost, null = not settled yet. */
  upheld: boolean | null;
  bondStatus: DisputeBondStatus;
  /** Reward paid on top of the returned bond when this side won; "0" otherwise. */
  rewardAmount: string;
  createdAt: string;
}

export interface SubmitDisputePayload {
  reason: string;
  /** Only the FIRST objector may set this (min 10). Others match automatically — omit it. */
  bondAmount?: number;
  /** "object" (default) challenges the proposal; "support" defends it. */
  side?: DisputeSide;
}

export function getDisputes(marketId: string): Promise<Dispute[]> {
  return request<Dispute[]>(`/markets/${marketId}/disputes`);
}

/** The caller's OWN dispute for a market — result + bond + reward, or null. */
export interface MyDispute {
  id: string;
  reason: string | null;
  side: DisputeSide;
  /** true = this side won, false = lost, null = not settled yet. */
  upheld: boolean | null;
  bondAmount: string;
  bondStatus: DisputeBondStatus;
  /** Reward paid on top of the returned bond when this side won; "0" otherwise. */
  rewardAmount: string;
  createdAt: string;
}

export function getMyDispute(marketId: string): Promise<MyDispute | null> {
  return request<MyDispute | null>(`/markets/${marketId}/my-dispute`);
}

/** A dispute the caller raised on some market, with its settled result. */
export interface MyDisputeSummary {
  id: string;
  marketId: string;
  marketTitle: string | null;
  side: DisputeSide;
  /** true = this side won, false = lost, null = not settled yet. */
  upheld: boolean | null;
  bondAmount: string;
  bondStatus: DisputeBondStatus;
  rewardAmount: string;
  createdAt: string;
}

export function getMyDisputes(): Promise<MyDisputeSummary[]> {
  return request<MyDisputeSummary[]>("/markets/my-disputes");
}

export interface DisputeInfo {
  /** OBJECT-side count. */
  objectionCount: number;
  objectCount: number;
  supportCount: number;
  windowOpen: boolean;
  windowClosesAt: string | null;
  windowMinutes: number;
  canObject: boolean;
  /** Fixed per-head bond once the first objector set it; null until then. */
  bondRequired: number | null;
  /** true once the bond is locked in for everyone (after the first objection). */
  bondFixed: boolean;
  /** Floor for the first objector's chosen bond. */
  minBond: number;
  bondNote: string;
}

export function getDisputeInfo(marketId: string): Promise<DisputeInfo> {
  return request<DisputeInfo>(`/markets/${marketId}/dispute-info`);
}

export function submitDispute(
  marketId: string,
  payload: SubmitDisputePayload,
): Promise<Dispute> {
  return request<Dispute>(`/markets/${marketId}/disputes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ActivityEvent {
  type: "bet" | "win";
  userName: string;
  outomeLabel: string; // note: matches backend spelling
  marketTitle: string;
  marketId: string;
  amount: number;
  placedAt: string;
}

export function getRecentActivity(): Promise<ActivityEvent[]> {
  return request<ActivityEvent[]>("/markets/activity");
}

export function feedHeartbeat(sessionId: string): Promise<{ count: number }> {
  return request<{ count: number }>("/markets/feed/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
}

export function getMarkets(q?: string): Promise<Market[]> {
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return request<Market[]>(`/markets${qs}`);
}

export function getMarket(id: string): Promise<Market> {
  return request<Market>(`/markets/${id}`);
}

export interface ResolvedMarket {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageUrlAlt: string | null;
  category: string | null;
  subcategory: string | null;
  status: "resolved" | "settled";
  totalPool: number;
  resolutionCriteria: string | null;
  createdAt: string;
  opensAt: string | null;
  closesAt: string | null;
  resolvedAt: string | null;
  participantCount: number;
  winner: { id: string; label: string } | null;
  objectionCount: number;
  outcomeChanged: boolean;
  evidence: {
    url: string | null;
    note: string | null;
    submittedAt: string | null;
  };
}

export function getResolvedMarkets(): Promise<ResolvedMarket[]> {
  return request<ResolvedMarket[]>("/markets/resolved");
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export interface PlaceBetPayload {
  outcomeId: string;
  amount: number;
}

export interface BetStreak {
  count: number;
  dayInCycle: number;
  boostActive: boolean;
}

export interface PlaceBetResult {
  id: string;
  streak?: BetStreak;
  [key: string]: any;
}

export function placeBet(
  marketId: string,
  payload: PlaceBetPayload,
): Promise<PlaceBetResult> {
  bustCache(`/markets/${marketId}`);
  bustCache("/markets");
  return request<PlaceBetResult>(`/markets/${marketId}/bets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface Bet {
  id: string;
  amount: number;
  status: "pending" | "won" | "lost" | "refunded";
  oddsAtPlacement: number | null;
  payout: number | null;
  placedAt: string;
  marketId: string;
  outcomeId: string;
  /** Currency the stake was placed in — "BTN" (default) or "USDT". */
  currency?: "BTN" | "USDT";
  market?: Market;
  outcome?: Outcome;
}

export interface Transaction {
  id: string;
  type:
    | "deposit"
    | "withdrawal"
    | "bet_placed"
    | "bet_payout"
    | "refund"
    | "dispute_bond"
    | "dispute_refund"
    | "dispute_bond_lock"
    | "dispute_bond_forfeit"
    | "dispute_bond_reward"
    | "referral_bonus"
    | "referral_prize"
    | "streak_bonus"
    | "duel_wager"
    | "duel_payout"
    | "free_credit"
    | "season_prize";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  positionId: string | null;
  paymentId: string | null;
  stakeAmount: number | null;
  createdAt: string;
}

export function getMyBets(status?: Bet["status"]): Promise<Bet[]> {
  const qs = status ? `?status=${status}` : "";
  return request<Bet[]>(`/users/me/bets${qs}`);
}

export function getMyResults(): Promise<Bet[]> {
  return request<Bet[]>("/users/me/results");
}

// ─── User ─────────────────────────────────────────────────────────────────────

export function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/users/me");
}
export function setFeaturedAchievements(achievementIds: string[]): Promise<{ featuredAchievementIds: string[] }> { return request("/users/me/featured-achievements", { method: "POST", body: JSON.stringify({ achievementIds }) }); }

export interface PublicProfile {
  id: string; firstName: string | null; lastName: string | null; username: string | null;
  photoUrl: string | null; reputationTier: string; reputationScore: number | null;
  totalPredictions: number; correctPredictions: number; winRate: number; rank: number | null;
  betStreak?: number; contrarianBadge: string | null; contrarianWins: number; joinedAt: string;
  featuredAchievementIds?: string[];
  seasonBadgeStats?: Record<
    string,
    { eplSettled: number; eplWins: number; uclSettled: number; uclWins: number }
  >;
  recentCalls?: Array<{ id: string; marketTitle: string; outcomeLabel: string; status: "won" | "lost" | "refunded"; payout: number | null; placedAt: string }>;
}
export function getPublicProfile(id: string): Promise<PublicProfile> {
  return request<PublicProfile>(`/users/profiles/${encodeURIComponent(id)}`);
}

export function getMyTransactions(
  type?: Transaction["type"],
): Promise<Transaction[]> {
  const qs = type ? `?type=${type}` : "";
  return request<Transaction[]>(`/users/me/transactions${qs}`);
}

// ─── TON Wallet Betting ──────────────────────────────────────────────────────

export interface WalletBetPayload {
  outcomeId: string;
  amount: number; // in TON
  walletAddress: string;
  txHash?: string; // proof of payment
}

/** Place a bet using TON wallet (no login required) */
export async function placeBetWithWallet(
  marketId: string,
  payload: WalletBetPayload,
) {
  bustCache(`/markets/${marketId}`);
  bustCache("/markets");
  // No auth token needed — wallet address is the identifier
  const res = await fetch(`${API_URL}/markets/${marketId}/bets/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

/** Get bets by wallet address (no login required) */
export function getBetsByWallet(walletAddress: string) {
  return fetch(`${API_URL}/bets/wallet/${walletAddress}`).then((r) =>
    r.ok ? r.json() : Promise.reject(r.statusText),
  );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  reputationScore: number | null;
  reputationTier: string;
  totalPredictions: number;
  correctPredictions: number;
  winRate: number;
  totalBetAmount: number;
  /** Effective daily-bet streak (0 when a day has been missed). */
  betStreak?: number;
  weeklyPredictions?: number;
  weeklyWins?: number;
  isMe: boolean;
}

export interface LeaderboardResponse {
  board: LeaderboardEntry[];
  myRank: number | null;
  totalRanked: number;
}

export function getLeaderboard(
  period: "all" | "week" = "all",
): Promise<LeaderboardResponse> {
  return request<LeaderboardResponse>(`/users/leaderboard?period=${period}`);
}

// ─── Challenges (Prediction Duels) ───────────────────────────────────────────

export type CardType = "doubleDown" | "shield" | "ghost";

export interface CardInventory {
  doubleDown: number;
  shield: number;
  ghost: number;
}

export interface ChallengeResponse {
  id: string;
  marketId: string;
  marketTitle: string | null;
  outcomeId: string;
  outcomeLabel: string | null;
  creatorId: string;
  creatorName: string | null;
  joinerId: string | null;
  joinerName: string | null;
  winnerId: string | null;
  /** null when Ghost card is active and viewer is not the creator */
  wagerAmount: number | null;
  isOwner: boolean;
  participantCount: number;
  status: "open" | "active" | "settled" | "expired" | "void";
  equippedCard: CardType | null;
  expiresAt: string;
  settledAt: string | null;
  createdAt: string;
  link: string;
}

export interface DuelLeaderboardEntry {
  userId: string;
  username: string | null;
  wins: number;
  wagerWon: number;
}

export function createChallenge(
  marketId: string,
  outcomeId: string,
  wagerAmount: number = 0,
  equippedCard?: CardType,
): Promise<ChallengeResponse> {
  return request<ChallengeResponse>("/challenges", {
    method: "POST",
    body: JSON.stringify({
      marketId,
      outcomeId,
      wagerAmount,
      ...(equippedCard ? { equippedCard } : {}),
    }),
  });
}

export function getMyCards(): Promise<CardInventory> {
  return request<CardInventory>("/challenges/cards");
}

export function getChallenges(): Promise<ChallengeResponse[]> {
  return request<ChallengeResponse[]>("/challenges");
}

export function getOpenChallenges(): Promise<ChallengeResponse[]> {
  return request<ChallengeResponse[]>("/challenges/open");
}

export function getDuelLeaderboard(): Promise<DuelLeaderboardEntry[]> {
  return request<DuelLeaderboardEntry[]>("/challenges/leaderboard");
}

export function joinChallenge(challengeId: string): Promise<ChallengeResponse> {
  return request<ChallengeResponse>(`/challenges/${challengeId}/join`, {
    method: "POST",
  });
}

/** Minimal challenge info shown before sign-in, from a `challenge_<id>` deep link. */
export interface ChallengePreview {
  id: string;
  marketId: string;
  marketTitle: string | null;
  marketStatus: string | null;
  outcomeId: string;
  outcomeLabel: string | null;
  creatorName: string;
  wagerAmount: number | null;
  status: string;
  expiresAt: string | null;
}

/** Public — no auth required. Resolves a challenge deep link to its market. */
export function getChallengePreview(
  challengeId: string,
): Promise<ChallengePreview> {
  return request<ChallengePreview>(`/challenges/${challengeId}/preview`);
}

// ─── Seasons ─────────────────────────────────────────────────────────────────

export interface Season {
  id: string;
  weekNumber: number;
  year: number;
  startsAt: string;
  endsAt: string;
  status: "active" | "closed";
  winnersSnapshot:
    | {
        rank: number;
        userId: string;
        firstName: string | null;
        username: string | null;
        reputationScore: number | null;
        reputationTier: string;
        winRate: number;
      }[]
    | null;
  createdAt: string;
}

export function getCurrentSeason(): Promise<Season | null> {
  return request<Season | null>("/users/seasons/current");
}

export function getSeasonHistory(limit = 10): Promise<Season[]> {
  return request<Season[]>(`/users/seasons/history?limit=${limit}`);
}

// ─── Referral ─────────────────────────────────────────────────────────────────

export interface ReferralStats {
  referralLink: string;
  referredCount: number;
  convertedCount: number;
  totalEarned: number;
  flatBonus: number;
  betPct: number;
  cap: number;
  prizeThreshold: number;
  prizeAmount: number;
  prizeClaimed: boolean;
}

export function getReferralStats(): Promise<ReferralStats> {
  return request<ReferralStats>("/users/me/referral");
}

// ── Behavioural event tracking ────────────────────────────────────────────────

export type TrackEventPayload = {
  eventType: string;
  sessionId?: string;
  platform?: "tma" | "pwa";
  meta?: Record<string, any>;
};

/** Fire-and-forget — never throws, never blocks UI. */
export function trackEvent(payload: TrackEventPayload): void {
  request<void>("/events", {
    method: "POST",
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently discard — tracking must never break the user flow
  });
}

// ── TER Price API ─────────────────────────────────────────────────────────────

export interface TerPrice {
  midPrice: number;
  buyPrice: number;
  sellPrice: number;
  xauUsd: number;
  usdInr: number;
  fetchedAt: string;
}

/**
 * Fetch current TER price (cached 30s on backend).
 * Used by TER market cards and detail pages to show live prices.
 */
export function getTerPrice(): Promise<TerPrice> {
  return request<TerPrice>("/ter/price");
}

/**
 * Fetch recent TER price history (sampled every 5s on the backend).
 * Used to seed the live chart instantly on first page load.
 */
export function getTerPriceHistory(): Promise<TerPrice[]> {
  return request<TerPrice[]>("/ter/price/history");
}

// ── BTC Price API ─────────────────────────────────────────────────────────────

export interface BtcPrice {
  price: number;
  source: "binance" | "coinbase";
  fetchedAt: string;
}

export function getBtcPrice(): Promise<BtcPrice> {
  return request<BtcPrice>("/btc/price");
}

/**
 * Fetch recent BTC price history (sampled every 2s on the backend).
 * Used to seed the live chart instantly on first page load.
 */
export function getBtcPriceHistory(): Promise<BtcPrice[]> {
  return request<BtcPrice[]>("/btc/price/history");
}

// ─── EPL live data (standings + player stats, from apifootball.com) ───────────

export interface EplStandingRow {
  position: number;
  teamName: string;
  teamBadge: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface EplStandings {
  updatedAt: string;
  table: EplStandingRow[];
}

export interface EplStatEntry {
  player: string;
  club: string;
  clubBadge: string;
  face: string; // primary player photo (FPL); "" when unavailable
  faceBackup: string; // secondary player photo (TheSportsDB); "" when none
  value: number;
}

export interface EplStats {
  updatedAt: string;
  goals: EplStatEntry[];
  assists: EplStatEntry[];
  yellow: EplStatEntry[];
  red: EplStatEntry[];
}

export function getEplStandings(): Promise<EplStandings> {
  return request<EplStandings>("/epl/standings");
}

export function getEplStats(): Promise<EplStats> {
  return request<EplStats>("/epl/stats");
}

export interface EplSeason {
  started: boolean;
  seasonStart: string | null;
  maxPlayed: number;
}

export function getEplSeason(): Promise<EplSeason> {
  return request<EplSeason>("/epl/season");
}

// ── UEFA Champions League (same shapes as EPL) ────────────────────────────────
export type UclStandingRow = EplStandingRow;
export type UclStandings = EplStandings;
export type UclStatEntry = EplStatEntry;
export type UclStats = EplStats;
export type UclSeason = EplSeason;

export function getUclStandings(): Promise<UclStandings> {
  return request<UclStandings>("/ucl/standings");
}

export function getUclStats(): Promise<UclStats> {
  return request<UclStats>("/ucl/stats");
}

export function getUclSeason(): Promise<UclSeason> {
  return request<UclSeason>("/ucl/season");
}

export interface UclBracketTeam {
  name: string;
  short: string;
  crest: string;
}
export interface UclBracketMatch {
  a: UclBracketTeam | null;
  b: UclBracketTeam | null;
  winner: "a" | "b" | null;
}
export interface UclBracketRound {
  key: string;
  label: string;
  matches: UclBracketMatch[];
}
export interface UclBracket {
  updatedAt: string;
  season: string | null;
  hasData: boolean;
  decided: boolean;
  rounds: UclBracketRound[];
}

export function getUclBracket(): Promise<UclBracket> {
  return request<UclBracket>("/ucl/bracket");
}

// ── Market suggestions ("Ask the Crowd") ─────────────────────────────────────

export interface MarketSuggestion {
  id: string;
  title: string;
  description: string | null;
  category: string;
  votes: number;
  creator: string;
  createdAt: string;
  votedByMe: boolean;
  marketId: string | null;
}

export interface SuggestionQuota {
  canSuggest: boolean;
  used: number;
  limit: number;
  resetsAt: string;
}

export function getSuggestions(): Promise<MarketSuggestion[]> {
  return request<MarketSuggestion[]>("/suggestions");
}

export function getSuggestionQuota(): Promise<SuggestionQuota> {
  return request<SuggestionQuota>("/suggestions/quota");
}

export function createSuggestion(payload: {
  title: string;
  description?: string;
  category?: string;
}): Promise<{ id: string; status: string }> {
  return request("/suggestions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function voteSuggestion(
  id: string,
): Promise<{ votes: number; votedByMe: boolean }> {
  return request(`/suggestions/${id}/vote`, { method: "POST" });
}

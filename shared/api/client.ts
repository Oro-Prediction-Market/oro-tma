// ─────────────────────────────────────────────────────────────────────────────
// API client — all requests to the NestJS backend go through here
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Store the JWT in localStorage — persists across browser/app restarts (PWA-friendly)
let _token: string | null = localStorage.getItem("oro_token");

export function setToken(token: string) {
  _token = token;
  localStorage.setItem("oro_token", token);
}

export function getToken(): string | null {
  return _token;
}

export function clearToken() {
  _token = null;
  localStorage.removeItem("oro_token");
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
  // Win streak
  telegramStreak?: number | null;
  // Daily bet streak
  betStreakCount?: number;
  dayInCycle?: number;
  nextBoostInDays?: number;
  boostReady?: boolean;
  // Referrals
  referralCount?: number;
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
  skipOtp?: boolean,
): Promise<{ accountName: string; maskedPhone: string; requiresOtp: boolean }> {
  return request("/payments/bank/link", {
    method: "POST",
    body: JSON.stringify({
      cid,
      ...(phone ? { phone } : {}),
      ...(skipOtp ? { skipOtp } : {}),
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
  marketId: string;
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
  metadata: Record<string, any> | null;
  evidenceNote: string | null;
  signalMeta: SignalMeta | null;
  createdAt: string;
  outcomes: Outcome[];
}

export interface Dispute {
  id: string;
  userId: string;
  marketId: string;
  bondAmount: string;
  reason: string | null;
  bondRefunded: boolean;
  createdAt: string;
}

export interface SubmitDisputePayload {
  bondAmount?: number;
  paymentId?: string;
  reason?: string;
}

export function getDisputes(marketId: string): Promise<Dispute[]> {
  return request<Dispute[]>(`/markets/${marketId}/disputes`);
}

export interface DisputeRequirements {
  minBond: number;
  minParticipants: number;
  eligible: boolean;
  reason: string | null;
}

export function getDisputeRequirements(
  marketId: string,
): Promise<DisputeRequirements> {
  return request<DisputeRequirements>(
    `/markets/${marketId}/dispute-requirements`,
  );
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
    | "referral_bonus"
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

// ── BTC Price API ─────────────────────────────────────────────────────────────

export interface BtcPrice {
  price: number;
  source: "binance" | "coinbase";
  fetchedAt: string;
}

export function getBtcPrice(): Promise<BtcPrice> {
  return request<BtcPrice>("/btc/price");
}

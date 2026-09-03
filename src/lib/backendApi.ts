import { getBackendAuthBearerHeader } from '@/lib/backendAuthBearer';
import type { AccountType } from '@/lib/accountType';

/**
 * True when VITE_BACKEND_URL is the usual local API — browser calls to :3001 often fail (offline URL,
 * firewall, mixed context); in dev we route via Vite proxy instead.
 */
function isLocalDefaultApiUrl(value: string): boolean {
  const v = value.trim().replace(/\/$/, '');
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):3001$/i.test(v);
}

/**
 * Base URL for API calls from the web app.
 * - In **development**, default to same-origin `/api` (Vite → :3001) so LAN/mobile (`http://172.x:8080`)
 *   never calls `http://localhost:3001` from the wrong device and avoids CORS failures. Set
 *   `VITE_BACKEND_DIRECT=true` to force `VITE_BACKEND_URL` in dev (e.g. remote staging API).
 * - In **production**, set `VITE_BACKEND_URL` when UI and API differ.
 */
function resolveBackendBaseUrl(): string {
  const raw = typeof import.meta.env.VITE_BACKEND_URL === 'string' ? import.meta.env.VITE_BACKEND_URL : '';
  const trimmed = raw.trim();
  const directEnv =
    import.meta.env.VITE_BACKEND_DIRECT === 'true' ||
    import.meta.env.VITE_BACKEND_USE_DIRECT_API === 'true';

  if (import.meta.env.DEV) {
    if (!directEnv) {
      return '';
    }
    if (!trimmed || isLocalDefaultApiUrl(trimmed)) {
      return '';
    }
    return trimmed.replace(/\/$/, '');
  }

  if (trimmed) {
    return trimmed.replace(/\/$/, '');
  }
  // Production builds must set VITE_BACKEND_URL — defaulting to localhost breaks live sites
  // (requests fail or hit the wrong host; Admin UI used to show a fake "Invalid admin key").
  if (import.meta.env.PROD) {
    return '';
  }
  return 'http://localhost:3001';
}

/** Same-origin in dev (empty) or explicit API base in prod. */
export const BACKEND_URL = resolveBackendBaseUrl();

/**
 * URL for `/api/*` routes. Dev + empty BACKEND_URL → `/api/...` (Vite proxies to backend :3001).
 * Production requires `VITE_BACKEND_URL` or we throw instead of POSTing to the static host by mistake.
 */
function composeApiUrl(apiPath: string): string {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  if (import.meta.env.PROD && !BACKEND_URL) {
    throw new Error(
      'API URL is not configured. In Vercel → Environment Variables, set VITE_BACKEND_URL to your Railway backend HTTPS URL, then redeploy.'
    );
  }
  if (!BACKEND_URL) return path;
  return `${BACKEND_URL.replace(/\/$/, '')}${path}`;
}

/**
 * Public forms often surface the browser's vague "Failed to fetch" — add actionable context.
 */
async function fetchWithConnectivityHint(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (e instanceof TypeError || /\bfailed to fetch\b/i.test(raw) || /\bnetwork\b/i.test(raw)) {
      const devHint = import.meta.env.DEV
        ? ' Start the backend (cd backend && npm run dev — port 3001); the Vite dev server proxies /api to it.'
        : '';
      const prodHint = import.meta.env.PROD
        ? ' On Vercel, set VITE_BACKEND_URL to your API origin; confirm Railway is up and CORS allows this site.'
        : '';
      throw new Error(`Cannot reach backend.${devHint}${prodHint} (${raw})`);
    }
    throw e;
  }
}

/** Absolute API origin for widget snippets / external embeds (never empty). */
export function widgetBackendPublicUrl(): string {
  const raw = import.meta.env.VITE_BACKEND_URL;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

export type TryOnCategory =
  | 'clothing'
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'one-pieces'
  | 'eyewear'
  | 'earrings'
  | 'necklace'
  | 'jewelry'
  | 'footwear';

/**
 * Product catalog category — historically a superset of `TryOnCategory` for the Outfit Builder's
 * 'shoes' slot. Now that `TryOnCategory` includes `'footwear'`, catalog and single-item try-on
 * share one category space; the Outfit Builder's `shoes` *slot key* (its internal state field) is
 * unrelated and stays as-is — only the catalog tagging value moved to `'footwear'`.
 */
export type ProductCategory = TryOnCategory;

/**
 * Display grouping for product categories — mirrors `PRODUCT_CATEGORY_GROUPS` in
 * `backend/src/lib/constants.ts` (kept in sync by hand, same as `TryOnCategory` itself). Add a
 * new category to the right group's array when the platform gains one.
 */
export const PRODUCT_CATEGORY_GROUPS: { group: string; categories: ProductCategory[] }[] = [
  { group: 'Clothing', categories: ['clothing', 'tops', 'bottoms', 'dresses', 'one-pieces'] },
  { group: 'Footwear', categories: ['footwear'] },
  { group: 'Accessories', categories: ['eyewear', 'earrings', 'necklace', 'jewelry'] },
];

/** Friendly display labels for `ProductCategory` values — raw enum strings are not shown to users. */
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  clothing: 'Clothing',
  tops: 'Tops',
  bottoms: 'Bottoms',
  earrings: 'Earrings',
  necklace: 'Necklace',
  dresses: 'Dresses',
  'one-pieces': 'One-pieces',
  footwear: 'Footwear',
  eyewear: 'Eyewear',
  jewelry: 'Other Jewelry',
};

// ─── Typed API error (replaces `Error & { status?; code?; retryAfter? }`) ────

/**
 * All HTTP errors thrown by `handleResponse` and `adminFetch` are instances
 * of `ApiError`.  Use `instanceof ApiError` to discriminate API failures from
 * network/parse errors.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BootstrapDeviceApprovalRequiredError extends Error {
  readonly code = 'DEVICE_APPROVAL_REQUIRED';

  constructor(message = 'Approve this device before continuing.') {
    super(message);
    this.name = 'BootstrapDeviceApprovalRequiredError';
  }
}

// ─── Admin response shapes ────────────────────────────────────────────────────

/** Platform-level metrics returned by GET /api/admin/metrics */
export interface AdminMetrics {
  users: { total: number };
  tryons: { total: number; today: number; thisMonth: number; successRate: number };
  subscriptions: { active: number };
  revenue: { ngn: number; usd: number; totalPayments: number };
  usageOverTime: Array<{ date: string; tryons: number; newUsers: number }>;
}

/**
 * A single admin user row.  The backend merges a Convex profile
 * (Record<string, unknown>) with `is_banned`, so extra fields may be present.
 */
export interface AdminUser {
  user_id?: string;
  email?: string;
  account_type?: 'business' | null;
  plan_id?: string | null;
  is_blocked?: boolean;
  is_banned: boolean;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AdminUserList {
  users: AdminUser[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/**
 * A single admin try-on row.  The backend returns a merged Convex object,
 * so extra fields may be present.
 */
export interface AdminTryOn {
  id?: string;
  status?: string;
  category?: string;
  user_id?: string;
  created_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}

export interface AdminTryOnList {
  tryons: AdminTryOn[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface AdminQueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface AdminSettings {
  [key: string]: unknown;
}

export interface AdminHealth {
  status: 'ok' | 'degraded' | 'down';
  uptime?: number;
  redis?: { ok: boolean };
  convex?: { ok: boolean };
  [key: string]: unknown;
}

export interface AdminActivityItem {
  id?: string;
  event_type?: string;
  actor?: string;
  action?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface AdminApiKey {
  id: string;
  name?: string;
  status?: string;
  key_preview?: string;
  user_id?: string;
  brand_name?: string;
  last_used?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AdminDomain {
  id?: string;
  domain: string;
  user_id?: string;
  [key: string]: unknown;
}

export interface AdminLogEntry {
  level: string;
  message: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface AdminAuditEntry {
  id?: string;
  event_type?: string;
  actor?: string;
  action?: string;
  target_id?: string;
  severity?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/** Brand-level analytics returned by GET /api/analytics */
export interface BrandAnalytics {
  overview: {
    totalTryons: number;
    completedTryons: number;
    failedTryons: number;
    successRate: number;
    avgProcessingMs: number;
    creditsUsed: number;
    creditsRemaining: number;
  };
  byCategory: Array<{ category: string; count: number; successRate: number }>;
  dailyTrend: Array<{ date: string; count: number; completed: number }>;
  topProducts: Array<{ productImage: string; count: number; category: string }>;
  widgetEngagement: { totalWidgetTryons: number; widgetConversionRate: number };
  period: { days: number };
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function pickAuthorizationHeader(): string | null {
  return getBackendAuthBearerHeader();
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = pickAuthorizationHeader();
  if (auth) {
    headers['Authorization'] = auth;
  }
  return headers;
}

/** Convex Auth JWT bearer for widget / uploads that bypass `fetch` wrappers. */
function getAuthorizationHeaderValue(): string | null {
  return pickAuthorizationHeader();
}

export type AccountBootstrapBody = {
  accountType: AccountType;
  email?: string;
  brandName?: string;
  fullName?: string;
  role?: string;
  /** Stable per-browser id (UUID in localStorage) — server enforces trusted device rules. */
  deviceFingerprint: string;
};

export type InviteValidationResult =
  | { valid: false }
  | {
      valid: true;
      email: string;
      name?: string;
      accountType?: 'personal' | 'business';
      companyName?: string;
    };

/** Public invite gate — Convex lifecycle + legacy INVITE_TOKEN_MAP_JSON (via API). */
export async function validateInviteToken(token: string): Promise<InviteValidationResult> {
  const q = encodeURIComponent(token);
  const res = await fetchWithConnectivityHint(composeApiUrl(`/api/auth/invite/validate?token=${q}`));
  if (!res.ok) return { valid: false };
  return (await res.json()) as InviteValidationResult;
}

/** Mark lifecycle invite accepted after successful signup (no-op for legacy env-map tokens). */
export async function completeInviteAfterSignup(token: string, email: string): Promise<void> {
  const res = await fetchWithConnectivityHint(composeApiUrl('/api/auth/invite/complete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email: email.trim().toLowerCase() }),
  });
  if (!res.ok) {
    let msg = 'Could not finalize invitation';
    try {
      const b = (await res.json()) as { error?: string };
      if (typeof b.error === 'string') msg = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function bootstrapLocalSession(body: AccountBootstrapBody): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetchWithConnectivityHint(composeApiUrl('/api/account/session/bootstrap'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      accountType: body.accountType,
      brandName: body.brandName,
      fullName: body.fullName,
      role: body.role,
      email: body.email,
      deviceFingerprint: body.deviceFingerprint,
    }),
  });
  if (!res.ok && res.status === 403) {
    try {
      const cloned = await res.clone().json();
      const code = typeof cloned.code === 'string' ? cloned.code : undefined;
      if (code === 'DEVICE_APPROVAL_REQUIRED') {
        throw new BootstrapDeviceApprovalRequiredError(
          typeof cloned.error === 'string' ? cloned.error : undefined,
        );
      }
    } catch (err) {
      if (err instanceof BootstrapDeviceApprovalRequiredError) throw err;
    }
  }
  await handleResponse(res);
}

export async function requestAccountDeviceApprovalCode(body: {
  deviceFingerprint: string;
}): Promise<{ ok: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetchWithConnectivityHint(composeApiUrl('/api/account/device/request-code'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function verifyAccountDeviceApproval(body: {
  deviceFingerprint: string;
  code: string;
}): Promise<{ ok: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetchWithConnectivityHint(composeApiUrl('/api/account/device/verify'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function getMyAccount(): Promise<{
  user: { id: string; email: string };
  profile: Record<string, unknown> | null;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/account/me`, { headers });
  return handleResponse(res);
}

export async function patchMySettings(patch: Record<string, unknown>): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/account/settings`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  await handleResponse(res);
}

export async function patchMyCompliance(goals: string[], completedAt: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/account/compliance`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ onboarding_goals: goals, completed_at: completedAt }),
  });
  await handleResponse(res);
}

/**
 * Reads an error body from a non-OK response.
 * Tries JSON first (`error` or `message` field + optional `code`);
 * falls back to plain text; falls back to the `fallback` string on parse failure.
 * Used by both handleResponse (full API) and widget inline error paths.
 */
async function parseApiErrorBody(
  res: Response,
  fallback: string
): Promise<{ message: string; code?: string }> {
  let message = fallback;
  let code: string | undefined;
  try {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = (await res.json()) as { error?: string; message?: string; code?: string };
      message = body.error || body.message || message;
      if (typeof body.code === 'string') code = body.code;
    } else {
      const text = await res.text();
      if (text) message = text;
    }
  } catch { /* ignore parse error — keep fallback */ }
  return { message, code };
}

async function handleResponse<T>(res: Response, context?: { feature?: string }): Promise<T> {
  if (!res.ok) {
    let retryAfter: number | undefined;

    const { message: parsedMessage, code } = await parseApiErrorBody(
      res,
      `Request failed: ${res.status}`
    );
    let message = parsedMessage;

    // 429 — Rate limited: extract Retry-After hint
    if (res.status === 429) {
      const ra = res.headers.get('retry-after');
      retryAfter = ra ? parseInt(ra, 10) : undefined;
      message = retryAfter
        ? `Too many requests — please wait ${retryAfter}s before trying again.`
        : 'Too many requests — please slow down and try again shortly.';
    }

    /** POST to the static site (e.g. Vercel) returns 405 — means VITE_BACKEND_URL was not set to the Railway API. */
    if (res.status === 405) {
      message =
        'Request blocked (HTTP 405). Your live app is probably posting to the website host instead of the API. In Vercel → Environment Variables set VITE_BACKEND_URL to your Railway backend HTTPS URL (not tryverseai.com), then redeploy.';
    }

    // 503 / 5xx — infrastructure failure; use a clearer message
    if (res.status === 503) {
      message = 'Service temporarily unavailable. Please try again in a moment.';
    } else if (res.status >= 500 && !code) {
      message = message.startsWith('Request failed')
        ? 'An unexpected server error occurred. Please try again.'
        : message;
    }

    // 401 — Only force sign-out when the token was sent but rejected (expired / malformed).
    // Missing actor (no Bearer) must not log the user out — that breaks dashboard reload races,
    // and momentary token-refresh gaps (e.g. around tab visibility changes) legitimately send no
    // Authorization header. The backend's "missing" message must never trip this.
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        const msg = (message || '').toLowerCase();
        const shouldSignOut = msg.includes('invalid or expired');
        if (shouldSignOut) {
          window.dispatchEvent(new CustomEvent('tryverse:auth:expired'));
        }
      }
    }

    // 403 ACCOUNT_SUSPENDED — dispatch specific event + set friendly message
    if (res.status === 403 && code === 'ACCOUNT_SUSPENDED') {
      message = 'Your account has been suspended. Please contact support@tryverseai.com for assistance.';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tryverse:auth:suspended'));
      }
    }

    const err = new ApiError(message, res.status, code, retryAfter);

    // Skip Sentry for expected non-server errors (402, 429, 403, 405 misconfig)
    if (res.status !== 402 && res.status !== 429 && res.status !== 403 && res.status !== 405) {
      try {
        const { captureSentryException } = await import('@/lib/sentry');
        captureSentryException(err, {
          tags: { feature: context?.feature || 'api', type: 'api_error' },
          extra: { url: res.url, status: res.status, code: code ?? null },
        });
      } catch { /* Sentry not loaded or disabled */ }
    }
    throw err;
  }
  return res.json() as Promise<T>;
}

/** Backend returns 402 + code CREDITS_EXHAUSTED when the account has no try-on credits left. */
export function isCreditsExhaustedApiError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.status === 402 || err.code === 'CREDITS_EXHAUSTED';
}

/** Shown when a user's free try-on credits run out (402 / CREDITS_EXHAUSTED). */
export const SHOPPER_TRYON_UNAVAILABLE_MESSAGE =
  "You've used all your free try-on credits. Upgrade your plan to keep trying on outfits.";

// ─── Emails ───────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(params: { name?: string; brandName?: string }): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/emails/welcome`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: params.name, brandName: params.brandName }),
  });
  if (!res.ok) return;
  await res.json();
}

export async function sendApiKeyDeliveryEmail(params: { keyName: string; keyPreview: string }): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/emails/api-key-delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) return;
  await res.json();
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadImage(
  file: File,
  type: 'person' | 'product'
): Promise<{ filePath: string; type: string }> {
  const auth = getAuthorizationHeaderValue();
  const formData = new FormData();
  formData.append('image', file);
  formData.append('type', type);

  const res = await fetch(`${BACKEND_URL}/api/upload`, {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
    body: formData,
  });
  return handleResponse(res);
}

/** Upload for embedded/widget flows authenticated with `x-api-key` only (paths scoped to the key owner). */
export async function uploadImageWithApiKey(
  file: File,
  type: 'person' | 'product',
  apiKey: string
): Promise<{ filePath: string; type: string }> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('type', type);
  const res = await fetch(`${BACKEND_URL}/api/upload`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData,
  });
  return handleResponse(res);
}

export async function uploadImageFromUrlWithApiKey(
  imageUrl: string,
  apiKey: string
): Promise<{ filePath: string }> {
  const res = await fetch(`${BACKEND_URL}/api/upload/from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ url: imageUrl }),
  });
  return handleResponse(res);
}

// ─── Try-On ───────────────────────────────────────────────────────────────────

export interface TryOnRequest {
  personImagePath: string;
  productImagePath: string;
  category: TryOnCategory;
  productDescription?: string;
  /** Client-generated per-attempt key (crypto.randomUUID()) — lets the server dedupe a retried
   * request instead of double-reserving credits or starting a second job. Omit to skip protection. */
  idempotencyKey?: string;
}

export interface TryOnResponse {
  tryonId: string;
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'duplicate';
  category: TryOnCategory;
  resultUrl?: string;
  processingTimeMs?: number;
  error?: string;
  estimatedWaitSeconds?: number;
}

export async function startTryOn(params: TryOnRequest): Promise<TryOnResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/tryon`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...params, async: false }), // sync for immediate result
  });
  return handleResponse<TryOnResponse>(res, { feature: 'try_on' });
}

export type WidgetTryOnStartResponse =
  | { success: boolean; tryonId: string; status: string; resultUrl?: string; error?: string }
  | {
      success: boolean;
      tryonId: string;
      jobId: string;
      status: 'queued';
      pollUrl: string;
      estimatedWaitSeconds?: number;
    };

export async function widgetRequestTryOnWithApiKey(
  params: TryOnRequest,
  apiKey: string
): Promise<WidgetTryOnStartResponse> {
  const res = await fetch(`${BACKEND_URL}/api/widget/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      personImagePath: params.personImagePath,
      productImagePath: params.productImagePath,
      category: params.category,
      productDescription: params.productDescription,
    }),
  });
  if (!res.ok) {
    // Widget requests use API keys — skip auth events and Sentry noise from handleResponse.
    const { message, code } = await parseApiErrorBody(res, `Request failed: ${res.status}`);
    throw new ApiError(message, res.status, code);
  }
  return res.json() as Promise<WidgetTryOnStartResponse>;
}

export async function widgetTryOnStatusWithApiKey(
  tryonId: string,
  apiKey: string
): Promise<{ tryonId: string; status: string; resultUrl?: string | null; error?: string }> {
  const res = await fetch(`${BACKEND_URL}/api/widget/status/${encodeURIComponent(tryonId)}`, {
    headers: { 'x-api-key': apiKey },
  });
  return handleResponse(res);
}

/** Poll widget try-on until completed or failed (queue mode). */
export async function pollWidgetTryOnUntilResult(
  tryonId: string,
  apiKey: string,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<string> {
  const intervalMs = options?.intervalMs ?? 2000;
  const maxAttempts = options?.maxAttempts ?? 60;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = await widgetTryOnStatusWithApiKey(tryonId, apiKey);
    if (data.status === 'completed' && data.resultUrl) return data.resultUrl;
    if (data.status === 'failed') throw new Error(data.error || 'Try-on failed');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Timeout waiting for try-on result');
}

export async function pollTryOnStatus(tryonId: string): Promise<TryOnResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/tryon/${tryonId}`, { headers });
  return handleResponse<TryOnResponse>(res, { feature: 'try_on' });
}

/** Shared catalog (Try-On Studio + widget when enabled). */
export interface TryverseModel {
  id: string;
  slug: string;
  display_name: string;
  gender: 'female' | 'male';
  body_type: string | null;
  appearance_tag: string | null;
  image_url: string;
  sort_order: number;
  /** Free-plan users may only use models where this is true (enforced on API). */
  free_tier_eligible?: boolean;
}

export async function getTryverseModels(): Promise<TryverseModel[]> {
  const res = await fetch(`${BACKEND_URL}/api/models`, { cache: 'no-store' });
  if (!res.ok) {
    let msg = 'Failed to load model library';
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { models?: TryverseModel[] };
  return data.models || [];
}

/** Store a library model image as your person shot (dashboard JWT). */
export async function createPersonPathFromModel(modelId: string): Promise<string> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/models/person-path`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId }),
  });
  const data = await handleResponse<{ filePath: string }>(res, { feature: 'try_on' });
  return data.filePath;
}

export async function getSignedImageUrl(path: string): Promise<string> {
  if (path.startsWith('http')) return path;
  const auth = getAuthorizationHeaderValue();
  const res = await fetch(
    `${BACKEND_URL}/api/upload/signed-url?path=${encodeURIComponent(path)}`,
    { headers: auth ? { Authorization: auth } : {} }
  );
  const data = await handleResponse<{ url: string }>(res);
  return data.url;
}

/**
 * Fetches try-on history using cursor-based pagination (O(limit) read — no
 * full table scan). Pass `cursor: null` to start from the most recent try-on;
 * pass the returned `nextCursor` to get the next page.
 */
export async function getTryOnHistory(
  _page = 1, // kept for call-site compatibility; cursor mode is used instead
  category?: TryOnCategory,
  cursor: string | null = null
) {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ limit: '20', cursor: cursor ?? '' });
  if (category) params.append('category', category);
  const res = await fetch(`${BACKEND_URL}/api/tryon?${params}`, { headers });
  return handleResponse<{
    tryons: (TryOnResponse & { id?: string; tryonId?: string; createdAt?: string })[];
    nextCursor: string | null;
    isDone: boolean;
  }>(res);
}

export async function deleteTryOn(tryonId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/tryon/${encodeURIComponent(tryonId)}`, {
    method: 'DELETE',
    headers,
  });
  await handleResponse(res, { feature: 'try_on' });
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export async function getCredits() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/credits`, { headers });
  return handleResponse<{
    plan: string;
    accountType: 'business';
    isUnlimited: boolean;
    freeCreditsRemaining: number;
    freeCreditsTotal: number;
    monthlyCreditsRemaining: number;
    monthlyCreditsTotal: number;
    monthlyCreditsUsed: number;
    usagePercent: number;
  }>(res);
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function getPaymentProviders(): Promise<{
  paystack: boolean;
  flutterwave: boolean;
}> {
  const res = await fetch(`${BACKEND_URL}/api/payment/providers`);
  if (!res.ok) {
    return { paystack: false, flutterwave: false };
  }
  return res.json();
}

/** Amount is set on the server from plans.price_ngn. */
export async function initializePaystackPayment(
  planId: string,
  callbackUrl: string
): Promise<{ authorization_url: string; reference: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/payment/initialize/paystack`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ planId, callbackUrl }),
  });
  return handleResponse(res, { feature: 'payment' });
}

/** Amount from server: USD → price_usd, NGN → price_ngn. */
export async function initializeFlutterwavePayment(
  planId: string,
  currency: string,
  callbackUrl: string
): Promise<{ authorization_url: string; tx_ref: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/payment/initialize/flutterwave`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ planId, currency, callbackUrl }),
  });
  return handleResponse(res, { feature: 'payment' });
}

// ─── Early access (public; saves via backend + Resend confirmation) ──────────

export interface EarlyAccessPayload {
  first_name: string;
  email: string;
  brand_name: string;
  role: string;
  website_url: string;
  platform: string;
  product_range: string;
  monthly_revenue: string;
  return_rate: string;
  top_return_reason: string;
  customer_confidence: string;
  tried_solutions: string[];
  must_have_features: string[];
  biggest_challenge: string;
  timeline: string;
  heard_about?: string | null;
  prior_solution_notes?: string | null;
}

export async function submitEarlyAccessRequest(
  payload: EarlyAccessPayload
): Promise<{ success: boolean; id?: string; convexDocumentId?: string; emailSent?: boolean }> {
  const res = await fetchWithConnectivityHint(composeApiUrl('/api/early-access'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, { feature: 'early_access' });
}

export async function submitDemoBooking(payload: {
  full_name: string;
  email: string;
  brand_name: string;
  store_platform: string;
  monthly_visitors: string;
  message?: string;
}): Promise<{ ok: boolean }> {
  const res = await fetchWithConnectivityHint(composeApiUrl('/api/demo/book'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, { feature: 'demo_booking' });
}

export async function submitEnterpriseInquiry(payload: {
  full_name: string;
  email: string;
  company_name: string;
  company_website?: string;
  role?: string;
  country?: string;
  catalogue_size?: string;
  monthly_generation_volume?: string;
  features_interested?: string[];
  api_sdk_requirements?: string;
  infrastructure_requirements?: string;
  message?: string;
}): Promise<{ ok: boolean }> {
  const res = await fetchWithConnectivityHint(composeApiUrl('/api/demo/enterprise'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, { feature: 'enterprise_inquiry' });
}

/** Contact / Support form — saved via backend to avoid PostgREST schema issues. */
export interface SupportContactPayload {
  first_name: string;
  last_name: string;
  company_name?: string | null;
  email: string;
  phone_number?: string | null;
  category: string;
  subject: string;
  message: string;
}

export async function submitSupportContact(payload: SupportContactPayload): Promise<{ ok: boolean }> {
  const res = await fetchWithConnectivityHint(composeApiUrl('/api/support/contact'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 405) {
      throw new Error(
        'Request blocked (HTTP 405). In Vercel set VITE_BACKEND_URL to your Railway API HTTPS URL and redeploy so forms call the backend, not the static site.'
      );
    }
    let message = `Failed to submit (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (typeof (body as { error?: string }).error === 'string') {
        message = `${(body as { error: string }).error} (${res.status})`;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<{ ok: boolean }>;
}

// ─── Products ─────────────────────────────────────────────────────────────────
// Product list + signed URLs go through the backend API with the user’s session

export interface Product {
  id: string;
  name: string;
  image_url: string | null;
  image_display_url?: string | null;
  category: ProductCategory;
  product_url: string | null;
  tryons_count?: number;
  created_at: string;
  updated_at?: string;
}

/** Resolve storage path to temporary HTTPS URL for display (same logic as product list). */
export async function resolveProductImageDisplayUrl(pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${BACKEND_URL}/api/upload/signed-url?path=${encodeURIComponent(pathOrUrl)}`,
      { headers }
    );
    if (!res.ok) return null;
    const { url } = (await res.json()) as { url?: string };
    return url || null;
  } catch {
    return null;
  }
}

export async function getProducts(page = 1, limit = 20, category?: ProductCategory) {
  if (!getBackendAuthBearerHeader()) throw new Error('Not authenticated');
  const headers = await getAuthHeaders();
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (category) q.set('category', category);
  const res = await fetch(`${BACKEND_URL}/api/products?${q}`, { headers });
  const body = await handleResponse<{
    products: Product[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(res);
  const products: Product[] = await Promise.all(
    (body.products || []).map(async (p) => ({
      ...p,
      category: p.category as ProductCategory,
      image_display_url: p.image_display_url ?? (await resolveProductImageDisplayUrl(p.image_url)),
    }))
  );
  return { products, pagination: body.pagination };
}

export async function createProduct(data: {
  name: string;
  image_url?: string;
  category: ProductCategory;
  product_url?: string;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const product = await handleResponse<Product>(res);
  const image_display_url = await resolveProductImageDisplayUrl(product.image_url);
  return { ...product, image_display_url };
}

export async function updateProduct(
  id: string,
  data: { name?: string; image_url?: string; category?: ProductCategory; product_url?: string }
): Promise<Product> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  const product = await handleResponse<Product>(res);
  const image_display_url = await resolveProductImageDisplayUrl(product.image_url);
  return { ...product, image_display_url };
}

export async function deleteProduct(id: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    await handleResponse(res);
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getBrandAnalytics(days = 30): Promise<BrandAnalytics> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/analytics?days=${days}`, { headers });
  return handleResponse<BrandAnalytics>(res);
}

// ─── AI Model Personalization ─────────────────────────────────────────────────

export interface PersonalizeAnalytics {
  totalGenerations: number;
  days: number;
  enabled: boolean;
  dailyBreakdown: { date: string; generations: number }[];
}

export async function getPersonalizeAnalytics(days = 30): Promise<PersonalizeAnalytics> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/personalize/analytics?days=${days}`, { headers });
  return handleResponse<PersonalizeAnalytics>(res);
}

// ─── Widget domains ───────────────────────────────────────────────────────────

export async function listWidgetDomains() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/widget/domains`, { headers });
  return handleResponse<{ domains: Array<{ domain: string; apiKeyId: string; apiKeyName: string }> }>(res);
}

export async function addWidgetDomain(domain: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/widget/domains`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ domain }),
  });
  return handleResponse<{ success: boolean; domain: string }>(res);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getSupportedCategories() {
  const res = await fetch(`${BACKEND_URL}/api/tryon/categories`);
  return handleResponse<{
    categories: Array<{ id: TryOnCategory; label: string; description: string; modelFamily: string }>;
  }>(res);
}

// ─── Admin session (HttpOnly cookie — key never stored in JS memory) ──────────

/**
 * The admin key is no longer stored in sessionStorage or any JS-accessible
 * storage. Instead, a short-lived HttpOnly cookie is issued by the server after
 * the key is validated. All admin API calls use `credentials: 'include'` so the
 * browser attaches the cookie automatically — the key itself is never readable
 * from JavaScript, blocking XSS exfiltration.
 *
 * The `adminKey` parameter on public functions is kept for TypeScript
 * compatibility but is no longer passed to the server.
 */

// Sentinel stored in sessionStorage — just tracks "browser tab has an active
// session" for UI state restoration. NOT the admin key.
const ADMIN_SESSION_FLAG = 'tryverse_admin_session_active';

/** Set when checkAdminSession succeeded — skip beta + account-type gates. */
export const ADMIN_OPERATOR_BYPASS_CACHE_KEY = 'tryverse_admin_operator_bypass';
/** "bypass" | "no" — result of one admin cookie probe per tab (avoids repeated requests). */
export const ADMIN_SESSION_PROBE_KEY = 'tryverse_admin_session_probe';

export function getStoredAdminKey(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_FLAG) === '1' ? 'session' : null;
  } catch {
    return null;
  }
}

export function setStoredAdminKey(_key: string): void {
  try {
    sessionStorage.setItem(ADMIN_SESSION_FLAG, '1');
  } catch {
    /* ignore */
  }
}

export function clearStoredAdminKey(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_FLAG);
    sessionStorage.removeItem(ADMIN_OPERATOR_BYPASS_CACHE_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_PROBE_KEY);
  } catch {
    /* ignore */
  }
}

/** No-op — kept for call-site compatibility. Heartbeat is handled server-side. */
export function setAdminKeyLastActive(): void {}

/** No-op — kept for call-site compatibility. Expiry is handled by the server session. */
export function isAdminSessionExpired(): boolean { return false; }

/**
 * In dev, `BACKEND_URL` is often empty so admin calls use same-origin `/api/*` (Vite proxy → :3001).
 * Production requires `VITE_BACKEND_URL` or admin cannot reach the API.
 */
function assertBackendUrlForProdAdmin(): void {
  if (import.meta.env.PROD && !BACKEND_URL) {
    throw new Error(
      'API URL is not configured. In Vercel → Environment Variables, set VITE_BACKEND_URL to your Railway backend HTTPS URL (example: https://your-service.up.railway.app), then redeploy. Without this, the admin page cannot reach the API.'
    );
  }
}

/** POST/DELETE `/api/admin/session` or GET `/api/admin/session/check` — relative in dev when `BACKEND_URL` is empty. */
function urlForAdminSession(path: '' | '/check'): string {
  assertBackendUrlForProdAdmin();
  const suffix = path === '' ? '/api/admin/session' : `/api/admin/session${path}`;
  if (!BACKEND_URL) return suffix;
  return `${BACKEND_URL.replace(/\/$/, '')}${suffix}`;
}

/**
 * Login: validates the admin key on the server; server sets an HttpOnly cookie.
 * Throws if the key is invalid.
 */
export async function adminLogin(key: string): Promise<void> {
  const sessionUrl = urlForAdminSession('');
  const atLabel = BACKEND_URL || '(dev: same-origin /api — start backend on :3001)';
  let res: Response;
  try {
    res = await fetch(sessionUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
  } catch (e) {
    const reason = e instanceof TypeError ? e.message : String(e);
    throw new Error(
      `Cannot reach the API at ${atLabel}. In production set VITE_BACKEND_URL to your Railway URL. Confirm the API is running and CORS allows ${typeof window !== 'undefined' ? window.location.origin : 'this site'}. (${reason})`
    );
  }
  if (!res.ok) {
    let msg = 'Invalid admin key';
    try {
      const b = (await res.json()) as { error?: string };
      if (typeof b.error === 'string' && b.error.trim()) {
        msg = b.error.trim();
      }
    } catch {
      /* ignore */
    }
    if (res.status === 403) {
      throw new Error(msg);
    }
    if (res.status === 400) {
      throw new Error(msg === 'Invalid admin key' ? 'Invalid request — check the key field.' : msg);
    }
    throw new Error(msg);
  }
  setStoredAdminKey('session'); // mark UI state only
}

/**
 * Logout: revokes the server session and clears the cookie.
 */
export async function adminLogout(): Promise<void> {
  clearStoredAdminKey();
  try {
    await fetch(urlForAdminSession(''), {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    /* best-effort — cookie will expire anyway */
  }
}

/**
 * Checks if the current session cookie is still valid.
 * Used on admin page mount to restore authenticated state without re-entering the key.
 */
export async function checkAdminSession(): Promise<boolean> {
  try {
    const res = await fetch(urlForAdminSession('/check'), {
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function adminFetch<T = unknown>(path: string, _adminKey: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      // Attach HttpOnly session cookie automatically
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
        // x-admin-key intentionally omitted — HttpOnly cookie handles authentication
      },
    });
  } catch (e) {
    const hint =
      e instanceof TypeError
        ? BACKEND_URL
          ? `Cannot reach backend at ${BACKEND_URL}. Start the API (npm run dev in backend) or fix VITE_BACKEND_URL.`
          : `Cannot reach API. Start the backend on port 3001 (npm run dev in backend) so Vite can proxy /api, or set VITE_BACKEND_URL.`
        : String(e);
    let target = 'API';
    if (BACKEND_URL) {
      try {
        target = new URL(BACKEND_URL).host;
      } catch {
        target = BACKEND_URL;
      }
    } else if (typeof window !== 'undefined') {
      target = `${window.location.host} (proxied /api)`;
    }
    throw new Error(`Failed to fetch (${target}): ${hint}`);
  }
  if (res.status === 403) {
    // A 403 here means the session cookie was rejected — could be an actually-wrong/expired key,
    // but could also be a CSRF/Fetch-Metadata guard rejection or another server-side reason.
    // Surface the server's real message instead of always guessing "Invalid admin key", which
    // previously masked a real bug (a same-site-vs-same-origin CSRF check false positive) as a
    // wrong-key report even though the key was correct.
    let message = 'Admin access denied (403)';
    try {
      const body = (await res.json()) as { error?: string };
      if (typeof body?.error === 'string' && body.error.trim()) message = body.error.trim();
    } catch {
      /* ignore */
    }
    throw new ApiError(message, 403);
  }
  if (!res.ok) {
    let message = `Admin API error (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; details?: Array<{ message?: string }> };
      if (typeof body?.error === 'string') message = body.error;
      if (Array.isArray(body?.details) && body.details[0]?.message) {
        message = `${message}: ${body.details[0].message}`;
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

export async function getAdminMetrics(adminKey: string): Promise<AdminMetrics> {
  return adminFetch<AdminMetrics>('/api/admin/metrics', adminKey);
}

export async function getAdminModelLibrary(adminKey: string) {
  return adminFetch<{
    models: (TryverseModel & { is_active: boolean; free_tier_eligible: boolean; created_at: string })[];
  }>('/api/admin/model-library', adminKey, { cache: 'no-store' });
}

export async function patchAdminModelLibrary(
  adminKey: string,
  modelId: string,
  patch: { is_active?: boolean; free_tier_eligible?: boolean }
) {
  return adminFetch<{ ok: boolean; id: string }>(`/api/admin/model-library/${modelId}`, adminKey, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Bulk: which presets free-plan users can run (dashboard + API enforced). */
export async function postAdminModelLibraryBulkFreeTier(
  adminKey: string,
  mode: 'all_in_catalog' | 'defaults_only' | 'all_rows'
) {
  return adminFetch<{ ok: boolean; mode: string; updated: number }>(
    '/api/admin/model-library/bulk-free-tier',
    adminKey,
    { method: 'POST', body: JSON.stringify({ mode }) }
  );
}

export async function getAdminUsers(
  adminKey: string,
  page = 1,
  limit = 50,
  search?: string,
  accountType?: 'all' | 'business'
): Promise<AdminUserList> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.append('search', search);
  if (accountType && accountType !== 'all') params.append('accountType', accountType);
  return adminFetch<AdminUserList>(`/api/admin/users?${params}`, adminKey);
}

export async function getAdminTryons(adminKey: string, page = 1, limit = 50, status?: string): Promise<AdminTryOnList> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.append('status', status);
  return adminFetch<AdminTryOnList>(`/api/admin/tryons?${params}`, adminKey);
}

export async function getAdminRevenue(adminKey: string, days = 30): Promise<Record<string, unknown>> {
  return adminFetch<Record<string, unknown>>(`/api/admin/revenue?days=${days}`, adminKey);
}

export interface AdminAiUsage {
  totalGenerations: number;
  byFeature: Record<string, number>;
  perUser: Array<{
    userId: string;
    brandName: string | null;
    contactEmail: string | null;
    planId: string;
    total: number;
    byFeature: Record<string, number>;
    lastUsed: string;
  }>;
  recent: Array<{ userId: string; brandName: string | null; feature: string; createdAt: string }>;
}

export async function getAdminAiUsage(adminKey: string, limit = 100): Promise<AdminAiUsage> {
  return adminFetch<AdminAiUsage>(`/api/admin/ai-usage?limit=${limit}`, adminKey);
}

export async function getAdminQueue(adminKey: string): Promise<AdminQueueStatus> {
  return adminFetch<AdminQueueStatus>('/api/admin/queue', adminKey);
}

/** Block or unblock a user (profiles.is_blocked + auth/session via backend). */
export async function banAdminUser(adminKey: string, userId: string, unban = false): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(`/api/admin/users/${userId}/block`, adminKey, {
    method: 'POST',
    body: JSON.stringify({ blocked: !unban }),
  });
}

/** Cascade-delete profile, keys, try-ons, etc. (Convex trust mutation). */
export async function deleteAdminUserAccount(adminKey: string, userId: string): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(
    `/api/admin/users/${encodeURIComponent(userId)}/account`,
    adminKey,
    { method: 'DELETE' }
  );
}

export async function adjustUserCredits(
  adminKey: string,
  userId: string,
  credits: { freeCredits?: number; monthlyCredits?: number }
): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(`/api/admin/users/${userId}/credits`, adminKey, {
    method: 'PATCH',
    body: JSON.stringify(credits),
  });
}

export async function retryTryOn(adminKey: string, tryonId: string): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(`/api/admin/tryons/${tryonId}/retry`, adminKey, { method: 'POST' });
}

export async function pauseAdminQueue(adminKey: string): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>('/api/admin/queue/pause', adminKey, { method: 'POST' });
}

export async function resumeAdminQueue(adminKey: string): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>('/api/admin/queue/resume', adminKey, { method: 'POST' });
}

export async function getAdminSettings(adminKey: string): Promise<AdminSettings> {
  return adminFetch<AdminSettings>('/api/admin/settings', adminKey);
}

export async function getAdminHealth(adminKey: string): Promise<AdminHealth> {
  return adminFetch<AdminHealth>('/api/admin/health', adminKey);
}

export async function getAdminActivity(adminKey: string, limit = 20): Promise<{ items: AdminActivityItem[] }> {
  return adminFetch<{ items: AdminActivityItem[] }>(`/api/admin/activity?limit=${limit}`, adminKey);
}

export async function getAdminApiKeys(adminKey: string): Promise<{ keys: AdminApiKey[] }> {
  return adminFetch<{ keys: AdminApiKey[] }>('/api/admin/api-keys', adminKey);
}

export async function revokeAdminApiKey(adminKey: string, keyId: string): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(`/api/admin/api-keys/${keyId}/revoke`, adminKey, { method: 'POST' });
}

export async function getAdminDomains(adminKey: string): Promise<{ domains: AdminDomain[] }> {
  return adminFetch<{ domains: AdminDomain[] }>('/api/admin/domains', adminKey);
}

export async function getAdminLogs(adminKey: string, limit = 200, level?: string): Promise<{ logs: AdminLogEntry[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (level) params.append('level', level);
  return adminFetch<{ logs: AdminLogEntry[] }>(`/api/admin/logs?${params}`, adminKey);
}

export async function getAdminSentryConfig(adminKey: string): Promise<{ enabled: boolean; issuesUrl?: string }> {
  return adminFetch('/api/admin/sentry-config', adminKey);
}

export async function getAdminAudit(
  adminKey: string,
  limit = 100,
  offset = 0,
  filters?: { eventType?: string; severity?: 'error' | 'warn' | 'info' }
): Promise<{ entries: AdminAuditEntry[]; total: number }> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters?.eventType) params.append('event_type', filters.eventType);
  else if (filters?.severity) params.append('severity', filters.severity);
  return adminFetch<{ entries: AdminAuditEntry[]; total: number }>(`/api/admin/audit?${params}`, adminKey);
}

export async function clearAdminLogs(adminKey: string): Promise<{ ok: boolean; message?: string }> {
  return adminFetch('/api/admin/logs/clear', adminKey, { method: 'POST' });
}

export async function clearAdminAudit(adminKey: string): Promise<{ ok: boolean; message?: string }> {
  return adminFetch('/api/admin/audit/clear', adminKey, { method: 'POST' });
}

export interface PostHogQueryResult<T = unknown> {
  results?: T[][];
  columns?: string[];
  types?: string[];
  hasMore?: boolean;
}

/**
 * Proxies a HogQL query to PostHog through the backend (`/api/admin/analytics/posthog-query`),
 * which holds the Personal API Key server-side — the browser never sees it.
 */
export async function postHogAdminQuery<T = unknown>(
  adminKey: string,
  query: { kind: string; query: string },
  name: string
): Promise<PostHogQueryResult<T>> {
  return adminFetch<PostHogQueryResult<T>>('/api/admin/analytics/posthog-query', adminKey, {
    method: 'POST',
    body: JSON.stringify({ query, name }),
  });
}

/** Pending closed-beta users (beta_approved is not true, not rejected). */
export type AdminPendingBetaRow = {
  userId: string;
  full_name?: string | null;
  contact_email?: string | null;
  brand_name?: string | null;
  account_type: string;
  created_at?: string | null;
  beta_requested_at?: string | null;
};

export async function getAdminBetaPending(adminKey: string): Promise<{ profiles: AdminPendingBetaRow[] }> {
  return adminFetch<{ profiles: AdminPendingBetaRow[] }>('/api/admin/beta-pending', adminKey, {
    cache: 'no-store',
  });
}

export async function approveAdminBetaAccess(adminKey: string, userId: string): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(
    `/api/admin/beta-access/${encodeURIComponent(userId)}/approve`,
    adminKey,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export async function rejectAdminBetaAccess(adminKey: string, userId: string): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(
    `/api/admin/beta-access/${encodeURIComponent(userId)}/reject`,
    adminKey,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

// ─── Admin — waitlist & lifecycle invites ─────────────────────────────────────

export type AdminWaitlistRow = {
  id: string;
  applicant_type?: string | null;
  first_name: string;
  email: string;
  brand_name: string;
  role: string;
  website_url: string;
  platform: string;
  timeline: string;
  biggest_challenge: string;
  created_at?: string | null;
  waitlist_review_status?: string | null;
};

export async function getAdminWaitlistEarlyAccess(
  adminKey: string
): Promise<{ rows: AdminWaitlistRow[] }> {
  return adminFetch<{ rows: AdminWaitlistRow[] }>('/api/admin/waitlist/early-access', adminKey, {
    cache: 'no-store',
  });
}

export async function patchAdminWaitlistReview(
  adminKey: string,
  docId: string,
  waitlist_review_status: string
): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(
    `/api/admin/waitlist/early-access/${encodeURIComponent(docId)}/review`,
    adminKey,
    { method: 'PATCH', body: JSON.stringify({ waitlist_review_status }) }
  );
}

export type AdminLifecycleInvite = {
  token: string;
  email: string;
  name?: string;
  accountType: string;
  companyName?: string;
  status: string;
  createdAt: number;
  sentAt?: number;
  acceptedAt?: number;
  createdBy?: string;
  _creationTime?: number;
};

export async function adminCreateInvite(
  adminKey: string,
  body: {
    email: string;
    name?: string;
    accountType: 'personal' | 'business';
    companyName?: string;
  }
): Promise<{ token: string; inviteUrl: string; email: string; accountType: string }> {
  return adminFetch('/api/admin/invites/create', adminKey, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminSendInvite(
  adminKey: string,
  token: string
): Promise<{ success: boolean; sentTo: string; accountType: string }> {
  return adminFetch('/api/admin/invites/send', adminKey, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function getAdminInvites(
  adminKey: string,
  opts?: { status?: string; accountType?: string }
): Promise<{ invites: AdminLifecycleInvite[] }> {
  const q = new URLSearchParams();
  if (opts?.status) q.set('status', opts.status);
  if (opts?.accountType) q.set('accountType', opts.accountType);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return adminFetch<{ invites: AdminLifecycleInvite[] }>(`/api/admin/invites${suffix}`, adminKey, {
    cache: 'no-store',
  });
}

export async function adminDeleteInvite(
  adminKey: string,
  token: string
): Promise<{ ok: boolean; deleted: boolean }> {
  return adminFetch<{ ok: boolean; deleted: boolean }>(
    `/api/admin/invites/${encodeURIComponent(token)}`,
    adminKey,
    { method: 'DELETE' }
  );
}

// ─── API Keys (dashboard) ──────────────────────────────────────────────────

export type ApiKeyScope = 'read' | 'write';

export interface ApiKeyRecord {
  id: string;
  /** null for keys created after the hash migration — nothing to reveal after the one-time
   *  creation response, which is why `key_last4` exists for display. */
  key_value: string | null;
  key_last4: string | null;
  name: string;
  created_at: string;
  last_used_at?: string | null;
  /** null = legacy/unscoped key with full access. */
  scopes?: ApiKeyScope[] | null;
  expires_at?: string | null;
  expired?: boolean;
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/account/api-keys`, { headers });
  const data = await handleResponse<{ keys: ApiKeyRecord[] }>(res);
  return data.keys;
}

/** Idempotent — returns the existing key if the account already has one, otherwise creates one. */
export async function getOrCreateApiKey(): Promise<ApiKeyRecord> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/account/api-keys`, {
    method: 'POST',
    headers,
  });
  const data = await handleResponse<{ key: ApiKeyRecord; created: boolean }>(res);
  return data.key;
}

/** Revokes existing key(s) and issues a fresh one — old key stops working immediately. */
export async function regenerateApiKey(): Promise<ApiKeyRecord> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/account/api-keys/regenerate`, {
    method: 'POST',
    headers,
  });
  const data = await handleResponse<{ key: ApiKeyRecord }>(res);
  return data.key;
}

/** Always creates a NEW key — unlike getOrCreateApiKey, which is idempotent. */
export async function createNamedApiKey(options: {
  name: string;
  scopes?: ApiKeyScope[];
  expiresInDays?: number;
}): Promise<ApiKeyRecord> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/account/api-keys/create`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  const data = await handleResponse<{ key: ApiKeyRecord }>(res);
  return data.key;
}

/** Revokes one specific key by id — does not touch the account's other keys. */
export async function revokeApiKeyById(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/account/api-keys/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
    headers,
  });
  await handleResponse<{ ok: true }>(res);
}

// ─── AI Model Generation (Enterprise) ──────────────────────────────────────
// Real backend at POST /api/ai-studio/models/generate — server enforces requireAuth +
// requirePlan('enterprise') independently of this UI (see backend/src/middleware/requirePlan.ts).

export interface AiModelGenerationParams {
  /** Free-text description of the model to generate. */
  prompt: string;
  /** Client-generated per-attempt key (crypto.randomUUID()) — lets the server dedupe a retried
   * request instead of double-reserving credits or starting a second job. Omit to skip protection. */
  idempotencyKey?: string;
}

export interface AiModelResult {
  id: string;
  imageUrl: string;
  /** Backend storage path — reusable directly as a try-on `personImagePath` (same storage layer). */
  storagePath: string;
  createdAt: string;
}

export async function generateAiModel(params: AiModelGenerationParams): Promise<AiModelResult> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/models/generate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await handleResponse<{ id: string; storagePath?: string; createdAt?: string; status?: string }>(res);
  if (data.status === 'duplicate' || !data.storagePath) {
    // A retried request reused an idempotency key already claimed by a prior generation — the
    // server intentionally didn't replay the full result. Surface this rather than building a
    // broken AiModelResult from a partial response.
    throw new ApiError('This model was already generated with this request — check My Models.', 409, 'duplicate_request');
  }
  const imageUrl = await getSignedImageUrl(data.storagePath);
  return { id: data.id, imageUrl, storagePath: data.storagePath, createdAt: data.createdAt ?? new Date().toISOString() };
}

export async function getSavedAiModels(): Promise<AiModelResult[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/models`, { headers });
  const data = await handleResponse<{
    models: Array<{ id: string; storagePath: string; createdAt: string }>;
  }>(res);
  return Promise.all(
    data.models.map(async (m) => ({
      id: m.id,
      imageUrl: await getSignedImageUrl(m.storagePath),
      storagePath: m.storagePath,
      createdAt: m.createdAt,
    }))
  );
}

export async function deleteAiModel(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/models/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  await handleResponse<{ ok: boolean }>(res);
}

// ─── AI Product Photoshoot (Enterprise) ────────────────────────────────────
// Real backend at POST /api/ai-studio/photoshoot/generate — server enforces requireAuth +
// requirePlan('enterprise'). Flow: upload a product photo, pick a model (stock library or one of
// the brand's saved AI-generated models), generate.

export interface PhotoshootGenerationParams {
  productStoragePath: string;
  modelId: string;
  modelSource: 'library' | 'generated';
  background?: string;
  theme?: string;
  lighting?: string;
  /** Client-generated per-attempt key (crypto.randomUUID()) — lets the server dedupe a retried
   * request instead of double-reserving credits or starting a second job. Omit to skip protection. */
  idempotencyKey?: string;
}

export interface PhotoshootResult {
  imageUrl: string;
  createdAt: string;
}

export async function generateProductPhotoshoot(params: PhotoshootGenerationParams): Promise<PhotoshootResult> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/photoshoot/generate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await handleResponse<{ storagePath?: string; createdAt?: string; status?: string }>(res);
  if (data.status === 'duplicate' || !data.storagePath) {
    // See generateAiModel above — a retried request reused an already-claimed idempotency key.
    throw new ApiError('This photoshoot was already generated with this request — check your results.', 409, 'duplicate_request');
  }
  const imageUrl = await getSignedImageUrl(data.storagePath);
  return { imageUrl, createdAt: data.createdAt ?? new Date().toISOString() };
}

// ─── Outfit Builder (Enterprise) ────────────────────────────────────────────
// Combines multiple selected catalog products (top+bottom-or-one-piece, optional shoes/outerwear)
// into one flat-lay try-on, worn by a chosen model. Async/polled like the main try-on flow (see
// startTryOn/pollTryOnStatus above), since a full-outfit FASHN generation can take as long as the
// existing single-garment path.

export interface OutfitSlotSelection {
  top?: string;
  bottom?: string;
  one_piece?: string;
  shoes?: string;
  outerwear?: string;
  eyewear?: string;
  earrings?: string;
  necklace?: string;
  jewelry?: string;
}

export interface GenerateOutfitParams {
  modelId: string;
  modelSource: 'library' | 'generated';
  slots: OutfitSlotSelection;
  /** Client-generated per-attempt key (crypto.randomUUID()) — lets the server dedupe a retried
   * request instead of double-reserving credits or starting a second job. Omit to skip protection. */
  idempotencyKey?: string;
}

export interface OutfitResponse {
  outfitId: string;
  jobId?: string;
  status: 'processing' | 'completed' | 'failed' | 'duplicate';
  resultUrl?: string;
  error?: string;
  createdAt?: string;
  completedAt?: string;
}

export async function generateOutfit(params: GenerateOutfitParams): Promise<OutfitResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/outfit/generate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse<OutfitResponse>(res, { feature: 'outfit_builder' });
}

export async function pollOutfitStatus(outfitId: string): Promise<OutfitResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/outfit/${outfitId}`, { headers });
  return handleResponse<OutfitResponse>(res, { feature: 'outfit_builder' });
}

// ─── AI Model Studio (Enterprise) ───────────────────────────────────────────
// Turns a flat-lay product photo into professional on-model photography via FASHN
// product-to-model. No model-library step — optionally guided by a face reference for identity.

export interface GenerateProductModelParams {
  productStoragePath: string;
  faceReferenceStoragePath?: string;
  prompt?: string;
  /** Client-generated per-attempt key (crypto.randomUUID()) — lets the server dedupe a retried
   * request instead of double-reserving credits or starting a second job. Omit to skip protection. */
  idempotencyKey?: string;
}

export interface ProductModelGenerationResponse {
  generationId: string;
  jobId?: string;
  status: 'processing' | 'completed' | 'failed' | 'duplicate';
  resultUrl?: string;
  error?: string;
  createdAt?: string;
  completedAt?: string;
}

export async function generateProductModel(params: GenerateProductModelParams): Promise<ProductModelGenerationResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/product-model/generate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse<ProductModelGenerationResponse>(res, { feature: 'product_model' });
}

export async function pollProductModelStatus(generationId: string): Promise<ProductModelGenerationResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/product-model/${generationId}`, { headers });
  return handleResponse<ProductModelGenerationResponse>(res, { feature: 'product_model' });
}

// ─── AI Video (Enterprise) ───────────────────────────────────────────────────
// Animates a still image into a short clip via FASHN image-to-video. Real per-credit cost.

export interface GenerateVideoParams {
  /** Exactly one of these three source fields must be set. */
  sourceStoragePath?: string;
  /** Animate a completed try-on's own result image. */
  tryonId?: string;
  /** Animate a saved AI model (stock library or the brand's own generated model). */
  modelId?: string;
  modelSource?: 'library' | 'generated';
  prompt?: string;
  duration?: 5 | 10;
  resolution?: '480p' | '720p' | '1080p';
  /** Client-generated per-attempt key (crypto.randomUUID()) — lets the server dedupe a retried
   * request instead of double-reserving credits or starting a second job. Omit to skip protection. */
  idempotencyKey?: string;
}

export interface VideoGenerationResponse {
  generationId: string;
  jobId?: string;
  status: 'processing' | 'completed' | 'failed' | 'duplicate';
  resultUrl?: string;
  error?: string;
  createdAt?: string;
  completedAt?: string;
}

export async function generateVideo(params: GenerateVideoParams): Promise<VideoGenerationResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/video/generate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse<VideoGenerationResponse>(res, { feature: 'video' });
}

export async function pollVideoStatus(generationId: string): Promise<VideoGenerationResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/ai-studio/video/${generationId}`, { headers });
  return handleResponse<VideoGenerationResponse>(res, { feature: 'video' });
}

// ─── My Creations ───────────────────────────────────────────────────────────
// Unified, durable read across every generator (Try-On, Outfit Builder, AI Model Studio, AI
// Product Photoshoot, AI Video, AI Models) — persists across refresh/logout/device change, unlike
// each tool's own in-session results list.

export type CreationType = "tryon" | "outfit" | "product_model" | "photoshoot" | "video" | "ai_model";

export interface Creation {
  id: string;
  type: CreationType;
  status: string;
  resultUrl: string | null;
  isVideo: boolean;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface CreationsPage {
  creations: Creation[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Pass the previous page's `nextCursor` to fetch the next 20 (or `limit`) — omit for the first page. */
export async function getMyCreations(cursor?: string | null, limit = 20): Promise<CreationsPage> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`${BACKEND_URL}/api/creations?${params}`, { headers });
  return handleResponse<CreationsPage>(res);
}

export async function deleteCreation(type: CreationType, id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/creations/${type}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  await handleResponse<{ ok: boolean }>(res);
}

/** Types that produce an image usable as a model — `video` isn't an image, `ai_model` is already one. */
export type PromotableCreationType = Exclude<CreationType, "video" | "ai_model">;

/** "Save as model" — Brand Library write path. The result becomes a saved model in ModelPickerGrid everywhere. */
export async function promoteCreationToModel(type: PromotableCreationType, id: string): Promise<{ modelId: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/creations/${type}/${encodeURIComponent(id)}/promote-to-model`, {
    method: "POST",
    headers,
  });
  return handleResponse<{ ok: boolean; modelId: string }>(res);
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

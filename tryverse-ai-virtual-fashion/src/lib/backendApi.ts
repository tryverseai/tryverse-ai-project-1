import { readConvexAuthJwt } from '@/lib/convexAuthStorage';

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
 * - In **development**, use same-origin `/api` and `/health` (Vite → :3001) when URL is unset **or**
 *   still `http://localhost:3001` in .env — avoids `Failed to fetch (localhost:3001)` from direct cross-port calls.
 * - In **production**, set `VITE_BACKEND_URL` to your API origin when UI and API differ.
 */
function resolveBackendBaseUrl(): string {
  const raw = typeof import.meta.env.VITE_BACKEND_URL === 'string' ? import.meta.env.VITE_BACKEND_URL : '';
  const trimmed = raw.trim();

  if (import.meta.env.DEV) {
    if (!trimmed || isLocalDefaultApiUrl(trimmed)) {
      return '';
    }
    return trimmed.replace(/\/$/, '');
  }

  if (trimmed) {
    return trimmed.replace(/\/$/, '');
  }
  return 'http://localhost:3001';
}

/** Same-origin in dev (empty) or explicit API base in prod. */
export const BACKEND_URL = resolveBackendBaseUrl();

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

export type TryOnCategory = 'clothing' | 'bags' | 'glasses';

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
  account_type?: 'individual' | 'business' | null;
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

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = readConvexAuthJwt();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** Synchronous — no async needed since readConvexAuthJwt is synchronous. */
function getAuthToken(): string | null {
  return readConvexAuthJwt();
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

    // 503 / 5xx — infrastructure failure; use a clearer message
    if (res.status === 503) {
      message = 'Service temporarily unavailable. Please try again in a moment.';
    } else if (res.status >= 500 && !code) {
      message = message.startsWith('Request failed')
        ? 'An unexpected server error occurred. Please try again.'
        : message;
    }

    // 401 — Expired or missing token: dispatch a global event so AuthContext can sign out
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tryverse:auth:expired'));
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

    // Skip Sentry for expected non-server errors (402, 429, 403)
    if (res.status !== 402 && res.status !== 429 && res.status !== 403) {
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
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('image', file);
  formData.append('type', type);

  const res = await fetch(`${BACKEND_URL}/api/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
}

export interface TryOnResponse {
  tryonId: string;
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
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
  const token = getAuthToken();
  const res = await fetch(
    `${BACKEND_URL}/api/upload/signed-url?path=${encodeURIComponent(path)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
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
    accountType: 'individual' | 'business';
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
): Promise<{ success: boolean; id?: string; emailSent?: boolean }> {
  const res = await fetch(`${BACKEND_URL}/api/early-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, { feature: 'early_access' });
}

export async function submitIndividualEarlyAccessRequest(payload: {
  first_name: string;
  email: string;
  what_interests_you: string;
  timeline: string;
  heard_about?: string | null;
}): Promise<{ success: boolean; id?: string; emailSent?: boolean }> {
  const res = await fetch(`${BACKEND_URL}/api/early-access/individual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, { feature: 'early_access' });
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
  const res = await fetch(`${BACKEND_URL}/api/support/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = 'Failed to submit';
    try {
      const body = await res.json();
      message = (body as { error?: string }).error || message;
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
  category: TryOnCategory;
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

export async function getProducts(page = 1, limit = 20, category?: TryOnCategory) {
  if (!readConvexAuthJwt()) throw new Error('Not authenticated');
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
      category: p.category as TryOnCategory,
      image_display_url: p.image_display_url ?? (await resolveProductImageDisplayUrl(p.image_url)),
    }))
  );
  return { products, pagination: body.pagination };
}

export async function createProduct(data: {
  name: string;
  image_url?: string;
  category: TryOnCategory;
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
  data: { name?: string; image_url?: string; category?: TryOnCategory; product_url?: string }
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

// ─── Widget domains ───────────────────────────────────────────────────────────

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
  } catch {
    /* ignore */
  }
}

/** No-op — kept for call-site compatibility. Heartbeat is handled server-side. */
export function setAdminKeyLastActive(): void {}

/** No-op — kept for call-site compatibility. Expiry is handled by the server session. */
export function isAdminSessionExpired(): boolean { return false; }

/**
 * Login: validates the admin key on the server; server sets an HttpOnly cookie.
 * Throws if the key is invalid.
 */
export async function adminLogin(key: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/admin/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error('Invalid admin key');
  setStoredAdminKey('session'); // mark UI state only
}

/**
 * Logout: revokes the server session and clears the cookie.
 */
export async function adminLogout(): Promise<void> {
  clearStoredAdminKey();
  try {
    await fetch(`${BACKEND_URL}/api/admin/session`, {
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
    const res = await fetch(`${BACKEND_URL}/api/admin/session/check`, {
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
  if (res.status === 403) throw new ApiError('Invalid admin key', 403);
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
  accountType?: 'all' | 'business' | 'individual'
): Promise<AdminUserList> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.append('search', search);
  if (accountType && accountType !== 'all') params.append('accountType', accountType);
  return adminFetch<AdminUserList>(`/api/admin/users?${params}`, adminKey);
}

export async function patchAdminUserAccountType(
  adminKey: string,
  userId: string,
  account_type: 'business' | 'individual'
): Promise<{ ok: boolean }> {
  return adminFetch<{ ok: boolean }>(`/api/admin/users/${userId}/profile`, adminKey, {
    method: 'PATCH',
    body: JSON.stringify({ account_type }),
  });
}

export async function getAdminTryons(adminKey: string, page = 1, limit = 50, status?: string): Promise<AdminTryOnList> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.append('status', status);
  return adminFetch<AdminTryOnList>(`/api/admin/tryons?${params}`, adminKey);
}

export async function getAdminRevenue(adminKey: string, days = 30): Promise<Record<string, unknown>> {
  return adminFetch<Record<string, unknown>>(`/api/admin/revenue?days=${days}`, adminKey);
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

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

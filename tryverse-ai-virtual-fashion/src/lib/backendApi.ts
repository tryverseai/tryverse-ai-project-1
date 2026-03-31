import { supabase } from '@/integrations/supabase/client';

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

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function handleResponse<T>(res: Response, context?: { feature?: string }): Promise<T> {
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; message?: string; code?: string };
      message = body.error || body.message || message;
      if (typeof body.code === 'string') code = body.code;
    } catch { /* ignore parse error */ }
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = res.status;
    if (code) err.code = code;
    if (res.status !== 402) {
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
  if (!(err instanceof Error)) return false;
  const e = err as Error & { status?: number; code?: string };
  return e.status === 402 || e.code === 'CREDITS_EXHAUSTED';
}

/** Same wording the backend returns for 402 — use for studio UIs that need a fallback. */
export const SHOPPER_TRYON_UNAVAILABLE_MESSAGE =
  "Virtual try-on isn't available right now. Please try again later or contact the store.";

// ─── Emails ───────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(params: { name?: string; brandName?: string }) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/emails/welcome`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: params.name, brandName: params.brandName }),
  });
  if (!res.ok) return;
  await res.json();
}

export async function sendApiKeyDeliveryEmail(params: { keyName: string; keyPreview: string }) {
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
  const token = await getAuthToken();
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
  const token = await getAuthToken();
  const res = await fetch(
    `${BACKEND_URL}/api/upload/signed-url?path=${encodeURIComponent(path)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  const data = await handleResponse<{ url: string }>(res);
  return data.url;
}

export async function getTryOnHistory(page = 1, category?: TryOnCategory) {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (category) params.append('category', category);
  const res = await fetch(`${BACKEND_URL}/api/tryon?${params}`, { headers });
  return handleResponse<{
    tryons: (TryOnResponse & { id?: string; tryonId?: string; createdAt?: string })[];
    pagination: { page: number; limit: number; total: number; pages: number };
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
    isUnlimited: boolean;
    freeCreditsRemaining: number;
    freeCreditsTotal: number;
    monthlyCreditsRemaining: number;
    monthlyCreditsTotal: number;
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
// Uses Supabase directly (RLS) so Products page works without backend dependency

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

async function getImageDisplayUrl(pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${BACKEND_URL}/api/upload/signed-url?path=${encodeURIComponent(pathOrUrl)}`,
      { headers }
    );
    if (!res.ok) return null;
    const { url } = await res.json();
    return url || null;
  } catch {
    return null;
  }
}

export async function getProducts(page = 1, limit = 20, category?: TryOnCategory) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not authenticated');

  let q = supabase
    .from('products')
    .select('id, name, image_url, category, product_url, tryons_count, created_at, updated_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (category) q = q.eq('category', category);

  const from = (page - 1) * limit;
  const { data: rows, error, count } = await q.range(from, from + limit - 1);

  if (error) throw new Error(error.message);

  const products: Product[] = await Promise.all(
    (rows || []).map(async (p) => ({
      ...p,
      category: p.category as TryOnCategory,
      image_display_url: await getImageDisplayUrl(p.image_url),
    }))
  );

  return {
    products,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit) || 1,
    },
  };
}

export async function createProduct(data: {
  name: string;
  image_url?: string;
  category: TryOnCategory;
  product_url?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      name: data.name,
      image_url: data.image_url || null,
      category: data.category,
      product_url: data.product_url || null,
    })
    .select('id, name, image_url, category, product_url, tryons_count, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  const image_display_url = await getImageDisplayUrl(product.image_url);
  return { ...product, image_display_url } as Product;
}

export async function updateProduct(
  id: string,
  data: { name?: string; image_url?: string; category?: TryOnCategory; product_url?: string }
) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not authenticated');

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.image_url !== undefined) updates.image_url = data.image_url;
  if (data.category !== undefined) updates.category = data.category;
  if (data.product_url !== undefined) updates.product_url = data.product_url;

  const { data: product, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, name, image_url, category, product_url, tryons_count, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  const image_display_url = await getImageDisplayUrl(product.image_url);
  return { ...product, image_display_url } as Product;
}

export async function deleteProduct(id: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getBrandAnalytics(days = 30) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/analytics?days=${days}`, { headers });
  return handleResponse(res);
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

// ─── Admin (requires X-Admin-Key) ──────────────────────────────────────────────

const ADMIN_KEY_STORAGE = 'tryverse_admin_key';
const ADMIN_KEY_LAST_ACTIVE = 'tryverse_admin_key_last_active';

/** Minutes of inactivity (away from admin page) before auto sign-out. No timeout while on admin page. */
const ADMIN_IDLE_TIMEOUT_MINUTES = 15;

export function getStoredAdminKey(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setStoredAdminKey(key: string): void {
  try {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
    setAdminKeyLastActive();
  } catch {
    /* ignore */
  }
}

export function clearStoredAdminKey(): void {
  try {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    sessionStorage.removeItem(ADMIN_KEY_LAST_ACTIVE);
  } catch {
    /* ignore */
  }
}

export function setAdminKeyLastActive(): void {
  try {
    sessionStorage.setItem(ADMIN_KEY_LAST_ACTIVE, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** True if admin has been away longer than the idle timeout (should re-enter key). */
export function isAdminSessionExpired(): boolean {
  try {
    const lastActive = sessionStorage.getItem(ADMIN_KEY_LAST_ACTIVE);
    if (!lastActive) return true;
    const elapsed = Date.now() - parseInt(lastActive, 10);
    return elapsed > ADMIN_IDLE_TIMEOUT_MINUTES * 60 * 1000;
  } catch {
    return true;
  }
}

async function adminFetch(path: string, adminKey: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey,
        ...options?.headers,
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
  if (res.status === 403) throw new Error('Invalid admin key');
  if (!res.ok) {
    let message = `Admin API error (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.error === 'string') message = body.error;
      const details = body?.details as { message?: string }[] | undefined;
      if (Array.isArray(details) && details[0]?.message) {
        message = `${message}: ${details[0].message}`;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export async function getAdminMetrics(adminKey: string) {
  return adminFetch('/api/admin/metrics', adminKey);
}

export async function getAdminModelLibrary(adminKey: string) {
  return adminFetch<{
    models: (TryverseModel & { is_active: boolean; created_at: string })[];
  }>('/api/admin/model-library', adminKey, { cache: 'no-store' });
}

export async function getAdminUsers(
  adminKey: string,
  page = 1,
  limit = 50,
  search?: string,
  accountType?: 'all' | 'business' | 'individual'
) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.append('search', search);
  if (accountType && accountType !== 'all') params.append('accountType', accountType);
  return adminFetch(`/api/admin/users?${params}`, adminKey);
}

export async function patchAdminUserAccountType(
  adminKey: string,
  userId: string,
  account_type: 'business' | 'individual'
) {
  return adminFetch(`/api/admin/users/${userId}/profile`, adminKey, {
    method: 'PATCH',
    body: JSON.stringify({ account_type }),
  });
}

export async function getAdminTryons(adminKey: string, page = 1, limit = 50, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.append('status', status);
  return adminFetch(`/api/admin/tryons?${params}`, adminKey);
}

export async function getAdminRevenue(adminKey: string, days = 30) {
  return adminFetch(`/api/admin/revenue?days=${days}`, adminKey);
}

export async function getAdminQueue(adminKey: string) {
  return adminFetch('/api/admin/queue', adminKey);
}

/** Block or unblock a user (profiles.is_blocked + Supabase auth). */
export async function banAdminUser(adminKey: string, userId: string, unban = false) {
  return adminFetch(`/api/admin/users/${userId}/block`, adminKey, {
    method: 'POST',
    body: JSON.stringify({ blocked: !unban }),
  });
}

export async function adjustUserCredits(adminKey: string, userId: string, credits: { freeCredits?: number; monthlyCredits?: number }) {
  return adminFetch(`/api/admin/users/${userId}/credits`, adminKey, {
    method: 'PATCH',
    body: JSON.stringify(credits),
  });
}

export async function retryTryOn(adminKey: string, tryonId: string) {
  return adminFetch(`/api/admin/tryons/${tryonId}/retry`, adminKey, { method: 'POST' });
}

export async function pauseAdminQueue(adminKey: string) {
  return adminFetch('/api/admin/queue/pause', adminKey, { method: 'POST' });
}

export async function resumeAdminQueue(adminKey: string) {
  return adminFetch('/api/admin/queue/resume', adminKey, { method: 'POST' });
}

export async function getAdminSettings(adminKey: string) {
  return adminFetch('/api/admin/settings', adminKey);
}

export async function getAdminHealth(adminKey: string) {
  return adminFetch('/api/admin/health', adminKey);
}

export async function getAdminActivity(adminKey: string, limit = 20) {
  return adminFetch(`/api/admin/activity?limit=${limit}`, adminKey);
}

export async function getAdminApiKeys(adminKey: string) {
  return adminFetch('/api/admin/api-keys', adminKey);
}

export async function revokeAdminApiKey(adminKey: string, keyId: string) {
  return adminFetch(`/api/admin/api-keys/${keyId}/revoke`, adminKey, { method: 'POST' });
}

export async function getAdminDomains(adminKey: string) {
  return adminFetch('/api/admin/domains', adminKey);
}

export async function getAdminLogs(adminKey: string, limit = 200, level?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (level) params.append('level', level);
  return adminFetch(`/api/admin/logs?${params}`, adminKey);
}

export async function getAdminSentryConfig(adminKey: string): Promise<{ enabled: boolean; issuesUrl?: string }> {
  return adminFetch('/api/admin/sentry-config', adminKey);
}

export async function getAdminAudit(
  adminKey: string,
  limit = 100,
  offset = 0,
  filters?: { eventType?: string; severity?: 'error' | 'warn' | 'info' }
) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters?.eventType) params.append('event_type', filters.eventType);
  else if (filters?.severity) params.append('severity', filters.severity);
  return adminFetch(`/api/admin/audit?${params}`, adminKey);
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

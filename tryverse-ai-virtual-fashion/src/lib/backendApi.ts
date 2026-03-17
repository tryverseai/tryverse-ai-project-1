import { supabase } from '@/integrations/supabase/client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

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

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch { /* ignore parse error */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
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
  return handleResponse<TryOnResponse>(res);
}

export async function pollTryOnStatus(tryonId: string): Promise<TryOnResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/tryon/${tryonId}`, { headers });
  return handleResponse<TryOnResponse>(res);
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
    tryons: TryOnResponse[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(res);
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export async function getCredits() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/credits`, { headers });
  return handleResponse<{
    plan: string;
    isUnlimited: boolean;
    freeCreditsRemaining: number;
    monthlyCreditsRemaining: number;
    monthlyCreditsTotal: number;
    usagePercent: number;
  }>(res);
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function initializePaystackPayment(
  planId: string,
  amount: number,
  callbackUrl: string
): Promise<{ authorization_url: string; reference: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/payment/initialize/paystack`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ planId, amount, callbackUrl }),
  });
  return handleResponse(res);
}

export async function initializeFlutterwavePayment(
  planId: string,
  amount: number,
  currency: string,
  callbackUrl: string
): Promise<{ authorization_url: string; tx_ref: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/payment/initialize/flutterwave`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ planId, amount, currency, callbackUrl }),
  });
  return handleResponse(res);
}

// ─── Products ─────────────────────────────────────────────────────────────────

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

export async function getProducts(page = 1, limit = 20, category?: TryOnCategory) {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (category) params.append('category', category);
  const res = await fetch(`${BACKEND_URL}/api/products?${params}`, { headers });
  return handleResponse<{
    products: Product[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(res);
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
  return handleResponse<Product>(res);
}

export async function updateProduct(
  id: string,
  data: { name?: string; image_url?: string; category?: TryOnCategory; product_url?: string }
) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/products/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<Product>(res);
}

export async function deleteProduct(id: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/products/${id}`, { method: 'DELETE', headers });
  if (res.status === 204) return;
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error || `Delete failed: ${res.status}`);
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

export function getStoredAdminKey(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setStoredAdminKey(key: string): void {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
}

export function clearStoredAdminKey(): void {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

async function adminFetch(path: string, adminKey: string, options?: RequestInit) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
      ...options?.headers,
    },
  });
  if (res.status === 403) throw new Error('Invalid admin key');
  if (!res.ok) throw new Error(`Admin API error: ${res.status}`);
  return res.json();
}

export async function getAdminMetrics(adminKey: string) {
  return adminFetch('/api/admin/metrics', adminKey);
}

export async function getAdminUsers(adminKey: string, page = 1, limit = 50, search?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.append('search', search);
  return adminFetch(`/api/admin/users?${params}`, adminKey);
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

export async function banAdminUser(adminKey: string, userId: string, unban = false) {
  const url = unban ? `/api/admin/users/${userId}/ban?none=1` : `/api/admin/users/${userId}/ban`;
  return adminFetch(url, adminKey, { method: 'DELETE' });
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

export async function getAdminAudit(adminKey: string, limit = 100, offset = 0, eventType?: string) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (eventType) params.append('event_type', eventType);
  return adminFetch(`/api/admin/audit?${params}`, adminKey);
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

import { env } from '../config/env';
import { anyApi, convexQueryTrusted } from '../config/convexHttp';

export type InviteGateOk = {
  valid: true;
  email: string;
  name?: string;
  /** personal | business; legacy ENV map treats as business-ish (full invite form) */
  accountType?: 'personal' | 'business';
  companyName?: string;
};

export type InviteGateResult =
  | { valid: false }
  | InviteGateOk;

export function parseEnvInviteTokenMap(): Record<string, string> {
  try {
    const raw = env.INVITE_TOKEN_MAP_JSON?.trim() || '{}';
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof k === 'string' && typeof v === 'string' && k.trim() && v.trim()) {
        out[k.trim()] = v.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Validates an invite token: Convex lifecycle invite (sent) wins; else falls back to INVITE_TOKEN_MAP_JSON.
 */
export async function resolveInviteGate(tokenRaw: string): Promise<InviteGateResult> {
  const token = String(tokenRaw ?? '').trim();
  if (!token) return { valid: false };

  try {
    const row = await convexQueryTrusted<{
      email: string;
      name?: string;
      accountType: string;
      companyName?: string;
      status: string;
    } | null>(anyApi.invites.getInviteByTokenTrusted, {
      secret: env.BACKEND_SHARED_SECRET,
      token,
    });
    if (row && row.status === 'sent') {
      const at = row.accountType === 'personal' ? 'personal' : 'business';
      return {
        valid: true,
        email: String(row.email).toLowerCase(),
        name: row.name ?? undefined,
        accountType: at,
        companyName: row.companyName ?? undefined,
      };
    }
  } catch {
    /* Convex unreachable — fall through to legacy map only */
  }

  const email = parseEnvInviteTokenMap()[token];
  if (!email) return { valid: false };
  return { valid: true, email: email.toLowerCase(), accountType: 'business' };
}

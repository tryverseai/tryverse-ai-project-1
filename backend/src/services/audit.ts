import { logger } from '../config/logger';
import { env } from '../config/env';
import { anyApi, convexMutationTrusted } from '../config/convexHttp';

export type AuditEventType =
  | 'admin_action'
  | 'failed_login'
  | 'rate_limit'
  | 'api_key_blocked'
  | 'api_key_anomaly';

export interface AuditEntry {
  event_type: AuditEventType;
  actor?: string;
  action: string;
  target_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await convexMutationTrusted(anyApi.backendTrusted.insertAdminAuditLog, {
      secret: env.BACKEND_SHARED_SECRET,
      event_type: entry.event_type,
      action: entry.action,
      actor: entry.actor,
      target_id: entry.target_id,
      details: entry.details,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
    });
  } catch (err) {
    logger.error('Audit log error', { error: String(err) });
  }
}

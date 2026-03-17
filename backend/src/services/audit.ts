import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';

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
    const { error } = await supabaseAdmin.from('admin_audit_log').insert({
      event_type: entry.event_type,
      actor: entry.actor ?? null,
      action: entry.action,
      target_id: entry.target_id ?? null,
      details: entry.details ?? {},
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
    });
    if (error) logger.error('Audit log insert failed', { error: error.message });
  } catch (err) {
    logger.error('Audit log error', { error: String(err) });
  }
}

-- Admin audit log for security and compliance
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type  TEXT NOT NULL,           -- admin_action, failed_login, rate_limit, api_key_blocked, api_key_anomaly
  actor       TEXT,                    -- admin, ip:x.x.x.x, api_key:xxx, user:uuid
  action      TEXT NOT NULL,           -- user_banned, credits_adjusted, key_revoked, etc.
  target_id   TEXT,                    -- userId, keyId, etc.
  details     JSONB DEFAULT '{}',
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_event_type ON public.admin_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON public.admin_audit_log(actor);

-- RLS enabled: blocks direct client access. Backend uses service role (bypasses RLS).
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_audit_log IS 'Security audit trail: admin actions, failed logins, rate limits, API key events';

import { Router, Request, Response, NextFunction } from 'express';
import { createHash, randomInt } from 'crypto';
import { requireAuth, convexProfileCreditLookupKey } from '../middleware/auth';
import {
  cxGetProfile,
  cxInsertProfile,
  cxPatchProfile,
  cxCountTrustedDevices,
  cxIsFingerprintTrusted,
  cxRegisterTrustedDevice,
  cxReplaceDeviceApprovalChallenge,
  cxVerifyDeviceApprovalChallenge,
} from '../services/creditsConvexBridge';
import { DEFAULT_FREE_CREDITS_BUSINESS, DEFAULT_FREE_CREDITS_INDIVIDUAL } from '../services/credits';
import { logger } from '../config/logger';
import { sendWelcomeEmail, sendDeviceApprovalEmail } from '../services/email';
import { cxConsolidateTryonsToCanonicalUserId } from '../services/tryonConvexBridge';
import { env } from '../config/env';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../config/convexHttp';

const router = Router();

function hashDeviceApprovalCode(profileKey: string, fingerprint: string, codeDigits: string): string {
  return createHash('sha256')
    .update(
      `${env.BACKEND_SHARED_SECRET.trim()}|${profileKey}|${fingerprint.trim()}|${codeDigits.trim()}`
    )
    .digest('hex');
}

async function migrateLegacyWelcomeSentField(profileKey: string): Promise<void> {
  const row = await cxGetProfile(profileKey);
  if (!row) return;
  const legacy =
    typeof row.verification_email_sent_at === 'string' ? row.verification_email_sent_at.trim() : '';
  const modern = typeof row.welcome_email_sent_at === 'string' ? row.welcome_email_sent_at.trim() : '';
  if (legacy && !modern) {
    try {
      await cxPatchProfile(profileKey, { welcome_email_sent_at: legacy });
    } catch (e) {
      logger.warn('welcome_email_sent legacy migration failed', { error: String(e) });
    }
  }
}

/**
 * Sends the post-verification welcome email once per profile (stored in `welcome_email_sent_at`).
 * Legacy rows used `verification_email_sent_at` for the same purpose — migrated on read without resending.
 */
async function sendWelcomeEmailOnce(params: {
  profileKey: string;
  email: string;
  fullName?: string;
  brandName?: string;
  logUserSlice: string;
}): Promise<void> {
  const { profileKey, email, fullName, brandName, logUserSlice } = params;
  if (!email.trim()) return;

  await migrateLegacyWelcomeSentField(profileKey);

  const row = await cxGetProfile(profileKey);
  if (!row) return;

  const welcomed =
    typeof row.welcome_email_sent_at === 'string'
      ? row.welcome_email_sent_at.trim().length > 0
      : Boolean((row as { welcome_email_sent_at?: unknown }).welcome_email_sent_at);

  /** Legacy installs: old lock field blocks duplicate welcome sends. */
  const legacyWelcomed =
    typeof row.verification_email_sent_at === 'string'
      ? row.verification_email_sent_at.trim().length > 0
      : Boolean((row as { verification_email_sent_at?: unknown }).verification_email_sent_at);

  if (welcomed || legacyWelcomed) return;

  const lockIso = new Date().toISOString();
  try {
    await cxPatchProfile(profileKey, { welcome_email_sent_at: lockIso });
  } catch (e) {
    logger.warn('could not lock welcome_email_sent_at before welcome send', {
      error: String(e),
      userId: logUserSlice,
    });
    return;
  }

  try {
    const ok = await sendWelcomeEmail({
      email,
      ...(fullName ? { name: fullName } : {}),
      ...(brandName !== undefined ? { brandName } : {}),
    });
    if (!ok) {
      logger.warn('welcome email was not confirmed by provider (Resend); not retrying from bootstrap', {
        userId: logUserSlice,
      });
    }
  } catch (e) {
    logger.warn('welcome email send threw', {
      error: String(e),
      userId: logUserSlice,
    });
  }
}

/**
 * POST /api/account/session/bootstrap
 * Ensures a Convex `profiles` row exists for the authenticated local-session user.
 */
router.post(
  '/session/bootstrap',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const canonicalId = req.user!.id;
      const profileKey = convexProfileCreditLookupKey(req);
      const body = req.body as Record<string, unknown>;
      const emailFromJwt = (req.user!.email || '').trim();
      const emailFromBody =
        typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const email = emailFromJwt || emailFromBody;
      const deviceFingerprintRaw =
        typeof body.deviceFingerprint === 'string' ? body.deviceFingerprint.trim() : '';

      if (deviceFingerprintRaw.length < 8) {
        res.status(400).json({
          error: 'This app update requires a browser device id. Reload the page and sign in again.',
        });
        return;
      }

      try {
        await cxConsolidateTryonsToCanonicalUserId(req.convexAuthSubjectRaw ?? canonicalId);
      } catch (e) {
        logger.warn('try-on subject consolidation skipped or failed during bootstrap', {
          error: String(e),
          userSlice: canonicalId.slice(0, 12),
        });
      }

      const trustedCount = await cxCountTrustedDevices(profileKey);
      const fpTrusted = await cxIsFingerprintTrusted(profileKey, deviceFingerprintRaw);
      if (trustedCount > 0 && !fpTrusted) {
        res.status(403).json({
          error: 'Approve this device with the emailed code before continuing.',
          code: 'DEVICE_APPROVAL_REQUIRED',
        });
        return;
      }

      const accountTypeRaw = body.accountType;
      const at = accountTypeRaw === 'individual' ? 'individual' : 'business';
      const cap = at === 'individual' ? DEFAULT_FREE_CREDITS_INDIVIDUAL : DEFAULT_FREE_CREDITS_BUSINESS;
      const brandName = typeof body.brandName === 'string' ? body.brandName : undefined;
      const fullName = typeof body.fullName === 'string' ? body.fullName : undefined;
      const role = typeof body.role === 'string' ? body.role : undefined;

      const existing = await cxGetProfile(profileKey);
      let createdFlag = false;
      if (existing) {
        await cxPatchProfile(profileKey, {
          contact_email: email || existing.contact_email,
          ...(brandName !== undefined ? { brand_name: brandName } : {}),
          ...(fullName !== undefined ? { full_name: fullName } : {}),
          ...(role !== undefined ? { role } : {}),
          account_type: at,
        });
        await sendWelcomeEmailOnce({
          profileKey,
          email,
          fullName,
          brandName,
          logUserSlice: canonicalId.slice(0, 12),
        });
        createdFlag = false;
      } else {
        await cxInsertProfile(profileKey, at, cap, cap, {
          ...(email ? { contactEmail: email } : {}),
        });
        await cxPatchProfile(profileKey, {
          ...(brandName !== undefined ? { brand_name: brandName } : {}),
          ...(fullName !== undefined ? { full_name: fullName } : {}),
          ...(role !== undefined ? { role } : {}),
        });

        await sendWelcomeEmailOnce({
          profileKey,
          email,
          fullName,
          brandName,
          logUserSlice: canonicalId.slice(0, 12),
        });
        createdFlag = true;
      }

      await cxRegisterTrustedDevice(profileKey, deviceFingerprintRaw);
      res.json({ ok: true, created: createdFlag });
    } catch (err) {
      logger.error('account bootstrap failed', { error: String(err) });
      next(err);
    }
  }
);

/**
 * POST /api/account/device/request-code
 * Sends a 10-minute device-approval OTP for verified profiles with ≥1 trusted device.
 */
router.post(
  '/device/request-code',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profileKey = convexProfileCreditLookupKey(req);
      const body = req.body as Record<string, unknown>;
      const fpRaw = typeof body.deviceFingerprint === 'string' ? body.deviceFingerprint.trim() : '';
      if (fpRaw.length < 8) {
        res.status(400).json({ error: 'Reload the page and try again (missing device fingerprint).' });
        return;
      }

      const email = (req.user!.email || '').trim().toLowerCase();
      if (!email) {
        res.status(400).json({ error: 'Account has no verified email.' });
        return;
      }

      const profile = await cxGetProfile(profileKey);
      if (!profile) {
        res.status(400).json({ error: 'Profile not found. Complete onboarding first.' });
        return;
      }

      const trustCount = await cxCountTrustedDevices(profileKey);
      if (trustCount === 0) {
        res.status(400).json({
          error: 'No previous devices on file — sign in and bootstrap normally on this browser.',
        });
        return;
      }

      if (await cxIsFingerprintTrusted(profileKey, fpRaw)) {
        res.status(400).json({ error: 'This device is already approved.' });
        return;
      }

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const hash = hashDeviceApprovalCode(profileKey, fpRaw, code);
      const expiresAtMs = Date.now() + 10 * 60 * 1000;
      await cxReplaceDeviceApprovalChallenge({
        userProfileId: profileKey,
        fingerprint: fpRaw,
        codeHash: hash,
        expiresAtMs,
      });

      const firstTok =
        (typeof profile.full_name === 'string' && profile.full_name.trim()?.split(/\s+/)[0]) ||
        (typeof profile.brand_name === 'string' && profile.brand_name.trim()?.split(/\s+/)[0]);

      await sendDeviceApprovalEmail({
        email,
        code,
        ...(firstTok ? { firstName: firstTok } : {}),
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/account/device/verify
 * Validates the device code — other active sessions remain valid.
 */
router.post(
  '/device/verify',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profileKey = convexProfileCreditLookupKey(req);
      const body = req.body as Record<string, unknown>;
      const fpRaw = typeof body.deviceFingerprint === 'string' ? body.deviceFingerprint.trim() : '';
      const codeDigits =
        typeof body.code === 'string' ? body.code.trim().replace(/\s+/g, '') : '';

      if (fpRaw.length < 8) {
        res.status(400).json({ error: 'Reload the page and try again (missing device fingerprint).' });
        return;
      }
      if (!/^[0-9]{6}$/.test(codeDigits)) {
        res.status(400).json({ error: 'Enter the 6-digit code from your email.' });
        return;
      }

      const hash = hashDeviceApprovalCode(profileKey, fpRaw, codeDigits);

      try {
        await cxVerifyDeviceApprovalChallenge({
          userProfileId: profileKey,
          fingerprint: fpRaw,
          codeHash: hash,
        });
      } catch {
        res.status(400).json({ error: 'Invalid or expired code.' });
        return;
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/account/me
 */
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await cxGetProfile(convexProfileCreditLookupKey(req));
    res.json({
      user: { id: req.user!.id, email: req.user!.email || '' },
      profile,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/account/api-keys
 * The caller's own active API keys.
 */
router.get('/api-keys', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const keys = await convexQueryTrusted<Array<{ id: string; key_value: string; name: string; created_at: string }>>(
      anyApi.backendTrusted.listApiKeysForUser,
      { secret: env.BACKEND_SHARED_SECRET, userId: req.user!.id }
    );
    res.json({ keys });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/account/api-keys
 * Idempotent: returns the caller's existing key if one already exists, otherwise creates one.
 * This is what makes key generation "automatic" — the dashboard calls this once on first load
 * of the Connect Store screen and never shows a manual "Generate" button.
 */
router.post('/api-keys', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await convexQueryTrusted<Array<{ id: string; key_value: string; name: string; created_at: string }>>(
      anyApi.backendTrusted.listApiKeysForUser,
      { secret: env.BACKEND_SHARED_SECRET, userId: req.user!.id }
    );
    if (existing.length > 0) {
      res.json({ key: existing[0], created: false });
      return;
    }
    const created = (await convexMutationTrusted(anyApi.adminTrusted.createApiKeyAdmin, {
      secret: env.BACKEND_SHARED_SECRET,
      userId: req.user!.id,
      name: 'Production',
    })) as { id: string; user_id: string; key_value: string; name: string; created_at: string; status: 'active' };
    res.json({ key: created, created: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/account/api-keys/regenerate
 * Revokes the caller's existing key(s) and issues a fresh one. Old key stops working immediately.
 */
router.post(
  '/api-keys/regenerate',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const existing = await convexQueryTrusted<Array<{ id: string }>>(anyApi.backendTrusted.listApiKeysForUser, {
        secret: env.BACKEND_SHARED_SECRET,
        userId: req.user!.id,
      });
      for (const key of existing) {
        await convexMutationTrusted(anyApi.adminTrusted.revokeApiKeyAdmin, {
          secret: env.BACKEND_SHARED_SECRET,
          legacyId: key.id,
        });
      }
      const created = (await convexMutationTrusted(anyApi.adminTrusted.createApiKeyAdmin, {
        secret: env.BACKEND_SHARED_SECRET,
        userId: req.user!.id,
        name: 'Production',
      })) as { id: string; user_id: string; key_value: string; name: string; created_at: string; status: 'active' };
      res.json({ key: created });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/account/settings
 * Body fields mirror Convex `profiles.updateSettings`.
 */
router.patch(
  '/settings',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const k of [
        'brand_name',
        'website_url',
        'contact_email',
        'widget_show_models',
        'widget_fit_recommendations',
        'widget_auto_detect',
        'widget_collect_analytics',
      ] as const) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: 'No valid settings fields' });
        return;
      }
      await cxPatchProfile(convexProfileCreditLookupKey(req), patch);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/account/compliance
 */
router.patch(
  '/compliance',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { onboarding_goals, completed_at } = req.body as {
        onboarding_goals?: unknown;
        completed_at?: unknown;
      };
      if (!Array.isArray(onboarding_goals) || typeof completed_at !== 'string') {
        res.status(400).json({ error: 'onboarding_goals (array) and completed_at (string) required' });
        return;
      }
      const goals = onboarding_goals.filter((g): g is string => typeof g === 'string');
      await cxPatchProfile(convexProfileCreditLookupKey(req), {
        compliance_onboarding_completed_at: completed_at,
        onboarding_goals: goals,
        updated_at: completed_at,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

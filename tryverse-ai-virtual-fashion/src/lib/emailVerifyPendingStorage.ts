import type { AccountType } from "./accountType";

export const EMAIL_VERIFY_PENDING_STORAGE_KEY = "tryverse_email_verify_pending";

export type PendingEmailVerificationBootstrap = {
  accountType: AccountType;
  brandName?: string;
  fullName?: string;
  role?: string;
  turnstileToken?: string;
};

export type EmailVerifyPendingPayload = {
  email: string;
  pendingBootstrap?: PendingEmailVerificationBootstrap;
  inviteToken?: string;
  accountTypeAfterInvite?: AccountType;
};

export function saveEmailVerifyPending(payload: EmailVerifyPendingPayload) {
  try {
    sessionStorage.setItem(EMAIL_VERIFY_PENDING_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

function isAccountType(v: unknown): v is AccountType {
  return v === "individual" || v === "business";
}

export function readEmailVerifyPending(): EmailVerifyPendingPayload | null {
  try {
    const raw = sessionStorage.getItem(EMAIL_VERIFY_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
    if (!email) return null;
    let pendingBootstrap: PendingEmailVerificationBootstrap | undefined;
    const pb = o.pendingBootstrap;
    if (pb && typeof pb === "object" && "accountType" in pb && isAccountType((pb as { accountType?: unknown }).accountType)) {
      const x = pb as Record<string, unknown>;
      pendingBootstrap = {
        accountType: x.accountType as AccountType,
        ...(typeof x.brandName === "string" ? { brandName: x.brandName } : {}),
        ...(typeof x.fullName === "string" ? { fullName: x.fullName } : {}),
        ...(typeof x.role === "string" ? { role: x.role } : {}),
        ...(typeof x.turnstileToken === "string" ? { turnstileToken: x.turnstileToken } : {}),
      };
    }
    return {
      email,
      ...(pendingBootstrap ? { pendingBootstrap } : {}),
      ...(typeof o.inviteToken === "string" && o.inviteToken.trim() ? { inviteToken: o.inviteToken.trim() } : {}),
      ...(isAccountType(o.accountTypeAfterInvite) ? { accountTypeAfterInvite: o.accountTypeAfterInvite } : {}),
    };
  } catch {
    return null;
  }
}

export function clearEmailVerifyPending() {
  try {
    sessionStorage.removeItem(EMAIL_VERIFY_PENDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

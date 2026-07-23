/**
 * Normalize Resend API failures into stable Error strings for Convex Auth hooks
 * and for the web app toast mapper (`convexAuthEmailFlowToast`).
 */

function stringifyApiKeyInvalidHint(): Error {
  return new Error(
    "Email could not be sent: Resend API key is invalid. Set AUTH_RESEND_KEY in the Convex dashboard to a current key from https://resend.com/api-keys (the same active key as backend RESEND_API_KEY is OK). Trim any pasted spaces.",
  );
}

/** Resend sandbox: only inbox allowed is the owning Resend-account email unless a domain is verified. */
function stringifyTestModeRestricted(parsed: unknown, rawLow: string): Error | null {
  const msg =
    typeof parsed === "object" && parsed !== null && typeof (parsed as { message?: unknown }).message === "string"
      ? String((parsed as { message: string }).message).toLowerCase()
      : "";

  const combinedLow = `${rawLow} ${msg}`;
  if (
    combinedLow.includes("only send testing emails") ||
    combinedLow.includes("you can only send testing emails") ||
    (combinedLow.includes("testing emails") &&
      combinedLow.includes("your own email"))
  ) {
    return new Error(
      'Resend is in testing mode for this sender: only the email tied to your Resend account receives mail until you verify a domain. Sign up using that inbox, or verify a sending domain at resend.com/domains and set AUTH_EMAIL_FROM in Convex.',
    );
  }
  return null;
}

/** Unverified or wrong `from` relative to verified domains. */
function stringifyFromDomainIssues(rawLow: string, parsed: unknown): Error | null {
  const msg =
    typeof parsed === "object" && parsed !== null && typeof (parsed as { message?: unknown }).message === "string"
      ? String((parsed as { message: string }).message).toLowerCase()
      : "";

  const combinedLow = `${rawLow} ${msg}`;
  if (
    combinedLow.includes("domain") &&
    (combinedLow.includes("not verified") ||
      combinedLow.includes("please verify") ||
      combinedLow.includes("verify your domain"))
  ) {
    return new Error(
      "Sending domain for AUTH_EMAIL_FROM is not verified at Resend. Verify the domain under resend.com/domains or use sender TryVerse <onboarding@resend.dev> for testing.",
    );
  }
  return null;
}

export function raiseUnlessResendResponseOk(res: Response, rawDetail: string, parsedJson: unknown): void {
  if (res.ok) return;

  const detail = rawDetail.replace(/\s+/g, " ").trim();
  const low = detail.toLowerCase();

  if (/invalid.*api.*key|api\s*key\s*is\s*invalid|"api_key"/i.test(low)) {
    throw stringifyApiKeyInvalidHint();
  }

  const testErr = stringifyTestModeRestricted(parsedJson, low);
  if (testErr) throw testErr;

  const domainErr = stringifyFromDomainIssues(low, parsedJson);
  if (domainErr) throw domainErr;

  if (/\bquota\b|\blimit\b.*\b(send|daily|requests)\b/i.test(low)) {
    throw new Error(
      'Resend rate or quota rejected this send ("' + detail.slice(0, 180) + '"). Check billing/limits at resend.com.',
    );
  }

  throw new Error(`Resend error: ${detail}`);
}

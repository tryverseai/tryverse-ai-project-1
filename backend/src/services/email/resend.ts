import { Resend } from 'resend';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    logger.debug('Resend not configured — skipping email', { to: params.to, subject: params.subject });
    return false;
  }

  // New client per send avoids stale singleton if env was fixed without restart (tsx edge cases).
  const client = new Resend(apiKey);

  try {
    const { data, error } = await client.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      const msg = error.message || String(error);
      logger.error('Resend send failed', { to: params.to, subject: params.subject, error: msg });
      if (/invalid.*api.*key|api key is invalid/i.test(msg)) {
        logger.warn(
          'Resend: create a new key at https://resend.com/api-keys and set RESEND_API_KEY in backend/.env (no spaces). ' +
            'For Convex signup/password emails, set AUTH_RESEND_KEY in the Convex dashboard to the same key.'
        );
      }
      return false;
    }

    logger.info('Email sent', { to: params.to, subject: params.subject, id: data?.id });
    return true;
  } catch (err) {
    logger.error('Resend exception', { to: params.to, subject: params.subject, error: String(err) });
    return false;
  }
}

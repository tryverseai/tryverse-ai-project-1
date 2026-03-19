import { Resend } from 'resend';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const client = getResend();
  if (!client) {
    logger.debug('Resend not configured — skipping email', { to: params.to, subject: params.subject });
    return false;
  }

  try {
    const { data, error } = await client.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      logger.error('Resend send failed', { to: params.to, subject: params.subject, error: error.message });
      return false;
    }

    logger.info('Email sent', { to: params.to, subject: params.subject, id: data?.id });
    return true;
  } catch (err) {
    logger.error('Resend exception', { to: params.to, subject: params.subject, error: String(err) });
    return false;
  }
}

import sgMail from '@sendgrid/mail';
import { config } from '../config';
import { logger } from '../services/logger';

// Initialize SendGrid
if (config.sendgrid.apiKey) {
  sgMail.setApiKey(config.sendgrid.apiKey);
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  if (!config.sendgrid.apiKey) {
    logger.warn('SendGrid API key not configured - skipping email');
    logger.debug(`Would have sent email to ${to}: ${subject}`);
    return;
  }

  const msg = {
    to,
    from: {
      email: config.sendgrid.fromEmail,
      name: 'Campsite Alerts',
    },
    subject,
    text,
    html: html || text,
  };

  try {
    await sgMail.send(msg);
    logger.info(`Email sent successfully to ${to}`);
  } catch (error: any) {
    logger.error('SendGrid error:', error.response?.body || error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send a batch of emails
 */
export async function sendBatchEmails(
  messages: Array<{
    to: string;
    subject: string;
    text: string;
    html?: string;
  }>
): Promise<void> {
  if (!config.sendgrid.apiKey) {
    logger.warn('SendGrid API key not configured - skipping batch emails');
    return;
  }

  const formattedMessages = messages.map((msg) => ({
    to: msg.to,
    from: {
      email: config.sendgrid.fromEmail,
      name: 'Campsite Alerts',
    },
    subject: msg.subject,
    text: msg.text,
    html: msg.html || msg.text,
  }));

  try {
    await sgMail.send(formattedMessages);
    logger.info(`Batch of ${messages.length} emails sent successfully`);
  } catch (error: any) {
    logger.error('SendGrid batch error:', error.response?.body || error.message);
    throw new Error(`Failed to send batch emails: ${error.message}`);
  }
}

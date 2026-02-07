import twilio from 'twilio';
import { config } from '../config';
import { logger } from '../services/logger';

// Initialize Twilio client
let twilioClient: twilio.Twilio | null = null;

if (config.twilio.accountSid && config.twilio.authToken) {
  twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
}

/**
 * Send an SMS using Twilio
 */
export async function sendSms(to: string, message: string): Promise<void> {
  if (!twilioClient) {
    logger.warn('Twilio not configured - skipping SMS');
    logger.debug(`Would have sent SMS to ${to}: ${message}`);
    return;
  }

  if (!config.twilio.phoneNumber) {
    logger.warn('Twilio phone number not configured - skipping SMS');
    return;
  }

  // Ensure phone number is in E.164 format
  const formattedTo = formatPhoneNumber(to);

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: config.twilio.phoneNumber,
      to: formattedTo,
    });

    logger.info(`SMS sent successfully to ${formattedTo} (SID: ${result.sid})`);
  } catch (error: any) {
    logger.error('Twilio error:', error.message);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

/**
 * Send a batch of SMS messages
 */
export async function sendBatchSms(
  messages: Array<{ to: string; message: string }>
): Promise<void> {
  if (!twilioClient) {
    logger.warn('Twilio not configured - skipping batch SMS');
    return;
  }

  const results = await Promise.allSettled(
    messages.map((msg) => sendSms(msg.to, msg.message))
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info(`Batch SMS: ${succeeded} succeeded, ${failed} failed`);
}

/**
 * Format phone number to E.164 format
 * Assumes US numbers if no country code provided
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it already has country code (11+ digits starting with 1 for US)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it's a 10-digit US number, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it already looks like an international number
  if (digits.length > 10) {
    return `+${digits}`;
  }

  // Return as-is and let Twilio handle the error
  return phone;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

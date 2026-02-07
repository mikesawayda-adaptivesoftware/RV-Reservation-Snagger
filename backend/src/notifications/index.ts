import { UserProfile, CampsiteAlert, AlertMatch } from '../../../shared/types';
import { logger } from '../services/logger';
import { sendEmail } from './email';
import { sendSms } from './sms';

/**
 * Send notifications for new matches based on user preferences
 */
export async function sendNotifications(
  user: Partial<UserProfile>,
  alert: CampsiteAlert,
  matches: AlertMatch[]
): Promise<void> {
  const methods = user.notificationPreferences?.methods || ['email'];

  // Check quiet hours
  if (user.notificationPreferences?.quietHoursEnabled) {
    const now = new Date();
    const timezone = user.notificationPreferences.timezone || 'America/Los_Angeles';
    
    if (isQuietHours(now, user.notificationPreferences.quietHoursStart, user.notificationPreferences.quietHoursEnd, timezone)) {
      logger.info(`Skipping notifications for user ${user.id} - quiet hours active`);
      // TODO: Queue for later delivery
      return;
    }
  }

  const notificationPromises: Promise<void>[] = [];

  if (methods.includes('email') && user.email) {
    notificationPromises.push(
      sendEmailNotification(user.email, user.displayName || 'Camper', alert, matches)
    );
  }

  if (methods.includes('sms') && user.phoneNumber) {
    notificationPromises.push(
      sendSmsNotification(user.phoneNumber, alert, matches)
    );
  }

  await Promise.allSettled(notificationPromises);
}

async function sendEmailNotification(
  email: string,
  name: string,
  alert: CampsiteAlert,
  matches: AlertMatch[]
): Promise<void> {
  const subject = `🏕️ Campsite Available: ${alert.parkName}`;
  
  const matchList = matches
    .map((m) => {
      const dates = m.availableDates
        .map((d) => `${formatDate(d.start)} - ${formatDate(d.end)}`)
        .join(', ');
      return `• ${m.siteName} (${m.siteType}): ${dates}`;
    })
    .join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2E7D32; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .match { background: white; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #2E7D32; }
    .btn { display: inline-block; background: #2E7D32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏕️ Campsite Alert</h1>
      <p>Great news! We found availability at ${alert.parkName}</p>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>We found <strong>${matches.length}</strong> available campsite${matches.length > 1 ? 's' : ''} matching your alert:</p>
      
      ${matches.map((m) => `
        <div class="match">
          <h3>${m.siteName}</h3>
          <p><strong>Campground:</strong> ${m.campgroundName}</p>
          <p><strong>Site Type:</strong> ${m.siteType}</p>
          <p><strong>Available Dates:</strong></p>
          <ul>
            ${m.availableDates.map((d) => `<li>${formatDate(d.start)} to ${formatDate(d.end)}</li>`).join('')}
          </ul>
          <a href="${m.reservationUrl}" class="btn">Book Now</a>
        </div>
      `).join('')}
      
      <p style="margin-top: 20px;">Act fast - popular campsites get booked quickly!</p>
    </div>
    <div class="footer">
      <p>You're receiving this because you set up a campsite alert for ${alert.parkName}.</p>
      <p>Manage your alerts at [Your Website]</p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Campsite Alert: ${alert.parkName}

Hi ${name},

We found ${matches.length} available campsite(s) matching your alert:

${matchList}

Book now before they're gone!

${matches[0].reservationUrl}
`;

  await sendEmail(email, subject, text, html);
  logger.info(`Email notification sent to ${email} for alert ${alert.id}`);
}

async function sendSmsNotification(
  phoneNumber: string,
  alert: CampsiteAlert,
  matches: AlertMatch[]
): Promise<void> {
  const matchCount = matches.length;
  const firstMatch = matches[0];
  
  const message = `🏕️ Campsite Alert: ${matchCount} site${matchCount > 1 ? 's' : ''} available at ${alert.parkName}! First available: ${firstMatch.siteName}. Book now: ${firstMatch.reservationUrl}`;

  await sendSms(phoneNumber, message);
  logger.info(`SMS notification sent to ${phoneNumber} for alert ${alert.id}`);
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isQuietHours(
  now: Date,
  startTime: string | null,
  endTime: string | null,
  timezone: string
): boolean {
  if (!startTime || !endTime) return false;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });

    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;

    const [endHour, endMinute] = endTime.split(':').map(Number);
    const endMinutes = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (error) {
    logger.error('Error checking quiet hours:', error);
    return false;
  }
}

export { sendEmail } from './email';
export { sendSms } from './sms';

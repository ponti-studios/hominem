import 'dotenv/config';
import { env } from '../src/env';
import { createTelegramClient } from '../src/messaging/telegram';

if (
  !env.TELEGRAM_BOT_TOKEN ||
  !env.TELEGRAM_WEBHOOK_SECRET ||
  !env.TELEGRAM_BOT_USERNAME ||
  !env.TELEGRAM_OWNER_USER_ID
) {
  throw new Error('Set all TELEGRAM_* variables before configuring the webhook.');
}

const telegram = createTelegramClient({ botToken: env.TELEGRAM_BOT_TOKEN });
await telegram.setWebhook(
  `${env.API_URL.replace(/\/$/, '')}/api/telegram/webhook`,
  env.TELEGRAM_WEBHOOK_SECRET,
);
console.info('Telegram webhook configured.');

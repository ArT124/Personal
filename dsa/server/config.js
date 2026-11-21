import 'dotenv/config';
import path from 'node:path';

const num = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

export function loadConfig(env = process.env) {
  const port = num(env.PORT, 3000);
  return {
    port,
    appUrl: (env.APP_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, ''),
    mongoUri: env.MONGODB_URI || '',
    mongoDb: env.MONGODB_DB || 'daily_dsa',
    dataDir: path.resolve(env.DATA_DIR || './data'),
    vapidPublicKey: env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: env.VAPID_PRIVATE_KEY || '',
    vapidSubject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    cronSecret: env.CRON_SECRET || '',
    schedulerMinutes: num(env.INTERNAL_SCHEDULER_MINUTES, 5),
    isProduction: env.NODE_ENV === 'production',
    trustProxy: env.TRUST_PROXY !== 'false',
  };
}

import { loadConfig } from './config.js';
import { createStore } from './store/index.js';
import { setupPush } from './push.js';
import { createScheduler } from './scheduler.js';
import { createApp } from './app.js';

const config = loadConfig();
const store = await createStore(config);
const push = await setupPush(config, store);
const scheduler = createScheduler({ store, push, appUrl: config.appUrl });
const app = createApp({ store, push, scheduler, config });

const server = app.listen(config.port, () => {
  console.log(`Daily DSA running at http://localhost:${config.port} (store: ${store.kind})`);
  if (!config.cronSecret) console.warn('[cron] CRON_SECRET is not set: the /api/cron/reminders endpoint is disabled.');
});

// Check reminders inside the server too. On free hosts the server may sleep,
// so an external cron (cron-job.org / GitHub Actions) also calls /api/cron/reminders.
let timer = null;
if (config.schedulerMinutes > 0) {
  const run = () => scheduler.tick().catch((err) => console.error('[scheduler]', err));
  timer = setInterval(run, config.schedulerMinutes * 60 * 1000);
  setTimeout(run, 10_000);
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  clearInterval(timer);
  server.close();
  await store.close().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Sends the daily reminder and the optional evening nudge.
// Safe to call as often as you like: each user gets at most one of each per day.

import { ensureTodayPlan, normalizeUser, reminderDue, reminderPayload, todayDone, localDate } from './planner.js';
import { withLock } from './lock.js';

export function createScheduler({ store, push, appUrl }) {
  let running = null;

  async function processUser(id, now) {
    return withLock(id, async () => {
      const raw = await store.getUser(id);
      if (!raw) return { sent: 0, removed: 0 };
      const user = normalizeUser(raw);
      const kind = reminderDue(user, now);
      if (!kind) return { sent: 0, removed: 0 };

      const today = localDate(user.settings.timezone, now);
      const { slugs } = ensureTodayPlan(user, now);
      user.lastNotifiedDate = today;
      if (kind === 'nudge') user.lastNudgeDate = today;

      let sent = 0;
      let removed = 0;
      // No need to nag if today's problems are already done.
      if (!todayDone(user, slugs)) {
        const payload = reminderPayload(user, kind, slugs, appUrl, now);
        const keep = [];
        for (const sub of user.subscriptions) {
          const result = await push.send(sub, payload);
          if (result === 'gone') removed++;
          else keep.push(sub);
          if (result === 'ok') sent++;
        }
        user.subscriptions = keep;
      }
      await store.saveUser(user);
      return { sent, removed };
    });
  }

  async function tick(now = new Date()) {
    if (running) return running;
    running = (async () => {
      const summary = { checked: 0, sent: 0, removedSubscriptions: 0, errors: 0, at: now.toISOString() };
      for await (const user of store.usersWithSubscriptions()) {
        summary.checked++;
        try {
          const r = await processUser(user.id, now);
          summary.sent += r.sent;
          summary.removedSubscriptions += r.removed;
        } catch (err) {
          summary.errors++;
          console.error('[scheduler] user failed:', err.message);
        }
      }
      if (summary.sent || summary.errors) console.log('[scheduler]', JSON.stringify(summary));
      return summary;
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return { tick };
}

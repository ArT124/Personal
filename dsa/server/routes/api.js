import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { TOPICS, SEQUENCE, BY_SLUG, PHASES } from '../data/curriculum.js';

const PHASE_NAME = new Map(PHASES.map((ph) => [ph.id, ph.name]));
import {
  newUser,
  normalizeUser,
  ensureTodayPlan,
  addBonusProblem,
  recommendations,
  markProblem,
  stats,
  streaks,
  publicProblem,
  reminderPayload,
  isValidTimezone,
  localDate,
  bumpActivity,
  DEFAULT_SETTINGS,
} from '../planner.js';
import { revisionSheet } from '../revision.js';
import { createLeetCodeSource, pickPracticeProblem, recordPractice, undoPractice, practiceSummary } from '../practice.js';
import { isValidSubscription } from '../push.js';
import { withLock } from '../lock.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_SUBSCRIPTIONS = 10;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Checks and cleans a partial settings object. Throws HttpError(400) on bad input. */
export function validateSettings(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Settings must be an object');
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'name':
        if (typeof value !== 'string' || value.length > 40) throw new HttpError(400, 'Name must be at most 40 characters');
        out.name = value.trim();
        break;
      case 'timezone':
        if (!isValidTimezone(value)) throw new HttpError(400, 'Unknown timezone');
        out.timezone = value;
        break;
      case 'reminderTime':
      case 'nudgeTime':
        if (typeof value !== 'string' || !TIME_RE.test(value)) throw new HttpError(400, `${key} must look like 09:30`);
        out[key] = value;
        break;
      case 'dailyGoal': {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 5) throw new HttpError(400, 'Daily goal must be 1 to 5');
        out.dailyGoal = n;
        break;
      }
      case 'startTopic':
        if (!TOPICS.some((t) => t.id === value)) throw new HttpError(400, 'Unknown topic');
        out.startTopic = value;
        break;
      case 'notifications':
      case 'nudge':
      case 'randomPractice':
        if (typeof value !== 'boolean') throw new HttpError(400, `${key} must be true or false`);
        out[key] = value;
        break;
      default:
        throw new HttpError(400, `Unknown setting: ${key}`);
    }
  }
  return out;
}

export function createApiRouter({ store, push, scheduler, config, practiceSource = createLeetCodeSource() }) {
  const router = express.Router();
  router.use(express.json({ limit: '200kb' }));

  const createLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many accounts created from this network. Try again later.' },
  });
  const practiceLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'That is a lot of random problems! Wait a few minutes and try again.' },
  });

  // ---- helpers ----
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  async function authenticate(req) {
    const header = req.get('authorization') || '';
    const match = /^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,100})$/.exec(header);
    if (!match) return null;
    const [, id, token] = match;
    const raw = await store.getUser(id);
    if (!raw) return null;
    const a = Buffer.from(sha256(token), 'hex');
    const b = Buffer.from(raw.tokenHash || '', 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return id;
  }

  const requireUser = wrap(async (req, res, next) => {
    const id = await authenticate(req);
    if (!id) throw new HttpError(401, 'Not signed in. Reload the page to start fresh, or link this device with your sync code.');
    req.userId = id;
    next();
  });

  /** Loads the user under a lock, runs fn, and saves if fn returns save: true. */
  function withUser(req, fn) {
    return withLock(req.userId, async () => {
      const raw = await store.getUser(req.userId);
      if (!raw) throw new HttpError(401, 'Account not found');
      const user = normalizeUser(raw);
      const result = await fn(user);
      if (result?.save !== false) await store.saveUser(user);
      return result?.body ?? result;
    });
  }

  function todayView(user, now = new Date()) {
    const { date, slugs } = ensureTodayPlan(user, now);
    const rec = recommendations(user, slugs, now);
    const problems = slugs.map((s) => publicProblem(BY_SLUG.get(s), user));
    const s = stats(user, now);
    return {
      date,
      problems,
      allDone: problems.length > 0 && problems.every((p) => p.status !== 'todo'),
      roadmapComplete: problems.length === 0,
      recommendations: {
        revision: rec.revision.map((r) => ({ ...publicProblem(r.problem, user), reason: r.reason })),
        upNext: rec.upNext.map((p) => publicProblem(p, user)),
        stretch: publicProblem(rec.stretch, user),
      },
      streak: s.streak,
      progress: { solved: s.solved, total: s.total, percent: s.percent, estimatedDaysLeft: s.estimatedDaysLeft },
      practice: practiceSummary(user),
      settings: user.settings,
    };
  }

  function meView(user) {
    return {
      id: user.id,
      createdAt: user.createdAt,
      settings: user.settings,
      devicesWithNotifications: user.subscriptions.length,
      streak: streaks(user),
    };
  }

  // ---- public ----

  router.get('/config', (req, res) => {
    res.json({ vapidPublicKey: push.publicKey, appUrl: config.appUrl, totalProblems: SEQUENCE.length });
  });

  router.get(
    '/curriculum',
    wrap(async (req, res) => {
      const id = await authenticate(req);
      const user = id ? normalizeUser(await store.getUser(id)) : null;
      res.json({
        topics: TOPICS.map((t, i) => ({
          id: t.id,
          name: t.name,
          phase: PHASE_NAME.get(t.phase) || '',
          summary: t.summary,
          index: i,
          problems: SEQUENCE.filter((p) => p.topicId === t.id).map((p) => publicProblem(p, user)),
        })),
      });
    }),
  );

  router.post(
    '/users',
    createLimiter,
    wrap(async (req, res) => {
      const settings = validateSettings(req.body?.settings || {});
      const id = crypto.randomUUID();
      const token = newToken();
      const user = newUser(id, sha256(token), settings);
      await store.saveUser(user);
      res.status(201).json({ syncCode: `${id}.${token}`, user: meView(user) });
    }),
  );

  // ---- signed in ----

  router.get('/me', requireUser, wrap(async (req, res) => res.json(await withUser(req, (u) => ({ save: false, body: meView(u) })))));

  router.patch(
    '/me/settings',
    requireUser,
    wrap(async (req, res) => {
      const changes = validateSettings(req.body);
      const body = await withUser(req, (user) => {
        const before = user.settings;
        user.settings = { ...user.settings, ...changes };
        // A new daily goal or starting topic should change today's plan straight away
        // (keeping any problem already finished today).
        const goalChanged = changes.dailyGoal !== undefined && changes.dailyGoal !== before.dailyGoal;
        const topicChanged = changes.startTopic !== undefined && changes.startTopic !== before.startTopic;
        if (goalChanged || topicChanged) {
          const date = localDate(user.settings.timezone);
          const current = user.plans[date] || [];
          const finished = current.filter((s) => user.progress[s]);
          const unfinished = topicChanged ? [] : current.filter((s) => !user.progress[s]);
          const plan = [...finished, ...unfinished].slice(0, Math.max(user.settings.dailyGoal, finished.length));
          if (plan.length) user.plans[date] = plan;
          else delete user.plans[date];
        }
        // Moving the reminder later today means it can still fire today.
        if (changes.reminderTime !== undefined && changes.reminderTime !== before.reminderTime) user.lastNotifiedDate = null;
        if (changes.nudgeTime !== undefined && changes.nudgeTime !== before.nudgeTime) user.lastNudgeDate = null;
        return meView(user);
      });
      res.json(body);
    }),
  );

  router.post(
    '/me/sync-code/rotate',
    requireUser,
    wrap(async (req, res) => {
      const token = newToken();
      await withUser(req, (user) => {
        user.tokenHash = sha256(token);
        return {};
      });
      res.json({ syncCode: `${req.userId}.${token}` });
    }),
  );

  router.get(
    '/me/export',
    requireUser,
    wrap(async (req, res) => {
      const body = await withUser(req, (u) => ({
        save: false,
        body: {
          app: 'daily-dsa',
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: u.settings,
          progress: u.progress,
          activity: u.activity,
          practiceHistory: u.practice.history,
        },
      }));
      res.set('Content-Disposition', 'attachment; filename="daily-dsa-progress.json"');
      res.json(body);
    }),
  );

  router.post(
    '/me/import',
    requireUser,
    wrap(async (req, res) => {
      const data = req.body;
      if (data?.app !== 'daily-dsa' || typeof data.progress !== 'object') throw new HttpError(400, 'This is not a Daily DSA export file');
      const progress = {};
      for (const [slug, entry] of Object.entries(data.progress || {})) {
        if (!BY_SLUG.has(slug) || !['solved', 'revise', 'skipped'].includes(entry?.status)) continue;
        progress[slug] = {
          status: entry.status,
          updatedAt: String(entry.updatedAt || new Date().toISOString()).slice(0, 40),
          ...(entry.solvedAt ? { solvedAt: String(entry.solvedAt).slice(0, 40) } : {}),
          ...(entry.lastReviewedAt ? { lastReviewedAt: String(entry.lastReviewedAt).slice(0, 40) } : {}),
          reviews: Number.isInteger(entry.reviews) ? Math.min(Math.max(entry.reviews, 0), 100) : 0,
        };
      }
      const activity = {};
      for (const [date, count] of Object.entries(data.activity || {})) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger(count) && count > 0) activity[date] = Math.min(count, 1000);
      }
      let settings = {};
      try {
        const { name, timezone, reminderTime, nudge, nudgeTime, dailyGoal, startTopic, notifications, randomPractice } = data.settings || {};
        settings = validateSettings(
          Object.fromEntries(
            Object.entries({ name, timezone, reminderTime, nudge, nudgeTime, dailyGoal, startTopic, notifications, randomPractice }).filter(
              ([, v]) => v !== undefined,
            ),
          ),
        );
      } catch {
        settings = {};
      }
      const practiceHistory = (Array.isArray(data.practiceHistory) ? data.practiceHistory : [])
        .filter((h) => h && /^[a-z0-9-]{1,120}$/.test(h.slug) && ['solved', 'skipped'].includes(h.result))
        .slice(-300)
        .map((h) => ({
          num: Number.isInteger(h.num) ? h.num : 0,
          title: String(h.title || h.slug).slice(0, 200),
          slug: h.slug,
          difficulty: ['Easy', 'Medium', 'Hard'].includes(h.difficulty) ? h.difficulty : 'Medium',
          url: `https://leetcode.com/problems/${h.slug}/`,
          topicId: String(h.topicId || '').slice(0, 40),
          topicName: String(h.topicName || '').slice(0, 80),
          tags: [],
          source: h.source === 'roadmap' ? 'roadmap' : 'leetcode',
          result: h.result,
          at: String(h.at || new Date().toISOString()).slice(0, 40),
        }));
      const body = await withUser(req, (user) => {
        user.progress = progress;
        user.activity = activity;
        user.practice = { current: null, history: practiceHistory };
        user.settings = { ...user.settings, ...settings };
        user.plans = {};
        return { imported: Object.keys(progress).length };
      });
      res.json(body);
    }),
  );

  router.post(
    '/me/reset',
    requireUser,
    wrap(async (req, res) => {
      await withUser(req, (user) => {
        user.progress = {};
        user.activity = {};
        user.plans = {};
        user.practice = { current: null, history: [] };
        return {};
      });
      res.json({ ok: true });
    }),
  );

  router.delete(
    '/me',
    requireUser,
    wrap(async (req, res) => {
      await withLock(req.userId, () => store.deleteUser(req.userId));
      res.json({ ok: true });
    }),
  );

  router.get('/today', requireUser, wrap(async (req, res) => res.json(await withUser(req, (u) => todayView(u)))));

  router.post(
    '/today/bonus',
    requireUser,
    wrap(async (req, res) => {
      const body = await withUser(req, (user) => {
        const added = addBonusProblem(user);
        if (!added) throw new HttpError(409, 'No more problems left in the roadmap');
        return todayView(user);
      });
      res.json(body);
    }),
  );

  router.post(
    '/problems/:slug/status',
    requireUser,
    wrap(async (req, res) => {
      const { slug } = req.params;
      const status = req.body?.status;
      if (!BY_SLUG.has(slug)) throw new HttpError(404, 'Unknown problem');
      if (!['solved', 'revise', 'skipped', 'todo', 'reviewed'].includes(status)) throw new HttpError(400, 'Invalid status');
      const body = await withUser(req, (user) => {
        try {
          markProblem(user, slug, status);
        } catch (err) {
          throw new HttpError(400, err.message);
        }
        return todayView(user);
      });
      res.json(body);
    }),
  );

  // ---- optional random practice ----

  router.get('/practice', requireUser, wrap(async (req, res) => res.json(await withUser(req, (u) => ({ save: false, body: practiceSummary(u) })))));

  router.post(
    '/practice/next',
    requireUser,
    practiceLimiter,
    wrap(async (req, res) => {
      const snapshot = normalizeUser(await store.getUser(req.userId));
      if (!snapshot.settings.randomPractice) throw new HttpError(409, 'Random practice is off. Turn it on in Settings first.');
      // Ask LeetCode outside the lock (it can take a few seconds), then save under the lock.
      let problem;
      try {
        problem = await pickPracticeProblem(snapshot, practiceSource);
      } catch {
        throw new HttpError(503, 'Could not reach LeetCode right now. Try again in a minute.');
      }
      if (!problem) throw new HttpError(404, 'No new practice problems for your topics yet. Solve a few more roadmap problems first.');
      const body = await withUser(req, (user) => {
        if (user.practice.current) recordPractice(user, 'skipped');
        user.practice.current = problem;
        return practiceSummary(user);
      });
      res.json(body);
    }),
  );

  router.post(
    '/practice/result',
    requireUser,
    wrap(async (req, res) => {
      const result = req.body?.result;
      if (!['solved', 'skipped'].includes(result)) throw new HttpError(400, 'Result must be solved or skipped');
      const body = await withUser(req, (user) => {
        const entry = recordPractice(user, result);
        if (!entry) throw new HttpError(409, 'There is no practice problem to mark');
        if (result === 'solved') bumpActivity(user, localDate(user.settings.timezone), 1);
        return practiceSummary(user);
      });
      res.json(body);
    }),
  );

  router.post(
    '/practice/undo',
    requireUser,
    wrap(async (req, res) => {
      const body = await withUser(req, (user) => {
        const last = undoPractice(user);
        if (!last) throw new HttpError(409, 'Nothing to undo');
        if (last.result === 'solved') bumpActivity(user, localDate(user.settings.timezone, new Date(last.at)), -1);
        return practiceSummary(user);
      });
      res.json(body);
    }),
  );

  router.post(
    '/practice/clear',
    requireUser,
    wrap(async (req, res) => {
      const body = await withUser(req, (user) => {
        user.practice.current = null;
        return practiceSummary(user);
      });
      res.json(body);
    }),
  );

  router.get(
    '/revision-sheet',
    requireUser,
    wrap(async (req, res) => res.json(await withUser(req, (u) => ({ save: false, body: revisionSheet(u) })))),
  );

  router.get('/stats', requireUser, wrap(async (req, res) => res.json(await withUser(req, (u) => ({ save: false, body: stats(u) })))));

  // ---- push notifications ----

  router.post(
    '/push/subscribe',
    requireUser,
    wrap(async (req, res) => {
      const sub = req.body?.subscription;
      if (!isValidSubscription(sub)) throw new HttpError(400, 'Invalid push subscription');
      const label = String(req.body?.device || req.get('user-agent') || 'Unknown device').slice(0, 120);
      const body = await withUser(req, (user) => {
        const others = user.subscriptions.filter((s) => s.endpoint !== sub.endpoint);
        user.subscriptions = [
          ...others.slice(-(MAX_SUBSCRIPTIONS - 1)),
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, device: label, createdAt: new Date().toISOString() },
        ];
        user.settings.notifications = true;
        return meView(user);
      });
      res.json(body);
    }),
  );

  router.post(
    '/push/unsubscribe',
    requireUser,
    wrap(async (req, res) => {
      const endpoint = req.body?.endpoint;
      const body = await withUser(req, (user) => {
        user.subscriptions = user.subscriptions.filter((s) => s.endpoint !== endpoint);
        return meView(user);
      });
      res.json(body);
    }),
  );

  router.post(
    '/push/test',
    requireUser,
    wrap(async (req, res) => {
      const body = await withUser(req, async (user) => {
        if (!user.subscriptions.length) throw new HttpError(400, 'No device has notifications turned on yet');
        const { slugs } = ensureTodayPlan(user);
        const payload = { ...reminderPayload(user, 'morning', slugs, config.appUrl), title: 'Test: notifications work!' };
        let sent = 0;
        const keep = [];
        for (const sub of user.subscriptions) {
          const r = await push.send(sub, payload);
          if (r !== 'gone') keep.push(sub);
          if (r === 'ok') sent++;
        }
        user.subscriptions = keep;
        return { sent, devices: keep.length };
      });
      res.json(body);
    }),
  );

  // ---- cron trigger (called by cron-job.org / GitHub Actions) ----

  const cronHandler = wrap(async (req, res) => {
    const given = req.get('x-cron-secret') || req.query.key || '';
    const a = Buffer.from(sha256(String(given)));
    const b = Buffer.from(sha256(config.cronSecret || crypto.randomBytes(16).toString('hex')));
    if (!config.cronSecret || !crypto.timingSafeEqual(a, b)) throw new HttpError(403, 'Bad cron secret');
    res.json(await scheduler.tick());
  });
  router.post('/cron/reminders', cronHandler);
  router.get('/cron/reminders', cronHandler);

  router.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    const status = err.status || 500;
    if (status >= 500) console.error('[api]', err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : err.message });
  });

  return router;
}

export { DEFAULT_SETTINGS };

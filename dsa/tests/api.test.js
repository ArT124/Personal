// End-to-end API test: starts the real app on a random port with a temp JSON store
// and a fake push sender.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFileStore } from '../server/store/fileStore.js';
import { createScheduler } from '../server/scheduler.js';
import { createApp } from '../server/app.js';
import { SEQUENCE } from '../server/data/curriculum.js';

let server;
let base;
let dir;
let store;
let scheduler;
const sent = [];

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-dsa-'));
  store = await createFileStore(dir);
  const push = {
    publicKey: 'test-public-key',
    async send(sub, payload) {
      if (sub.endpoint.includes('gone')) return 'gone';
      sent.push({ endpoint: sub.endpoint, payload });
      return 'ok';
    },
  };
  const config = { appUrl: 'https://dsa.example.com', cronSecret: 'secret123', isProduction: false, trustProxy: false };
  scheduler = createScheduler({ store, push, appUrl: config.appUrl });
  // Fake LeetCode list for the optional random practice feature (no network in tests).
  const practiceSource = {
    async list({ skip }) {
      const questions = [9001, 9002, 9003].map((n) => ({
        num: n, title: `Practice ${n}`, slug: `practice-${n}`, difficulty: 'Easy', paidOnly: false, tags: [{ slug: 'math', name: 'Math' }],
      }));
      return { total: questions.length, questions: questions.slice(skip) };
    },
  };
  const app = createApp({ store, push, scheduler, config, practiceSource });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await store.close();
  await fs.rm(dir, { recursive: true, force: true });
});

async function call(pathname, { method = 'GET', body, code, headers = {} } = {}) {
  const res = await fetch(base + pathname, {
    method,
    redirect: 'manual',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(code ? { Authorization: `Bearer ${code}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text, headers: res.headers };
}

const newAccount = async (settings = { timezone: 'UTC' }) => (await call('/api/users', { method: 'POST', body: { settings } })).json.syncCode;

test('serves the site, health check, security headers and 404 page', async () => {
  const home = await call('/');
  assert.equal(home.status, 200);
  assert.match(home.text, /Daily DSA/);
  assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal((await call('/healthz')).json.ok, true);
  assert.equal((await call('/manifest.webmanifest')).status, 200);
  assert.equal((await call('/sw.js')).status, 200);
  assert.equal((await call('/nope')).status, 404);
  assert.equal((await call('/api/nope')).status, 404);
});

test('public config and curriculum', async () => {
  const cfg = await call('/api/config');
  assert.equal(cfg.json.vapidPublicKey, 'test-public-key');
  assert.equal(cfg.json.totalProblems, SEQUENCE.length);
  const cur = await call('/api/curriculum');
  assert.equal(cur.json.topics.flatMap((t) => t.problems).length, SEQUENCE.length);
  assert.ok(cur.json.topics.every((t) => t.phase.startsWith('Phase ')));
});

test('auth is required and checked', async () => {
  assert.equal((await call('/api/today')).status, 401);
  const code = await newAccount();
  const [id] = code.split('.');
  assert.equal((await call('/api/today', { code: `${id}.${'x'.repeat(43)}` })).status, 401);
  assert.equal((await call('/api/today', { code })).status, 200);
});

test('full daily flow: today, mark solved, bonus, stats, undo', async () => {
  const code = await newAccount();
  let today = (await call('/api/today', { code })).json;
  assert.equal(today.problems.length, 1);
  assert.equal(today.problems[0].slug, SEQUENCE[0].slug);
  assert.equal(today.problems[0].url, `https://leetcode.com/problems/${SEQUENCE[0].slug}/`);
  assert.equal(today.allDone, false);

  today = (await call(`/api/problems/${SEQUENCE[0].slug}/status`, { method: 'POST', code, body: { status: 'solved' } })).json;
  assert.equal(today.allDone, true);
  assert.equal(today.streak.current, 1);
  assert.equal(today.progress.solved, 1);

  today = (await call('/api/today/bonus', { method: 'POST', code })).json;
  assert.equal(today.problems.length, 2);
  assert.equal(today.problems[1].slug, SEQUENCE[1].slug);

  const stats = (await call('/api/stats', { code })).json;
  assert.equal(stats.solved, 1);

  today = (await call(`/api/problems/${SEQUENCE[0].slug}/status`, { method: 'POST', code, body: { status: 'todo' } })).json;
  assert.equal(today.streak.current, 0);

  assert.equal((await call('/api/problems/not-a-problem/status', { method: 'POST', code, body: { status: 'solved' } })).status, 404);
  assert.equal((await call(`/api/problems/${SEQUENCE[0].slug}/status`, { method: 'POST', code, body: { status: 'nope' } })).status, 400);
});

test('settings validation and plan updates', async () => {
  const code = await newAccount();
  assert.equal((await call('/api/me/settings', { method: 'PATCH', code, body: { reminderTime: '25:00' } })).status, 400);
  assert.equal((await call('/api/me/settings', { method: 'PATCH', code, body: { timezone: 'Mars/Base' } })).status, 400);
  assert.equal((await call('/api/me/settings', { method: 'PATCH', code, body: { hacker: true } })).status, 400);
  const ok = await call('/api/me/settings', { method: 'PATCH', code, body: { dailyGoal: 3, reminderTime: '07:30', timezone: 'Asia/Kolkata' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.settings.reminderTime, '07:30');
  assert.equal((await call('/api/today', { code })).json.problems.length, 3);
  await call('/api/me/settings', { method: 'PATCH', code, body: { startTopic: 'graphs' } });
  const today = (await call('/api/today', { code })).json;
  assert.equal(today.problems[0].topicId, 'graphs');
});

test('sync code: a second device sees the same data; rotating signs it out', async () => {
  const code = await newAccount();
  await call(`/api/problems/${SEQUENCE[0].slug}/status`, { method: 'POST', code, body: { status: 'solved' } });
  // "Other device" uses the same code
  assert.equal((await call('/api/stats', { code })).json.solved, 1);
  const rotated = (await call('/api/me/sync-code/rotate', { method: 'POST', code })).json.syncCode;
  assert.equal((await call('/api/me', { code })).status, 401);
  assert.equal((await call('/api/me', { code: rotated })).status, 200);
});

test('export and import progress', async () => {
  const code = await newAccount();
  await call(`/api/problems/${SEQUENCE[0].slug}/status`, { method: 'POST', code, body: { status: 'solved' } });
  const exported = (await call('/api/me/export', { code })).json;
  assert.equal(exported.app, 'daily-dsa');

  const other = await newAccount();
  const imported = await call('/api/me/import', { method: 'POST', code: other, body: exported });
  assert.equal(imported.json.imported, 1);
  assert.equal((await call('/api/stats', { code: other })).json.solved, 1);
  assert.equal((await call('/api/me/import', { method: 'POST', code: other, body: { foo: 1 } })).status, 400);
});

test('push subscribe, test notification and the cron reminder', async () => {
  const code = await newAccount({ timezone: 'UTC', reminderTime: '00:00', nudge: false });
  const subscription = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } };
  assert.equal((await call('/api/push/subscribe', { method: 'POST', code, body: { subscription: { endpoint: 'http://bad' } } })).status, 400);
  const me = (await call('/api/push/subscribe', { method: 'POST', code, body: { subscription } })).json;
  assert.equal(me.devicesWithNotifications, 1);
  // subscribing again does not duplicate
  assert.equal((await call('/api/push/subscribe', { method: 'POST', code, body: { subscription } })).json.devicesWithNotifications, 1);

  sent.length = 0;
  const t = (await call('/api/push/test', { method: 'POST', code })).json;
  assert.equal(t.sent, 1);
  assert.match(sent[0].payload.url, /^https:\/\/leetcode\.com\/problems\//);

  // Cron: wrong secret rejected
  assert.equal((await call('/api/cron/reminders', { method: 'POST', headers: { 'x-cron-secret': 'wrong' } })).status, 403);
  sent.length = 0;
  const first = (await call('/api/cron/reminders', { method: 'POST', headers: { 'x-cron-secret': 'secret123' } })).json;
  assert.ok(first.sent >= 1);
  assert.ok(sent.some((s) => s.endpoint === subscription.endpoint));
  // Second run on the same day sends nothing to this user
  sent.length = 0;
  await call('/api/cron/reminders?key=secret123');
  assert.ok(!sent.some((s) => s.endpoint === subscription.endpoint));
});

test('expired push subscriptions are removed', async () => {
  const code = await newAccount({ timezone: 'UTC', reminderTime: '00:00', nudge: false });
  const subscription = { endpoint: 'https://push.example/gone', keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } };
  await call('/api/push/subscribe', { method: 'POST', code, body: { subscription } });
  await scheduler.tick();
  assert.equal((await call('/api/me', { code })).json.devicesWithNotifications, 0);
});

test('/go/<id> redirects to the LeetCode problem for today', async () => {
  const code = await newAccount();
  const [id] = code.split('.');
  const res = await call(`/go/${id}`);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), `https://leetcode.com/problems/${SEQUENCE[0].slug}/`);
  assert.equal((await call('/go/not-an-id')).headers.get('location'), '/');
});

test('delete account', async () => {
  const code = await newAccount();
  assert.equal((await call('/api/me', { method: 'DELETE', code })).status, 200);
  assert.equal((await call('/api/me', { code })).status, 401);
});

test('random practice is optional and off by default', async () => {
  const code = await newAccount();
  const today = (await call('/api/today', { code })).json;
  assert.equal(today.practice.enabled, false);
  assert.equal((await call('/api/practice/next', { method: 'POST', code })).status, 409);

  assert.equal((await call('/api/me/settings', { method: 'PATCH', code, body: { randomPractice: 'yes' } })).status, 400);
  await call('/api/me/settings', { method: 'PATCH', code, body: { randomPractice: true } });
  const first = await call('/api/practice/next', { method: 'POST', code });
  assert.equal(first.status, 200);
  assert.match(first.json.current.slug, /^practice-/);

  // "Another one" records the old one as skipped and gives a different problem.
  const second = (await call('/api/practice/next', { method: 'POST', code })).json;
  assert.notEqual(second.current.slug, first.json.current.slug);
  assert.equal(second.skipped, 1);

  const solved = (await call('/api/practice/result', { method: 'POST', code, body: { result: 'solved' } })).json;
  assert.equal(solved.solved, 1);
  assert.equal(solved.current, null);
  const after = (await call('/api/today', { code })).json;
  assert.equal(after.streak.current, 1);
  assert.equal(after.progress.solved, 0); // the roadmap is untouched

  const undone = (await call('/api/practice/undo', { method: 'POST', code })).json;
  assert.equal(undone.solved, 0);
  assert.equal(undone.current.slug, second.current.slug);
  assert.equal((await call('/api/today', { code })).json.streak.current, 0);

  const cleared = (await call('/api/practice/clear', { method: 'POST', code })).json;
  assert.equal(cleared.current, null);
  assert.equal((await call('/api/practice/result', { method: 'POST', code, body: { result: 'solved' } })).status, 409);
});

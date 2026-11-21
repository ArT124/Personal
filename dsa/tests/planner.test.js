import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newUser,
  ensureTodayPlan,
  markProblem,
  streaks,
  revisionDue,
  recommendations,
  reminderDue,
  reminderPayload,
  localDate,
  localTime,
  addBonusProblem,
  stats,
} from '../server/planner.js';
import { SEQUENCE, TOPICS } from '../server/data/curriculum.js';

const at = (iso) => new Date(iso);
const user = (settings = {}) => newUser('u1', 'hash', { timezone: 'Asia/Kolkata', ...settings }, at('2026-01-01T00:00:00Z'));

test('local date and time follow the user timezone', () => {
  const now = at('2026-03-10T20:00:00Z'); // 01:30 next day in India
  assert.equal(localDate('Asia/Kolkata', now), '2026-03-11');
  assert.equal(localTime('Asia/Kolkata', now), '01:30');
  assert.equal(localDate('America/New_York', now), '2026-03-10');
  assert.equal(localDate('Not/AZone', now), '2026-03-10'); // falls back to UTC
});

test('first daily problem is the first problem in the roadmap', () => {
  const u = user();
  const { slugs } = ensureTodayPlan(u, at('2026-03-10T05:00:00Z'));
  assert.deepEqual(slugs, [SEQUENCE[0].slug]);
});

test("today's plan stays fixed for the day, even after solving", () => {
  const u = user();
  const now = at('2026-03-10T05:00:00Z');
  const first = ensureTodayPlan(u, now).slugs;
  markProblem(u, first[0], 'solved', now);
  assert.deepEqual(ensureTodayPlan(u, at('2026-03-10T10:00:00Z')).slugs, first);
  // Next day moves on
  assert.deepEqual(ensureTodayPlan(u, at('2026-03-11T05:00:00Z')).slugs, [SEQUENCE[1].slug]);
});

test('an unsolved problem carries over to the next day', () => {
  const u = user();
  const day1 = ensureTodayPlan(u, at('2026-03-10T05:00:00Z')).slugs;
  const day2 = ensureTodayPlan(u, at('2026-03-11T05:00:00Z')).slugs;
  assert.deepEqual(day1, day2);
});

test('daily goal picks several problems, skipping finished ones', () => {
  const u = user({ dailyGoal: 3 });
  markProblem(u, SEQUENCE[1].slug, 'skipped', at('2026-03-09T05:00:00Z'));
  const { slugs } = ensureTodayPlan(u, at('2026-03-10T05:00:00Z'));
  assert.deepEqual(slugs, [SEQUENCE[0].slug, SEQUENCE[2].slug, SEQUENCE[3].slug]);
});

test('start topic skips ahead, then wraps round to earlier topics', () => {
  const last = TOPICS[TOPICS.length - 1];
  const u = user({ startTopic: last.id, dailyGoal: 5 });
  const n = last.problems.length;
  const { slugs } = ensureTodayPlan(u, at('2026-03-10T05:00:00Z'));
  assert.equal(slugs[0], last.problems[0].slug);
  if (n < 5) assert.equal(slugs[n], SEQUENCE[0].slug);
});

test('bonus problem adds the next one', () => {
  const u = user();
  const now = at('2026-03-10T05:00:00Z');
  ensureTodayPlan(u, now);
  const extra = addBonusProblem(u, now);
  assert.equal(extra.slug, SEQUENCE[1].slug);
  assert.equal(ensureTodayPlan(u, now).slugs.length, 2);
});

test('streak counts consecutive days and survives until the end of today', () => {
  const u = user();
  markProblem(u, SEQUENCE[0].slug, 'solved', at('2026-03-08T05:00:00Z'));
  markProblem(u, SEQUENCE[1].slug, 'solved', at('2026-03-09T05:00:00Z'));
  markProblem(u, SEQUENCE[2].slug, 'solved', at('2026-03-10T05:00:00Z'));
  assert.deepEqual(streaks(u, at('2026-03-10T12:00:00Z')), { current: 3, longest: 3, practisedToday: true });
  // Next day, nothing solved yet: streak still 3 (alive)
  assert.equal(streaks(u, at('2026-03-11T12:00:00Z')).current, 3);
  // Two days later: broken
  assert.equal(streaks(u, at('2026-03-12T12:00:00Z')).current, 0);
  assert.equal(streaks(u, at('2026-03-12T12:00:00Z')).longest, 3);
});

test('undo removes the activity for that day', () => {
  const u = user();
  const now = at('2026-03-10T05:00:00Z');
  markProblem(u, SEQUENCE[0].slug, 'solved', now);
  markProblem(u, SEQUENCE[0].slug, 'todo', now);
  assert.equal(streaks(u, now).current, 0);
  assert.equal(u.progress[SEQUENCE[0].slug], undefined);
});

test('revision: flagged problems first, then spaced repetition', () => {
  const u = user();
  markProblem(u, SEQUENCE[0].slug, 'solved', at('2026-03-01T05:00:00Z'));
  markProblem(u, SEQUENCE[1].slug, 'revise', at('2026-03-09T05:00:00Z'));
  const due = revisionDue(u, at('2026-03-10T05:00:00Z'));
  assert.deepEqual(due.map((d) => d.problem.slug), [SEQUENCE[1].slug, SEQUENCE[0].slug]);
  // After reviewing, it is not due again until the next interval (7 days)
  markProblem(u, SEQUENCE[0].slug, 'reviewed', at('2026-03-10T05:00:00Z'));
  const later = revisionDue(u, at('2026-03-12T05:00:00Z'));
  assert.ok(!later.some((d) => d.problem.slug === SEQUENCE[0].slug));
});

test('recommendations: up next and a harder stretch problem', () => {
  const u = user();
  const { slugs } = ensureTodayPlan(u, at('2026-03-10T05:00:00Z'));
  const rec = recommendations(u, slugs, at('2026-03-10T05:00:00Z'));
  assert.equal(rec.upNext.length, 3);
  assert.ok(!rec.upNext.some((p) => slugs.includes(p.slug)));
  assert.ok(rec.stretch && rec.stretch.difficulty !== 'Easy');
});

test('reminders: morning once a day, nudge only if not done', () => {
  const u = user({ reminderTime: '09:00', nudge: true, nudgeTime: '21:00' });
  u.subscriptions = [{ endpoint: 'https://push.example/1', keys: {} }];
  // 08:59 IST = 03:29 UTC
  assert.equal(reminderDue(u, at('2026-03-10T03:29:00Z')), null);
  assert.equal(reminderDue(u, at('2026-03-10T03:31:00Z')), 'morning');
  u.lastNotifiedDate = '2026-03-10';
  assert.equal(reminderDue(u, at('2026-03-10T10:00:00Z')), null);
  // 21:05 IST
  assert.equal(reminderDue(u, at('2026-03-10T15:35:00Z')), 'nudge');
  u.lastNudgeDate = '2026-03-10';
  assert.equal(reminderDue(u, at('2026-03-10T16:00:00Z')), null);
  // Next morning again
  assert.equal(reminderDue(u, at('2026-03-11T04:00:00Z')), 'morning');
});

test('reminders: none without a device or when turned off', () => {
  const u = user();
  assert.equal(reminderDue(u, at('2026-03-10T10:00:00Z')), null);
  u.subscriptions = [{ endpoint: 'x' }];
  u.settings.notifications = false;
  assert.equal(reminderDue(u, at('2026-03-10T10:00:00Z')), null);
});

test('notification links straight to the LeetCode problem', () => {
  const u = user();
  const { slugs } = ensureTodayPlan(u, at('2026-03-10T05:00:00Z'));
  const p = reminderPayload(u, 'morning', slugs, 'https://dsa.example.com/', at('2026-03-10T05:00:00Z'));
  assert.equal(p.url, `https://leetcode.com/problems/${SEQUENCE[0].slug}/`);
  assert.match(p.title, new RegExp(SEQUENCE[0].title));
  assert.equal(p.appUrl, 'https://dsa.example.com/#/');
});

test('stats add up', () => {
  const u = user();
  markProblem(u, SEQUENCE[0].slug, 'solved', at('2026-03-10T05:00:00Z'));
  markProblem(u, SEQUENCE[1].slug, 'skipped', at('2026-03-10T05:00:00Z'));
  const s = stats(u, at('2026-03-10T06:00:00Z'));
  assert.equal(s.solved, 1);
  assert.equal(s.skipped, 1);
  assert.equal(s.remaining, SEQUENCE.length - 2);
  assert.equal(s.heatmap.length, 84);
  assert.equal(s.heatmap.at(-1).count, 1);
});

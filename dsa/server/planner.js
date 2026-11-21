// Pure functions that decide what a user should solve today, what to revise,
// and how their streak and stats look. No I/O here, so it is easy to test.

import { SEQUENCE, TOPICS, BY_SLUG } from './data/curriculum.js';

export const STATUSES = ['solved', 'revise', 'skipped'];
const DONE = new Set(['solved', 'revise', 'skipped']);
const SOLVED = new Set(['solved', 'revise']);
// Spaced repetition: revisit a solved problem after 3, 7, 21, then 60 days.
const REVIEW_INTERVALS = [3, 7, 21, 60];
const PLAN_HISTORY_DAYS = 60;

export const DEFAULT_SETTINGS = {
  name: '',
  timezone: 'UTC',
  reminderTime: '09:00',
  nudge: true,
  nudgeTime: '21:00',
  dailyGoal: 1,
  startTopic: TOPICS[0].id,
  notifications: true,
};

// ---------- dates ----------

export function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parts(timezone, now) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: isValidTimezone(timezone) ? timezone : 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out = {};
  for (const part of fmt.formatToParts(now)) out[part.type] = part.value;
  return out;
}

/** 'YYYY-MM-DD' in the user's timezone. */
export function localDate(timezone, now = new Date()) {
  const p = parts(timezone, now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 'HH:MM' (24h) in the user's timezone. */
export function localTime(timezone, now = new Date()) {
  const p = parts(timezone, now);
  return `${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromStr, toStr) {
  return Math.round((Date.parse(`${toStr}T00:00:00Z`) - Date.parse(`${fromStr}T00:00:00Z`)) / 86400000);
}

// ---------- user shape ----------

export function newUser(id, tokenHash, settings = {}, now = new Date()) {
  return normalizeUser({
    id,
    tokenHash,
    createdAt: now.toISOString(),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  });
}

/** Fills in any missing fields so older records keep working. */
export function normalizeUser(user) {
  return {
    progress: {},
    plans: {},
    activity: {},
    subscriptions: [],
    lastNotifiedDate: null,
    lastNudgeDate: null,
    ...user,
    settings: { ...DEFAULT_SETTINGS, ...(user.settings || {}) },
  };
}

// ---------- picking problems ----------

function startIndex(user) {
  const topicIndex = TOPICS.findIndex((t) => t.id === user.settings.startTopic);
  if (topicIndex <= 0) return 0;
  return SEQUENCE.findIndex((p) => p.topicIndex === topicIndex);
}

/**
 * Next `count` problems in learning order that the user has not finished.
 * Starts at the chosen starting topic, then wraps round to earlier topics.
 */
export function nextProblems(user, count, exclude = new Set()) {
  const out = [];
  const start = startIndex(user);
  for (let i = 0; i < SEQUENCE.length && out.length < count; i++) {
    const problem = SEQUENCE[(start + i) % SEQUENCE.length];
    if (exclude.has(problem.slug)) continue;
    if (DONE.has(user.progress[problem.slug]?.status)) continue;
    out.push(problem);
  }
  return out;
}

/**
 * Today's problems. Fixed for the whole day once chosen, so the question in the
 * morning notification is the same one the site shows. An unsolved question
 * stays first in line tomorrow: you keep it until you solve or skip it.
 * Mutates user.plans; returns { date, slugs, changed }.
 */
export function ensureTodayPlan(user, now = new Date()) {
  const date = localDate(user.settings.timezone, now);
  const goal = clampGoal(user.settings.dailyGoal);
  let slugs = (user.plans[date] || []).filter((s) => BY_SLUG.has(s));
  let changed = !user.plans[date];

  if (slugs.length < goal) {
    const extra = nextProblems(user, goal - slugs.length, new Set(slugs));
    if (extra.length) {
      slugs = [...slugs, ...extra.map((p) => p.slug)];
      changed = true;
    }
  }

  if (changed) {
    user.plans[date] = slugs;
    const cutoff = addDays(date, -PLAN_HISTORY_DAYS);
    for (const d of Object.keys(user.plans)) if (d < cutoff) delete user.plans[d];
  }
  return { date, slugs, changed };
}

/** Adds one more problem to today's plan ("I want another one"). */
export function addBonusProblem(user, now = new Date()) {
  const { date, slugs } = ensureTodayPlan(user, now);
  const [extra] = nextProblems(user, 1, new Set(slugs));
  if (!extra) return null;
  user.plans[date] = [...slugs, extra.slug];
  return extra;
}

function clampGoal(n) {
  const v = Number.parseInt(n, 10);
  return Number.isFinite(v) ? Math.min(Math.max(v, 1), 5) : 1;
}

/** Problems due for revision: "revise" first, then spaced repetition. */
export function revisionDue(user, now = new Date(), limit = 2) {
  const today = localDate(user.settings.timezone, now);
  const flagged = [];
  const due = [];
  for (const [slug, entry] of Object.entries(user.progress)) {
    const problem = BY_SLUG.get(slug);
    if (!problem) continue;
    if (entry.status === 'revise') {
      flagged.push({ problem, since: entry.updatedAt, reason: 'You marked this for revision' });
      continue;
    }
    if (entry.status !== 'solved' || !entry.solvedAt) continue;
    const last = entry.lastReviewedAt || entry.solvedAt;
    const lastDate = localDate(user.settings.timezone, new Date(last));
    const interval = REVIEW_INTERVALS[Math.min(entry.reviews || 0, REVIEW_INTERVALS.length - 1)];
    const age = daysBetween(lastDate, today);
    if (age >= interval) {
      due.push({ problem, since: last, reason: `Solved ${age} days ago - quick spaced-repetition check` });
    }
  }
  const byOldest = (a, b) => String(a.since).localeCompare(String(b.since));
  return [...flagged.sort(byOldest), ...due.sort(byOldest)].slice(0, limit);
}

/** Recommendations shown next to today's question. */
export function recommendations(user, todaySlugs, now = new Date()) {
  const exclude = new Set(todaySlugs);
  const upNext = nextProblems(user, 3, exclude);
  upNext.forEach((p) => exclude.add(p.slug));

  // Stretch goal: a harder unsolved problem from the topic you are on.
  const current = BY_SLUG.get(todaySlugs[0]) || upNext[0];
  const rank = { Easy: 0, Medium: 1, Hard: 2 };
  let stretch = null;
  if (current) {
    stretch =
      SEQUENCE.find(
        (p) =>
          p.topicId === current.topicId &&
          rank[p.difficulty] > rank[current.difficulty] &&
          !exclude.has(p.slug) &&
          !DONE.has(user.progress[p.slug]?.status),
      ) || null;
  }

  return {
    revision: revisionDue(user, now),
    upNext,
    stretch,
  };
}

// ---------- recording progress ----------

/**
 * status: 'solved' | 'revise' | 'skipped' | 'todo' (undo) | 'reviewed'
 * Mutates user. Returns the new progress entry (or null after undo).
 */
export function markProblem(user, slug, status, now = new Date()) {
  if (!BY_SLUG.has(slug)) throw new Error('Unknown problem');
  const tz = user.settings.timezone;
  const today = localDate(tz, now);
  const prev = user.progress[slug];
  const iso = now.toISOString();

  if (status === 'todo') {
    if (prev && SOLVED.has(prev.status) && prev.solvedAt) {
      bumpActivity(user, localDate(tz, new Date(prev.solvedAt)), -1);
    }
    delete user.progress[slug];
    return null;
  }

  if (status === 'reviewed') {
    if (!prev || !SOLVED.has(prev.status)) throw new Error('Only solved problems can be reviewed');
    const entry = { ...prev, status: 'solved', reviews: (prev.reviews || 0) + 1, lastReviewedAt: iso, updatedAt: iso };
    user.progress[slug] = entry;
    bumpActivity(user, today, 1);
    return entry;
  }

  if (!STATUSES.includes(status)) throw new Error('Invalid status');
  const wasSolved = prev && SOLVED.has(prev.status);
  const entry = { ...(prev || {}), status, updatedAt: iso };

  if (SOLVED.has(status) && !wasSolved) {
    entry.solvedAt = iso;
    entry.reviews = 0;
    bumpActivity(user, today, 1);
  }
  if (status === 'skipped' && wasSolved && prev.solvedAt) {
    bumpActivity(user, localDate(tz, new Date(prev.solvedAt)), -1);
    delete entry.solvedAt;
  }
  user.progress[slug] = entry;
  return entry;
}

function bumpActivity(user, date, delta) {
  const next = (user.activity[date] || 0) + delta;
  if (next > 0) user.activity[date] = next;
  else delete user.activity[date];
}

// ---------- streaks & stats ----------

export function streaks(user, now = new Date()) {
  const today = localDate(user.settings.timezone, now);
  const active = new Set(Object.keys(user.activity).filter((d) => user.activity[d] > 0));

  // The streak is still alive today if you practised yesterday.
  let cursor = active.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (active.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of [...active].sort()) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest, practisedToday: active.has(today) };
}

export function stats(user, now = new Date()) {
  const byDifficulty = { Easy: { done: 0, total: 0 }, Medium: { done: 0, total: 0 }, Hard: { done: 0, total: 0 } };
  const topics = TOPICS.map((t) => ({ id: t.id, name: t.name, done: 0, total: t.problems.length }));
  let solved = 0;
  let skipped = 0;
  let revise = 0;

  for (const problem of SEQUENCE) {
    const status = user.progress[problem.slug]?.status;
    byDifficulty[problem.difficulty].total++;
    if (SOLVED.has(status)) {
      solved++;
      byDifficulty[problem.difficulty].done++;
      topics[problem.topicIndex].done++;
    }
    if (status === 'skipped') skipped++;
    if (status === 'revise') revise++;
  }

  const today = localDate(user.settings.timezone, now);
  const heatmap = [];
  for (let i = 83; i >= 0; i--) {
    const date = addDays(today, -i);
    heatmap.push({ date, count: user.activity[date] || 0 });
  }

  const remaining = SEQUENCE.length - solved - skipped;
  const goal = clampGoal(user.settings.dailyGoal);
  return {
    total: SEQUENCE.length,
    solved,
    skipped,
    revise,
    remaining,
    percent: Math.round((solved / SEQUENCE.length) * 100),
    estimatedDaysLeft: Math.ceil(remaining / goal),
    byDifficulty,
    topics,
    heatmap,
    streak: streaks(user, now),
    memberSince: user.createdAt,
  };
}

// ---------- reminders ----------

/** Which reminder (if any) is due now: 'morning', 'nudge' or null. */
export function reminderDue(user, now = new Date()) {
  const s = user.settings;
  if (!s.notifications || !user.subscriptions.length) return null;
  const today = localDate(s.timezone, now);
  const time = localTime(s.timezone, now);
  const nudgeOn = s.nudge && s.nudgeTime > s.reminderTime;

  if (user.lastNotifiedDate !== today && time >= s.reminderTime) {
    // If the server missed the morning slot and it is already evening, send one nudge instead of two.
    if (nudgeOn && time >= s.nudgeTime) return user.lastNudgeDate !== today ? 'nudge' : null;
    return 'morning';
  }
  if (nudgeOn && user.lastNudgeDate !== today && time >= s.nudgeTime) return 'nudge';
  return null;
}

export function todayDone(user, slugs) {
  return slugs.length > 0 && slugs.every((s) => DONE.has(user.progress[s]?.status));
}

/** Notification content for the reminder. Clicking it opens the LeetCode page. */
export function reminderPayload(user, kind, slugs, appUrl, now = new Date()) {
  const problems = slugs.map((s) => BY_SLUG.get(s)).filter(Boolean);
  const pending = problems.filter((p) => !DONE.has(user.progress[p.slug]?.status));
  const first = pending[0] || problems[0];
  const { current } = streaks(user, now);
  const base = appUrl.replace(/\/$/, '');

  if (!first) {
    return {
      title: 'Daily DSA',
      body: 'You have finished the whole roadmap. Time for revision!',
      url: `${base}/#/`,
      appUrl: `${base}/#/`,
      tag: 'daily-dsa',
    };
  }

  const more = pending.length > 1 ? ` (+${pending.length - 1} more)` : '';
  const streakText = current > 0 ? ` · ${current}-day streak` : '';
  const title =
    kind === 'nudge'
      ? `Still time today: ${first.title}`
      : `Today's DSA: ${first.title}`;
  const body =
    kind === 'nudge'
      ? `${first.topicName} · ${first.difficulty}${more}. Keep your streak going${streakText}.`
      : `${first.topicName} · ${first.difficulty}${more}${streakText}. Tap to open it on LeetCode.`;

  return {
    title,
    body,
    url: first.url,
    appUrl: `${base}/#/`,
    tag: 'daily-dsa',
    slug: first.slug,
  };
}

export function publicProblem(problem, user) {
  if (!problem) return null;
  const entry = user?.progress[problem.slug];
  return {
    num: problem.num,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    hint: problem.hint,
    url: problem.url,
    topicId: problem.topicId,
    topicName: problem.topicName,
    order: problem.order,
    status: entry?.status || 'todo',
    solvedAt: entry?.solvedAt || null,
  };
}

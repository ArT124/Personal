// Unit tests for the optional random practice picker, using a fake LeetCode source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newUser, markProblem } from '../server/planner.js';
import { TOPICS } from '../server/data/curriculum.js';
import {
  practiceProfile,
  pickPracticeProblem,
  recordPractice,
  undoPractice,
  practiceSummary,
  difficultyFor,
  createLeetCodeSource,
} from '../server/practice.js';

const now = new Date('2026-03-10T05:00:00Z');
const user = (settings = {}) => newUser('u1', 'hash', { timezone: 'UTC', randomPractice: true, ...settings }, now);
const q = (num, slug, tags, extra = {}) => ({ num, title: slug, slug, difficulty: 'Easy', paidOnly: false, tags: tags.map((t) => ({ slug: t, name: t })), ...extra });

/** Fake source: returns the same list for every tag/difficulty and records the calls. */
function fakeSource(questions) {
  const calls = [];
  return {
    calls,
    async list(args) {
      calls.push(args);
      return { total: questions.length, questions: questions.slice(args.skip, args.skip + args.limit) };
    },
  };
}

test('new user: profile is the starting topic only', () => {
  const profile = practiceProfile(user());
  assert.deepEqual(profile.topics.map((t) => t.topic.id), [TOPICS[0].id]);
  assert.ok(profile.knownTags.has('math'));
  assert.ok(!profile.knownTags.has('dynamic-programming'));
});

test('profile grows with progress', () => {
  const u = user();
  const sw = TOPICS.find((t) => t.id === 'sliding-window');
  markProblem(u, sw.problems[0].slug, 'solved', now);
  const ids = practiceProfile(u).topics.map((t) => t.topic.id);
  assert.ok(ids.includes('sliding-window'));
  assert.ok(practiceProfile(u).knownTags.has('sliding-window'));
});

test('only offers free, non-roadmap problems whose tags are all known', async () => {
  const u = user();
  const source = fakeSource([
    q(1, 'two-sum', ['array']), // in the roadmap
    q(9001, 'premium-one', ['math'], { paidOnly: true }),
    q(9002, 'needs-dp', ['math', 'dynamic-programming']),
    q(9003, 'just-right', ['math', 'array']),
  ]);
  const p = await pickPracticeProblem(u, source, { rand: () => 0.1, now });
  assert.equal(p.slug, 'just-right');
  assert.equal(p.source, 'leetcode');
  assert.equal(p.url, 'https://leetcode.com/problems/just-right/');
  assert.equal(p.topicId, TOPICS[0].id);
});

test('does not repeat problems from practice history', async () => {
  const u = user();
  const source = fakeSource([q(9003, 'a', ['math']), q(9004, 'b', ['math'])]);
  u.practice.current = await pickPracticeProblem(u, source, { rand: () => 0, now });
  recordPractice(u, 'solved', now);
  const second = await pickPracticeProblem(u, source, { rand: () => 0, now });
  assert.notEqual(second.slug, u.practice.history[0].slug);
});

test('falls back to a solved roadmap problem when LeetCode fails', async () => {
  const u = user();
  markProblem(u, TOPICS[0].problems[0].slug, 'solved', now);
  const broken = { async list() { throw new Error('down'); } };
  const p = await pickPracticeProblem(u, broken, { now });
  assert.equal(p.source, 'roadmap');
  assert.equal(p.slug, TOPICS[0].problems[0].slug);
});

test('throws when LeetCode fails and there is nothing to fall back on', async () => {
  const broken = { async list() { throw new Error('down'); } };
  await assert.rejects(() => pickPracticeProblem(user(), broken, { now }));
});

test('record, undo and summary', () => {
  const u = user();
  u.practice.current = { slug: 'x', title: 'X', num: 5000, difficulty: 'Easy', url: 'u', topicName: 'T' };
  recordPractice(u, 'solved', now);
  assert.equal(u.practice.current, null);
  assert.equal(practiceSummary(u).solved, 1);
  undoPractice(u);
  assert.equal(u.practice.current.slug, 'x');
  assert.equal(practiceSummary(u).solved, 0);
  assert.equal(recordPractice(user(), 'solved', now), null);
});

test('difficulty rises with topic progress', () => {
  assert.equal(difficultyFor(0, () => 0.1), 'EASY');
  assert.equal(difficultyFor(0.6, () => 0.5), 'MEDIUM');
  assert.equal(difficultyFor(1, () => 0.9), 'HARD');
  assert.notEqual(difficultyFor(0, () => 0.99), 'HARD');
});

test('LeetCode source parses and caches responses', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        data: { questionList: { totalNum: 1, data: [{ questionFrontendId: '42', title: 'T', titleSlug: 't', difficulty: 'Hard', isPaidOnly: false, topicTags: [{ slug: 'array', name: 'Array' }] }] } },
      }),
    };
  };
  const source = createLeetCodeSource({ fetchImpl });
  const a = await source.list({ tag: 'array', difficulty: 'HARD' });
  await source.list({ tag: 'array', difficulty: 'HARD' });
  assert.equal(calls, 1);
  assert.deepEqual(a.questions[0], { num: 42, title: 'T', slug: 't', difficulty: 'Hard', paidOnly: false, tags: [{ slug: 'array', name: 'Array' }] });
});

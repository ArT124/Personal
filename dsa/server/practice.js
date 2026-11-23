// Optional "random extra practice": a random LeetCode problem picked from the
// topics the user has already studied. It is separate from the roadmap: it never
// repeats a roadmap problem and never changes roadmap progress.
//
// Problems come from LeetCode's public problem list (filtered by topic tag and
// difficulty). A problem is only offered if every one of its tags is a topic the
// user has studied, so it never needs something they have not learned yet.
// If LeetCode can't be reached, a solved roadmap problem is offered instead.

import { TOPICS, SEQUENCE, BY_SLUG } from './data/curriculum.js';

const DONE = new Set(['solved', 'revise', 'skipped']);
const HISTORY_LIMIT = 300;

/** LeetCode tag slugs for each roadmap topic. The first tag is the one we search by. */
export const TOPIC_TAGS = {
  basics: ['math', 'simulation', 'enumeration', 'brainteaser'],
  arrays: ['array', 'string', 'counting', 'iterator'],
  hashing: ['hash-table', 'hash-function', 'counting'],
  'prefix-sum': ['prefix-sum'],
  matrix: ['matrix'],
  recursion: ['recursion'],
  sorting: ['sorting', 'counting-sort', 'merge-sort', 'quickselect', 'bucket-sort', 'radix-sort', 'divide-and-conquer'],
  'two-pointers': ['two-pointers'],
  'sliding-window': ['sliding-window'],
  'binary-search': ['binary-search'],
  'bs-answer': ['binary-search'],
  'linked-list': ['linked-list', 'doubly-linked-list'],
  stack: ['stack', 'queue'],
  'monotonic-stack': ['monotonic-stack', 'monotonic-queue'],
  trees: ['binary-tree', 'tree', 'depth-first-search', 'breadth-first-search'],
  bst: ['binary-search-tree', 'ordered-set'],
  heap: ['heap-priority-queue'],
  backtracking: ['backtracking'],
  tries: ['trie'],
  graphs: ['graph', 'depth-first-search', 'breadth-first-search'],
  'topo-sort': ['topological-sort'],
  'union-find': ['union-find'],
  'advanced-graphs': ['shortest-path', 'minimum-spanning-tree', 'biconnected-component', 'eulerian-circuit', 'strongly-connected-component'],
  greedy: ['greedy'],
  intervals: ['line-sweep'],
  'dp-1d': ['dynamic-programming', 'memoization'],
  'dp-2d': ['dynamic-programming', 'memoization'],
  'dp-knapsack': ['dynamic-programming', 'memoization'],
  'dp-advanced': ['dynamic-programming', 'bitmask'],
  bits: ['bit-manipulation', 'bitmask'],
  math: ['math', 'number-theory', 'geometry', 'combinatorics'],
  'string-algorithms': ['string-matching', 'rolling-hash', 'hash-function'],
  'range-queries': ['segment-tree', 'binary-indexed-tree'],
  design: ['design', 'data-stream'],
};
// Tags that need nothing beyond the basics.
const ALWAYS_KNOWN = ['array', 'string', 'simulation', 'counting', 'enumeration', 'brainteaser', 'iterator'];

export function normalizePractice(practice) {
  return {
    current: practice?.current || null,
    history: Array.isArray(practice?.history) ? practice.history : [],
  };
}

/**
 * What the user has studied so far: the topics they have made progress in
 * (or the topic they are on, for a brand-new user), with how far along each is.
 */
export function practiceProfile(user) {
  const topics = [];
  for (const topic of TOPICS) {
    const done = topic.problems.filter((p) => DONE.has(user.progress[p.slug]?.status)).length;
    if (done > 0) topics.push({ topic, fraction: done / topic.problems.length });
  }
  if (!topics.length) {
    const startAt = Math.max(0, TOPICS.findIndex((t) => t.id === user.settings.startTopic));
    const next = SEQUENCE.slice(SEQUENCE.findIndex((p) => p.topicIndex === startAt)).find((p) => !DONE.has(user.progress[p.slug]?.status));
    topics.push({ topic: TOPICS[next ? next.topicIndex : startAt], fraction: 0 });
  }
  const knownTags = new Set(ALWAYS_KNOWN);
  for (const { topic } of topics) for (const tag of TOPIC_TAGS[topic.id] || []) knownTags.add(tag);
  // Only topics with a LeetCode tag can be searched (Mixed Review topics have none).
  const searchable = topics.filter(({ topic }) => TOPIC_TAGS[topic.id]?.length);
  return { topics, searchable, knownTags };
}

/** Harder problems as you get further through a topic. */
export function difficultyFor(fraction, rand = Math.random) {
  const r = rand();
  if (fraction >= 1) return r < 0.65 ? 'MEDIUM' : 'HARD';
  if (fraction >= 0.5) return r < 0.2 ? 'EASY' : r < 0.9 ? 'MEDIUM' : 'HARD';
  return r < 0.6 ? 'EASY' : 'MEDIUM';
}

const GRAPHQL = `query practiceList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    totalNum
    data { questionFrontendId title titleSlug difficulty isPaidOnly topicTags { slug name } }
  }
}`;

/** Reads LeetCode's public problem list, with an in-memory cache. */
export function createLeetCodeSource({ fetchImpl = globalThis.fetch, ttlMs = 12 * 60 * 60 * 1000, timeoutMs = 8000 } = {}) {
  const cache = new Map();
  return {
    async list({ tag, difficulty, skip = 0, limit = 50 }) {
      const key = `${tag}|${difficulty}|${skip}|${limit}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value;
      const res = await fetchImpl('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json', referer: 'https://leetcode.com/problemset/', 'user-agent': 'daily-dsa' },
        body: JSON.stringify({ query: GRAPHQL, variables: { categorySlug: '', limit, skip, filters: { tags: [tag], difficulty } } }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`LeetCode answered ${res.status}`);
      const json = await res.json();
      const list = json?.data?.questionList;
      if (!list || !Array.isArray(list.data)) throw new Error('Unexpected LeetCode response');
      const value = {
        total: Number(list.totalNum) || 0,
        questions: list.data.map((q) => ({
          num: Number(q.questionFrontendId),
          title: String(q.title),
          slug: String(q.titleSlug),
          difficulty: String(q.difficulty),
          paidOnly: Boolean(q.isPaidOnly),
          tags: (q.topicTags || []).map((t) => ({ slug: String(t.slug), name: String(t.name) })),
        })),
      };
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      cache.set(key, { at: Date.now(), value });
      return value;
    },
  };
}

const PAGE = 50;
const randInt = (n, rand) => Math.floor(rand() * n);

function shuffle(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1, rand);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks a random problem for extra practice. Returns the problem, or null if
 * there is nothing left to offer.
 */
export async function pickPracticeProblem(user, source, { rand = Math.random, now = new Date() } = {}) {
  const practice = normalizePractice(user.practice);
  const seen = new Set([...practice.history.map((h) => h.slug), practice.current?.slug].filter(Boolean));
  const profile = practiceProfile(user);
  const usable = (q) =>
    !q.paidOnly && !BY_SLUG.has(q.slug) && !seen.has(q.slug) && q.tags.every((t) => profile.knownTags.has(t.slug));

  let lastError = null;
  for (const { topic, fraction } of shuffle(profile.searchable, rand).slice(0, 3)) {
    const tag = TOPIC_TAGS[topic.id][0];
    const first = difficultyFor(fraction, rand);
    const order = [first, ...['EASY', 'MEDIUM', 'HARD'].filter((d) => d !== first)];
    for (const difficulty of order.slice(0, 2)) {
      try {
        const { total } = await source.list({ tag, difficulty, skip: 0, limit: PAGE });
        const pages = Math.ceil(total / PAGE);
        for (const page of shuffle([...Array(pages).keys()], rand).slice(0, 3)) {
          const { questions } = await source.list({ tag, difficulty, skip: page * PAGE, limit: PAGE });
          const options = questions.filter(usable);
          if (options.length) {
            const q = options[randInt(options.length, rand)];
            return {
              num: q.num,
              title: q.title,
              slug: q.slug,
              difficulty: q.difficulty,
              url: `https://leetcode.com/problems/${q.slug}/`,
              topicId: topic.id,
              topicName: topic.name,
              tags: q.tags.map((t) => t.name).slice(0, 6),
              source: 'leetcode',
              servedAt: now.toISOString(),
            };
          }
        }
      } catch (err) {
        lastError = err;
        break; // LeetCode is unreachable or changed: stop asking it.
      }
    }
    if (lastError) break;
  }

  // Fallback: re-practise a solved roadmap problem from a studied topic.
  const studied = new Set(profile.topics.map(({ topic }) => topic.id));
  const solved = SEQUENCE.filter(
    (p) => studied.has(p.topicId) && ['solved', 'revise'].includes(user.progress[p.slug]?.status) && !seen.has(p.slug),
  );
  if (!solved.length) {
    if (lastError) throw lastError;
    return null;
  }
  const p = solved[randInt(solved.length, rand)];
  return {
    num: p.num,
    title: p.title,
    slug: p.slug,
    difficulty: p.difficulty,
    url: p.url,
    topicId: p.topicId,
    topicName: p.topicName,
    tags: [],
    source: 'roadmap',
    servedAt: now.toISOString(),
  };
}

/** Records the result of the current practice problem ('solved' or 'skipped'). */
export function recordPractice(user, result, now = new Date()) {
  const practice = normalizePractice(user.practice);
  if (!practice.current) return null;
  const entry = { ...practice.current, result, at: now.toISOString() };
  practice.history = [...practice.history, entry].slice(-HISTORY_LIMIT);
  practice.current = null;
  user.practice = practice;
  return entry;
}

/** Puts the last recorded problem back as the current one. Returns it, or null. */
export function undoPractice(user) {
  const practice = normalizePractice(user.practice);
  const last = practice.history.at(-1);
  if (!last) return null;
  practice.history = practice.history.slice(0, -1);
  const { result, at, ...problem } = last;
  practice.current = problem;
  user.practice = practice;
  return last;
}

export function practiceSummary(user) {
  const practice = normalizePractice(user.practice);
  const solved = practice.history.filter((h) => h.result === 'solved');
  return {
    enabled: Boolean(user.settings.randomPractice),
    current: practice.current,
    solved: solved.length,
    skipped: practice.history.length - solved.length,
    recent: solved.slice(-5).reverse().map(({ num, title, url, difficulty, topicName, at }) => ({ num, title, url, difficulty, topicName, at })),
  };
}

// Builds a revision sheet from the topics the user has already solved problems in:
// a cheat sheet per topic, the solved problems with their hints, which ones to
// re-solve first, and any extra-practice problems solved for that topic.

import { TOPICS, PHASES } from './data/curriculum.js';
import { REVISION_NOTES } from './data/revisionNotes.js';

const SOLVED = new Set(['solved', 'revise']);
const PHASE_NAME = new Map(PHASES.map((ph) => [ph.id, ph.name]));
const FOCUS_PER_TOPIC = 3;

const lastTouched = (p) => Date.parse(p.lastReviewedAt || p.solvedAt || 0) || 0;

/** Problems to re-solve first: flagged ones, then the least reviewed, then the longest ago. */
function focusOrder(a, b) {
  if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
  if (a.reviews !== b.reviews) return a.reviews - b.reviews;
  return lastTouched(a) - lastTouched(b);
}

export function revisionSheet(user, now = new Date()) {
  const practice = (user.practice?.history || []).filter((h) => h.result === 'solved');
  const topics = [];

  for (const topic of TOPICS) {
    const problems = topic.problems
      .filter((p) => SOLVED.has(user.progress[p.slug]?.status))
      .map((p) => {
        const entry = user.progress[p.slug];
        return {
          num: p.num,
          title: p.title,
          slug: p.slug,
          url: `https://leetcode.com/problems/${p.slug}/`,
          difficulty: p.difficulty,
          hint: p.hint,
          flagged: entry.status === 'revise',
          reviews: entry.reviews || 0,
          solvedAt: entry.solvedAt || null,
          lastReviewedAt: entry.lastReviewedAt || null,
        };
      });
    if (!problems.length) continue;

    topics.push({
      id: topic.id,
      name: topic.name,
      phase: PHASE_NAME.get(topic.phase) || '',
      summary: topic.summary,
      notes: REVISION_NOTES[topic.id] || null,
      solved: problems.length,
      total: topic.problems.length,
      problems,
      focus: [...problems].sort(focusOrder).slice(0, FOCUS_PER_TOPIC).map((p) => p.slug),
      practice: practice
        .filter((h) => h.topicId === topic.id)
        .map(({ num, title, url, difficulty }) => ({ num, title, url, difficulty })),
    });
  }

  return {
    generatedAt: now.toISOString(),
    totals: {
      topics: topics.length,
      problems: topics.reduce((n, t) => n + t.solved, 0),
      flagged: topics.reduce((n, t) => n + t.problems.filter((p) => p.flagged).length, 0),
    },
    topics,
  };
}

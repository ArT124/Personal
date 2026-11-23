// Sanity checks for the roadmap: no duplicate slugs or numbers, valid fields.
// Run: npm run check:curriculum
import { TOPICS, SEQUENCE, PHASES } from '../server/data/curriculum.js';

const errors = [];
const phaseIds = PHASES.map((ph) => ph.id);
let lastPhase = 0;
for (const t of TOPICS) {
  const at = phaseIds.indexOf(t.phase);
  if (at < 0) errors.push(`topic ${t.id} has unknown phase ${t.phase}`);
  else if (at < lastPhase) errors.push(`topic ${t.id} is out of phase order`);
  else lastPhase = at;
  if (!t.problems.length) errors.push(`topic ${t.id} has no problems`);
}
const slugs = new Set();
const nums = new Set();
for (const p of SEQUENCE) {
  if (slugs.has(p.slug)) errors.push(`duplicate slug ${p.slug}`);
  if (nums.has(p.num)) errors.push(`duplicate number ${p.num}`);
  slugs.add(p.slug);
  nums.add(p.num);
  if (!/^[a-z0-9-]+$/.test(p.slug)) errors.push(`bad slug ${p.slug}`);
  if (!p.difficulty) errors.push(`bad difficulty for ${p.slug}`);
  if (!p.hint) errors.push(`missing hint for ${p.slug}`);
}
const counts = SEQUENCE.reduce((acc, p) => ({ ...acc, [p.difficulty]: (acc[p.difficulty] || 0) + 1 }), {});
console.log(`${PHASES.length} phases, ${TOPICS.length} topics, ${SEQUENCE.length} problems`, counts);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Curriculum OK');

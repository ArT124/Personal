// Sanity checks for the roadmap: no duplicate slugs or numbers, valid fields.
// Run: npm run check:curriculum
import { TOPICS, SEQUENCE } from '../server/data/curriculum.js';

const errors = [];
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
console.log(`${TOPICS.length} topics, ${SEQUENCE.length} problems`, counts);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Curriculum OK');

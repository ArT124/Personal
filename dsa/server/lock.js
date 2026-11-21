// Runs tasks for the same key one after another, so two requests that change
// the same user (e.g. phone and laptop at once) can't overwrite each other.
const queues = new Map();

export function withLock(key, task) {
  const prev = queues.get(key) || Promise.resolve();
  const run = prev.then(task, task);
  const tail = run.catch(() => {});
  queues.set(key, tail);
  tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return run;
}

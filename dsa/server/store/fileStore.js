// Simple JSON-file database for local development and self-hosting on a machine
// with a persistent disk. Writes are atomic (temp file + rename) and batched.

import fs from 'node:fs/promises';
import path from 'node:path';

export async function createFileStore(dataDir) {
  const file = path.join(dataDir, 'db.json');
  await fs.mkdir(dataDir, { recursive: true });

  let db = { users: {}, meta: {} };
  try {
    db = { users: {}, meta: {}, ...JSON.parse(await fs.readFile(file, 'utf8')) };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  let writing = Promise.resolve();
  let pending = false;
  const persist = () => {
    if (pending) return writing;
    pending = true;
    writing = writing.then(async () => {
      pending = false;
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db));
      await fs.rename(tmp, file);
    });
    return writing;
  };

  const clone = (v) => (v === undefined ? null : structuredClone(v));

  return {
    kind: 'file',
    async getUser(id) {
      return clone(db.users[id]);
    },
    async saveUser(user) {
      db.users[user.id] = structuredClone(user);
      await persist();
    },
    async deleteUser(id) {
      delete db.users[id];
      await persist();
    },
    async *usersWithSubscriptions() {
      for (const user of Object.values(db.users)) {
        if (user.subscriptions?.length && user.settings?.notifications) yield clone(user);
      }
    },
    async countUsers() {
      return Object.keys(db.users).length;
    },
    async getMeta(key) {
      return clone(db.meta[key]);
    },
    async setMeta(key, value) {
      db.meta[key] = value;
      await persist();
    },
    async close() {
      await writing;
    },
  };
}

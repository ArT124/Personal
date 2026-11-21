// MongoDB store, for the free MongoDB Atlas M0 cluster in production.

export async function createMongoStore(uri, dbName) {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');
  const meta = db.collection('meta');
  await users.createIndex({ 'settings.notifications': 1, 'subscriptions.0': 1 });

  const fromDoc = (doc) => {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
  };

  return {
    kind: 'mongodb',
    async getUser(id) {
      return fromDoc(await users.findOne({ _id: id }));
    },
    async saveUser(user) {
      const { id, ...rest } = user;
      await users.replaceOne({ _id: id }, rest, { upsert: true });
    },
    async deleteUser(id) {
      await users.deleteOne({ _id: id });
    },
    async *usersWithSubscriptions() {
      const cursor = users.find({ 'settings.notifications': true, 'subscriptions.0': { $exists: true } });
      for await (const doc of cursor) yield fromDoc(doc);
    },
    async countUsers() {
      return users.estimatedDocumentCount();
    },
    async getMeta(key) {
      const doc = await meta.findOne({ _id: key });
      return doc ? doc.value : null;
    },
    async setMeta(key, value) {
      await meta.replaceOne({ _id: key }, { value }, { upsert: true });
    },
    async close() {
      await client.close();
    },
  };
}

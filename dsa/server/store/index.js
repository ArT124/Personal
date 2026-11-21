import { createFileStore } from './fileStore.js';
import { createMongoStore } from './mongoStore.js';

export async function createStore(config) {
  if (config.mongoUri) return createMongoStore(config.mongoUri, config.mongoDb);
  if (config.isProduction) {
    console.warn(
      '[store] MONGODB_URI is not set: using a local JSON file. On free hosts like Render the disk is wiped on restart, so data will be lost.',
    );
  }
  return createFileStore(config.dataDir);
}

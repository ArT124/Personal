import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiRouter } from './routes/api.js';
import { ensureTodayPlan, normalizeUser, todayDone } from './planner.js';
import { BY_SLUG } from './data/curriculum.js';
import { withLock } from './lock.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function createApp({ store, push, scheduler, config, practiceSource }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'"],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'manifest-src': ["'self'"],
          'worker-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  app.get('/healthz', async (req, res) => {
    res.json({ ok: true, store: store.kind, time: new Date().toISOString() });
  });

  app.use(
    '/api',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }),
    (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    },
    createApiRouter({ store, push, scheduler, config, practiceSource }),
  );

  // Personal shortcut: /go/<id> jumps straight to today's LeetCode problem.
  // Used by the calendar reminder, which can't carry a login token.
  app.get('/go/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!UUID_RE.test(id)) return res.redirect(302, '/');
      const url = await withLock(id, async () => {
        const raw = await store.getUser(id);
        if (!raw) return '/';
        const user = normalizeUser(raw);
        const { slugs, changed } = ensureTodayPlan(user);
        if (changed) await store.saveUser(user);
        const pending = todayDone(user, slugs) ? null : slugs.find((s) => !user.progress[s]);
        return pending ? BY_SLUG.get(pending).url : '/#/';
      });
      res.set('Cache-Control', 'no-store');
      res.redirect(302, url);
    } catch (err) {
      next(err);
    }
  });

  app.use(
    express.static(PUBLIC_DIR, {
      extensions: ['html'],
      setHeaders(res, filePath) {
        const name = path.basename(filePath);
        if (name === 'sw.js' || name.endsWith('.html') || name === 'manifest.webmanifest') {
          res.set('Cache-Control', 'no-cache');
        } else {
          res.set('Cache-Control', 'public, max-age=86400');
        }
        if (name === 'sw.js') res.set('Service-Worker-Allowed', '/');
      },
    }),
  );

  app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[app]', err);
    res.status(500).send('Something went wrong.');
  });

  return app;
}

// Web Push (works on Chrome, Edge, Firefox, Android, and iPhone/iPad 16.4+ once
// the site is installed to the home screen).

import webpush from 'web-push';

/** Uses keys from env, or generates them once and keeps them in the database. */
export async function setupPush(config, store) {
  let publicKey = config.vapidPublicKey;
  let privateKey = config.vapidPrivateKey;

  if (!publicKey || !privateKey) {
    const saved = await store.getMeta('vapid');
    if (saved?.publicKey && saved?.privateKey) {
      ({ publicKey, privateKey } = saved);
    } else {
      ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
      await store.setMeta('vapid', { publicKey, privateKey });
      console.log('[push] Generated new VAPID keys and saved them in the database.');
    }
  }

  webpush.setVapidDetails(config.vapidSubject, publicKey, privateKey);

  return {
    publicKey,
    /** Returns 'ok' | 'gone' (subscription expired, remove it) | 'error'. */
    async send(subscription, payload) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: 'normal' });
        return 'ok';
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) return 'gone';
        console.warn('[push] send failed:', err.statusCode || '', err.body || err.message);
        return 'error';
      }
    },
  };
}

export function isValidSubscription(sub) {
  return (
    sub &&
    typeof sub.endpoint === 'string' &&
    /^https:\/\//.test(sub.endpoint) &&
    sub.endpoint.length < 1000 &&
    typeof sub.keys?.p256dh === 'string' &&
    typeof sub.keys?.auth === 'string' &&
    sub.keys.p256dh.length < 200 &&
    sub.keys.auth.length < 100
  );
}

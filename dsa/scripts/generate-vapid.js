// Prints a new pair of Web Push (VAPID) keys to paste into .env or the Render dashboard.
// Run: npm run vapid
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);

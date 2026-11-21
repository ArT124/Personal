// Push notification setup + calendar reminder (.ics) fallback.
import { api } from './api.js';

export function pushSupport() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return {
    supported,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    isIOS,
    isStandalone,
    // iPhone/iPad only allow web push after "Add to Home Screen".
    needsInstallFirst: isIOS && !isStandalone,
  };
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.warn('Service worker registration failed', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(sub, vapidKey) {
  const current = sub.options?.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current);
  const b = urlBase64ToUint8Array(vapidKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'device';
  return `${browser} on ${os}`;
}

export async function currentSubscription() {
  if (!pushSupport().supported) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Asks permission (must be called from a click) and registers this device. */
export async function enablePush(vapidKey) {
  const support = pushSupport();
  if (support.needsInstallFirst) {
    throw new Error('On iPhone/iPad, first add this site to your Home Screen (Share → Add to Home Screen), open it from there, then turn on reminders.');
  }
  if (!support.supported) throw new Error('This browser does not support push notifications. Use the calendar reminder instead.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Allow them for this site in your browser settings, then try again.'
        : 'Notification permission was not given.',
    );
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, vapidKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
  return api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), device: deviceLabel() } });
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}

/** On each visit, make sure the server still has this device's subscription. */
export async function resyncPush(vapidKey, wantsNotifications) {
  const support = pushSupport();
  if (!support.supported || support.permission !== 'granted' || !wantsNotifications) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, vapidKey)) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
    await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), device: deviceLabel() } });
  } catch (err) {
    console.warn('Push resync failed', err);
  }
}

// ---------- calendar fallback ----------

/** A daily repeating calendar event whose link opens today's LeetCode problem. */
export function buildCalendarFile({ appUrl, userId, time, timezone }) {
  const [h, m] = time.split(':');
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const link = `${appUrl}/go/${userId}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daily DSA//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:daily-dsa-${userId}@daily-dsa`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${timezone}:${y}${mo}${d}T${h}${m}00`,
    'DURATION:PT30M',
    'RRULE:FREQ=DAILY',
    "SUMMARY:Daily DSA: today's LeetCode problem",
    `DESCRIPTION:Open today's problem: ${link}`,
    `URL:${link}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    "DESCRIPTION:Time for today's DSA problem",
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

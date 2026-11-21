// Talks to the server. The "sync code" (userId.token) is the login: it is kept
// in this browser and can be copied to other devices to share progress.

const KEY = 'dsa.syncCode';
let memoryCode = null;

export const auth = {
  get() {
    try {
      return localStorage.getItem(KEY) || memoryCode;
    } catch {
      return memoryCode;
    }
  },
  set(code) {
    memoryCode = code;
    try {
      localStorage.setItem(KEY, code);
    } catch {
      /* private mode: keep it in memory for this visit */
    }
  },
  clear() {
    memoryCode = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    navigator.serviceWorker?.controller?.postMessage('clear-data');
  },
  userId() {
    return (this.get() || '').split('.')[0] || null;
  },
};

export const SYNC_CODE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{20,100}$/;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, quiet401 = false } = {}) {
  const headers = { Accept: 'application/json' };
  const code = auth.get();
  if (code) headers.Authorization = `Bearer ${code}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, navigator.onLine ? 'Could not reach the server. It may be waking up - try again in a few seconds.' : "You're offline.");
  }

  window.dispatchEvent(new CustomEvent('dsa:data-source', { detail: { cached: res.headers.get('X-From-Cache') === '1' } }));

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 401 && !quiet401) window.dispatchEvent(new CustomEvent('dsa:unauthorized'));
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data;
}

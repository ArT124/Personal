import { api, auth } from './api.js';
import { html, toastError, toast } from './ui.js';
import { registerServiceWorker, resyncPush } from './notifications.js';
import { welcomeView, todayView, roadmapView, statsView, settingsView, linkView, aboutView, notFoundView } from './views.js';

const ROUTES = {
  '': { view: todayView, nav: 'today', title: 'Today', auth: true },
  roadmap: { view: roadmapView, nav: 'roadmap', title: 'Roadmap', auth: true },
  stats: { view: statsView, nav: 'stats', title: 'Stats', auth: true },
  settings: { view: settingsView, nav: 'settings', title: 'Settings', auth: true },
  about: { view: aboutView, nav: 'about', title: 'About' },
  welcome: { view: welcomeView, nav: null, title: 'Welcome' },
  link: { view: linkView, nav: null, title: 'Link device' },
};

const main = document.getElementById('main');
let curriculumPromise = null;

const ctx = {
  config: null,
  me: null,
  params: new URLSearchParams(),
  async refreshMe() {
    ctx.me = await api('/me');
    return ctx.me;
  },
  getCurriculum() {
    curriculumPromise ||= api('/curriculum').catch((err) => {
      curriculumPromise = null;
      throw err;
    });
    return curriculumPromise;
  },
  navigate(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  },
  applyTheme,
};

function applyTheme() {
  let theme = 'system';
  try {
    theme = localStorage.getItem('dsa.theme') || 'system';
  } catch {
    /* ignore */
  }
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = hash.split('?');
  return { path: path.replace(/\/$/, ''), params: new URLSearchParams(query) };
}

let routeToken = 0;
async function route() {
  const token = ++routeToken;
  const { path, params } = parseHash();
  const def = ROUTES[path];
  ctx.params = params;

  if (def?.auth && !auth.get()) return ctx.navigate('#/welcome');
  if (path === 'welcome' && auth.get()) return ctx.navigate('#/');

  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (def && a.dataset.nav === def.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = def ? `${def.title} · Daily DSA` : 'Not found · Daily DSA';
  main.onclick = main.onchange = main.oninput = null;

  if (!def) return notFoundView(main);

  try {
    if (def.auth && !ctx.me) await ctx.refreshMe();
    if (token !== routeToken) return;
    await def.view(main, ctx);
    if (token !== routeToken) return;
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  } catch (err) {
    if (token !== routeToken) return;
    if (err.status === 401) return;
    main.innerHTML = String(html`<div class="not-found"><h1>Couldn't load this page</h1><p class="muted">${err.message}</p><button class="btn btn-primary" id="retry">Try again</button></div>`);
    main.querySelector('#retry').onclick = route;
  }
}

// Account was deleted or the sync link was replaced on another device.
window.addEventListener('dsa:unauthorized', () => {
  if (!auth.get()) return;
  auth.clear();
  ctx.me = null;
  toast('This device was signed out (the sync link was changed or the account deleted). Start again or link with a new sync link.', { timeout: 8000 });
  ctx.navigate('#/welcome');
});

// Offline indicator
const offlineBanner = document.getElementById('offline-banner');
const updateOnline = () => (offlineBanner.hidden = navigator.onLine);
window.addEventListener('online', () => {
  updateOnline();
  route();
});
window.addEventListener('offline', updateOnline);
window.addEventListener('dsa:data-source', (e) => {
  if (e.detail.cached) offlineBanner.hidden = false;
  else updateOnline();
});

// "Install app" button (Chrome, Edge, Android)
let installEvent = null;
const installBtn = document.getElementById('install-btn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => {
  installBtn.hidden = true;
  toast('Daily DSA installed!');
});

// When the app comes back to the foreground (e.g. after solving on LeetCode), refresh Today.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && parseHash().path === '' && auth.get()) route();
});

async function start() {
  applyTheme();
  updateOnline();
  registerServiceWorker();
  try {
    ctx.config = await api('/config');
  } catch (err) {
    main.innerHTML = String(html`<div class="not-found"><h1>Can't reach Daily DSA</h1><p class="muted">${err.message}</p><button class="btn btn-primary" id="retry">Try again</button></div>`);
    main.querySelector('#retry').onclick = () => location.reload();
    return;
  }
  window.addEventListener('hashchange', route);
  await route();
  if (auth.get() && ctx.me) resyncPush(ctx.config.vapidPublicKey, ctx.me.settings.notifications);
}

start().catch(toastError);

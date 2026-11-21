import { api, auth, SYNC_CODE_RE } from './api.js';
import { html, raw, icons, toast, toastError, confirmDialog, greeting, formatDate, formatTime, plural, setBusy } from './ui.js';
import { pushSupport, enablePush, disablePush, currentSubscription, buildCalendarFile, downloadFile, resyncPush } from './notifications.js';

const STATUS_LABEL = { todo: 'To do', solved: 'Solved', revise: 'Solved · revise later', skipped: 'Skipped' };
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

const diffPill = (d) => html`<span class="pill diff-${d}">${d}</span>`;
const leetLink = (p, label = 'Solve on LeetCode', cls = 'btn btn-primary') =>
  html`<a class="${cls}" href="${p.url}" target="_blank" rel="noopener noreferrer" data-action="open-leetcode">${label} ${icons.external}</a>`;
const bar = (done, total, cls = '') => {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return html`<div class="bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" data-w="${pct}"><span></span></div>`;
};
// Progress widths are set from JS (the CSP blocks inline style attributes).
function applyBars(root) {
  root.querySelectorAll('.bar[data-w]').forEach((el) => el.firstElementChild.style.setProperty('--w', `${el.dataset.w}%`));
}
function streakChip(streak) {
  const cold = streak.current === 0;
  const title = streak.practisedToday ? 'You practised today' : streak.current ? 'Solve one today to keep your streak' : 'Solve a problem to start a streak';
  return html`<div class="streak-chip ${cold ? 'is-cold' : ''}" title="${title}">${icons.flame}<span>${plural(streak.current, 'day')}</span><span class="visually-hidden">streak</span></div>`;
}
function statusDot(p) {
  return html`<button type="button" class="status-dot" data-status="${p.status}" data-action="toggle-solved" data-slug="${p.slug}"
    aria-label="${p.status === 'todo' ? `Mark ${p.title} solved` : `${p.title}: ${STATUS_LABEL[p.status]}. Click to undo`}">${icons.check}</button>`;
}

// ====================================================================
// Welcome / onboarding
// ====================================================================

export async function welcomeView(root, ctx) {
  const { topics } = await ctx.getCurriculum();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  root.innerHTML = String(html`
    <div class="welcome">
      <div class="welcome-hero">
        <img src="/icons/icon.svg" width="64" height="64" alt="" />
        <h1>One LeetCode problem a day, in the right order</h1>
        <p>Daily DSA walks you through ${ctx.config.totalProblems} hand-picked problems, from arrays to dynamic programming, and reminds you every day.</p>
      </div>
      <ul class="feature-list">
        <li>${icons.check}<span>A new problem each day that builds on the last one, with a link straight to LeetCode.</span></li>
        <li>${icons.check}<span>Daily reminder notification on your phone and computer, plus an optional evening nudge.</span></li>
        <li>${icons.check}<span>Streaks, revision of old problems, and progress stats. No sign-up or password.</span></li>
      </ul>
      <form class="card form-grid" id="welcome-form">
        <h2>Set up your plan</h2>
        <div class="field">
          <label for="w-name">Your name <span class="muted small">(optional)</span></label>
          <input id="w-name" type="text" maxlength="40" autocomplete="given-name" placeholder="e.g. Sam" />
        </div>
        <div class="field">
          <label for="w-topic">Where should you start?</label>
          <select id="w-topic">
            ${topics.map((t, i) => html`<option value="${t.id}">${i + 1}. ${t.name}${i === 0 ? ' (new to DSA)' : ''}</option>`)}
          </select>
          <p class="help">Start at the beginning if you're new. Skip ahead if you already know the basics; earlier topics come back at the end.</p>
        </div>
        <div class="field">
          <span class="label" id="w-goal-label">Problems per day</span>
          <div class="segmented" role="radiogroup" aria-labelledby="w-goal-label">
            ${[1, 2, 3].map((n) => html`<label><input type="radio" name="goal" value="${n}" ${n === 1 ? raw('checked') : ''} /><span>${n}</span></label>`)}
          </div>
        </div>
        <div class="field">
          <label for="w-time">Daily reminder time</label>
          <input id="w-time" type="time" value="09:00" required />
          <p class="help">Your time zone: ${tz}</p>
        </div>
        <button class="btn btn-primary" type="submit">Start learning</button>
      </form>
      <div class="card card-muted section">
        <h3>Already using Daily DSA on another device?</h3>
        <p class="muted small">Open Settings → Devices &amp; sync on that device and copy your sync link, or paste the code here.</p>
        <form id="link-form" class="btn-row">
          <input type="text" id="link-code" placeholder="Paste sync link or code" aria-label="Sync link or code" autocomplete="off" />
          <button class="btn" type="submit">Link this device</button>
        </form>
      </div>
      <footer class="site-footer"><a href="#/about">How it works &amp; privacy</a></footer>
    </div>`);

  root.querySelector('#welcome-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter || root.querySelector('#welcome-form button[type=submit]');
    setBusy(btn, true);
    try {
      const settings = {
        name: root.querySelector('#w-name').value.trim(),
        startTopic: root.querySelector('#w-topic').value,
        dailyGoal: Number(root.querySelector('input[name=goal]:checked').value),
        reminderTime: root.querySelector('#w-time').value || '09:00',
        timezone: tz,
      };
      const res = await api('/users', { method: 'POST', body: { settings } });
      auth.set(res.syncCode);
      await ctx.refreshMe();
      toast("You're all set. Here's your first problem!");
      ctx.navigate('#/');
    } catch (err) {
      toastError(err);
      setBusy(btn, false);
    }
  };
  root.querySelector('#link-form').onsubmit = (e) => {
    e.preventDefault();
    const code = extractCode(root.querySelector('#link-code').value);
    if (!code) return toast('That does not look like a sync code.', { error: true });
    ctx.navigate(`#/link?code=${encodeURIComponent(code)}`);
  };
}

function extractCode(text) {
  const value = String(text || '').trim();
  const m = /code=([^&\s]+)/.exec(value);
  const code = m ? decodeURIComponent(m[1]) : value;
  return SYNC_CODE_RE.test(code) ? code : null;
}

// ====================================================================
// Today
// ====================================================================

export async function todayView(root, ctx) {
  const data = await api('/today');
  const sub = await currentSubscription().catch(() => null);
  renderToday(root, ctx, data, Boolean(sub));
}

function notificationBanner(ctx, settings, subscribed) {
  if (subscribed || store.get('dsa.hideNotifBanner') === '1') return '';
  const s = pushSupport();
  const dismiss = html`<button type="button" class="btn btn-small btn-ghost" data-action="dismiss-banner">Not now</button>`;
  if (s.needsInstallFirst) {
    return html`<div class="banner">${icons.phone}<div class="banner-body"><strong>Get daily reminders on iPhone</strong>
      <p>Tap Share, then "Add to Home Screen". Open Daily DSA from your home screen and turn on reminders there.</p>
      <div class="btn-row"><a class="btn btn-small" href="#/about">How to install</a>${dismiss}</div></div></div>`;
  }
  if (!s.supported || s.permission === 'denied') {
    return html`<div class="banner banner-warn">${icons.calendar}<div class="banner-body"><strong>${s.permission === 'denied' ? 'Notifications are blocked' : 'Notifications are not available here'}</strong>
      <p>${s.permission === 'denied' ? 'Allow notifications for this site in your browser settings, or ' : 'You can '}add a daily calendar reminder that opens today's problem.</p>
      <div class="btn-row"><button type="button" class="btn btn-small" data-action="calendar">Add calendar reminder</button>${dismiss}</div></div></div>`;
  }
  return html`<div class="banner">${icons.bell}<div class="banner-body"><strong>Turn on your daily reminder</strong>
    <p>Get a notification at ${formatTime(settings.reminderTime)} with today's problem. Tap it to go straight to LeetCode.</p>
    <div class="btn-row"><button type="button" class="btn btn-small btn-primary" data-action="enable-push">Turn on reminders</button>${dismiss}</div></div></div>`;
}

function problemCard(p, index, count, total) {
  const done = p.status !== 'todo';
  return html`
    <article class="card problem-card ${done ? 'is-done' : ''}" aria-labelledby="pt-${p.slug}">
      <div class="problem-meta">
        <span class="pill pill-accent">${count > 1 ? `Problem ${index + 1} of ${count} · ` : ''}#${p.order + 1} of ${total}</span>
        <span class="pill">${p.topicName}</span>
        ${diffPill(p.difficulty)}
      </div>
      <h2 class="problem-title" id="pt-${p.slug}">
        <a href="${p.url}" target="_blank" rel="noopener noreferrer" data-action="open-leetcode">${p.title}</a>
      </h2>
      <div class="problem-num">LeetCode ${p.num}</div>
      <details class="hint"><summary>Show hint</summary><p>${p.hint}</p></details>
      ${
        done
          ? html`<div class="problem-actions">
              <span class="done-ribbon">${icons.check} ${STATUS_LABEL[p.status]}</span>
              ${leetLink(p, 'Open on LeetCode', 'btn')}
              <button type="button" class="btn btn-ghost" data-action="status" data-status="todo" data-slug="${p.slug}">${icons.undo} Undo</button>
            </div>`
          : html`<div class="problem-actions">
              ${leetLink(p)}
              <button type="button" class="btn" data-action="status" data-status="solved" data-slug="${p.slug}">${icons.check} Mark solved</button>
              <button type="button" class="btn" data-action="status" data-status="revise" data-slug="${p.slug}" title="Solved it, but want to see it again soon">${icons.repeat} Solved, revise later</button>
              <button type="button" class="btn btn-ghost" data-action="status" data-status="skipped" data-slug="${p.slug}" title="I already know this one">${icons.skip} Skip</button>
            </div>`
      }
    </article>`;
}

function miniRow(p, extra = '') {
  return html`<li class="problem-row">
    ${statusDot(p)}
    <div class="row-main">
      <a class="row-title" href="${p.url}" target="_blank" rel="noopener noreferrer">${p.title}</a>
      <div class="row-sub">${p.topicName} · LeetCode ${p.num}${p.reason ? ` · ${p.reason}` : ''}</div>
    </div>
    <div class="row-actions">${diffPill(p.difficulty)}${extra}</div>
  </li>`;
}

function renderToday(root, ctx, data, subscribed) {
  const { problems, recommendations: rec, streak, progress, settings } = data;
  root.innerHTML = String(html`
    <div class="page-head">
      <div><h1>${greeting(settings.name)}</h1><p>${formatDate(data.date)}</p></div>
      ${streakChip(streak)}
    </div>
    ${notificationBanner(ctx, settings, subscribed)}
    ${
      data.roadmapComplete
        ? html`<div class="banner banner-success">${icons.trophy}<div class="banner-body"><strong>You finished the whole roadmap!</strong>
            <p>Amazing work. Keep your skills sharp with the revision problems below, or reset your progress in Settings to go again.</p></div></div>`
        : ''
    }
    ${
      data.allDone
        ? html`<div class="banner banner-success">${icons.trophy}<div class="banner-body"><strong>Today's goal done${streak.current > 1 ? ` - ${streak.current}-day streak!` : '!'}</strong>
            <p>Come back tomorrow for the next one, or keep going now.</p>
            <button type="button" class="btn btn-small btn-primary" data-action="bonus">${icons.plus} Give me one more</button></div></div>`
        : ''
    }
    <section aria-label="Today's problems">
      ${problems.map((p, i) => problemCard(p, i, problems.length, progress.total))}
    </section>

    <div class="card card-muted section">
      <div class="progress-line"><span><strong>${progress.solved}</strong> of ${progress.total} solved (${progress.percent}%)</span>
      <span>${progress.estimatedDaysLeft > 0 ? `about ${plural(progress.estimatedDaysLeft, 'day')} to go` : 'complete'}</span></div>
      ${bar(progress.solved, progress.total)}
    </div>

    <section class="section" aria-labelledby="rec-h">
      <h2 id="rec-h">Recommended for you</h2>
      <div class="grid-2">
        <div class="card">
          <h3>Revise</h3>
          ${
            rec.revision.length
              ? html`<ul class="problem-list">${rec.revision.map((p) =>
                  miniRow(p, html`<button type="button" class="btn btn-small" data-action="status" data-status="reviewed" data-slug="${p.slug}" title="I re-solved it">Done</button>`),
                )}</ul>`
              : html`<p class="muted small">Nothing to revise yet. Problems you solved come back here after 3, 7, 21 and 60 days, so you don't forget them.</p>`
          }
        </div>
        <div class="card">
          <h3>Up next in your roadmap</h3>
          ${rec.upNext.length ? html`<ul class="problem-list">${rec.upNext.map((p) => miniRow(p))}</ul>` : html`<p class="muted small">You're at the end of the roadmap.</p>`}
        </div>
      </div>
      ${
        rec.stretch
          ? html`<div class="card section"><h3>Stretch goal</h3><p class="muted small">Feeling strong? A harder problem from the same topic.</p>
              <ul class="problem-list">${miniRow(rec.stretch)}</ul></div>`
          : ''
      }
    </section>`);
  applyBars(root);

  const update = (next) => renderToday(root, ctx, next, subscribed);
  root.onclick = async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'open-leetcode') {
      toast('Good luck! Come back here and mark it when you are done.');
      return;
    }
    if (action === 'status' || action === 'toggle-solved') {
      const slug = el.dataset.slug;
      const status = action === 'toggle-solved' ? (el.dataset.status === 'todo' ? 'solved' : 'todo') : el.dataset.status;
      setBusy(el, true);
      try {
        const next = await api(`/problems/${slug}/status`, { method: 'POST', body: { status } });
        update(next);
        if (status === 'solved' || status === 'revise') {
          toast(status === 'revise' ? "Nice! It'll come back for revision soon." : 'Solved! Great work.', {
            action: {
              label: 'Undo',
              onClick: async () => update(await api(`/problems/${slug}/status`, { method: 'POST', body: { status: 'todo' } })),
            },
          });
        } else if (status === 'skipped') toast('Skipped. It will not be suggested again.');
        else if (status === 'reviewed') toast('Revision logged. See you again later!');
      } catch (err) {
        toastError(err);
        setBusy(el, false);
      }
    }
    if (action === 'bonus') {
      setBusy(el, true);
      try {
        update(await api('/today/bonus', { method: 'POST' }));
        toast('Added another problem for today.');
      } catch (err) {
        toastError(err);
        setBusy(el, false);
      }
    }
    if (action === 'enable-push') {
      setBusy(el, true);
      try {
        await enablePush(ctx.config.vapidPublicKey);
        toast(`Reminders on! You'll get one every day at ${formatTime(settings.reminderTime)}.`);
        subscribed = true;
        update(data);
      } catch (err) {
        toastError(err);
        setBusy(el, false);
      }
    }
    if (action === 'dismiss-banner') {
      store.set('dsa.hideNotifBanner', '1');
      el.closest('.banner')?.remove();
    }
    if (action === 'calendar') downloadCalendar(ctx, settings);
  };
}

function downloadCalendar(ctx, settings) {
  downloadFile(
    'daily-dsa-reminder.ics',
    buildCalendarFile({ appUrl: ctx.config.appUrl, userId: auth.userId(), time: settings.reminderTime, timezone: settings.timezone }),
    'text/calendar',
  );
  toast('Open the downloaded file to add the daily reminder to your calendar.');
}

// ====================================================================
// Roadmap
// ====================================================================

export async function roadmapView(root, ctx) {
  const { topics } = await api('/curriculum');
  const startIndex = Math.max(0, topics.findIndex((t) => t.id === ctx.me.settings.startTopic));
  const ordered = [...topics.slice(startIndex), ...topics.slice(0, startIndex)];
  const currentTopic = ordered.find((t) => t.problems.some((p) => p.status === 'todo'))?.id;
  const open = new Set([currentTopic]);
  const filter = { q: '', difficulty: '', status: '' };

  root.innerHTML = String(html`
    <div class="page-head">
      <div><h1>Your roadmap</h1><p>${topics.length} topics in learning order. Each topic goes from easy to hard.</p></div>
    </div>
    <div class="filters" role="search">
      <div class="field field-search"><label class="visually-hidden" for="f-q">Search problems</label>
        <input id="f-q" type="search" placeholder="Search problems or topics" autocomplete="off" /></div>
      <div class="field"><label class="visually-hidden" for="f-d">Difficulty</label>
        <select id="f-d"><option value="">All difficulties</option><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
      <div class="field"><label class="visually-hidden" for="f-s">Status</label>
        <select id="f-s"><option value="">Any status</option><option value="todo">To do</option><option value="solved">Solved</option><option value="revise">Revise later</option><option value="skipped">Skipped</option></select></div>
    </div>
    <div id="topics"></div>`);

  const list = root.querySelector('#topics');

  function matches(p, t) {
    if (filter.difficulty && p.difficulty !== filter.difficulty) return false;
    if (filter.status && p.status !== filter.status) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      return p.title.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || String(p.num) === q;
    }
    return true;
  }

  function draw() {
    const filtering = Boolean(filter.q || filter.difficulty || filter.status);
    const blocks = topics
      .map((t, i) => {
        const shown = t.problems.filter((p) => matches(p, t));
        if (filtering && !shown.length) return '';
        const done = t.problems.filter((p) => p.status === 'solved' || p.status === 'revise').length;
        const complete = t.problems.every((p) => p.status !== 'todo');
        const isOpen = filtering || open.has(t.id);
        return html`<details class="topic ${t.id === currentTopic ? 'is-current' : ''} ${complete ? 'is-complete' : ''}" data-topic="${t.id}" ${isOpen ? raw('open') : ''}>
          <summary>
            <span class="topic-index">${complete ? icons.check : i + 1}</span>
            <span class="topic-name">${t.name}${t.id === currentTopic ? html` <span class="pill pill-accent">You are here</span>` : ''}${t.id === ctx.me.settings.startTopic && i > 0 ? html` <span class="pill">Start</span>` : ''}</span>
            <span class="topic-count">${done}/${t.problems.length}</span>
            <span class="topic-bar">${bar(done, t.problems.length)}</span>
          </summary>
          <div class="topic-body">
            <p class="topic-summary">${t.summary}</p>
            <ul class="problem-list">${shown.map(
              (p) => html`<li class="problem-row">
                ${statusDot(p)}
                <div class="row-main">
                  <a class="row-title" href="${p.url}" target="_blank" rel="noopener noreferrer">${p.title}</a>
                  <div class="row-sub">LeetCode ${p.num} · ${p.hint}</div>
                </div>
                <div class="row-actions">
                  ${diffPill(p.difficulty)}
                  <label class="visually-hidden" for="s-${p.slug}">Status of ${p.title}</label>
                  <select id="s-${p.slug}" class="btn-small" data-action="set-status" data-slug="${p.slug}">
                    ${Object.entries({ todo: 'To do', solved: 'Solved', revise: 'Revise', skipped: 'Skip' }).map(
                      ([v, l]) => html`<option value="${v}" ${p.status === v ? raw('selected') : ''}>${l}</option>`,
                    )}
                  </select>
                </div>
              </li>`,
            )}</ul>
          </div>
        </details>`;
      })
      .filter(Boolean);
    list.innerHTML = blocks.length ? String(html`${blocks}`) : '<p class="empty">No problems match these filters.</p>';
    applyBars(list);
  }
  draw();

  list.addEventListener('toggle', (e) => {
    const t = e.target.closest('details.topic');
    if (!t || filter.q || filter.difficulty || filter.status) return;
    if (t.open) open.add(t.dataset.topic);
    else open.delete(t.dataset.topic);
  }, true);

  async function setStatus(slug, status, el) {
    setBusy(el, true);
    try {
      await api(`/problems/${slug}/status`, { method: 'POST', body: { status } });
      for (const t of topics) for (const p of t.problems) if (p.slug === slug) p.status = status;
      draw();
      document.getElementById(`s-${slug}`)?.focus();
    } catch (err) {
      toastError(err);
      setBusy(el, false);
    }
  }

  root.onclick = (e) => {
    const el = e.target.closest('[data-action="toggle-solved"]');
    if (el) setStatus(el.dataset.slug, el.dataset.status === 'todo' ? 'solved' : 'todo', el);
  };
  root.onchange = (e) => {
    if (e.target.matches('[data-action="set-status"]')) setStatus(e.target.dataset.slug, e.target.value, e.target);
    if (e.target.id === 'f-d') { filter.difficulty = e.target.value; draw(); }
    if (e.target.id === 'f-s') { filter.status = e.target.value; draw(); }
  };
  root.oninput = (e) => {
    if (e.target.id === 'f-q') { filter.q = e.target.value.trim(); draw(); }
  };
}

// ====================================================================
// Stats
// ====================================================================

export async function statsView(root) {
  const s = await api('/stats');
  const firstDay = new Date(`${s.heatmap[0].date}T12:00:00`).getDay(); // 0 = Sunday
  const pad = (firstDay + 6) % 7; // weeks start on Monday
  const level = (n) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);
  const activeDays = s.heatmap.filter((d) => d.count > 0).length;

  root.innerHTML = String(html`
    <div class="page-head"><div><h1>Your stats</h1><p>Member since ${new Date(s.memberSince).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p></div></div>
    <div class="tiles">
      <div class="tile"><div class="tile-value">${s.streak.current}</div><div class="tile-label">Current streak (days)</div></div>
      <div class="tile"><div class="tile-value">${s.streak.longest}</div><div class="tile-label">Longest streak</div></div>
      <div class="tile"><div class="tile-value">${s.solved}<span class="muted small">/${s.total}</span></div><div class="tile-label">Problems solved</div></div>
      <div class="tile"><div class="tile-value">${s.remaining ? s.estimatedDaysLeft : 0}</div><div class="tile-label">Days to finish at your pace</div></div>
    </div>

    <section class="card section" aria-labelledby="h-act">
      <h2 id="h-act">Last 12 weeks</h2>
      <p class="muted small">${plural(activeDays, 'active day')} in the last 12 weeks.</p>
      <div class="heatmap-wrap">
        <div class="heatmap" role="img" aria-label="Activity over the last 12 weeks: ${plural(activeDays, 'active day')}">
          ${Array.from({ length: pad }, () => raw('<span aria-hidden="true" class="pad"></span>'))}
          ${s.heatmap.map((d, i) => html`<span data-level="${level(d.count)}" class="${i === s.heatmap.length - 1 ? 'is-today' : ''}" title="${d.date}: ${plural(d.count, 'problem')}"></span>`)}
        </div>
      </div>
      <div class="legend" aria-hidden="true">Less <span></span><span></span><span></span><span></span> More</div>
    </section>

    <div class="grid-2 section">
      <section class="card" aria-labelledby="h-diff">
        <h2 id="h-diff">By difficulty</h2>
        ${['Easy', 'Medium', 'Hard'].map(
          (d) => html`<div class="stat-row"><div class="progress-line"><span>${d}</span><span>${s.byDifficulty[d].done}/${s.byDifficulty[d].total}</span></div>${bar(s.byDifficulty[d].done, s.byDifficulty[d].total, `bar-${d}`)}</div>`,
        )}
        <hr class="divider section" />
        <p class="muted small">${s.revise} marked for revision · ${s.skipped} skipped</p>
      </section>
      <section class="card" aria-labelledby="h-top">
        <h2 id="h-top">By topic</h2>
        ${s.topics.map(
          (t) => html`<div class="stat-row"><div class="progress-line"><span>${t.name}</span><span>${t.done}/${t.total}</span></div>${bar(t.done, t.total)}</div>`,
        )}
      </section>
    </div>`);
  root.querySelectorAll('.heatmap .pad').forEach((el) => el.style.setProperty('visibility', 'hidden'));
  applyBars(root);
}

// ====================================================================
// Settings
// ====================================================================

export async function settingsView(root, ctx) {
  const { topics } = await ctx.getCurriculum();
  const me = await api('/me');
  const s = me.settings;
  const support = pushSupport();
  const sub = await currentSubscription().catch(() => null);
  const zones = (() => {
    const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return list.includes(s.timezone) ? list : [s.timezone, ...list];
  })();
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const theme = store.get('dsa.theme') || 'system';

  let pushStatus;
  if (sub) pushStatus = html`<span class="pill diff-Easy">On for this device</span>`;
  else if (support.needsInstallFirst) pushStatus = html`<span class="pill">Install to Home Screen first</span>`;
  else if (!support.supported) pushStatus = html`<span class="pill">Not supported in this browser</span>`;
  else if (support.permission === 'denied') pushStatus = html`<span class="pill diff-Hard">Blocked in browser settings</span>`;
  else pushStatus = html`<span class="pill">Off for this device</span>`;

  root.innerHTML = String(html`
    <div class="page-head"><div><h1>Settings</h1><p>Changes save automatically.</p></div></div>

    <section class="card settings-section form-grid" aria-labelledby="h-rem">
      <h2 id="h-rem">${icons.bell} Reminders</h2>
      <div class="switch-row">
        <div><div class="label">Push notifications on this device</div><div class="small muted">${pushStatus} · ${plural(me.devicesWithNotifications, 'device')} signed up in total</div></div>
        ${
          sub
            ? html`<button type="button" class="btn btn-small" data-action="disable-push">Turn off</button>`
            : html`<button type="button" class="btn btn-small btn-primary" data-action="enable-push" ${!support.supported || support.needsInstallFirst ? raw('disabled') : ''}>Turn on</button>`
        }
      </div>
      ${support.needsInstallFirst ? html`<p class="help">iPhone/iPad: tap Share → "Add to Home Screen", then open Daily DSA from the home screen to turn on notifications (iOS 16.4 or newer).</p>` : ''}
      <div class="switch-row">
        <div><div class="label" id="l-notif">Send me reminders</div><div class="small muted">Master switch for all devices.</div></div>
        <label class="switch"><input type="checkbox" data-setting="notifications" aria-labelledby="l-notif" ${s.notifications ? raw('checked') : ''} /><span></span></label>
      </div>
      <div class="field">
        <label for="st-time">Daily reminder time</label>
        <input id="st-time" type="time" data-setting="reminderTime" value="${s.reminderTime}" />
      </div>
      <div class="switch-row">
        <div><div class="label" id="l-nudge">Evening nudge</div><div class="small muted">A second reminder only if today's problem isn't done yet.</div></div>
        <label class="switch"><input type="checkbox" data-setting="nudge" aria-labelledby="l-nudge" ${s.nudge ? raw('checked') : ''} /><span></span></label>
      </div>
      <div class="field">
        <label for="st-nudge">Nudge time</label>
        <input id="st-nudge" type="time" data-setting="nudgeTime" value="${s.nudgeTime}" />
        <p class="help">Must be later than the daily reminder.</p>
      </div>
      <div class="field">
        <label for="st-tz">Time zone</label>
        <select id="st-tz" data-setting="timezone">${zones.map((z) => html`<option ${z === s.timezone ? raw('selected') : ''}>${z}</option>`)}</select>
        ${deviceTz && deviceTz !== s.timezone ? html`<p class="help">This device is in ${deviceTz}. <button type="button" class="link-btn" data-action="use-device-tz">Use it</button></p>` : ''}
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-small" data-action="test-push" ${me.devicesWithNotifications ? '' : raw('disabled')}>Send a test notification</button>
        <button type="button" class="btn btn-small" data-action="calendar">${icons.calendar} Add calendar reminder</button>
      </div>
      <p class="help">The calendar reminder works everywhere (even without notifications). Its link opens today's problem on LeetCode directly.</p>
    </section>

    <section class="card settings-section form-grid" aria-labelledby="h-plan">
      <h2 id="h-plan">${icons.map} Daily plan</h2>
      <div class="field">
        <span class="label" id="l-goal">Problems per day</span>
        <div class="segmented" role="radiogroup" aria-labelledby="l-goal">
          ${[1, 2, 3, 4, 5].map((n) => html`<label><input type="radio" name="dailyGoal" data-setting="dailyGoal" value="${n}" ${s.dailyGoal === n ? raw('checked') : ''} /><span>${n}</span></label>`)}
        </div>
      </div>
      <div class="field">
        <label for="st-topic">Start from topic</label>
        <select id="st-topic" data-setting="startTopic">${topics.map((t, i) => html`<option value="${t.id}" ${t.id === s.startTopic ? raw('selected') : ''}>${i + 1}. ${t.name}</option>`)}</select>
        <p class="help">Earlier topics are not lost; they come after the rest of the roadmap.</p>
      </div>
      <div class="field">
        <label for="st-name">Your name</label>
        <input id="st-name" type="text" maxlength="40" data-setting="name" value="${s.name}" placeholder="Shown in the greeting" />
      </div>
    </section>

    <section class="card settings-section form-grid" aria-labelledby="h-look">
      <h2 id="h-look">${icons.sparkle} Appearance</h2>
      <div class="segmented" role="radiogroup" aria-labelledby="h-look">
        ${['system', 'light', 'dark'].map((t) => html`<label><input type="radio" name="theme" value="${t}" ${theme === t ? raw('checked') : ''} /><span>${t[0].toUpperCase() + t.slice(1)}</span></label>`)}
      </div>
    </section>

    <section class="card settings-section form-grid" aria-labelledby="h-sync">
      <h2 id="h-sync">${icons.devices} Devices &amp; sync</h2>
      <p class="muted small">There is no password. Your <strong>sync link</strong> is your key: open it on your phone or another computer to see the same progress there. Keep it private.</p>
      <div id="sync-box" hidden>
        <div class="code-box" id="sync-link"></div>
        <div class="btn-row section">
          <button type="button" class="btn btn-small" data-action="copy-sync">Copy link</button>
          ${navigator.share ? html`<button type="button" class="btn btn-small" data-action="share-sync">Share…</button>` : ''}
        </div>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-small" data-action="show-sync">Show my sync link</button>
        <button type="button" class="btn btn-small btn-ghost" data-action="rotate-sync">Make a new link</button>
      </div>
      <p class="help">"Make a new link" signs out every other device that used the old one.</p>
      <hr class="divider" />
      <form id="link-form" class="field">
        <label for="link-code">Use a sync link from another device</label>
        <div class="btn-row"><input id="link-code" type="text" autocomplete="off" placeholder="Paste sync link or code" /><button class="btn btn-small" type="submit">Link</button></div>
      </form>
    </section>

    <section class="card settings-section form-grid" aria-labelledby="h-data">
      <h2 id="h-data">${icons.download} Your data</h2>
      <div class="btn-row">
        <button type="button" class="btn btn-small" data-action="export">Export progress (JSON)</button>
        <label class="btn btn-small" for="import-file">Import progress</label>
        <input id="import-file" type="file" accept="application/json,.json" class="visually-hidden" />
      </div>
      <hr class="divider" />
      <div class="btn-row">
        <button type="button" class="btn btn-small btn-danger" data-action="reset">Reset progress</button>
        <button type="button" class="btn btn-small btn-danger" data-action="forget">Sign out of this device</button>
        <button type="button" class="btn btn-small btn-danger" data-action="delete">Delete my data</button>
      </div>
    </section>
    <footer class="site-footer">Daily DSA · <a href="#/about">About &amp; privacy</a></footer>`);

  const save = async (changes) => {
    try {
      const res = await api('/me/settings', { method: 'PATCH', body: changes });
      ctx.me = res;
      toast('Saved');
      return true;
    } catch (err) {
      toastError(err);
      return false;
    }
  };

  let nameTimer;
  root.oninput = (e) => {
    if (e.target.dataset.setting === 'name') {
      clearTimeout(nameTimer);
      nameTimer = setTimeout(() => save({ name: e.target.value }), 700);
    }
  };
  root.onchange = async (e) => {
    const el = e.target;
    if (el.name === 'theme') {
      store.set('dsa.theme', el.value);
      ctx.applyTheme();
      return;
    }
    if (el.id === 'import-file' && el.files[0]) {
      try {
        const data = JSON.parse(await el.files[0].text());
        if (!(await confirmDialog({ title: 'Import progress?', text: 'This replaces the progress currently saved for your account.', okText: 'Import', danger: true }))) return;
        const res = await api('/me/import', { method: 'POST', body: data });
        toast(`Imported ${plural(res.imported, 'problem')}.`);
        settingsView(root, ctx);
      } catch (err) {
        toastError(err instanceof SyntaxError ? new Error('That file is not valid JSON.') : err);
      } finally {
        el.value = '';
      }
      return;
    }
    const key = el.dataset.setting;
    if (!key || key === 'name') return;
    let value = el.type === 'checkbox' ? el.checked : el.value;
    if (key === 'dailyGoal') value = Number(value);
    if ((key === 'reminderTime' || key === 'nudgeTime') && !value) return;
    const ok = await save({ [key]: value });
    if (!ok && el.type === 'checkbox') el.checked = !el.checked;
    if (ok && key === 'nudgeTime' && value <= ctx.me.settings.reminderTime) toast('Tip: the nudge only fires when it is later than the daily reminder.');
  };

  root.querySelector('#link-form').onsubmit = (e) => {
    e.preventDefault();
    const code = extractCode(root.querySelector('#link-code').value);
    if (!code) return toast('That does not look like a sync link.', { error: true });
    ctx.navigate(`#/link?code=${encodeURIComponent(code)}`);
  };

  const syncLink = (code) => `${ctx.config.appUrl}/#/link?code=${encodeURIComponent(code)}`;

  root.onclick = async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    try {
      if (action === 'enable-push') {
        setBusy(el, true);
        await enablePush(ctx.config.vapidPublicKey);
        toast('Notifications are on for this device.');
        return settingsView(root, ctx);
      }
      if (action === 'disable-push') {
        setBusy(el, true);
        await disablePush();
        toast('Notifications turned off for this device.');
        return settingsView(root, ctx);
      }
      if (action === 'test-push') {
        setBusy(el, true);
        const r = await api('/push/test', { method: 'POST' });
        toast(r.sent ? `Test sent to ${plural(r.sent, 'device')}. It should appear in a few seconds.` : 'No device could be reached. Try turning notifications off and on again.', { error: !r.sent });
        setBusy(el, false);
      }
      if (action === 'calendar') downloadCalendar(ctx, ctx.me.settings);
      if (action === 'use-device-tz') {
        if (await save({ timezone: deviceTz })) settingsView(root, ctx);
      }
      if (action === 'show-sync') {
        root.querySelector('#sync-link').textContent = syncLink(auth.get());
        root.querySelector('#sync-box').hidden = false;
        el.hidden = true;
      }
      if (action === 'copy-sync') {
        await navigator.clipboard.writeText(syncLink(auth.get()));
        toast('Sync link copied. Open it on your other device.');
      }
      if (action === 'share-sync') {
        await navigator.share({ title: 'Daily DSA sync link', text: 'Open this to sync my Daily DSA progress', url: syncLink(auth.get()) }).catch(() => {});
      }
      if (action === 'rotate-sync') {
        if (!(await confirmDialog({ title: 'Make a new sync link?', text: 'Other devices using the old link will be signed out and need the new link.', okText: 'Make new link' }))) return;
        const r = await api('/me/sync-code/rotate', { method: 'POST' });
        auth.set(r.syncCode);
        root.querySelector('#sync-link').textContent = syncLink(r.syncCode);
        root.querySelector('#sync-box').hidden = false;
        toast('New sync link created.');
      }
      if (action === 'export') {
        const data = await api('/me/export');
        downloadFile(`daily-dsa-progress-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
      }
      if (action === 'reset') {
        if (!(await confirmDialog({ title: 'Reset all progress?', text: 'Solved problems, streaks and history will be cleared. Settings stay. This cannot be undone.', okText: 'Reset', danger: true }))) return;
        await api('/me/reset', { method: 'POST' });
        toast('Progress reset. Fresh start!');
        ctx.navigate('#/');
      }
      if (action === 'forget') {
        if (!(await confirmDialog({ title: 'Sign out of this device?', text: 'Your data stays on the server. Make sure you have your sync link saved, or you will not be able to get back in.', okText: 'Sign out', danger: true }))) return;
        await disablePush().catch(() => {});
        auth.clear();
        ctx.me = null;
        ctx.navigate('#/welcome');
      }
      if (action === 'delete') {
        if (!(await confirmDialog({ title: 'Delete all your data?', text: 'Your account, progress and notification settings are permanently deleted from the server.', okText: 'Delete forever', danger: true }))) return;
        await disablePush().catch(() => {});
        await api('/me', { method: 'DELETE' });
        auth.clear();
        ctx.me = null;
        toast('Your data was deleted.');
        ctx.navigate('#/welcome');
      }
    } catch (err) {
      toastError(err);
      setBusy(el, false);
    }
  };
}

// ====================================================================
// Link a device
// ====================================================================

export async function linkView(root, ctx) {
  const code = extractCode(ctx.params.get('code'));
  if (!code) {
    root.innerHTML = String(html`<div class="not-found"><h1>That sync link is not valid</h1><p class="muted">Copy it again from Settings → Devices &amp; sync on your other device.</p><a class="btn btn-primary" href="#/">Go home</a></div>`);
    return;
  }
  const current = auth.get();
  if (current === code) {
    toast('This device is already linked.');
    return ctx.navigate('#/');
  }
  root.innerHTML = String(html`<div class="loading"><div class="spinner"></div><p>Linking…</p></div>`);
  const ok = await confirmDialog({
    title: 'Link this device?',
    text: current
      ? 'This device will switch to the account in the link. The progress currently shown here stays on the server and needs its own sync link to get back.'
      : 'This device will show the same progress and plan as your other device.',
    okText: 'Link device',
  });
  if (!ok) return ctx.navigate(current ? '#/' : '#/welcome');

  const hadSub = await currentSubscription().catch(() => null);
  if (current && hadSub) await disablePush().catch(() => {});
  auth.set(code);
  try {
    ctx.me = await api('/me', { quiet401: true });
  } catch (err) {
    if (current) auth.set(current);
    else auth.clear();
    toastError(new Error(err.status === 401 ? 'That sync link has expired or was replaced. Get a new one from your other device.' : err.message));
    return ctx.navigate(current ? '#/' : '#/welcome');
  }
  navigator.serviceWorker?.controller?.postMessage('clear-data');
  history.replaceState(null, '', '#/');
  toast('Device linked!');
  if (hadSub) resyncPush(ctx.config.vapidPublicKey, true);
  ctx.navigate('#/');
}

// ====================================================================
// About
// ====================================================================

export async function aboutView(root, ctx) {
  root.innerHTML = String(html`
    <article class="prose">
      <h1>About Daily DSA</h1>
      <p>Daily DSA gives you one LeetCode problem a day (or more, if you like), following the order most people learn data structures and algorithms. Each problem links straight to its LeetCode page.</p>

      <h2>How it works</h2>
      <ol>
        <li><strong>Roadmap.</strong> ${ctx.config.totalProblems} problems across 22 topics: Arrays → Hashing → Prefix Sum → Two Pointers → Sliding Window → Stack → Binary Search → Linked List → Recursion → Trees → BST → Heap → Backtracking → Tries → Graphs → Advanced Graphs → 1-D DP → 2-D DP → Greedy → Intervals → Bits → Math.</li>
        <li><strong>Today's problem</strong> is the next one you haven't done. It stays the same all day, so the morning notification and the site always match. If you don't finish it, it is still waiting tomorrow.</li>
        <li><strong>Mark it</strong> as Solved, "Solved, revise later" or Skip. Skipping is for problems you already know.</li>
        <li><strong>Revision.</strong> Solved problems come back after 3, 7, 21 and 60 days (spaced repetition), so the patterns stick.</li>
        <li><strong>Reminders.</strong> A push notification at your chosen time. Tapping it opens the LeetCode problem. An optional evening nudge comes only if you haven't finished yet.</li>
      </ol>

      <h2>Install it as an app</h2>
      <ul>
        <li><strong>Android (Chrome):</strong> menu ⋮ → "Install app" or "Add to Home screen".</li>
        <li><strong>iPhone / iPad (Safari):</strong> Share → "Add to Home Screen". Open it from the home screen to turn on notifications (iOS 16.4+).</li>
        <li><strong>Windows / Mac / Linux (Chrome or Edge):</strong> click the install icon in the address bar, or the "Install app" button at the top.</li>
      </ul>

      <h2>Use it on several devices</h2>
      <p>Open Settings → Devices &amp; sync, copy your sync link and open it on your other device. Both will share the same progress and each can get notifications.</p>

      <h2>Privacy</h2>
      <ul>
        <li>No email, password or real name needed. Your account is a random ID.</li>
        <li>We store only your settings, which problems you marked, and push subscription addresses for your devices.</li>
        <li>No ads, no trackers, no third-party scripts.</li>
        <li>Export or permanently delete your data any time in Settings.</li>
      </ul>

      <h2>FAQ</h2>
      <p><strong>I didn't get a notification.</strong> Check that notifications are allowed for this site (and for the browser in your phone settings), then use "Send a test notification" in Settings. Battery savers can delay notifications on some Android phones. The calendar reminder is a reliable backup.</p>
      <p><strong>Do I need a LeetCode account?</strong> Only to submit solutions on LeetCode. Daily DSA does not connect to your LeetCode account; you mark problems yourself.</p>
      <p class="muted small">Daily DSA is an independent study tool and is not affiliated with LeetCode. Problem titles link to their public pages on leetcode.com.</p>
    </article>`);
}

export function notFoundView(root) {
  root.innerHTML = String(html`<div class="not-found"><div class="big">404</div><h1>Page not found</h1><p class="muted">That page doesn't exist.</p><a class="btn btn-primary" href="#/">Go to today's problem</a></div>`);
}

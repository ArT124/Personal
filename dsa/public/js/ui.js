// Small UI helpers: safe HTML templates, icons, toasts and confirm dialogs.

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
export const raw = (s) => new SafeHtml(String(s));

function render(value) {
  if (value == null || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return esc(value);
}

/** Tagged template that escapes every value unless it is wrapped in raw() or html``. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += render(v) + strings[i + 1];
  });
  return new SafeHtml(out);
}

const svg = (body, extra = '') =>
  raw(`<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`);

export const icons = {
  check: svg('<path d="m5 12 5 5L20 7"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 'class="ext-icon"'),
  flame: raw(
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c.6 3.2-1 5.1-2.6 6.9C7.8 10.7 6 12.6 6 15.5A6 6 0 0 0 12 22a6 6 0 0 0 6-6.3c0-2.6-1.3-4.4-2.4-5.6-.3 1.5-1 2.7-2.1 3.4.4-3.9-.4-8.4-1.5-11.5Z"/></svg>',
  ),
  bell: svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  repeat: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  skip: svg('<path d="m5 4 10 8-10 8V4ZM19 5v14"/>'),
  undo: svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>'),
  phone: svg('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>'),
  calendar: svg('<path d="M8 2v3M16 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  sparkle: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  map: svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14"/>'),
  chart: svg('<path d="M4 20V10m6 10V4m6 16v-7m6 7H2"/>'),
  devices: svg('<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M6 18h6M17 9h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/>'),
  download: svg('<path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16"/>'),
};

// ---------- toasts ----------

export function toast(message, { error = false, action = null, timeout = 3500 } = {}) {
  const region = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast${error ? ' is-error' : ''}`;
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  let timer;
  const remove = () => {
    clearTimeout(timer);
    el.remove();
  };
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      remove();
      action.onClick();
    });
    el.append(btn);
  }
  region.append(el);
  timer = setTimeout(remove, action ? Math.max(timeout, 6000) : timeout);
}

export const toastError = (err) => toast(err?.message || String(err), { error: true, timeout: 5000 });

// ---------- dialogs ----------

export function confirmDialog({ title, text, okText = 'OK', cancelText = 'Cancel', danger = false }) {
  const dialog = document.getElementById('dialog');
  if (typeof dialog.showModal !== 'function') return Promise.resolve(window.confirm(`${title}\n\n${text}`));
  dialog.querySelector('#dialog-title').textContent = title;
  dialog.querySelector('#dialog-text').textContent = text;
  const ok = dialog.querySelector('#dialog-ok');
  const cancel = dialog.querySelector('#dialog-cancel');
  ok.textContent = okText;
  cancel.textContent = cancelText;
  cancel.hidden = cancelText === null;
  ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
  });
}

// ---------- formatting ----------

export function greeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

export function formatDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.setAttribute('aria-busy', busy ? 'true' : 'false');
}

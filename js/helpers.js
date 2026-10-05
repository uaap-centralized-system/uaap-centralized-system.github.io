/* Small shared helpers: dates and times, HTML building, forms, and messages. */

// ---------- Dates and times ----------

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** A Date as "YYYY-MM-DD" in local time. */
function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** A Date as "YYYY-MM" (used for Masterlist month/period). */
function toISOMonth(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function todayISO() {
  return toISODate(new Date());
}

/** Current time as "HH:MM" (24-hour), the format stored in records. */
function nowTime() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-10-05" → "Oct 5, 2026" */
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
}

/** "2026-10" → "October 2026" */
function formatPeriod(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** "14:05" → "2:05 PM" */
function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad2(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : (many || one + 's')}`;
}

// ---------- HTML building ----------

/** Escape text before putting it into HTML. */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * <option> tags for a dropdown. `options` can be plain strings or
 * { value, label } objects. Pass `placeholder` to add an empty first choice.
 */
function optionsHtml(options, selected, placeholder) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const first = placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '';
  return first + items.map((o) => (
    `<option value="${esc(o.value)}"${o.value === selected ? ' selected' : ''}>${esc(o.label)}</option>`
  )).join('');
}

/** A labelled form field. `control` must be an input/select with id="f-<name>". */
function fieldHtml({ name, label, required = false, control, hint = '' }) {
  const tag = required
    ? ' <span class="req" aria-hidden="true">*</span>'
    : ' <span class="optional">(optional)</span>';
  return `
    <div class="field" data-field="${name}">
      <label for="f-${name}">${esc(label)}${tag}</label>
      ${control}
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
      <p class="field-error"></p>
    </div>`;
}

const ICON_PATHS = {
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>',
  food: '<path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M8 12v9"/><path d="M17 21V3c-2 1.5-3 4-3 7v3h3"/>',
  car: '<path d="M5 17h14v-5l-2-5H7l-2 5v5z"/><path d="M5 12h14"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2"/><path d="M9 12h6M9 16h6"/>',
  logIn: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

// ---------- Forms ----------

/** All form values as a plain object, with text trimmed. */
function readForm(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    data[key] = typeof value === 'string' ? value.trim() : value;
  });
  return data;
}

/** Returns { fieldName: message } for every required field left blank. */
function checkRequired(data, labels) {
  const errors = {};
  Object.entries(labels).forEach(([key, label]) => {
    if (!data[key]) errors[key] = `Please fill in ${label}.`;
  });
  return errors;
}

/** Show messages under fields. Returns true when there are no errors. */
function showErrors(form, errors) {
  form.querySelectorAll('.field[data-field]').forEach((field) => {
    const message = errors[field.dataset.field] || '';
    field.classList.toggle('has-error', Boolean(message));
    field.querySelector('.field-error').textContent = message;
  });
  const firstBad = form.querySelector('.has-error input, .has-error select, .has-error textarea');
  if (firstBad) firstBad.focus();
  return Object.keys(errors).length === 0;
}

/**
 * Run a save with the button showing "Saving…". If it fails (e.g. no internet),
 * show the problem and give the button back so staff can try again.
 * Returns the result, or null if it failed.
 */
async function withSaving(button, work) {
  const label = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    return await work();
  } catch (err) {
    if (err.needsPasscode) {
      askForPasscode();
      return null;
    }
    console.error(err);
    toast(err.message || 'Could not save. Please try again.');
    button.disabled = false;
    button.innerHTML = label;
    return null;
  }
}

// ---------- Messages ----------

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3500);
}

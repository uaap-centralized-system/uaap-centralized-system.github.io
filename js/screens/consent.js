window.Screens = window.Screens || {};

// ===================== Parent-facing form (public, no passcode) =====================

// Kept after a submit so a parent sending forms for siblings doesn't retype them.
let consentFormDefaults = null;

/** The consent statement, worded like the paper form. Values are HTML-escaped. */
function consentStatementHtml(c) {
  const blank = (value, placeholder) => (value
    ? `<span class="fill">${esc(value)}</span>`
    : `<span class="fill fill--empty">${esc(placeholder)}</span>`);
  return `
    Please allow ${blank(c.childName, 'name of child')}, ${blank(c.childAge, 'age')} years old,
    ${blank(c.relationship, 'relation')} of ${blank(c.guardianName, 'name of guardian')},
    as an audience during the <strong>${esc(c.eventName)}</strong> held at
    <strong>${esc(c.venue)}</strong> on ${blank(c.gameDate && formatDate(c.gameDate), 'game date')}.`;
}

Screens.consentForm = function (el) {
  const d = consentFormDefaults || { gameDate: '', guardianName: '' };

  el.innerHTML = `
    <section class="consent-intro">
      <p class="eyebrow">Parent / Guardian Consent</p>
      <h1>Venue entry consent form</h1>
      <p>For minors watching <strong>${esc(CONSENT_FORM.eventName)}</strong>
        at <strong>${esc(CONSENT_FORM.venue)}</strong>.
        Please fill out <strong>one form for each child</strong>.</p>
    </section>

    <form class="card form consent-form" novalidate>
      ${fieldHtml({
        name: 'gameDate', label: 'Game date', required: true,
        control: `<input id="f-gameDate" name="gameDate" type="date" min="${todayISO()}" value="${esc(d.gameDate)}">`,
      })}
      ${fieldHtml({
        name: 'childName', label: "Child's full name", required: true,
        control: '<input id="f-childName" name="childName" type="text" autocomplete="off" maxlength="100">',
      })}
      <div class="form-row">
        ${fieldHtml({
          name: 'childAge', label: "Child's age", required: true,
          control: '<input id="f-childAge" name="childAge" type="number" min="0" max="99" step="1" inputmode="numeric">',
        })}
        ${fieldHtml({
          name: 'relationship', label: 'The child is your…', required: true,
          control: `<select id="f-relationship" name="relationship">
            ${optionsHtml(CONSENT_FORM.relationships, '', 'Choose one')}</select>`,
        })}
      </div>
      ${fieldHtml({
        name: 'guardianName', label: 'Your full name (parent or guardian)', required: true,
        control: `<input id="f-guardianName" name="guardianName" type="text" autocomplete="name" maxlength="100"
          value="${esc(d.guardianName)}">`,
      })}

      <div class="statement">
        <p class="statement-to">To: Security Officer</p>
        <p id="statement-text"></p>
        <p>${esc(CONSENT_FORM.liability)}</p>
      </div>

      <div class="field" data-field="agreed">
        <label class="check">
          <input type="checkbox" name="agreed" value="yes">
          <span>I am the child's parent or guardian, and I agree to the statement above.</span>
        </label>
        <p class="field-error"></p>
      </div>

      <div class="field" data-field="signature">
        <label>Your signature <span class="req" aria-hidden="true">*</span></label>
        <p class="hint">Sign with your finger or mouse in the box below.</p>
        <canvas class="signature-pad" aria-label="Signature area"></canvas>
        <div><button type="button" class="btn btn-secondary btn-small" id="clear-signature">Clear signature</button></div>
        <p class="field-error"></p>
      </div>

      <!-- Hidden from people; only spam bots fill this in. -->
      <div class="trap" aria-hidden="true">
        <label>Leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      </div>

      <p class="hint privacy-note">Your answers are used only to check venue entry for this event
        and can be seen only by UAAP staff.</p>
      <div class="form-actions">
        <button class="btn btn-primary btn-block" type="submit">${icon('check')} Submit Consent Form</button>
      </div>
    </form>`;

  const form = el.querySelector('form');
  const pad = signaturePad(form.querySelector('.signature-pad'));
  form.querySelector('#clear-signature').addEventListener('click', pad.clear);

  // Show the filled-in statement as they type.
  const statement = form.querySelector('#statement-text');
  const refresh = () => {
    statement.innerHTML = consentStatementHtml({ ...readForm(form), ...CONSENT_FORM });
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readForm(form);
    const errors = checkRequired(data, {
      gameDate: 'the game date',
      childName: "the child's name",
      childAge: "the child's age",
      relationship: 'how the child is related to you',
      guardianName: 'your name',
    });
    if (data.gameDate && data.gameDate < todayISO()) errors.gameDate = 'Please choose today or a future game date.';
    if (data.childAge && !/^\d{1,2}$/.test(data.childAge)) errors.childAge = 'Please enter the age in years, e.g. 12.';
    if (!data.agreed) errors.agreed = 'Please tick this box to agree.';
    if (pad.isEmpty()) errors.signature = 'Please sign in the box.';
    if (!showErrors(form, errors)) return;

    const saved = await withSaving(form.querySelector('[type=submit]'), () => Store.submitConsent({
      gameDate: data.gameDate,
      childName: data.childName,
      childAge: data.childAge,
      relationship: data.relationship,
      guardianName: data.guardianName,
      eventName: CONSENT_FORM.eventName,
      venue: CONSENT_FORM.venue,
      agreed: true,
      signature: pad.toImage(),
      website: data.website,
    }));
    if (!saved) return;
    consentFormDefaults = { gameDate: data.gameDate, guardianName: data.guardianName };

    el.innerHTML = `
      <div class="card success">
        <span class="success-icon">${icon('check')}</span>
        <h2>Consent form received</h2>
        <p><strong>${esc(saved.childName)}</strong> is on the list for
          <strong>${esc(formatDate(saved.gameDate))}</strong>.</p>
        <dl class="details">
          <div><dt>Reference number</dt><dd>${esc(saved.consentId)}</dd></div>
          <div><dt>Venue</dt><dd>${esc(CONSENT_FORM.venue)}</dd></div>
        </dl>
        <p class="hint">You can take a screenshot of this page to show at the entrance if asked.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="another">${icon('plus')} Fill out a form for another child</button>
        </div>
      </div>`;
    el.querySelector('#another').addEventListener('click', () => {
      Screens.consentForm(el);
      window.scrollTo(0, 0);
    });
    window.scrollTo(0, 0);
  });
};

// ===================== Staff: list and details (passcode) =====================

let consentListFilters = null;

Screens.consents = async function (el) {
  const all = await Store.listConsents();
  const f = consentListFilters || { date: todayISO(), search: '' };
  const parentLink = `${location.origin}${location.pathname}#/consent`;

  el.innerHTML = `
    <section class="card share">
      <h2>Link for parents</h2>
      <p class="hint">Send this to parents. They don't need a passcode, and they can't see anyone else's forms.</p>
      <div class="share-row">
        <input type="text" readonly value="${esc(parentLink)}" id="parent-link" aria-label="Link for parents">
        <button type="button" class="btn btn-primary" id="copy-link">Copy</button>
      </div>
    </section>

    <div class="filters card">
      ${dateFilterHtml('cs-date', f.date, 'Game date')}
      <div class="field">
        <label for="cs-search">Search</label>
        <input id="cs-search" type="search" placeholder="Child or guardian name" value="${esc(f.search)}">
      </div>
    </div>
    <p class="result-count" id="cs-count"></p>
    <div class="card card--flush">
      <table class="table table--stack table--clickable">
        <thead>
          <tr><th>Child</th><th>Age</th><th>Parent / Guardian</th><th>Relation</th><th>Submitted</th>
            <th><span class="sr-only">Open</span></th></tr>
        </thead>
        <tbody id="cs-rows"></tbody>
      </table>
    </div>`;

  const search = el.querySelector('#cs-search');
  const tbody = el.querySelector('#cs-rows');

  function update() {
    f.search = search.value;
    consentListFilters = { ...f };
    const q = f.search.trim().toLowerCase();
    const forDate = all.filter((c) => !f.date || c.gameDate === f.date);
    const shown = forDate
      .filter((c) => !q || c.childName.toLowerCase().includes(q) || c.guardianName.toLowerCase().includes(q))
      .sort((a, b) => a.childName.localeCompare(b.childName));

    const when = !f.date ? 'all dates' : (f.date === todayISO() ? 'today' : formatDate(f.date));
    el.querySelector('#cs-count').textContent = `${plural(forDate.length, 'child', 'children')} with consent for ${when}`;
    tbody.innerHTML = shown.length
      ? shown.map((c) => `
        <tr data-id="${esc(c.consentId)}">
          <td data-label="Child"><strong>${esc(c.childName)}</strong></td>
          <td data-label="Age">${esc(c.childAge)}</td>
          <td data-label="Parent / Guardian">${esc(c.guardianName)}</td>
          <td data-label="Relation">${esc(c.relationship)}</td>
          <td data-label="Submitted">${esc(formatDateTime(c.submittedAt))}</td>
          <td class="cell-action">
            <a class="btn btn-secondary btn-small" href="#/consents/${encodeURIComponent(c.consentId)}">View form</a>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="6" class="empty">${forDate.length ? 'No one matches your search.' : 'No consent forms for this date yet.'}</td></tr>`;
  }

  bindDateFilter(el, 'cs-date', (date) => {
    f.date = date;
    update();
  });
  search.addEventListener('input', update);

  // The whole row opens the form, not just the button.
  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (row && !e.target.closest('a')) location.hash = `#/consents/${encodeURIComponent(row.dataset.id)}`;
  });

  el.querySelector('#copy-link').addEventListener('click', async () => {
    const input = el.querySelector('#parent-link');
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (e) {
      input.select();
      document.execCommand('copy');
    }
    toast('Link copied. Paste it in a text or chat to parents.');
  });

  update();
};

Screens.consentDetail = async function (el, consentId) {
  const c = await Store.getConsent(decodeURIComponent(consentId));
  if (!c) {
    el.innerHTML = `
      <div class="card notice">
        <p>This consent form could not be found. It may have been deleted.</p>
        <a class="btn btn-secondary" href="#/consents">Back to Consent Forms</a>
      </div>`;
    return;
  }

  el.innerHTML = `
    <article class="card consent-doc">
      <div class="doc-head">
        <span class="doc-copy">Security Office Copy</span>
        <span>Ref. <strong>${esc(c.consentId)}</strong></span>
      </div>
      <div class="doc-to">
        <p>To: Security Officer</p>
        <p>Date: <strong>${esc(formatDate(toISODate(new Date(c.submittedAt))))}</strong></p>
      </div>
      <p class="doc-body">${consentStatementHtml(c)}</p>
      <p class="doc-body">${esc(CONSENT_FORM.liability)}</p>

      <div class="doc-signatures">
        <div class="doc-sign">
          <p class="doc-label">Conforme:</p>
          ${c.signature
            ? `<img class="doc-signature" src="${esc(c.signature)}" alt="Signature of ${esc(c.guardianName)}">`
            : '<p class="doc-signature doc-signature--none">No signature (sample record)</p>'}
          <p class="doc-line">${esc(c.guardianName)}<br><span>Parent / Guardian</span></p>
        </div>
        <div class="doc-sign">
          <p class="doc-label">&nbsp;</p>
          <div class="doc-signature"></div>
          <p class="doc-line">&nbsp;<br><span>UAAP Committee</span></p>
        </div>
      </div>

      <p class="hint doc-meta">
        Submitted online on ${esc(formatDateTime(c.submittedAt))}.
        ${c.agreed ? 'The parent/guardian ticked the box agreeing to this statement.' : ''}
      </p>
    </article>

    <div class="form-actions no-print">
      <button type="button" class="btn btn-danger-outline" id="delete-consent">${icon('trash')} Delete</button>
      <a class="btn btn-secondary" href="#/consents">Back to list</a>
      <button type="button" class="btn btn-primary" id="print-consent">${icon('print')} Print</button>
    </div>`;

  el.querySelector('#print-consent').addEventListener('click', () => window.print());
  el.querySelector('#delete-consent').addEventListener('click', async (e) => {
    if (!confirm(`Delete the consent form for ${c.childName} (${c.consentId})? This can't be undone.`)) return;
    const done = await withSaving(e.currentTarget, () => Store.deleteConsent(c.consentId).then(() => true));
    if (!done) return;
    toast(`Consent form for ${c.childName} deleted.`);
    location.hash = '#/consents';
  });
};

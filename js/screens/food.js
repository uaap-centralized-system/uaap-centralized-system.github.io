window.Screens = window.Screens || {};

// Date, sport and staff carry over to the next entry so staff don't re-pick them each time.
let foodEntryDefaults = null;
// Remember the summary filters while moving between screens.
let foodSummaryFilters = null;

Screens.food = async function (el) {
  const today = todayISO();
  const todays = (await Store.listFood()).filter((r) => r.date === today);
  const pieces = todays.reduce((sum, r) => sum + Number(r.quantity), 0);

  el.innerHTML = `
    <div class="big-actions">
      <a class="big-button" href="#/food/new">${icon('plus')}<span>New Food Entry</span></a>
      <a class="big-button big-button--light" href="#/food/summary">${icon('clipboard')}<span>View Food Summary</span></a>
    </div>
    <p class="today-stat">
      Today so far: <strong>${plural(pieces, 'piece')}</strong> of food in <strong>${plural(todays.length, 'entry', 'entries')}</strong>.
    </p>`;
};

Screens.foodEntry = async function (el) {
  const people = await Store.listPeople();
  const names = [...new Set(people.filter((p) => p.active).map((p) => p.fullName))].sort();
  const d = foodEntryDefaults || { date: todayISO(), sport: '', adminStaff: '' };

  el.innerHTML = `
    <form class="card form" novalidate>
      <div class="form-row">
        ${fieldHtml({
          name: 'date', label: 'Date', required: true,
          control: `<input id="f-date" name="date" type="date" value="${esc(d.date)}">`,
        })}
        ${fieldHtml({
          name: 'sport', label: 'Sport', required: true,
          control: `<select id="f-sport" name="sport">${optionsHtml(OPTIONS.sports, d.sport, 'Choose sport')}</select>`,
        })}
      </div>
      ${fieldHtml({
        name: 'department', label: 'Department', required: true,
        control: `<select id="f-department" name="department">${optionsHtml(OPTIONS.departments, '', 'Choose department')}</select>`,
      })}
      ${fieldHtml({
        name: 'representativeName', label: 'Representative Name', required: true,
        hint: 'The person picking up food for the whole team.',
        control: `<input id="f-representativeName" name="representativeName" type="text" list="rep-names" autocomplete="off">
          <datalist id="rep-names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`,
      })}
      <div class="form-row">
        ${fieldHtml({
          name: 'meal', label: 'Meal', required: true,
          control: `<select id="f-meal" name="meal">${optionsHtml(OPTIONS.meals, '', 'Choose meal')}</select>`,
        })}
        ${fieldHtml({
          name: 'quantity', label: 'Quantity', required: true,
          hint: 'Total pieces for the whole team.',
          control: '<input id="f-quantity" name="quantity" type="number" min="1" step="1" inputmode="numeric">',
        })}
      </div>
      ${fieldHtml({
        name: 'adminStaff', label: 'Admin Staff', required: true,
        control: `<select id="f-adminStaff" name="adminStaff">${optionsHtml(OPTIONS.adminStaff, d.adminStaff, 'Choose staff')}</select>`,
      })}
      ${fieldHtml({
        name: 'notes', label: 'Notes',
        control: '<textarea id="f-notes" name="notes" rows="2"></textarea>',
      })}
      <div class="form-actions">
        <a class="btn btn-secondary" href="#/food">Back</a>
        <button class="btn btn-primary" type="submit">${icon('check')} Save Entry</button>
      </div>
    </form>`;

  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readForm(form);
    const errors = checkRequired(data, {
      date: 'Date',
      sport: 'Sport',
      department: 'Department',
      representativeName: 'Representative Name',
      meal: 'Meal',
      quantity: 'Quantity',
      adminStaff: 'Admin Staff',
    });
    if (data.quantity && !(/^\d+$/.test(data.quantity) && Number(data.quantity) > 0)) {
      errors.quantity = 'Please enter a whole number, 1 or more.';
    }
    if (!showErrors(form, errors)) return;

    const saved = await withSaving(form.querySelector('[type=submit]'), () => Store.addFood({
      date: data.date,
      sport: data.sport,
      department: data.department,
      representativeName: data.representativeName,
      meal: data.meal,
      quantity: Number(data.quantity),
      adminStaff: data.adminStaff,
      notes: data.notes,
    }));
    if (!saved) return;
    foodEntryDefaults = { date: saved.date, sport: saved.sport, adminStaff: saved.adminStaff };
    toast(`Saved: ${saved.quantity} ${saved.meal} for ${saved.department}.`);
    await Screens.foodEntry(el); // fresh form for the next team
    window.scrollTo(0, 0);
  });
};

Screens.foodSummary = async function (el) {
  const all = await Store.listFood();
  const f = foodSummaryFilters || { date: todayISO(), sport: '' };

  el.innerHTML = `
    <div class="filters card no-print">
      <div class="field">
        <label for="fs-date">Date</label>
        <input id="fs-date" type="date" value="${esc(f.date)}">
      </div>
      <div class="field">
        <label for="fs-sport">Sport</label>
        <select id="fs-sport">${optionsHtml(OPTIONS.sports, f.sport, 'All sports')}</select>
      </div>
    </div>
    <div id="fs-body"></div>`;

  const dateInput = el.querySelector('#fs-date');
  const sportSelect = el.querySelector('#fs-sport');
  const body = el.querySelector('#fs-body');

  function update() {
    f.date = dateInput.value;
    f.sport = sportSelect.value;
    foodSummaryFilters = { ...f };

    const rows = all
      .filter((r) => (!f.date || r.date === f.date) && (!f.sport || r.sport === f.sport))
      .sort((a, b) => a.date.localeCompare(b.date)
        || OPTIONS.meals.indexOf(a.meal) - OPTIONS.meals.indexOf(b.meal)
        || a.foodRecordId.localeCompare(b.foodRecordId));
    const totalFor = (meal) => rows.filter((r) => r.meal === meal).reduce((s, r) => s + Number(r.quantity), 0);
    const total = rows.reduce((s, r) => s + Number(r.quantity), 0);
    const showDate = !f.date;
    const showSport = !f.sport;
    const colCount = 7 + (showDate ? 1 : 0) + (showSport ? 1 : 0);

    body.innerHTML = `
      <div class="stats">
        ${OPTIONS.meals.map((meal) => `
          <div class="stat">
            <span class="stat-label">${meal}</span>
            <span class="stat-value">${totalFor(meal)}</span>
          </div>`).join('')}
        <div class="stat stat--total">
          <span class="stat-label">Total Food</span>
          <span class="stat-value">${total}</span>
        </div>
      </div>

      <section class="card compiled-form">
        <div class="compiled-head">
          <h2>Compiled Food Form</h2>
          <p>${f.date ? esc(formatDate(f.date)) : 'All dates'} · ${f.sport ? esc(f.sport) : 'All sports'}</p>
        </div>
        <table class="table table--stack">
          <thead>
            <tr>
              <th>#</th>
              ${showDate ? '<th>Date</th>' : ''}
              ${showSport ? '<th>Sport</th>' : ''}
              <th>Department</th><th>Representative</th><th>Meal</th>
              <th class="num">Qty</th><th>Admin Staff</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((r, i) => `
              <tr>
                <td data-label="#">${i + 1}</td>
                ${showDate ? `<td data-label="Date">${esc(formatDate(r.date))}</td>` : ''}
                ${showSport ? `<td data-label="Sport">${esc(r.sport)}</td>` : ''}
                <td data-label="Department"><strong>${esc(r.department)}</strong></td>
                <td data-label="Representative">${esc(r.representativeName)}</td>
                <td data-label="Meal">${esc(r.meal)}</td>
                <td data-label="Qty" class="num"><strong>${esc(r.quantity)}</strong></td>
                <td data-label="Admin Staff">${esc(r.adminStaff)}</td>
                <td data-label="Notes">${esc(r.notes) || '<span class="muted">—</span>'}</td>
              </tr>`).join('')
            : `<tr><td colspan="${colCount}" class="empty">No food recorded for this date and sport.</td></tr>`}
          </tbody>
          ${rows.length ? `
          <tfoot>
            <tr>
              <td colspan="${colCount - 3}" class="tfoot-label">Total pieces</td>
              <td class="num"><strong>${total}</strong></td>
              <td colspan="2"></td>
            </tr>
          </tfoot>` : ''}
        </table>

        <div class="signature-block">
          <h3>Food Staff Signature</h3>
          <p class="hint no-print">One signature covers this whole form. Sign with your finger or mouse.</p>
          <canvas class="signature-pad" aria-label="Signature area"></canvas>
          <div class="signature-meta">
            <div class="field">
              <label for="fs-signer">Signed by</label>
              <select id="fs-signer">${optionsHtml(OPTIONS.adminStaff, 'Food Staff 1')}</select>
            </div>
            <button type="button" class="btn btn-secondary btn-small no-print" id="fs-clear">Clear Signature</button>
          </div>
        </div>
      </section>

      <div class="form-actions no-print">
        <a class="btn btn-secondary" href="#/food/new">${icon('plus')} New Food Entry</a>
        <button type="button" class="btn btn-primary" id="fs-print">${icon('print')} Print Form</button>
      </div>`;

    const pad = signaturePad(body.querySelector('.signature-pad'));
    body.querySelector('#fs-clear').addEventListener('click', pad.clear);
    body.querySelector('#fs-print').addEventListener('click', () => window.print());
  }

  dateInput.addEventListener('change', update);
  sportSelect.addEventListener('change', update);
  update();
};

/** Simple draw-with-finger/mouse signature box. Not saved; it prints with the form. */
function signaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111827';

  let drawing = false;
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  const stop = () => { drawing = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  return {
    clear() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    },
  };
}

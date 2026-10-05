window.Screens = window.Screens || {};

/** Plate numbers are stored in capitals with single spaces: "abc  1234" → "ABC 1234". */
function cleanPlate(plate) {
  return plate.toUpperCase().replace(/\s+/g, ' ').trim();
}

// Remember the chosen log date while moving between parking screens.
let parkingLogDate = null;

Screens.parking = async function (el) {
  const records = await Store.listParking();
  const parkedCount = records.filter((r) => !r.timeOut).length;
  if (!parkingLogDate) parkingLogDate = todayISO();

  el.innerHTML = `
    <div class="big-actions">
      <a class="big-button big-button--in" href="#/parking/in">${icon('logIn')}<span>Vehicle In</span></a>
      <a class="big-button big-button--out" href="#/parking/out">
        ${icon('logOut')}<span>Vehicle Out</span>
        <small>${parkedCount} currently parked</small>
      </a>
    </div>

    <section class="card card--flush">
      <div class="card-head card-head--stack">
        <div>
          <h2>Parking Log</h2>
          <p class="hint">Saved records can't be changed, only deleted.</p>
        </div>
        ${dateFilterHtml('pk-date', parkingLogDate, 'Show date')}
      </div>
      <table class="table table--stack">
        <thead>
          <tr>
            <th>Plate Number</th><th>Name</th><th>Time In</th><th>Time Out</th><th>Admin Staff</th><th>Notes</th>
            <th><span class="sr-only">Delete</span></th>
          </tr>
        </thead>
        <tbody id="pk-rows"></tbody>
      </table>
    </section>`;

  const tbody = el.querySelector('#pk-rows');
  let shown = [];

  function update() {
    shown = records
      .filter((r) => r.date === parkingLogDate)
      .sort((a, b) => b.timeIn.localeCompare(a.timeIn));
    const when = parkingLogDate === todayISO() ? 'today' : `on ${formatDate(parkingLogDate)}`;
    tbody.innerHTML = shown.length
      ? shown.map((r) => `
        <tr>
          <td data-label="Plate"><span class="plate plate--small">${esc(r.plateNumber)}</span></td>
          <td data-label="Name">${esc(r.name)}</td>
          <td data-label="Time In">${esc(formatTime(r.timeIn))}</td>
          <td data-label="Time Out">${r.timeOut
            ? esc(formatTime(r.timeOut))
            : '<span class="badge badge--green">Still parked</span>'}</td>
          <td data-label="Admin Staff">${esc(r.adminStaff)}</td>
          <td data-label="Notes">${esc(r.notes) || '<span class="muted">—</span>'}</td>
          <td class="cell-action">
            <button type="button" class="btn btn-danger-outline btn-small" data-delete="${esc(r.parkingRecordId)}">Delete</button>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="7" class="empty">${parkingLogDate ? `No vehicles recorded ${esc(when)}.` : 'Choose a date.'}</td></tr>`;
  }

  bindDateFilter(el, 'pk-date', (date) => {
    parkingLogDate = date;
    update();
  });

  tbody.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-delete]');
    if (!button) return;
    const r = shown.find((x) => x.parkingRecordId === button.dataset.delete);
    if (!confirm(`Delete the parking record for ${r.plateNumber} (${r.name})? This can't be undone.`)) return;
    const done = await withSaving(button, () => Store.deleteParking(r.parkingRecordId).then(() => true));
    if (!done) return;
    toast(`${r.plateNumber} record deleted.`);
    await Screens.parking(el);
  });

  update();
};

Screens.vehicleIn = async function (el) {
  const people = await Store.listPeople();
  const names = [...new Set(people.map((p) => p.fullName))].sort();

  el.innerHTML = `
    <form class="card form" novalidate>
      <div class="form-row">
        ${fieldHtml({
          name: 'date', label: 'Date', required: true,
          control: `<input id="f-date" name="date" type="date" value="${todayISO()}">`,
        })}
        ${fieldHtml({
          name: 'timeIn', label: 'Time In', required: true,
          control: `<input id="f-timeIn" name="timeIn" type="time" value="${nowTime()}">`,
        })}
      </div>
      ${fieldHtml({
        name: 'name', label: 'Name', required: true,
        control: `<input id="f-name" name="name" type="text" list="driver-names" autocomplete="off">
          <datalist id="driver-names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`,
      })}
      ${fieldHtml({
        name: 'plateNumber', label: 'Plate Number', required: true,
        control: `<input id="f-plateNumber" name="plateNumber" type="text" class="input-plate"
          autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC 1234">`,
      })}
      ${fieldHtml({
        name: 'adminStaff', label: 'Admin Staff', required: true,
        control: `<select id="f-adminStaff" name="adminStaff">${optionsHtml(OPTIONS.adminStaff, 'Parking Staff 1', 'Choose staff')}</select>`,
      })}
      ${fieldHtml({
        name: 'notes', label: 'Notes',
        control: '<textarea id="f-notes" name="notes" rows="2"></textarea>',
      })}
      <p class="notice notice--warn">Please double-check before saving. Name, plate number and time in can't be edited afterwards.</p>
      <div class="form-actions">
        <a class="btn btn-secondary" href="#/parking">Back</a>
        <button class="btn btn-in" type="submit">${icon('logIn')} Check In</button>
      </div>
    </form>`;

  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readForm(form);
    data.plateNumber = cleanPlate(data.plateNumber);
    const errors = checkRequired(data, {
      date: 'Date',
      timeIn: 'Time In',
      name: 'Name',
      plateNumber: 'Plate Number',
      adminStaff: 'Admin Staff',
    });
    if (data.plateNumber) {
      const alreadyParked = (await Store.listParking())
        .some((r) => !r.timeOut && r.plateNumber === data.plateNumber);
      if (alreadyParked) errors.plateNumber = `${data.plateNumber} is already parked. Check it out first using Vehicle Out.`;
    }
    if (!showErrors(form, errors)) return;

    const saved = await withSaving(form.querySelector('[type=submit]'), () => Store.addVehicleIn({
      date: data.date,
      name: data.name,
      plateNumber: data.plateNumber,
      timeIn: data.timeIn,
      adminStaff: data.adminStaff,
      notes: data.notes,
    }));
    if (!saved) return;

    el.innerHTML = `
      <div class="card success">
        <span class="success-icon">${icon('check')}</span>
        <h2>Vehicle checked in</h2>
        <span class="plate">${esc(saved.plateNumber)}</span>
        <dl class="details">
          <div><dt>Name</dt><dd>${esc(saved.name)}</dd></div>
          <div><dt>Time In</dt><dd>${esc(formatTime(saved.timeIn))}, ${esc(formatDate(saved.date))}</dd></div>
          <div><dt>Admin Staff</dt><dd>${esc(saved.adminStaff)}</dd></div>
          <div><dt>Record ID</dt><dd>${esc(saved.parkingRecordId)}</dd></div>
        </dl>
        <p class="hint">This record is saved. When the vehicle leaves, use <strong>Vehicle Out</strong>.
          If something is wrong, delete it from the Parking Log and check in again.</p>
        <div class="form-actions">
          <a class="btn btn-secondary" href="#/parking">Back to Parking</a>
          <button type="button" class="btn btn-in" id="another">${icon('logIn')} Check In Another</button>
        </div>
      </div>`;
    el.querySelector('#another').addEventListener('click', () => Screens.vehicleIn(el));
    window.scrollTo(0, 0);
  });
};

/** Vehicles still parked (no Time Out), longest-parked first. */
async function loadParked() {
  return (await Store.listParking())
    .filter((r) => !r.timeOut)
    .sort((a, b) => (a.date + a.timeIn).localeCompare(b.date + b.timeIn));
}

Screens.vehicleOut = async function (el) {
  let parked = await loadParked();
  const today = todayISO();

  el.innerHTML = `
    <div class="field">
      <label for="vo-search">Find a vehicle</label>
      <input id="vo-search" type="search" placeholder="Plate number or name" autocomplete="off">
    </div>
    <p class="result-count" id="vo-count"></p>
    <div class="vehicle-grid" id="vo-list"></div>`;

  const search = el.querySelector('#vo-search');
  const list = el.querySelector('#vo-list');

  function update() {
    const q = search.value.trim().toLowerCase();
    const shown = parked.filter((r) => !q
      || r.plateNumber.toLowerCase().includes(q)
      || r.name.toLowerCase().includes(q));

    el.querySelector('#vo-count').textContent = `${plural(parked.length, 'vehicle')} currently parked`;
    list.innerHTML = shown.length
      ? shown.map((r) => `
        <article class="vehicle-card">
          <span class="plate">${esc(r.plateNumber)}</span>
          <p class="vehicle-name">${esc(r.name)}</p>
          <p class="vehicle-time">
            Time In: <strong>${esc(formatTime(r.timeIn))}</strong>
            ${r.date !== today ? `<span class="badge badge--amber">${esc(formatDate(r.date))}</span>` : ''}
          </p>
          <button type="button" class="btn btn-out btn-block" data-id="${esc(r.parkingRecordId)}">
            ${icon('logOut')} Check Out
          </button>
        </article>`).join('')
      : `<p class="empty-state">${parked.length ? 'No parked vehicle matches your search.' : 'No vehicles are currently parked.'}</p>`;
  }

  list.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-id]');
    if (!button) return;
    const record = parked.find((r) => r.parkingRecordId === button.dataset.id);
    if (!confirm(`Check out ${record.plateNumber} (${record.name})?`)) return;

    button.disabled = true;
    button.textContent = 'Checking out…';
    try {
      const saved = await Store.checkOutVehicle(record.parkingRecordId, nowTime());
      toast(`${saved.plateNumber} checked out at ${formatTime(saved.timeOut)}.`);
      parked = parked.filter((r) => r.parkingRecordId !== record.parkingRecordId);
    } catch (err) {
      // Maybe someone else checked it out, or the connection dropped: show the real list.
      toast(err.message);
      parked = await loadParked().catch(() => parked);
    }
    update();
  });

  search.addEventListener('input', update);
  update();
};

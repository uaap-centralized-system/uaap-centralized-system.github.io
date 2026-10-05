window.Screens = window.Screens || {};

// Remember the search and filters while moving between list and edit screens.
const masterlistFilters = { search: '', sport: '', period: '' };

/** Months to choose from: 3 months back to 6 months ahead, plus `current` if outside that range. */
function periodChoices(current) {
  const now = new Date();
  const months = [];
  for (let i = -3; i <= 6; i++) months.push(toISOMonth(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  if (current && !months.includes(current)) months.push(current);
  return months.sort().map((p) => ({ value: p, label: formatPeriod(p) }));
}

Screens.masterlist = async function (el) {
  const people = await Store.listPeople();
  const periods = [...new Set(people.map((p) => p.period))].sort().reverse();
  const f = masterlistFilters;

  el.innerHTML = `
    <div class="toolbar">
      <a class="btn btn-primary" href="#/masterlist/new">${icon('plus')} Add Person</a>
    </div>
    <div class="filters card">
      <div class="field field--grow">
        <label for="ml-search">Search</label>
        <input id="ml-search" type="search" placeholder="Name, ID, or organization" value="${esc(f.search)}">
      </div>
      <div class="field">
        <label for="ml-sport">Sport</label>
        <select id="ml-sport">${optionsHtml(OPTIONS.sports, f.sport, 'All sports')}</select>
      </div>
      <div class="field">
        <label for="ml-period">Month / Period</label>
        <select id="ml-period">
          ${optionsHtml(periods.map((p) => ({ value: p, label: formatPeriod(p) })), f.period, 'All months')}
        </select>
      </div>
    </div>
    <p class="result-count" id="ml-count"></p>
    <div class="card card--flush">
      <table class="table table--stack">
        <thead>
          <tr>
            <th>ID</th><th>Full Name</th><th>Organization / Department</th>
            <th>Sport</th><th>Month / Period</th><th>Status</th>
            <th><span class="sr-only">Edit</span></th>
          </tr>
        </thead>
        <tbody id="ml-rows"></tbody>
      </table>
    </div>`;

  const search = el.querySelector('#ml-search');
  const sport = el.querySelector('#ml-sport');
  const period = el.querySelector('#ml-period');

  function update() {
    f.search = search.value;
    f.sport = sport.value;
    f.period = period.value;
    const q = f.search.trim().toLowerCase();

    const rows = people
      .filter((p) => !f.sport || p.sport === f.sport)
      .filter((p) => !f.period || p.period === f.period)
      .filter((p) => !q || [p.personId, p.fullName, p.organization].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    el.querySelector('#ml-count').textContent = `Showing ${rows.length} of ${plural(people.length, 'person', 'people')}`;
    el.querySelector('#ml-rows').innerHTML = rows.length
      ? rows.map((p) => `
        <tr>
          <td data-label="ID">${esc(p.personId)}</td>
          <td data-label="Full Name"><strong>${esc(p.fullName)}</strong></td>
          <td data-label="Organization">${esc(p.organization)}</td>
          <td data-label="Sport">${esc(p.sport)}</td>
          <td data-label="Month / Period">${esc(formatPeriod(p.period))}</td>
          <td data-label="Status">
            <span class="badge ${p.active ? 'badge--green' : 'badge--gray'}">${p.active ? 'Active' : 'Inactive'}</span>
          </td>
          <td class="cell-action">
            <a class="btn btn-secondary btn-small" href="#/masterlist/edit/${encodeURIComponent(p.personId)}">Edit</a>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="7" class="empty">No one matches your search.</td></tr>';
  }

  search.addEventListener('input', update);
  sport.addEventListener('change', update);
  period.addEventListener('change', update);
  update();
};

Screens.masterlistForm = async function (el, personId) {
  const isEdit = Boolean(personId);
  const person = isEdit
    ? await Store.getPerson(decodeURIComponent(personId))
    : { fullName: '', organization: '', sport: '', period: toISOMonth(new Date()), active: true };

  if (!person) {
    el.innerHTML = `
      <div class="card notice">
        <p>This person could not be found.</p>
        <a class="btn btn-secondary" href="#/masterlist">Back to Masterlist</a>
      </div>`;
    return;
  }

  el.innerHTML = `
    <form class="card form" novalidate>
      ${isEdit ? `<p class="record-id">Person ID: <strong>${esc(person.personId)}</strong></p>` : ''}
      ${fieldHtml({
        name: 'fullName', label: 'Full Name', required: true,
        control: `<input id="f-fullName" name="fullName" type="text" autocomplete="off" value="${esc(person.fullName)}">`,
      })}
      ${fieldHtml({
        name: 'organization', label: 'Organization / Department', required: true,
        control: `<select id="f-organization" name="organization">
          ${optionsHtml(OPTIONS.departments, person.organization, 'Choose organization')}</select>`,
      })}
      ${fieldHtml({
        name: 'sport', label: 'Sport', required: true,
        control: `<select id="f-sport" name="sport">${optionsHtml(OPTIONS.sports, person.sport, 'Choose sport')}</select>`,
      })}
      ${fieldHtml({
        name: 'period', label: 'Month / Period', required: true,
        control: `<select id="f-period" name="period">
          ${optionsHtml(periodChoices(person.period), person.period, 'Choose month')}</select>`,
      })}
      ${fieldHtml({
        name: 'active', label: 'Status', required: true,
        control: `<select id="f-active" name="active">
          ${optionsHtml([{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }], person.active ? 'yes' : 'no')}
        </select>`,
      })}
      <div class="form-actions">
        <a class="btn btn-secondary" href="#/masterlist">Cancel</a>
        <button class="btn btn-primary" type="submit">${icon('check')} Save</button>
      </div>
    </form>`;

  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readForm(form);
    const errors = checkRequired(data, {
      fullName: 'Full Name',
      organization: 'Organization / Department',
      sport: 'Sport',
      period: 'Month / Period',
    });
    if (!showErrors(form, errors)) return;

    const record = {
      fullName: data.fullName,
      organization: data.organization,
      sport: data.sport,
      period: data.period,
      active: data.active === 'yes',
    };
    form.querySelector('[type=submit]').disabled = true;
    if (isEdit) {
      await Store.updatePerson(person.personId, record);
      toast(`Changes to ${record.fullName} saved.`);
    } else {
      await Store.addPerson(record);
      toast(`${record.fullName} added to the Masterlist.`);
    }
    location.hash = '#/masterlist';
  });
};

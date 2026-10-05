/*
 * DATA LAYER: the only file that knows where records are kept.
 *
 * Every screen reads and writes through `Store`. Records go to one of two places:
 *  - Google Sheets, when js/config.js has a `sheetsUrl` (shared by all staff), or
 *  - this browser (localStorage), starting from the sample data (demo mode).
 *
 * Rules enforced here and in google-apps-script/Code.gs (not just in the screens):
 *  - Food and parking records can be deleted but not edited.
 *  - The only change to a parking record is setting Time Out at check-out.
 */
const Store = (function () {
  const TABLES = {
    masterlist: { idField: 'personId', idPrefix: 'P' },
    food: { idField: 'foodRecordId', idPrefix: 'F' },
    parking: { idField: 'parkingRecordId', idPrefix: 'PK' },
    consent: { idField: 'consentId', idPrefix: 'C' },
  };
  const sheetsUrl = ((window.UAAP_CONFIG || {}).sheetsUrl || '').trim();

  // The staff passcode is entered once per device and remembered in this browser.
  const Passcode = (function () {
    const KEY = 'uaap-centralized:passcode';
    let memory = '';
    return {
      get() {
        try { return localStorage.getItem(KEY) || memory; } catch (e) { return memory; }
      },
      set(value) {
        memory = value;
        try {
          if (value) localStorage.setItem(KEY, value);
          else localStorage.removeItem(KEY);
        } catch (e) { /* kept in memory for this visit */ }
      },
    };
  })();
  const backend = sheetsUrl ? sheetsBackend(sheetsUrl) : browserBackend();

  // ---------- Google Sheets (via the Apps Script web app) ----------

  function sheetsBackend(url) {
    async function post(request) {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          // text/plain avoids a CORS preflight request, which Apps Script can't answer.
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ ...request, passcode: Passcode.get() }),
        });
      } catch (e) {
        throw new Error('Could not reach the Google Sheet. Check the internet connection and try again.');
      }
      const result = await response.json().catch(() => ({ ok: false }));
      if (result.code === 'passcode') {
        Passcode.set('');
        const err = new Error('Please enter the staff passcode.');
        err.needsPasscode = true;
        throw err;
      }
      if (!result.ok) throw new Error(result.error || 'The Google Sheet returned an error. Please try again.');
      return result;
    }

    return {
      async list(table) {
        return (await post({ action: 'list', table })).rows;
      },
      async add(table, data) {
        return (await post({ action: 'add', table, data })).record;
      },
      async updatePerson(id, data) {
        return (await post({ action: 'updatePerson', id, data })).record;
      },
      async checkOut(id, timeOut) {
        return (await post({ action: 'checkOut', id, timeOut })).record;
      },
      async remove(table, id) {
        await post({ action: 'delete', table, id });
      },
      /** Public: works without the staff passcode, and can only add. */
      async submitConsent(data) {
        return (await post({ action: 'submitConsent', data })).record;
      },
    };
  }

  // ---------- This browser only (demo mode) ----------

  function browserBackend() {
    const STORAGE_PREFIX = 'uaap-centralized:';
    const cache = {};

    function readTable(table) {
      if (cache[table]) return cache[table];
      let rows = null;
      try {
        rows = JSON.parse(localStorage.getItem(STORAGE_PREFIX + table));
      } catch (e) {
        rows = null;
      }
      const isFirstVisit = !Array.isArray(rows);
      if (isFirstVisit) rows = JSON.parse(JSON.stringify(SAMPLE_DATA[table]));
      cache[table] = rows;
      if (isFirstVisit) writeTable(table);
      return rows;
    }

    function writeTable(table) {
      try {
        localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(cache[table]));
      } catch (e) {
        console.warn('Could not save in this browser; changes will be lost on refresh.', e);
      }
    }

    // Another tab saved something: drop our copy so the next read is fresh.
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(STORAGE_PREFIX)) delete cache[e.key.slice(STORAGE_PREFIX.length)];
    });

    /** Next ID like "F-0010": one higher than the largest existing number. */
    function nextId(table) {
      const { idField, idPrefix } = TABLES[table];
      const max = readTable(table).reduce((highest, row) => {
        const n = parseInt(String(row[idField]).split('-')[1], 10);
        return Number.isNaN(n) ? highest : Math.max(highest, n);
      }, 0);
      return `${idPrefix}-${String(max + 1).padStart(4, '0')}`;
    }

    function find(table, id) {
      const { idField } = TABLES[table];
      return readTable(table).find((row) => row[idField] === id);
    }

    return {
      async list(table) {
        return readTable(table).map((row) => ({ ...row }));
      },
      async add(table, data) {
        const record = { ...data, [TABLES[table].idField]: nextId(table) };
        readTable(table).push(record);
        writeTable(table);
        return { ...record };
      },
      async updatePerson(id, data) {
        const row = find('masterlist', id);
        if (!row) throw new Error('This person could not be found.');
        Object.assign(row, data, { personId: id });
        writeTable('masterlist');
        return { ...row };
      },
      async checkOut(id, timeOut) {
        const row = find('parking', id);
        if (!row) throw new Error('This parking record could not be found.');
        if (row.timeOut) throw new Error(`${row.plateNumber} was already checked out.`);
        row.timeOut = timeOut;
        writeTable('parking');
        return { ...row };
      },
      async remove(table, id) {
        const { idField } = TABLES[table];
        const rows = readTable(table);
        const i = rows.findIndex((row) => row[idField] === id);
        if (i === -1) throw new Error('This record could not be found. It may already be deleted.');
        rows.splice(i, 1);
        writeTable(table);
      },
      async submitConsent({ website, ...data }) {
        const { consentId, gameDate, childName } = await this.add('consent', { ...data, submittedAt: new Date().toISOString() });
        return { consentId, gameDate, childName };
      },
      async reset() {
        Object.keys(TABLES).forEach((table) => {
          delete cache[table];
          try {
            localStorage.removeItem(STORAGE_PREFIX + table);
          } catch (e) { /* nothing saved to clear */ }
        });
      },
    };
  }

  // ---------- What the screens use ----------

  return {
    /** True when records are shared through Google Sheets. */
    usingSheets: Boolean(sheetsUrl),

    // Masterlist
    listPeople: () => backend.list('masterlist'),
    async getPerson(personId) {
      return (await backend.list('masterlist')).find((p) => p.personId === personId) || null;
    },
    addPerson: (data) => backend.add('masterlist', data),
    updatePerson: (personId, data) => backend.updatePerson(personId, data),
    deletePerson: (personId) => backend.remove('masterlist', personId),

    // Food
    listFood: () => backend.list('food'),
    addFood: (data) => backend.add('food', data),
    deleteFood: (foodRecordId) => backend.remove('food', foodRecordId),

    // Parking
    listParking: () => backend.list('parking'),
    addVehicleIn: (data) => backend.add('parking', { ...data, timeOut: '' }),
    /** Sets Time Out on the same record. Nothing else can be changed. */
    checkOutVehicle: (parkingRecordId, timeOut) => backend.checkOut(parkingRecordId, timeOut),
    deleteParking: (parkingRecordId) => backend.remove('parking', parkingRecordId),

    // Consent forms
    listConsents: () => backend.list('consent'),
    async getConsent(consentId) {
      return (await backend.list('consent')).find((c) => c.consentId === consentId) || null;
    },
    /** Parents submit through this; it needs no passcode. */
    submitConsent: (data) => backend.submitConsent(data),
    deleteConsent: (consentId) => backend.remove('consent', consentId),

    /** Remember the staff passcode on this device. */
    setPasscode: (value) => Passcode.set(value),

    /** Demo mode only: go back to the sample data. */
    async resetToSampleData() {
      if (backend.reset) await backend.reset();
    },
  };
})();

/*
 * DATA LAYER: the only file that knows where records are kept.
 *
 * Every screen reads and writes through `Store`. Right now records are saved
 * in this browser (localStorage) and start out as the sample data.
 *
 * To connect Google Sheets later, rewrite the bodies of the functions below
 * to call a Google Apps Script web app (see README). The functions are
 * already `async`, so the screens will not need to change.
 *
 * Rules enforced here (not just in the screens):
 *  - Food and parking records can never be deleted.
 *  - A parking record can only change once: setting Time Out at check-out.
 */
const Store = (function () {
  const STORAGE_PREFIX = 'uaap-centralized:';
  const TABLES = {
    masterlist: { idField: 'personId', idPrefix: 'P' },
    food: { idField: 'foodRecordId', idPrefix: 'F' },
    parking: { idField: 'parkingRecordId', idPrefix: 'PK' },
  };
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

  const copy = (row) => ({ ...row });

  function findIndex(table, id) {
    const { idField } = TABLES[table];
    return readTable(table).findIndex((row) => row[idField] === id);
  }

  function insert(table, data) {
    const record = { ...data, [TABLES[table].idField]: nextId(table) };
    readTable(table).push(record);
    writeTable(table);
    return copy(record);
  }

  return {
    // ----- Masterlist -----
    async listPeople() {
      return readTable('masterlist').map(copy);
    },
    async getPerson(personId) {
      const i = findIndex('masterlist', personId);
      return i === -1 ? null : copy(readTable('masterlist')[i]);
    },
    async addPerson(data) {
      return insert('masterlist', data);
    },
    async updatePerson(personId, data) {
      const rows = readTable('masterlist');
      const i = findIndex('masterlist', personId);
      if (i === -1) throw new Error('This person could not be found.');
      rows[i] = { ...rows[i], ...data, personId };
      writeTable('masterlist');
      return copy(rows[i]);
    },

    // ----- Food -----
    async listFood() {
      return readTable('food').map(copy);
    },
    async addFood(data) {
      return insert('food', data);
    },

    // ----- Parking -----
    async listParking() {
      return readTable('parking').map(copy);
    },
    async addVehicleIn(data) {
      return insert('parking', { ...data, timeOut: '' });
    },
    /** Sets Time Out on the same record. Nothing else can be changed. */
    async checkOutVehicle(parkingRecordId, timeOut) {
      const rows = readTable('parking');
      const i = findIndex('parking', parkingRecordId);
      if (i === -1) throw new Error('This parking record could not be found.');
      if (rows[i].timeOut) throw new Error(`${rows[i].plateNumber} was already checked out.`);
      rows[i].timeOut = timeOut;
      writeTable('parking');
      return copy(rows[i]);
    },

    // ----- Demo only -----
    async resetToSampleData() {
      Object.keys(TABLES).forEach((table) => {
        delete cache[table];
        try {
          localStorage.removeItem(STORAGE_PREFIX + table);
        } catch (e) { /* nothing saved to clear */ }
      });
    },
  };
})();

/**
 * UAAP Centralized System: Google Sheets backend.
 *
 * Paste this whole file into the Sheet's Apps Script editor
 * (Extensions → Apps Script), run `setup` once, then deploy as a Web app.
 * See README.md → "Google Sheets setup".
 *
 * The app talks to this script only through POST requests (JSON body):
 *   { action: 'list', table }                 → { ok, rows }
 *   { action: 'add', table, data }            → { ok, record }
 *   { action: 'updatePerson', id, data }      → { ok, record }
 *   { action: 'checkOut', id, timeOut }       → { ok, record }
 *   { action: 'delete', table, id }           → { ok, deleted }
 *   { action: 'submitConsent', data }         → { ok, record }   ← public, no passcode
 * table is masterlist | food | parking | consent. Requests also send `passcode`.
 *
 * submitConsent is the ONLY thing that works without the passcode: parents use it
 * to send a consent form. It can only add one form; it can never read anything.
 *
 * STAFF PASSCODE: in the Apps Script editor, open Project Settings (gear) →
 * Script Properties → add STAFF_PASSCODE. When it is set, every request must
 * include it. When it is not set, anyone with the web app URL has full access.
 *
 * Rules enforced here, so they hold even if someone bypasses the app:
 *  - Food and parking records can't be edited after saving (only deleted).
 *  - Check Out only fills a blank Time Out on the same parking record.
 */

const TABLES = {
  masterlist: {
    tab: 'Masterlist', idField: 'personId', idPrefix: 'P',
    columns: ['personId', 'fullName', 'organization', 'sport', 'period', 'active'],
  },
  food: {
    tab: 'Food', idField: 'foodRecordId', idPrefix: 'F',
    columns: ['foodRecordId', 'date', 'sport', 'department', 'representativeName',
      'meal', 'quantity', 'adminStaff', 'notes'],
  },
  parking: {
    tab: 'Parking', idField: 'parkingRecordId', idPrefix: 'PK',
    columns: ['parkingRecordId', 'date', 'name', 'plateNumber', 'timeIn', 'timeOut',
      'adminStaff', 'notes'],
  },
  consent: {
    tab: 'Consent', idField: 'consentId', idPrefix: 'C',
    columns: ['consentId', 'submittedAt', 'gameDate', 'childName', 'childAge', 'relationship',
      'guardianName', 'eventName', 'venue', 'agreed', 'signature'],
  },
};

const BOOLEAN_COLUMNS = ['active', 'agreed'];
const MAX_CONSENTS_PER_MINUTE = 60;

/** Run once from the editor: creates all tabs with headers. Safe to run again. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABLES).forEach((key) => createTab(TABLES[key]));
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

function createTab(t) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(t.tab) || ss.insertSheet(t.tab);
  // Plain text everywhere, so Sheets never turns "2026-10" or "08:30" into dates/times.
  sheet.getRange(1, 1, sheet.getMaxRows(), t.columns.length).setNumberFormat('@');
  sheet.getRange(1, 1, 1, t.columns.length).setValues([t.columns]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function doGet() {
  return respond(() => ({ message: 'UAAP Centralized System backend is running.' }));
}

function doPost(e) {
  return respond(() => {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'submitConsent') return { record: submitConsent(body.data || {}) };

    const passcode = PropertiesService.getScriptProperties().getProperty('STAFF_PASSCODE');
    if (passcode && body.passcode !== passcode) {
      return { ok: false, code: 'passcode', error: 'Wrong or missing staff passcode.' };
    }
    if (body.action === 'list') return { rows: readRows(tableFor(body.table)) };

    const lock = LockService.getScriptLock();
    lock.waitLock(20000); // one save at a time, so IDs and row numbers never collide
    try {
      if (body.action === 'add') return { record: addRow(tableFor(body.table), body.data) };
      if (body.action === 'updatePerson') return { record: updatePerson(body.id, body.data) };
      if (body.action === 'checkOut') return { record: checkOut(body.id, body.timeOut) };
      if (body.action === 'delete') return { deleted: deleteRow(tableFor(body.table), body.id) };
      throw new Error('Unknown action: ' + body.action);
    } finally {
      lock.releaseLock();
    }
  });
}

// ---------- Helpers ----------

function respond(work) {
  let result;
  try {
    result = Object.assign({ ok: true }, work());
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function tableFor(name) {
  const t = TABLES[name];
  if (!t) throw new Error('Unknown table: ' + name);
  return t;
}

function sheetFor(t) {
  return SpreadsheetApp.getActive().getSheetByName(t.tab) || createTab(t);
}

/** Turn a row of cell text into a record with the right types. */
function toRecord(t, values) {
  const record = {};
  t.columns.forEach((col, i) => { record[col] = values[i]; });
  BOOLEAN_COLUMNS.forEach((col) => {
    if (col in record) record[col] = String(record[col]).toUpperCase() === 'TRUE';
  });
  if ('quantity' in record) record.quantity = Number(record.quantity) || 0;
  return record;
}

function readRows(t) {
  const sheet = sheetFor(t);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, t.columns.length).getDisplayValues()
    .filter((values) => values[0] !== '')
    .map((values) => toRecord(t, values));
}

/** Row number (2+) of the record with this ID, or -1. */
function findRow(t, id) {
  const sheet = sheetFor(t);
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const ids = sheet.getRange(2, 1, last - 1, 1).getDisplayValues();
  const i = ids.findIndex((r) => r[0] === id);
  return i === -1 ? -1 : i + 2;
}

function writeRow(t, rowNumber, record) {
  const sheet = sheetFor(t);
  if (rowNumber > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), rowNumber - sheet.getMaxRows());
  const values = t.columns.map((col) => {
    const v = record[col];
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    const text = v === undefined || v === null ? '' : String(v);
    // A leading ' stops Sheets from running typed text like "=IMPORTXML(...)" as a formula.
    // It isn't shown or read back; getDisplayValues() returns the original text.
    return /^[=+\-@]/.test(text) ? "'" + text : text;
  });
  sheet.getRange(rowNumber, 1, 1, values.length).setNumberFormat('@').setValues([values]);
}

/** Next ID like "F-0010". Remembers the highest ID ever issued, so deleted IDs are never reused. */
function nextId(t) {
  const props = PropertiesService.getScriptProperties();
  const key = 'lastId:' + t.tab;
  const max = readRows(t).reduce((highest, r) => {
    const n = parseInt(String(r[t.idField]).split('-')[1], 10);
    return isNaN(n) ? highest : Math.max(highest, n);
  }, Number(props.getProperty(key)) || 0);
  props.setProperty(key, String(max + 1));
  return t.idPrefix + '-' + ('000' + (max + 1)).slice(-4);
}

function addRow(t, data) {
  const record = Object.assign({}, data);
  record[t.idField] = nextId(t);
  if (t === TABLES.parking) record.timeOut = ''; // check-in never sets Time Out
  writeRow(t, sheetFor(t).getLastRow() + 1, record);
  return toRecord(t, t.columns.map((col) => record[col]));
}

function updatePerson(id, data) {
  const t = TABLES.masterlist;
  const row = findRow(t, id);
  if (row === -1) throw new Error('This person could not be found.');
  const current = toRecord(t, sheetFor(t).getRange(row, 1, 1, t.columns.length).getDisplayValues()[0]);
  const record = Object.assign(current, data, { personId: id });
  writeRow(t, row, record);
  return record;
}

function deleteRow(t, id) {
  const row = findRow(t, id);
  if (row === -1) throw new Error('This record could not be found. It may already be deleted.');
  sheetFor(t).deleteRow(row);
  return id;
}

/** Public: a parent submits one consent form. Validates everything, since anyone can call this. */
function submitConsent(data) {
  if (data.website) throw new Error('Submission rejected.'); // hidden field only bots fill in
  const text = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max);
  const record = {
    gameDate: text(data.gameDate, 10),
    childName: text(data.childName, 100),
    childAge: text(data.childAge, 3),
    relationship: text(data.relationship, 40),
    guardianName: text(data.guardianName, 100),
    eventName: text(data.eventName, 150),
    venue: text(data.venue, 150),
    agreed: data.agreed === true,
    signature: String(data.signature || ''),
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.gameDate)) throw new Error('Please choose the game date.');
  ['childName', 'relationship', 'guardianName', 'eventName', 'venue'].forEach((key) => {
    if (!record[key]) throw new Error('Please fill in all required fields.');
  });
  if (!/^\d{1,2}$/.test(record.childAge)) throw new Error("Please enter the child's age in years.");
  if (!record.agreed) throw new Error('Please tick the box to agree to the statement.');
  if (!/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(record.signature) || record.signature.length > 45000) {
    throw new Error('Please sign the form again.');
  }

  // Simple flood protection: at most MAX_CONSENTS_PER_MINUTE forms per minute overall.
  const cache = CacheService.getScriptCache();
  const bucket = 'consents:' + Math.floor(Date.now() / 60000);
  const count = Number(cache.get(bucket)) || 0;
  if (count >= MAX_CONSENTS_PER_MINUTE) {
    throw new Error('Many forms are being sent right now. Please wait a minute and try again.');
  }
  cache.put(bucket, String(count + 1), 120);

  record.submittedAt = new Date().toISOString();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const saved = addRow(TABLES.consent, record);
    // Send back only what the confirmation screen shows; never the stored data.
    return { consentId: saved.consentId, gameDate: saved.gameDate, childName: saved.childName };
  } finally {
    lock.releaseLock();
  }
}

function checkOut(id, timeOut) {
  const t = TABLES.parking;
  const row = findRow(t, id);
  if (row === -1) throw new Error('This parking record could not be found.');
  const record = toRecord(t, sheetFor(t).getRange(row, 1, 1, t.columns.length).getDisplayValues()[0]);
  if (record.timeOut) throw new Error(record.plateNumber + ' was already checked out.');
  if (!timeOut) throw new Error('Time Out is missing.');
  record.timeOut = timeOut;
  writeRow(t, row, record);
  return record;
}

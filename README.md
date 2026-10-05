# UAAP Centralized System (MVP prototype)

A simple web app that brings three manual UAAP workflows into one place:

- **Masterlist**: the reference list of personnel, by sport and month
- **Food**: one entry per food pickup by a team representative, plus a compiled form with one signature
- **Parking**: Vehicle In / Vehicle Out log

It's built for non-technical staff: big buttons, plain labels, few screens, and it works on phones.

## How to run it

It needs no installs or build step. It's plain HTML, CSS and JavaScript.

**Option 1:** double-click `index.html` to open it in Chrome, Safari or Edge.

**Option 2 (better for demos):** run a small local server from this folder:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

The app starts with fictional sample data. Records you add are saved **in that browser only**. To start over, use **Reset sample data** at the bottom of the Home screen.

## App structure

```
index.html               Page shell: header, Back button, screen area
css/styles.css           All styling (large text, mobile layout, print layout)
js/helpers.js            Date/time formatting, form helpers, icons, messages
js/sample-data.js        Dropdown choices (sports, departments, staff, meals) + sample records
js/store.js              DATA LAYER: every read/write goes through here
js/screens/home.js       Home: Masterlist / Food / Parking
js/screens/masterlist.js Search, filters, Add / Edit person
js/screens/food.js       Food menu, New Food Entry, Food Summary + Compiled Food Form
js/screens/parking.js    Parking menu + today's log, Vehicle In, Vehicle Out
js/app.js                Router: which screen shows for each address (#/food/new, etc.)
```

To **change dropdown choices** (add a sport, department or staff member), edit `OPTIONS` in `js/sample-data.js`.

### Data model

| Table | Fields |
|---|---|
| Masterlist | personId, fullName, organization, sport, period (`YYYY-MM`), active |
| Food records | foodRecordId, date, sport, department, representativeName, meal, quantity, adminStaff, notes |
| Parking records | parkingRecordId, date, name, plateNumber, timeIn, timeOut, adminStaff, notes |

Dates are stored as `YYYY-MM-DD` and times as 24-hour `HH:MM`. IDs look like `P-0001`, `F-0001`, `PK-0001`.

### Rules built into the prototype

- One food row = one pickup by one representative for their whole team. Quantity is the team's total pieces.
- Food and parking records can't be deleted.
- A parking record can't be edited after saving. The only change allowed is Check Out, which sets Time Out **on the same record**.
- Vehicle Out lists only vehicles with a blank Time Out. A plate that's already parked can't be checked in again.

These rules are enforced in `js/store.js` and in the screens. Real security, meaning server-side, needs a backend (see below).

## Adding Google Sheets later

All data access is in **`js/store.js`**, and every function there is already `async`. Moving to Google Sheets means rewriting that one file. The screens don't change.

Suggested approach (free, no server to host):

1. Create a Google Sheet with three tabs: `Masterlist`, `Food`, `Parking`. Put the field names from the table above in row 1 as column headers.
2. In the Sheet, open **Extensions → Apps Script** and write a small web app:
   - `doGet(e)` returns a tab's rows as JSON (e.g. `?table=Food`).
   - `doPost(e)` handles `add`, `updatePerson` and `checkOut` actions. The checkout handler should only fill Time Out if it's blank, so the parking rule holds on the server too.
3. **Deploy → New deployment → Web app** and copy the URL.
4. In `js/store.js`, replace each function body with a `fetch()` to that URL. For example, `listFood()` becomes `fetch(URL + '?table=Food').then(r => r.json())`.

This prototype doesn't use Sheets yet because a working demo without Google sign-in setup was the priority.

## MVP vs. future improvements

**In this MVP**
- Home with three large buttons, plus Back navigation on every screen
- Masterlist: search, filter by sport and month, add and edit
- Food: entry form with required-field checks. Date, sport and staff carry over to the next entry.
- Food Summary: Breakfast / Lunch / Dinner / overall totals by date and sport
- Compiled Food Form: one signature box (finger or mouse) and a **Print Form** button
- Parking: Vehicle In (time defaults to now), Vehicle Out cards with Check Out, today's parking log
- Works on phones, tablets and desktops. Sample data included.

**Future improvements**
- Google Sheets (or another shared database) so all staff see the same records
- Staff login and roles (e.g. only Masterlist staff can edit the Masterlist)
- Saving the food signature with the form, instead of only printing it
- Export to Excel/PDF and month-end reports
- Importing the monthly Masterlist from the existing spreadsheet
- Linking food and parking entries to Masterlist IDs
- Audit trail (who changed what, and when)

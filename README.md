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

Out of the box it runs in **demo mode**: fictional sample data, saved **in that browser only**. To start over, use **Reset sample data** at the bottom of the Home screen. To share records between staff, connect Google Sheets (below).

## App structure

```
index.html               Page shell: header, Back button, screen area
css/styles.css           All styling (large text, mobile layout, print layout)
js/helpers.js            Date/time formatting, form helpers, icons, messages
js/sample-data.js        Dropdown choices (sports, departments, staff, meals) + sample records
js/config.example.js     Copy to js/config.js and add the Google Sheets URL
js/store.js              DATA LAYER: every read/write goes through here (Sheets or browser)
js/screens/home.js       Home: Masterlist / Food / Parking
js/screens/masterlist.js Search, filters, Add / Edit person
js/screens/food.js       Food menu, New Food Entry, Food Summary + Compiled Food Form
js/screens/parking.js    Parking menu + today's log, Vehicle In, Vehicle Out
js/app.js                Router: which screen shows for each address (#/food/new, etc.)
google-apps-script/Code.gs  Backend that runs inside the Google Sheet
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
- Any record can be deleted from the app, after a confirmation: people from their Edit screen, food entries from the Food Summary, parking records from the Parking Log. Deleted IDs are never reused.
- Food and parking records can't be edited after saving. The only change to a parking record is Check Out, which sets Time Out **on the same record**.
- Vehicle Out lists only vehicles with a blank Time Out. A plate that's already parked can't be checked in again.

These rules are enforced in the screens, in `js/store.js`, and on the Google Sheets side in `Code.gs`.

## Google Sheets setup

The app has two modes:

- **Demo mode** (default): records are saved in the browser only, starting from sample data.
- **Google Sheets mode**: all staff read and write the same Google Sheet. This is on when `js/config.js` has a `sheetsUrl`.

The Sheet is connected through a small Google Apps Script web app, [`google-apps-script/Code.gs`](google-apps-script/Code.gs). It needs no server and no Google Cloud project.

1. Create a new Google Sheet, e.g. "UAAP Centralized System Data".
2. In the Sheet, open **Extensions → Apps Script**. Delete the starter code and paste in all of `google-apps-script/Code.gs`. Save.
3. Pick **setup** in the function dropdown at the top and click **Run**. Google asks you to authorize the script: choose your account, then **Advanced → Go to (project name) → Allow**. This creates the `Masterlist`, `Food` and `Parking` tabs.
4. Set a staff passcode: click **Project Settings** (gear icon) → **Script Properties** → **Add script property**. Name it `STAFF_PASSCODE` and set any value you like. Staff type it once per device.
5. Click **Deploy → New deployment**. Choose type **Web app**. Set *Execute as*: **Me** and *Who has access*: **Anyone**. Click **Deploy** and copy the **Web app URL**.
6. Copy `js/config.example.js` to `js/config.js` and paste the URL into `sheetsUrl`.
7. Reload the app. The Home screen should say "Records are saved to the shared Google Sheet."

**If you change `Code.gs` later:** paste the new version, then **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The URL stays the same.

**Security note:** the web app URL is visible to anyone who opens the app, so the **staff passcode is what protects the data**. Without `STAFF_PASSCODE` set, anyone who finds the URL can read, add and delete records. To change the passcode, edit the script property; staff will be asked for the new one automatically. Individual staff logins are listed under future improvements.

### How the pieces fit

- `js/store.js` is the only file that talks to the data. It picks Google Sheets or the browser from `js/config.js`. The screens never know which one is in use.
- `Code.gs` checks the passcode and enforces the same rules as the app: food and parking records can't be edited, and Check Out only fills a blank Time Out. These rules hold even if someone calls the URL directly.
- All Sheet cells are stored as plain text, so Sheets never turns `2026-10` or `08:30` into dates.
- You can read the Sheet freely, but avoid editing it by hand while staff are using the app, and keep the header row exactly as it is.

## MVP vs. future improvements

**In this MVP**
- Home with three large buttons, plus Back navigation on every screen
- Masterlist: search, filter by sport and month, add and edit
- Food: entry form with required-field checks. Date, sport and staff carry over to the next entry.
- Food Summary: Breakfast / Lunch / Dinner / overall totals by date and sport
- Compiled Food Form: one signature box (finger or mouse) and a **Print Form** button
- Parking: Vehicle In (time defaults to now), Vehicle Out cards with Check Out, parking log by date
- Screens open on today's data (Food Summary, Parking Log) or the current month (Masterlist), with a date picker and a Today button
- Works on phones, tablets and desktops. Sample data included.
- Optional Google Sheets backend so all staff share the same records, protected by a staff passcode
- Delete for all three modules, with confirmation

**Future improvements**
- Staff login and roles (e.g. only Masterlist staff can edit the Masterlist)
- Individual staff logins and an audit trail instead of one shared passcode
- Saving the food signature with the form, instead of only printing it
- Export to Excel/PDF and month-end reports
- Importing the monthly Masterlist from the existing spreadsheet
- Linking food and parking entries to Masterlist IDs

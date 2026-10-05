/*
 * Router: shows the right screen for the address after "#".
 * e.g. index.html#/food/new → New Food Entry.
 * `back` is where the Back button goes from each screen.
 * `isPublic` screens are for parents: no staff navigation, no passcode.
 */
const ROUTES = [
  { pattern: /^\/$/, title: 'Home', back: null, screen: Screens.home },

  { pattern: /^\/masterlist$/, title: 'Masterlist', back: '#/', screen: Screens.masterlist },
  { pattern: /^\/masterlist\/new$/, title: 'Add Person', back: '#/masterlist', screen: Screens.masterlistForm },
  { pattern: /^\/masterlist\/edit\/([^/]+)$/, title: 'Edit Person', back: '#/masterlist', screen: Screens.masterlistForm },

  { pattern: /^\/food$/, title: 'Food', back: '#/', screen: Screens.food },
  { pattern: /^\/food\/new$/, title: 'New Food Entry', back: '#/food', screen: Screens.foodEntry },
  { pattern: /^\/food\/summary$/, title: 'Food Summary', back: '#/food', screen: Screens.foodSummary },

  { pattern: /^\/parking$/, title: 'Parking', back: '#/', screen: Screens.parking },
  { pattern: /^\/parking\/in$/, title: 'Vehicle In', back: '#/parking', screen: Screens.vehicleIn },
  { pattern: /^\/parking\/out$/, title: 'Vehicle Out', back: '#/parking', screen: Screens.vehicleOut },

  { pattern: /^\/consents$/, title: 'Consent Forms', back: '#/', screen: Screens.consents },
  { pattern: /^\/consents\/([^/]+)$/, title: 'Consent Form', back: '#/consents', screen: Screens.consentDetail },

  // Parent-facing
  { pattern: /^\/consent$/, title: 'Consent Form', isPublic: true, screen: Screens.consentForm },
];

async function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  const route = ROUTES.find((r) => r.pattern.test(path));
  if (!route) {
    location.hash = '#/';
    return;
  }

  const isHome = !route.back;
  document.body.classList.toggle('is-public', Boolean(route.isPublic));
  document.querySelector('.brand').setAttribute('href', route.isPublic ? '#/consent' : '#/');
  document.getElementById('page-bar').hidden = isHome;
  document.getElementById('back-button').href = route.back || '#/';
  document.getElementById('page-title').textContent = route.title;
  document.title = isHome && !route.isPublic ? 'UAAP Centralized System' : `${route.title} · UAAP Centralized System`;

  const main = document.getElementById('main');
  main.innerHTML = '<p class="loading">Loading…</p>';
  window.scrollTo(0, 0);
  try {
    await route.screen(main, ...path.match(route.pattern).slice(1));
    passcodeJustEntered = false;
  } catch (err) {
    if (err.needsPasscode) {
      askForPasscode();
      return;
    }
    console.error(err);
    main.innerHTML = `<div class="card notice notice--error">${esc(err.message || 'Something went wrong.')}
      Please go back and try again.</div>`;
  }
}

// True right after staff submit a passcode, so a refusal can say it was wrong.
let passcodeJustEntered = false;

/** Ask for the staff passcode, then show the screen that needed it. */
function askForPasscode() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <form class="card form passcode-form" novalidate>
      <h2>Staff passcode</h2>
      <p class="hint">Enter the passcode from your UAAP supervisor. You only need to do this once on this device.</p>
      ${fieldHtml({
        name: 'passcode', label: 'Passcode', required: true,
        control: '<input id="f-passcode" name="passcode" type="password" autocomplete="current-password">',
      })}
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">Continue</button>
      </div>
    </form>`;
  const form = main.querySelector('form');
  if (passcodeJustEntered) showErrors(form, { passcode: "That passcode didn't work. Please check it and try again." });
  passcodeJustEntered = false;
  form.querySelector('input').focus();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { passcode } = readForm(form);
    if (!showErrors(form, checkRequired({ passcode }, { passcode: 'the passcode' }))) return;
    Store.setPasscode(passcode);
    passcodeJustEntered = true;
    form.querySelector('[type=submit]').disabled = true;
    form.querySelector('[type=submit]').textContent = 'Checking…';
    render();
  });
}

window.addEventListener('hashchange', render);
render();

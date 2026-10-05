/*
 * Router: shows the right screen for the address after "#".
 * e.g. index.html#/food/new → New Food Entry.
 * `back` is where the Back button goes from each screen.
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
];

async function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  const route = ROUTES.find((r) => r.pattern.test(path));
  if (!route) {
    location.hash = '#/';
    return;
  }

  const isHome = !route.back;
  document.getElementById('page-bar').hidden = isHome;
  document.getElementById('back-button').href = route.back || '#/';
  document.getElementById('page-title').textContent = route.title;
  document.title = isHome ? 'UAAP Centralized System' : `${route.title} · UAAP Centralized System`;

  const main = document.getElementById('main');
  main.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    await route.screen(main, ...path.match(route.pattern).slice(1));
  } catch (err) {
    console.error(err);
    main.innerHTML = '<div class="card notice notice--error">Something went wrong. Please go back and try again.</div>';
  }
}

window.addEventListener('hashchange', render);
render();

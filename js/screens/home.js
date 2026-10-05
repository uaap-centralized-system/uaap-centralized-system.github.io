window.Screens = window.Screens || {};

Screens.home = function (el) {
  el.innerHTML = `
    <section class="home">
      <h1 class="home-title">What would you like to do?</h1>
      <div class="tiles">
        <a class="tile tile--masterlist" href="#/masterlist">
          <span class="tile-icon">${icon('list')}</span>
          <span class="tile-title">Masterlist</span>
          <span class="tile-sub">Personnel list by sport and month</span>
        </a>
        <a class="tile tile--food" href="#/food">
          <span class="tile-icon">${icon('food')}</span>
          <span class="tile-title">Food</span>
          <span class="tile-sub">Record food given to each team</span>
        </a>
        <a class="tile tile--parking" href="#/parking">
          <span class="tile-icon">${icon('car')}</span>
          <span class="tile-title">Parking</span>
          <span class="tile-sub">Vehicle in and vehicle out</span>
        </a>
      </div>
      <p class="demo-note">
        Prototype: records are saved in this browser only.
        <button type="button" class="link-button" id="reset-data">Reset sample data</button>
      </p>
    </section>`;

  el.querySelector('#reset-data').addEventListener('click', async () => {
    if (!confirm('Erase all changes and go back to the sample data?')) return;
    await Store.resetToSampleData();
    toast('Sample data restored.');
  });
};

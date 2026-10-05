/*
 * Dropdown choices and sample records for the prototype.
 * All names are fictional. Sample dates are set relative to today so the
 * screens always have something to show.
 */

const OPTIONS = {
  sports: ['Basketball', 'Volleyball'],
  departments: [
    'Table Officials',
    'UAAP Staff',
    'Media',
    'Officiating Team',
    'Venue Staff',
    'School Delegations',
  ],
  adminStaff: ['Food Staff 1', 'Parking Staff 1', 'Masterlist Staff 1', 'Masterlist Staff 2'],
  meals: ['Breakfast', 'Lunch', 'Dinner'],
};

const SAMPLE_DATA = (function () {
  const now = new Date();
  const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return toISODate(d);
  };
  const thisMonth = toISOMonth(now);
  const lastMonth = toISOMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const today = daysAgo(0);
  const yesterday = daysAgo(1);

  const person = (personId, fullName, organization, sport, period, active = true) =>
    ({ personId, fullName, organization, sport, period, active });

  const food = (foodRecordId, date, sport, department, representativeName, meal, quantity, notes = '') =>
    ({ foodRecordId, date, sport, department, representativeName, meal, quantity, adminStaff: 'Food Staff 1', notes });

  const parking = (parkingRecordId, date, name, plateNumber, timeIn, timeOut, notes = '') =>
    ({ parkingRecordId, date, name, plateNumber, timeIn, timeOut, adminStaff: 'Parking Staff 1', notes });

  return {
    masterlist: [
      person('P-0001', 'Juan Dela Cruz', 'Table Officials', 'Basketball', thisMonth),
      person('P-0002', 'Maria Halimbawa', 'Table Officials', 'Basketball', thisMonth),
      person('P-0003', 'Pedro Sample', 'Officiating Team', 'Basketball', thisMonth),
      person('P-0004', 'Ana Testing', 'Media', 'Basketball', thisMonth),
      person('P-0005', 'Jose Placeholder', 'Venue Staff', 'Basketball', thisMonth),
      person('P-0006', 'Liza Demo', 'UAAP Staff', 'Basketball', thisMonth),
      person('P-0007', 'Carlo Example', 'Officiating Team', 'Volleyball', thisMonth),
      person('P-0008', 'Bea Mockup', 'Table Officials', 'Volleyball', thisMonth),
      person('P-0009', 'Rico Fictional', 'Media', 'Volleyball', thisMonth),
      person('P-0010', 'Tess Sampleton', 'School Delegations', 'Volleyball', thisMonth),
      person('P-0011', 'Mark Prototype', 'Venue Staff', 'Volleyball', lastMonth, false),
      person('P-0012', 'Joy Dummy', 'UAAP Staff', 'Basketball', lastMonth),
    ],

    food: [
      food('F-0001', today, 'Basketball', 'Venue Staff', 'Jose Placeholder', 'Breakfast', 12),
      food('F-0002', today, 'Basketball', 'Table Officials', 'Juan Dela Cruz', 'Breakfast', 10),
      food('F-0003', today, 'Basketball', 'Table Officials', 'Maria Halimbawa', 'Lunch', 10, 'For the whole TO team'),
      food('F-0004', today, 'Basketball', 'Media', 'Ana Testing', 'Lunch', 6),
      food('F-0005', today, 'Basketball', 'Officiating Team', 'Pedro Sample', 'Lunch', 8),
      food('F-0006', today, 'Volleyball', 'Table Officials', 'Bea Mockup', 'Lunch', 7),
      food('F-0007', today, 'Volleyball', 'Media', 'Rico Fictional', 'Lunch', 4, '1 vegetarian meal'),
      food('F-0008', yesterday, 'Basketball', 'UAAP Staff', 'Liza Demo', 'Dinner', 15),
      food('F-0009', yesterday, 'Volleyball', 'Officiating Team', 'Carlo Example', 'Lunch', 6),
    ],

    parking: [
      parking('PK-0001', yesterday, 'Juan Dela Cruz', 'ABC 1234', '08:15', '17:40'),
      parking('PK-0002', yesterday, 'Rico Fictional', 'NDX 4521', '09:02', '15:30'),
      parking('PK-0003', today, 'Pedro Sample', 'XYZ 5678', '07:45', '12:10'),
      parking('PK-0004', today, 'Maria Halimbawa', 'DAQ 9012', '08:30', ''),
      parking('PK-0005', today, 'Ana Testing', 'NBC 3456', '09:10', '', 'Media van'),
      parking('PK-0006', today, 'Carlo Example', 'TUV 7788', '10:05', ''),
    ],
  };
})();

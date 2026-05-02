import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check } from 'k6';

// Backend URL
const BE_URL = 'http://gateway-lb:4000/api/v1';

// Load passengers with tokens
const passengers = new SharedArray('passengers', () => {
  return papaparse
    .parse(open('./csv/users_with_token.csv'), { header: false })
    .data.map((row) => ({
      token: row[2],
    }));
});

// Generate random coordinate around a base point
function randomLocation() {
  const baseLat = 10.762622;
  const baseLng = 106.660172;

  return {
    lat: baseLat + (Math.random() - 0.5) * 0.01,
    lng: baseLng + (Math.random() - 0.5) * 0.01,
  };
}

function randomVehicleType() {
  const rand = Math.random(); // 0 → 1
  if (rand < 0.5) return 'MOTORBIKE'; // 5/10
  if (rand < 0.5 + 0.3) return 'CAR_4_SEATS'; // 3/10
  return 'CAR_7_SEATS'; // 2/10
}

export const options = {
  scenarios: {
    create_trip: {
      executor: 'ramping-arrival-rate',

      startRate: 5,
      timeUnit: '1s',

      preAllocatedVUs: 100,
      maxVUs: 500,

      stages: [
        { target: 50, duration: '10s' }, // warm up nhẹ
        { target: 100, duration: '20s' }, // mid
        { target: 150, duration: '20s' }, // giữ ổn định
        { target: 250, duration: '30s' }, // tiến dần
        { target: 350, duration: '30s' }, // peak nhưng vẫn trong khả năng
      ],
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500'], // nới nhẹ vì khi load sẽ tinggi
    http_req_failed: ['rate<0.02'], // 2% fail cho phép
  },
};

export default function () {
  const user = passengers[Math.floor(Math.random() * passengers.length)];

  const pickup = randomLocation();
  const dropOff = randomLocation();

  const payload = JSON.stringify({
    vehicleType: randomVehicleType(),
    pickup: {
      lat: pickup.lat,
      lng: pickup.lng,
    },
    dropOff: {
      lat: dropOff.lat,
      lng: dropOff.lng,
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
  };

  const res = http.post(`${BE_URL}/trips`, payload, params);

  check(res, {
    'status 2xx': (r) => r.status >= 200 && r.status < 300,
  });
}

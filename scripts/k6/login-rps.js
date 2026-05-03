import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check } from 'k6';

const BE_URL = 'http://gateway-lb/api/v1';

// Load user list from CSV (sharing for all VUs)
const users = new SharedArray('users', () => {
  return papaparse.parse(open('./csv/users.csv'), {
    header: false,
  }).data;
});

export const options = {
  scenarios: {
    capacity_test: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { target: 20, duration: '20s' },
        { target: 50, duration: '20s' },
        { target: 100, duration: '20s' },
        { target: 150, duration: '20s' },
        { target: 120, duration: '30s' },
      ],
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<400'], // p95 dưới 400ms
    http_req_failed: ['rate<0.001'], // lỗi < 0.1%
  },
};

export default function () {
  const user = users[__ITER % users.length];
  const email = user[0];
  const password = user[1];

  const res = http.post(
    `${BE_URL}/sessions`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(res, {
    'login success': (r) => r.status >= 200 && r.status < 300,
  });
}

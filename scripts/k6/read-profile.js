import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check } from 'k6';

// Backend URL
const BE_URL = 'http://gateway-lb:4000/api/v1';

// Load tokens from CSV
const usersWithTokens = new SharedArray('users', () => {
  return papaparse
    .parse(open('./csv/users_with_token.csv'), { header: false })
    .data.map((row) => ({ email: row[0], token: row[2] }));
});

export const options = {
  scenarios: {
    read_heavy: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 200, // tăng lên để đủ tải
      maxVUs: 1000, // để k6 không bị thiếu VU
      stages: [
        { target: 100, duration: '20s' }, // 0 → 100 trong 30s
        { target: 300, duration: '20s' }, // 100 → 300 trong 30s
        { target: 500, duration: '30s' }, // 300 → 500 trong 30s
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Random pick user
  const user =
    usersWithTokens[Math.floor(Math.random() * usersWithTokens.length)];

  // GET user profile
  const res = http.get(`${BE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });

  check(res, {
    'status 2xx': (r) => r.status >= 200 && r.status < 300,
  });
}

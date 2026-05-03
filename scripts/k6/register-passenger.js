import http from 'k6/http';
import { check } from 'k6';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

const BE_URL = 'http://gateway-lb/api/v1';

// Load CSV files
const usersFile = open('./csv/users.csv');

// Parse CSV data
const usersList = papaparse
  .parse(usersFile, { header: false })
  .data.filter((row) => row[0]);

// Combine both lists with their roles
const allUsers = [
  ...usersList.map((row) => ({
    email: row[0],
    password: row[1],
    role: 'passenger',
  })),
];

export const options = {
  scenarios: {
    sequential_register: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: allUsers.length,
      maxDuration: '30m',
    },
  },
};

export default function () {
  const userIndex = __ITER;

  if (userIndex >= allUsers.length) {
    return;
  }

  const user = allUsers[userIndex];

  // Extract name from email (e.g., passenger1 from passenger1@gmail.com)
  const emailPrefix = user.email.split('@')[0];
  const fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

  const payload = {
    email: user.email,
    fullName: fullName,
    password: user.password,
    phone: `090${Math.random().toString().substring(2, 10)}`,
    role: user.role,
  };

  const res = http.post(`${BE_URL}/users`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'has userId in response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id || body.userId;
      } catch {
        return false;
      }
    },
  });
}

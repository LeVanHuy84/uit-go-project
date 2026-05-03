import http from 'k6/http';
import { check } from 'k6';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { SharedArray } from 'k6/data';

const BE_URL = 'http://gateway-lb/api/v1';

const drivers = new SharedArray('drivers', () => {
  return papaparse
    .parse(open('./csv/driver.csv'), {
      header: false,
    })
    .data.filter((row) => row[0]);
});

const vehicleTypes = ['MOTORBIKE', 'CAR_4_SEATS', 'CAR_7_SEATS'];

function buildFullName(email) {
  const emailPrefix = email.split('@')[0];
  return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
}

function buildPhone(index) {
  const suffix = String(index + 1).padStart(7, '0');
  return `09${suffix}`;
}

function buildDriverProfile(index) {
  const safeIndex = index + 1;
  return {
    licenseNumber: `GPLX-${String(safeIndex).padStart(6, '0')}`,
    vehicleType: vehicleTypes[index % vehicleTypes.length],
    vehicleBrand: ['Honda', 'Yamaha', 'Toyota'][index % 3],
    vehicleModel: ['Vision', 'Exciter', 'Vios'][index % 3],
    licensePlate: `51${String(safeIndex).padStart(4, '0')}`,
  };
}

export const options = {
  scenarios: {
    sequential_register: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: drivers.length,
      maxDuration: '30m',
    },
  },
};

function postJson(url, payload, headers = {}) {
  return http.post(url, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function putJson(url, payload, headers = {}) {
  return http.put(url, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function loginAndGetToken(email, password) {
  const loginRes = postJson(`${BE_URL}/sessions`, { email, password });

  check(loginRes, {
    'login status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'login response has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body.access_token);
      } catch {
        return false;
      }
    },
  });

  const body = JSON.parse(loginRes.body);
  return body.access_token;
}

export default function () {
  const driverIndex = __ITER;

  if (driverIndex >= drivers.length) {
    return;
  }

  const driver = drivers[driverIndex];
  const email = driver[0];
  const password = driver[1];
  const fullName = buildFullName(email);
  const phone = buildPhone(driverIndex);
  const driverProfile = buildDriverProfile(driverIndex);

  const registerRes = postJson(`${BE_URL}/users`, {
    email,
    fullName,
    password,
    phone,
    role: 'driver',
  });

  check(registerRes, {
    'register status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'register response has user id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body.id || body.userId);
      } catch {
        return false;
      }
    },
  });

  const token = loginAndGetToken(email, password);

  const updateProfileRes = putJson(
    `${BE_URL}/users/me`,
    {
      fullName,
      phone,
    },
    {
      Authorization: `Bearer ${token}`,
    },
  );

  check(updateProfileRes, {
    'update profile status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  const driverProfileRes = postJson(
    `${BE_URL}/users/register-driver-profile`,
    driverProfile,
    {
      Authorization: `Bearer ${token}`,
    },
  );

  check(driverProfileRes, {
    'driver profile status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });
}

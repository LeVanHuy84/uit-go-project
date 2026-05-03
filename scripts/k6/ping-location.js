import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

const BE_URL = 'http://gateway-lb/api/v1';

// Load drivers
const drivers = new SharedArray('drivers', () => {
  return papaparse
    .parse(open('./csv/driver_with_all.csv'), { header: false })
    .data.map((row) => ({
      driverId: row[3],
      token: row[2],
      vehicleType: row[4],
    }));
});

export const options = {
  vus: drivers.length, // mỗi VU = 1 driver
  duration: '40m', // chạy đủ lâu để thấy các giai đoạn tăng dần
};

// Random location generator
function randomLocation() {
  const baseLat = 10.762622;
  const baseLng = 106.660172;

  return {
    lat: baseLat + (Math.random() - 0.5) * 0.01,
    lng: baseLng + (Math.random() - 0.5) * 0.01,
  };
}

// state local cho mỗi VU
let hasSentStatus = false;

export default function () {
  const index = __VU - 1; // VU index tương ứng với driver index
  const driver = drivers[index];

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driver.token}`,
    },
  };

  // 1) GỬI ONLINE STATUS LẦN ĐẦU
  if (!hasSentStatus) {
    const body = JSON.stringify({
      status: 'ONLINE',
      vehicleType: driver.vehicleType,
    });

    const res = http.put(
      `${BE_URL}/drivers/${driver.driverId}/status`,
      body,
      params,
    );

    check(res, { 'status updated 200': (r) => r.status === 200 });

    // console.log(`Driver ${driver.driverId} ONLINE`);
    hasSentStatus = true;
  }

  // 2) GỬI LOCATION MỖI 30 GIÂY
  const location = JSON.stringify(randomLocation());

  const res2 = http.put(
    `${BE_URL}/drivers/${driver.driverId}/location`,
    location,
    params,
  );

  check(res2, { 'location updated 200': (r) => r.status === 200 });

  sleep(30);
}

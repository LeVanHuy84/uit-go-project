import fs from 'fs';
import Papa from 'papaparse';
import axios from 'axios';

// Cấu hình
const BE_URL = 'http://localhost:4000/api/v1';
const INPUT_CSV = './scripts/csv/driver.csv'; // file CSV gốc: email,password
const OUTPUT_CSV = './scripts/csv/driver_with_all.csv'; // file CSV có thêm token, VerhicleType

// Đọc CSV
const rawCSV = fs.readFileSync(INPUT_CSV, 'utf8');
const users = Papa.parse(rawCSV, { header: false }).data;

// Hàm login lấy token
async function login(email, password) {
  try {
    const res = await axios.post(
      `${BE_URL}/sessions`,
      { email, password },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return res.data.access_token;
  } catch (err) {
    throw new Error(
      `Login failed for ${email}: ${err.response?.status || err.message}`
    );
  }
}

async function getDriverInfo(token) {
  try {
    const res = await axios.get(`${BE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      vehicleType: res.data.driverProfile.vehicleType,
      userId: res.data.id,
    };
  } catch (err) {
    throw new Error(
      `Fetching driver info failed: ${err.response?.status || err.message}`
    );
  }
}

// Main
(async () => {
  const outputData = [];
  for (const [email, password] of users) {
    const token = await login(email, password);
    const { vehicleType, userId } = await getDriverInfo(token);
    outputData.push([email, password, token, userId, vehicleType]);
    console.log(`Got token for ${email}`);
  }

  // Chuyển sang CSV
  const csv = Papa.unparse(outputData);
  fs.writeFileSync(OUTPUT_CSV, csv);
  console.log(`Saved tokens to ${OUTPUT_CSV}`);
})();

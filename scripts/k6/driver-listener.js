import amqp from 'amqplib';
import fs from 'fs';
import Papa from 'papaparse';
import axios from 'axios';

const BE_URL = 'http://localhost:4000/api/v1';
const RABBITMQ = 'amqp://guest:guest@localhost:5672';
const DRIVER_CSV = './k6/csv/driver_with_all.csv';

const http = axios.create({
  timeout: 5000,
  maxRedirects: 0,
  validateStatus: () => true,
});

function loadDrivers(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const parsed = Papa.parse(raw, { header: false });
  const map = new Map();

  parsed.data.forEach((row) => {
    const [email, password, token, driverId, vehicleType] = row;
    if (!driverId || !token) return;
    map.set(driverId.trim(), {
      driverId: driverId.trim(),
      token: token.trim(),
      vehicleType: vehicleType?.trim(),
    });
  });

  return map;
}

const drivers = loadDrivers(DRIVER_CSV);

let stats = {
  assigned: 0,
  accepted: 0,
  completed: 0,
  requests: 0,
  failed: 0,
};

async function acceptTrip(driver, tripId) {
  stats.assigned++;
  stats.requests++;
  try {
    await http.post(
      `${BE_URL}/drivers/accept`,
      { tripId, driverId: driver.driverId },
      { headers: { Authorization: `Bearer ${driver.token}` } },
    );
    stats.accepted++;

    await new Promise((r) => setTimeout(r, 2000));
    stats.requests++;
    await http.post(
      `${BE_URL}/trips/${tripId}/complete`,
      {},
      { headers: { Authorization: `Bearer ${driver.token}` } },
    );
    stats.completed++;
  } catch (err) {
    stats.failed++;
    console.error(
      `Error in accept/complete for driver ${driver.driverId}:`,
      err.response?.data || err.message,
    );
  }
}

async function listenAssigns() {
  const conn = await amqp.connect(RABBITMQ);
  const ch = await conn.createChannel();

  const EXCHANGE = 'notification';
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

  const q = await ch.assertQueue('', { exclusive: true });
  await ch.bindQueue(q.queue, EXCHANGE, 'driver.assigned');

  console.log('Driver simulator listening for assignments...');

  ch.consume(
    q.queue,
    async (msg) => {
      if (!msg) return;
      try {
        const body = JSON.parse(msg.content.toString());
        const routing = msg.fields.routingKey;

        const driver = drivers.get(body.driverId);
        if (!driver) return;

        if (routing.endsWith('.assigned')) {
          await acceptTrip(driver, body.tripId);
        }
      } catch (err) {
        stats.failed++;
        console.error('MQ message parse error', err);
      }
    },
    { noAck: true },
  );

  conn.on('close', () => {
    console.log('MQ connection closed, reconnecting...');
    setTimeout(listenAssigns, 2000);
  });
}

process.on('SIGINT', () => {
  console.log('\n===== SUMMARY =====');
  console.log('assigned:', stats.assigned);
  console.log('accepted:', stats.accepted);
  console.log('completed:', stats.completed);
  console.log('requests:', stats.requests);
  console.log('failed:', stats.failed);
  console.log('===================\n');
  process.exit(0);
});

listenAssigns();

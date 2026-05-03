import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

// =====================================================
// Custom Metrics
// =====================================================
const tripCreateTrend = new Trend('trip_create_latency_ms');
const tripCreateRate = new Rate('trip_create_success');
const errors = new Counter('errors_total');

// =====================================================
// Environment Config
// =====================================================
const BASE = __ENV.BE_URL || 'http://gateway-lb/api/v1';
const RUN_MODE = __ENV.RUN_MODE || 'full';

// =====================================================
// Shared User Dataset
// =====================================================
const users = new SharedArray('users', () => {
  return papaparse
    .parse(open('./csv/users_with_token.csv'), {
      header: false,
    })
    .data.filter((r) => r && r.length > 2 && r[2])
    .map((r) => ({
      email: r[0],
      token: r[2],
    }));
});

// =====================================================
// Helpers
// =====================================================
function thinkTime(min = 1, max = 5) {
  return Math.random() * (max - min) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomVehicleType() {
  const rand = Math.random();

  if (rand < 0.5) return 'MOTORBIKE';
  if (rand < 0.8) return 'CAR_4_SEATS';

  return 'CAR_7_SEATS';
}

function numEnv(name, fallback) {
  const value = Number(__ENV[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// =====================================================
// Scenario Timeline
// =====================================================

/*
00:00 → 02:00 NORMAL
02:30 → 12:30 STRESS
13:00 → 13:30 SPIKE
14:00 → 44:00 SOAK
*/

// =====================================================
// Full Scenario Suite
// =====================================================
const fullScenarios = {
  // =================================================
  // NORMAL LOAD
  // =================================================
  normal: {
    executor: 'constant-vus',

    startTime: __ENV.NORMAL_START || '0s',

    vus: Number(__ENV.NORMAL_VUS) || 40,

    duration: __ENV.NORMAL_DURATION || '2m',

    exec: 'normalFlow',
  },

  // =================================================
  // STRESS TEST
  // Gradually increase concurrent users
  // =================================================
  stress: {
    executor: 'ramping-vus',

    startTime: __ENV.STRESS_START || '2m30s',

    startVUs: 10,

    stages: [
      {
        duration: '2m',
        target: 50,
      },
      {
        duration: '2m',
        target: 100,
      },
      {
        duration: '2m',
        target: 150,
      },
      {
        duration: '2m',
        target: 180,
      },
      {
        duration: '2m',
        target: 200,
      },
    ],

    gracefulRampDown: '30s',

    exec: 'normalFlow',
  },

  // =================================================
  // SPIKE TEST
  // Sudden burst traffic
  // =================================================
  spike: {
    executor: 'ramping-arrival-rate',

    startTime: __ENV.SPIKE_START || '13m',

    timeUnit: '1s',

    startRate: numEnv('SPIKE_START_RATE', 50),

    stages: [
      {
        duration: '5s',
        target: numEnv('SPIKE_TARGET_1', 100),
      },
      {
        duration: '5s',
        target: numEnv('SPIKE_TARGET_2', 250),
      },
      {
        duration: '15s',
        target: numEnv('SPIKE_TARGET_3', 300),
      },
      {
        duration: '5s',
        target: numEnv('SPIKE_TARGET_4', 0),
      },
    ],

    preAllocatedVUs: numEnv('SPIKE_PREALLOCATED_VUS', 500),

    maxVUs: numEnv('SPIKE_MAX_VUS', 1000),

    exec: 'normalFlow',
  },

  // =================================================
  // SOAK TEST
  // Long-running stability validation
  // =================================================
  soak: {
    executor: 'constant-vus',

    startTime: __ENV.SOAK_START || '14m',

    vus: Number(__ENV.SOAK_VUS) || 50,

    duration: __ENV.SOAK_DURATION || '30m',

    exec: 'normalFlow',
  },
};

// =====================================================
// Quick Smoke Test
// =====================================================
const normalOnlyScenario = {
  normal: {
    executor: 'constant-vus',

    vus: Number(__ENV.NORMAL_VUS) || 10,

    duration: __ENV.NORMAL_DURATION || '45s',

    exec: 'normalFlow',
  },
};

// =====================================================
// k6 Options
// =====================================================
export const options = {
  scenarios: RUN_MODE === 'normal-only' ? normalOnlyScenario : fullScenarios,

  thresholds: {
    // =========================
    // SLA Thresholds
    // =========================
    'http_req_duration{scenario:normal}': ['p(95)<500'],

    'http_req_duration{scenario:stress}': ['p(95)<1200'],

    'http_req_duration{scenario:spike}': ['p(95)<2000'],

    'http_req_duration{scenario:soak}': ['p(95)<800'],

    // =========================
    // Reliability
    // =========================
    http_req_failed: ['rate<0.1'],

    trip_create_success: ['rate>0.8'],

    errors_total: ['count<1000'],
  },
};

// =====================================================
// Main Business Flow
// =====================================================
export function normalFlow() {
  // =================================================
  // Validate dataset
  // =================================================
  if (!users || users.length === 0) {
    console.error('No users loaded — preload required');

    return;
  }

  // =================================================
  // Random user
  // =================================================
  const user = pickRandom(users);

  // =================================================
  // Request payload
  // =================================================
  const payload = JSON.stringify({
    vehicleType: randomVehicleType(),

    pickup: {
      lat: 10.762622,
      lng: 106.660172,
    },

    dropOff: {
      lat: 10.776889,
      lng: 106.700806,
    },
  });

  // =================================================
  // Request params
  // =================================================
  const params = {
    headers: {
      'Content-Type': 'application/json',

      Authorization: `Bearer ${user.token}`,
    },

    tags: {
      scenario: exec.scenario.name,
      user: user.email,
    },

    timeout: '60s',
  };

  // =================================================
  // Execute request
  // =================================================
  const start = Date.now();

  const res = http.post(`${BASE}/trips`, payload, params);

  const latency = Date.now() - start;

  // =================================================
  // Metrics
  // =================================================
  tripCreateTrend.add(latency);

  const ok = check(res, {
    'created trip (2xx)': (r) => r.status >= 200 && r.status < 300,
  });

  tripCreateRate.add(ok);

  // =================================================
  // Error logging
  // =================================================
  if (!ok) {
    errors.add(1);

    console.error(`[${exec.scenario.name}] ${res.status} -> ${res.body}`);
  }

  // =================================================
  // Think Time
  // IMPORTANT:
  // No think time for SPIKE test
  // =================================================
  if (exec.scenario.name !== 'spike') {
    sleep(thinkTime(0.5, 3));
  }
}

export default function () {}

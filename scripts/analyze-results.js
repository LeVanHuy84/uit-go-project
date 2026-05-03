#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// =====================================================
// Read NDJSON
// =====================================================
function readNdjson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (e) {
    console.error(`Failed reading ${filePath}`, e);

    return [];
  }
}

// =====================================================
// Percentile
// =====================================================
function percentile(arr, p) {
  if (!arr.length) return 0;

  const sorted = [...arr].sort((a, b) => a - b);

  const index = Math.floor(sorted.length * p);

  return sorted[index] || 0;
}

// =====================================================
// Empty Scenario Summary
// =====================================================
function createScenarioSummary() {
  return {
    total_requests: 0,
    checks_passed: 0,
    checks_failed: 0,
    errors: 0,
    durations: [],
  };
}

// =====================================================
// Summarize by Scenario
// =====================================================
function summarize(events) {
  const scenarios = {
    normal: createScenarioSummary(),
    stress: createScenarioSummary(),
    spike: createScenarioSummary(),
    soak: createScenarioSummary(),
    default: createScenarioSummary(),
  };

  for (const e of events) {
    if (e.type !== 'Point') continue;

    const metric = e.metric;

    const value = e.data?.value;

    const scenario = e.data?.tags?.scenario || 'default';

    if (!scenarios[scenario]) {
      scenarios[scenario] = createScenarioSummary();
    }

    const s = scenarios[scenario];

    // =========================================
    // Requests
    // =========================================
    if (metric === 'http_reqs' && typeof value === 'number') {
      s.total_requests += value;
    }

    // =========================================
    // Duration
    // =========================================
    if (metric === 'http_req_duration' && typeof value === 'number') {
      s.durations.push(value);
    }

    // =========================================
    // Checks
    // =========================================
    if (metric === 'checks' && typeof value === 'number') {
      if (value === 1) {
        s.checks_passed++;
      } else {
        s.checks_failed++;
      }
    }

    // =========================================
    // Errors
    // =========================================
    if (metric === 'http_req_failed' && value === 1) {
      s.errors++;
    }
  }

  // =============================================
  // Final Aggregation
  // =============================================
  for (const key of Object.keys(scenarios)) {
    const s = scenarios[key];

    const avg =
      s.durations.length > 0
        ? s.durations.reduce((a, b) => a + b, 0) / s.durations.length
        : 0;

    s.avg_req_duration = avg.toFixed(2);

    s.p95 = percentile(s.durations, 0.95).toFixed(2);

    delete s.durations;
  }

  return scenarios;
}

// =====================================================
// CSV
// =====================================================
function toCsv(rows, headers) {
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
  }

  return lines.join('\n');
}

// =====================================================
// Main
// =====================================================
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node analyze-results.js <json files>');

    process.exit(1);
  }

  const allRows = [];
  const markdown = [];

  markdown.push('# Load Test Report');
  markdown.push('');

  for (const file of args) {
    console.log(`Analyzing ${file}...`);

    const events = readNdjson(file);

    const scenarios = summarize(events);

    markdown.push(`# ${path.basename(file)}`);

    markdown.push('');

    markdown.push(
      '| Scenario | Requests | avg(ms) | p95(ms) | errors | checks passed | checks failed |',
    );

    markdown.push('|---|---:|---:|---:|---:|---:|---:|');

    for (const [scenario, s] of Object.entries(scenarios)) {
      // skip empty scenarios
      if (
        s.total_requests === 0 &&
        s.checks_passed === 0 &&
        s.checks_failed === 0
      ) {
        continue;
      }

      markdown.push(
        `| ${scenario} | ${s.total_requests} | ${s.avg_req_duration} | ${s.p95} | ${s.errors} | ${s.checks_passed} | ${s.checks_failed} |`,
      );

      allRows.push({
        file: path.basename(file),
        scenario,
        total_requests: s.total_requests,
        avg_req_duration: s.avg_req_duration,
        p95: s.p95,
        errors: s.errors,
        checks_passed: s.checks_passed,
        checks_failed: s.checks_failed,
      });
    }

    markdown.push('');
  }

  markdown.push('## Recommendations');

  markdown.push('- Review p95 latency differences between scenarios.');

  markdown.push(
    '- Compare spike/stress behavior against CPU and memory metrics in Grafana.',
  );

  // =====================================================
  // Ensure dirs
  // =====================================================
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results');
  }

  if (!fs.existsSync('reports')) {
    fs.mkdirSync('reports');
  }

  // =====================================================
  // CSV Export
  // =====================================================
  const headers = [
    'file',
    'scenario',
    'total_requests',
    'avg_req_duration',
    'p95',
    'errors',
    'checks_passed',
    'checks_failed',
  ];

  fs.writeFileSync('results/summary.csv', toCsv(allRows, headers));

  // =====================================================
  // Markdown Export
  // =====================================================
  fs.writeFileSync('reports/report.md', markdown.join('\n'));

  console.log('Wrote results/summary.csv and reports/report.md');
}

main();

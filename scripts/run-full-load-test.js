#!/usr/bin/env node
/* Orchestrator: 1) run preloads 2) start background k6 processes (drivers pings & listener) 3) run trip generator scenario 4) collect results and analyze */
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(__filename);

function run(shellCmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(shellCmd, {
      stdio: 'inherit',
      shell: true,
      cwd: SCRIPTS_DIR,
      ...opts,
    });
    p.on('close', (code) =>
      code === 0
        ? resolve(code)
        : reject(new Error(`Command exited ${code}: ${shellCmd}`)),
    );
  });
}

async function main() {
  console.log('Orchestrator: preload users and drivers');

  // run preloads (Node scripts) from scripts dir
  if (existsSync(path.join(SCRIPTS_DIR, 'k6/passenger-preload.js'))) {
    console.log('  → running passenger-preload.js');
    await run('node k6/passenger-preload.js');
  }
  if (existsSync(path.join(SCRIPTS_DIR, 'k6/driver-preload.js'))) {
    console.log('  → running driver-preload.js');
    await run('node k6/driver-preload.js');
  }

  // ensure results directory exists in mounted volume: host scripts/k6/results -> container /k6/results
  const resultsDir = path.join(SCRIPTS_DIR, 'k6', 'results');
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });

  // quick sanity run: normal-only to verify create-trip success before long full-flow
  if (process.env.SKIP_SMOKE !== '1') {
    console.log('Running quick normal-only smoke test first...');
    const smokeOut = `json=/k6/results/smoke-normal-${Date.now()}.json`;
    const smokeCmd = [
      'docker compose run --rm',
      '-e RUN_MODE=normal-only',
      `-e NORMAL_VUS=${process.env.SMOKE_VUS || '10'}`,
      `-e NORMAL_DURATION=${process.env.SMOKE_DURATION || '45s'}`,
      'k6 run',
      `--out ${smokeOut}`,
      'full-flow.js',
    ].join(' ');
    console.log(`  → running: ${smokeCmd}`);
    await run(smokeCmd);
  }

  console.log(
    'Starting background k6 services: ping-location (drivers) and driver-listener',
  );

  const pingTS = Date.now();
  const pingOut = `json=/k6/results/ping-location-${pingTS}.json`;
  const listenerOut = `json=/k6/results/driver-listener-${pingTS}.json`;
  const mainOut = `json=/k6/results/full-flow-${pingTS}.json`;

  // Start ping-location in background
  const pingCmd = `docker compose run --rm k6 run --out ${pingOut} --vus ${process.env.PING_VUS || '50'} --duration ${process.env.PING_DURATION || '10m'} ping-location.js`;
  console.log(`  → starting: ${pingCmd}`);
  const pingProc = spawn(pingCmd, {
    shell: true,
    cwd: SCRIPTS_DIR,
    detached: true,
    stdio: 'ignore',
  });
  pingProc.unref();

  // Start driver-listener in background
  const listenerCmd = `docker compose run --rm k6 run --out ${listenerOut} --vus ${process.env.LISTENER_VUS || '20'} --duration ${process.env.LISTENER_DURATION || '10m'} driver-listener.js`;
  console.log(`  → starting: ${listenerCmd}`);
  const listenerProc = spawn(listenerCmd, {
    shell: true,
    cwd: SCRIPTS_DIR,
    detached: true,
    stdio: 'ignore',
  });
  listenerProc.unref();

  // give background processes a moment to start
  await new Promise((r) => setTimeout(r, 3000));

  console.log('Running main full-flow scenario');
  const mainCmd = `docker compose run --rm k6 run --out ${mainOut} full-flow.js`;
  console.log(`  → running: ${mainCmd}`);
  await run(mainCmd);

  console.log('Main run complete, analyzing results...');

  // analyze results
  const resultFiles = [];
  if (existsSync(resultsDir)) {
    readdirSync(resultsDir)
      .filter((x) => x.endsWith('.json'))
      .forEach((f) => resultFiles.push(path.join(resultsDir, f)));
  }

  if (resultFiles.length > 0) {
    const analyzeCmd = `node analyze-results.js ${resultFiles.map((f) => `"${f}"`).join(' ')}`;
    await run(analyzeCmd);
  }

  console.log('✓ All done. Results in results/ and reports/');
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

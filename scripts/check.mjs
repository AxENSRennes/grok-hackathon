import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

// Leave 500 ms for npm startup and process cleanup within the 15-second budget.
const started = performance.now();
const deadline = started + 14_500;
const root = fileURLToPath(new URL('../', import.meta.url));
const unitOnly = process.argv.includes('--unit-only');
const steps = [
  ...(!unitOnly ? [['types', 'typescript/bin/tsc', '--noEmit']] : []),
  ['unit', 'vitest/vitest.mjs', 'run'],
];

for (const [label, binary, ...args] of steps) {
  const remaining = deadline - performance.now();
  if (remaining <= 0) {
    console.error('The 15-second budget was reached: verification incomplete.');
    process.exitCode = 124;
    break;
  }
  const exitCode = await new Promise(resolve => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(`../node_modules/${binary}`, import.meta.url)), ...args], {
      cwd: root,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`The 15-second budget was reached (${label}): verification incomplete.`);
      if (process.platform === 'win32') child.kill('SIGKILL');
      else {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') child.kill('SIGKILL'); }
      }
    }, remaining);
    child.once('error', error => {
      clearTimeout(timer);
      console.error(error.message);
      resolve(1);
    });
    child.once('close', code => {
      clearTimeout(timer);
      resolve(timedOut ? 124 : (code ?? 1));
    });
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    break;
  }
}

if (!process.exitCode) console.log(`Checks passed in ${((performance.now() - started) / 1000).toFixed(2)} s.`);

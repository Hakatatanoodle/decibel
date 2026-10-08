#!/usr/bin/env node
// Verify the IEC 61672 A-weighting IIR cascade against the analog reference.
// Usage: node scripts/verify-a-weighting.mjs [sampleRate]
// Prints the cascade response vs the reference curve and fails if any point
// deviates by more than +/-1 dB.
import {
  designAWeightingSections,
  cascadeMagnitudeDb,
  aWeightingReferenceDb,
} from '../src/lib/a-weighting.js';

const FREQS = [50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000];
const TOL_DB = 1.0;

const sampleRate = Number(process.argv[2] ?? 48000);
if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
  console.error('Usage: node scripts/verify-a-weighting.mjs [sampleRate]');
  process.exit(2);
}

const sections = designAWeightingSections(sampleRate);

console.log(`A-weighting IIR verification @ ${sampleRate} Hz`);
console.log('freq(Hz)  cascade(dB)  reference(dB)  err(dB)');
let worst = 0;
let failed = false;
for (const f of FREQS) {
  const got = cascadeMagnitudeDb(sections, f, sampleRate);
  const ref = aWeightingReferenceDb(f);
  const err = got - ref;
  worst = Math.max(worst, Math.abs(err));
  if (Math.abs(err) > TOL_DB) failed = true;
  const flag = Math.abs(err) > TOL_DB ? '  <-- FAIL' : '';
  console.log(
    `${String(f).padStart(8)}  ${got.toFixed(2).padStart(11)}  ${ref
      .toFixed(2)
      .padStart(13)}  ${(err >= 0 ? '+' : '') + err.toFixed(2).padStart(6)}${flag}`
  );
}
console.log(`worst |err| = ${worst.toFixed(2)} dB (limit ${TOL_DB.toFixed(1)} dB)`);
if (failed) {
  console.error('FAIL: A-weighting cascade exceeds +/-1 dB tolerance.');
  process.exit(1);
}
console.log('PASS: all points within +/-1 dB of the IEC 61672 reference.');

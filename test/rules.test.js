'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { applyRules, SEVERITY } = require('../src/rules.js');

test('rules engine - source-map detection', (t) => {
  const files = [
    { path: 'dist/index.js', size: 100 },
    { path: 'dist/index.js.map', size: 500 },
    { path: 'src/style.css.map', size: 200 },
  ];

  const violations = applyRules(files);
  const mapViolations = violations.filter((v) => v.ruleId === 'source-map');

  assert.strictEqual(mapViolations.length, 2);
  assert.strictEqual(mapViolations[0].file, 'dist/index.js.map');
  assert.strictEqual(mapViolations[1].file, 'src/style.css.map');
  assert.strictEqual(mapViolations[0].severity, SEVERITY.CRITICAL);
});

test('rules engine - dotenv detection', (t) => {
  const files = [
    { path: '.env', size: 10 },
    { path: 'config/.env.local', size: 20 },
    { path: '.env.production', size: 30 },
    { path: 'environment.js', size: 40 },
  ];

  const violations = applyRules(files);
  const mapViolations = violations.filter((v) => v.ruleId === 'dotenv');

  assert.strictEqual(mapViolations.length, 3);
  assert.strictEqual(mapViolations[0].file, '.env');
  assert.strictEqual(mapViolations[1].file, 'config/.env.local');
});

test('rules engine - oversized file detection', (t) => {
  const files = [
    { path: 'small.js', size: 1024 },
    { path: 'huge.bin', size: 11 * 1024 * 1024 }, // 11 MB
  ];

  const violations = applyRules(files);
  const v = violations.find((v) => v.ruleId === 'oversized-file');

  assert.ok(v);
  assert.strictEqual(v.file, 'huge.bin');
  assert.strictEqual(v.severity, SEVERITY.HIGH);
});

test('rules engine - severity filtering', (t) => {
  const files = [
    { path: '.env', size: 10 }, // critical
    { path: 'huge.bin', size: 11 * 1024 * 1024 }, // high
    { path: 'jest.config.js', size: 100 }, // warn
    { path: '.gitignore', size: 50 }, // info
  ];

  const all = applyRules(files);
  assert.strictEqual(all.length, 4);

  const highAndCrit = applyRules(files, { minSeverity: 'high' });
  assert.strictEqual(highAndCrit.length, 2);
  assert.ok(highAndCrit.some((v) => v.severity === 'critical'));
  assert.ok(highAndCrit.some((v) => v.severity === 'high'));

  const onlyCrit = applyRules(files, { minSeverity: 'critical' });
  assert.strictEqual(onlyCrit.length, 1);
  assert.strictEqual(onlyCrit[0].severity, 'critical');
});

test('rules engine - inline sourcesContent detection', (t) => {
  const files = [
    { path: 'regular.js.map', size: 100, content: '{"version":3,"sources":["a.js"]}' },
    { path: 'inline.js.map', size: 200, content: '{"version":3,"sources":["a.js"],"sourcesContent":["console.log(1)"]}' },
    { path: 'invalid.js.map', size: 50, content: '{invalid-json' },
  ];

  const violations = applyRules(files, { rules: ['sourcecontent-json'] });
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].file, 'inline.js.map');
  assert.strictEqual(violations[0].severity, SEVERITY.CRITICAL);
});

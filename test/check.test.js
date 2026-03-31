'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { getDryRunFiles, runCheck } = require('../src/check.js');

test('check - getDryRunFiles ignores node_modules and respects .npmignore', async (t) => {
  const cwd = path.resolve(__dirname, '..');
  const files = await getDryRunFiles(cwd);

  const hasNodeModules = files.some((f) => f.path.startsWith('node_modules/'));
  assert.strictEqual(hasNodeModules, false);

  const hasGit = files.some((f) => f.path.startsWith('.git/'));
  assert.strictEqual(hasGit, false);

  const hasTests = files.some((f) => f.path.startsWith('tests/'));
  assert.strictEqual(hasTests, false); // Because we added tests/ to .npmignore

  const hasSrc = files.some((f) => f.path.startsWith('src/'));
  assert.strictEqual(hasSrc, true);
});

test('check - runCheck executes rules on project files', async (t) => {
  const cwd = path.resolve(__dirname, '..');

  // Let's run check without .npmignore applied fully (we explicitly bypass tests ignore for this test by passing rules so no violations hit unless we mock)
  const result = await runCheck(cwd, { rules: ['config-internal'] });
  
  assert.strictEqual(typeof result.totalSize, 'number');
  assert.ok(result.files.length > 0);
  assert.ok(Array.isArray(result.violations));
});

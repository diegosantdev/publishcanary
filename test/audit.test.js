'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { fetchPackageMetadata } = require('../src/utils.js');

test('utils - fetchPackageMetadata resolves latest version', async (t) => {
  const meta = await fetchPackageMetadata('is-odd');
  assert.strictEqual(meta.name, 'is-odd');
  assert.ok(meta.version);
  assert.ok(meta.tarballUrl.includes('is-odd'));
});

test('utils - fetchPackageMetadata resolves specific version', async (t) => {
  const meta = await fetchPackageMetadata('is-odd@3.0.0');
  assert.strictEqual(meta.name, 'is-odd');
  assert.strictEqual(meta.version, '3.0.0');
  assert.ok(meta.tarballUrl.endsWith('is-odd-3.0.0.tgz'));
});

test('utils - fetchPackageMetadata scoped packages', async (t) => {
  const meta = await fetchPackageMetadata('@types/node@18.0.0');
  assert.strictEqual(meta.name, '@types/node');
  assert.strictEqual(meta.version, '18.0.0');
});

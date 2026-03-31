'use strict';

const arg = process.argv[2] || 'check';
const extra = process.argv.slice(3);

if (arg === 'check') {
  process.argv = ['node', 'npm-canary', 'check', ...extra];
} else if (arg === 'rules') {
  process.argv = ['node', 'npm-canary', 'rules', ...extra];
} else if (arg === 'audit') {
  process.argv = ['node', 'npm-canary', 'audit', '@anthropic-ai/claude-code@2.1.87', ...extra];
} else if (arg === 'compare') {
  process.argv = ['node', 'npm-canary', 'compare', 'react@17.0.2', 'react@18.2.0', ...extra];
}

require('../src/index.js');

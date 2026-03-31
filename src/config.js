'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULTS = {
  threshold: 0,
  minSeverity: 'info',
  json: false,
  failOn: 'high',
  ignore: [],
  rules: null,
};

function loadConfig(cwd) {
  const candidates = [
    path.join(cwd, '.canaryrc'),
    path.join(cwd, '.canaryrc.json'),
    path.join(cwd, 'canary.config.json'),
  ];

  let fileConfig = {};

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        break;
      } catch {}
    }
  }

  const pkgPath = path.join(cwd, 'package.json');
  let pkgConfig = {};
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkgConfig = pkg.canary || {};
    } catch {}
  }

  return Object.assign({}, DEFAULTS, pkgConfig, fileConfig);
}

module.exports = { loadConfig, DEFAULTS };

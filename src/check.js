'use strict';

const path = require('path');
const fs = require('fs');
const glob = require('fast-glob');

const { applyRules } = require('./rules.js');
const { loadConfig } = require('./config.js');

async function runCheck(cwd, opts = {}) {
  const config = Object.assign({}, loadConfig(cwd), opts);
  const ignore = config.ignore || [];

  const pkgPath = path.join(cwd, 'package.json');
  let packageName = null;
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      packageName = pkg.name ? `${pkg.name}@${pkg.version || '0.0.0'}` : null;
    } catch {}
  }

  const dryRunFiles = await getDryRunFiles(cwd, ignore);

  if (dryRunFiles.length === 0) {
    return {
      packageName,
      files: [],
      violations: [],
      totalSize: 0,
    };
  }

  const totalSize = dryRunFiles.reduce((acc, f) => acc + f.size, 0);

  const violations = applyRules(dryRunFiles, {
    rules: config.rules,
    minSeverity: config.minSeverity,
  });

  return { packageName, files: dryRunFiles, violations, totalSize };
}

async function getDryRunFiles(cwd, ignore = []) {
  const npmIgnorePath = path.join(cwd, '.npmignore');
  const pkgPath = path.join(cwd, 'package.json');

  let filelist = [];

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (Array.isArray(pkg.files) && pkg.files.length > 0) {
        filelist = await resolveFilesField(cwd, pkg.files);
        return filelist;
      }
    } catch {}
  }

  const baseIgnore = [
    'node_modules/**',
    '.git/**',
    '*.tgz',
    '*.tar.gz',
    ...ignore,
  ];

  const npmPatterns = fs.existsSync(npmIgnorePath)
    ? parseIgnoreFile(npmIgnorePath)
    : [];

  const patterns = ['**/*'];
  const negated = [...baseIgnore, ...npmPatterns];

  const entries = await glob(patterns, {
    cwd,
    ignore: negated,
    onlyFiles: true,
    dot: true,
    followSymbolicLinks: false,
  });

  filelist = entries.map((e) => {
    const full = path.join(cwd, e);
    const stat = fs.statSync(full);
    return {
      path: e,
      size: stat.size,
      fullPath: full,
      get content() {
        if (stat.size > 5 * 1024 * 1024) return '';
        try { return fs.readFileSync(full, 'utf8'); } catch { return ''; }
      }
    };
  });

  return filelist;
}

async function resolveFilesField(cwd, filesPatterns) {
  const alwaysIncluded = ['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md'];
  const patterns = [...new Set([...alwaysIncluded, ...filesPatterns])];

  const expanded = await glob(
    patterns.map((p) => (p.endsWith('/') ? `${p}**/*` : p)),
    { cwd, onlyFiles: true, dot: true, followSymbolicLinks: false }
  );

  return expanded.map((e) => {
    const full = path.join(cwd, e);
    let size = 0;
    try {
      size = fs.statSync(full).size;
    } catch {}
    return {
      path: e,
      size,
      fullPath: full,
      get content() {
        if (size > 5 * 1024 * 1024) return '';
        try { return fs.readFileSync(full, 'utf8'); } catch { return ''; }
      }
    };
  });
}

function parseIgnoreFile(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

module.exports = { runCheck, getDryRunFiles };

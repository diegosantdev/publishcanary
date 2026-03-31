'use strict';

const { fetchAndExtractPackage, cleanupTmp } = require('./utils.js');
const { applyRules } = require('./rules.js');

async function runAudit(packageSpec, opts = {}) {
  let tmpDir = null;

  try {
    const { meta, files, tmpDir: tmp } = await fetchAndExtractPackage(packageSpec);
    tmpDir = tmp;

    const totalSize = files.reduce((acc, f) => acc + f.size, 0);

    const violations = applyRules(files, {
      rules: opts.rules,
      minSeverity: opts.minSeverity,
    });

    return {
      packageName: `${meta.name}@${meta.version}`,
      meta,
      files,
      violations,
      totalSize,
    };
  } finally {
    if (tmpDir) cleanupTmp(tmpDir);
  }
}

module.exports = { runAudit };

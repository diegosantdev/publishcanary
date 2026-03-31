'use strict';

const { fetchAndExtractGitPackage, cleanupTmp } = require('./utils.js');
const { runCheck } = require('./check.js');

async function runAuditGit(repo, opts = {}) {
  let tmpDir = null;
  try {
    const { extractDir, tmpDir: tmp, rateLimitInfo } = await fetchAndExtractGitPackage(repo, opts.ref, opts.token);
    tmpDir = tmp;

    const result = await runCheck(extractDir, {
      rules: opts.rules,
      minSeverity: opts.minSeverity,
    });

    result.packageName = `github:${repo}${opts.ref ? `#${opts.ref}` : ''}`;
    result.meta = { repo, ref: opts.ref, rateLimitInfo };

    return result;
  } finally {
    if (tmpDir) cleanupTmp(tmpDir);
  }
}

module.exports = { runAuditGit };

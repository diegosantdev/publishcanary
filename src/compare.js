'use strict';

const { fetchAndExtractPackage, cleanupTmp } = require('./utils.js');
const { applyRules } = require('./rules.js');
const { scanAllFiles } = require('./scanner.js');

async function runCompare(specA, specB, opts = {}) {
  const [resA, resB] = await Promise.all([
    fetchAndExtractPackage(specA),
    fetchAndExtractPackage(specB),
  ]);

  try {
    const scan = (res) => {
      const violations = [
        ...applyRules(res.files, opts),
        ...scanAllFiles(res.files),
      ];
      const totalSize = res.files.reduce((a, f) => a + f.size, 0);
      return {
        name: `${res.meta.name}@${res.meta.version}`,
        files: res.files,
        violations,
        totalSize,
        fileCount: res.files.length,
      };
    };

    const a = scan(resA);
    const b = scan(resB);

    const sizeChange = b.totalSize - a.totalSize;
    const fileCountChange = b.fileCount - a.fileCount;
    const violationChange = b.violations.length - a.violations.length;

    const newViolations = b.violations.filter(
      (bv) => !a.violations.some((av) => av.ruleId === bv.ruleId && av.file === bv.file)
    );

    const fixedViolations = a.violations.filter(
      (av) => !b.violations.some((bv) => bv.ruleId === av.ruleId && bv.file === av.file)
    );

    const newFiles = b.files
      .filter((bf) => !a.files.some((af) => af.path === bf.path))
      .map((f) => f.path);

    const removedFiles = a.files
      .filter((af) => !b.files.some((bf) => bf.path === af.path))
      .map((f) => f.path);

    return { a, b, sizeChange, fileCountChange, violationChange, newViolations, fixedViolations, newFiles, removedFiles };
  } finally {
    cleanupTmp(resA.tmpDir);
    cleanupTmp(resB.tmpDir);
  }
}

module.exports = { runCompare };

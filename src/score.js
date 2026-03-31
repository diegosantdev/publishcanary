'use strict';

function computeScore(violations, totalFiles, totalSize) {
  let score = 100;

  const penalties = {
    critical: 40,
    high: 20,
    warn: 10,
    info: 2,
  };

  const counted = { critical: new Set(), high: new Set(), warn: new Set(), info: new Set() };

  for (const v of violations) {
    counted[v.severity]?.add(v.ruleId);
  }

  for (const [sev, ids] of Object.entries(counted)) {
    score -= ids.size * penalties[sev];
  }

  if (totalSize > 50 * 1024 * 1024) score -= 10;
  else if (totalSize > 20 * 1024 * 1024) score -= 5;
  else if (totalSize > 5 * 1024 * 1024) score -= 2;

  return Math.max(0, Math.min(100, score));
}

function scoreGrade(score) {
  if (score >= 95) return { grade: 'A', label: 'Safe', color: 'green' };
  if (score >= 80) return { grade: 'B', label: 'Good', color: 'cyan' };
  if (score >= 60) return { grade: 'C', label: 'Review', color: 'yellow' };
  if (score >= 40) return { grade: 'D', label: 'Risky', color: 'red' };
  return { grade: 'F', label: 'Blocked', color: 'red' };
}

module.exports = { computeScore, scoreGrade };

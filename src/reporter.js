'use strict';

const kleur = require('kleur');
const { computeScore, scoreGrade } = require('./score.js');

const SEV_COLOR = {
  critical: (s) => kleur.red().bold(s),
  high:     (s) => kleur.yellow().bold(s),
  warn:     (s) => kleur.yellow(s),
  info:     (s) => kleur.cyan(s),
};

const SEV_BADGE = {
  critical: (s) => kleur.bgRed().white().bold(` ${s.toUpperCase()} `),
  high:     (s) => kleur.bgYellow().black().bold(` ${s.toUpperCase()} `),
  warn:     (s) => kleur.bgYellow().black(` ${s.toUpperCase()} `),
  info:     (s) => kleur.bgCyan().black(` ${s.toUpperCase()} `),
};

const SEV_ICON = {
  critical: '✖',
  high:     '⚠',
  warn:     '▲',
  info:     '●',
};

const GRADE_COLOR = {
  green:  (s) => kleur.green().bold(s),
  cyan:   (s) => kleur.cyan().bold(s),
  yellow: (s) => kleur.yellow().bold(s),
  red:    (s) => kleur.red().bold(s),
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function line(char = '─', width = 52) {
  return kleur.dim(char.repeat(width));
}

function header(packageName, totalFiles, totalSize) {
  console.log('');
  console.log(`  ${kleur.white().bold('npm-canary')} ${kleur.dim('——————————————————————————————')}`);
  if (packageName) {
    console.log(`  ${kleur.dim('package')}  ${kleur.cyan().bold(packageName)}`);
  }
  console.log(
    `  ${kleur.dim('scanned')}  ${kleur.white(String(totalFiles))} file(s)` +
    `  ${kleur.dim('·')}  ${kleur.white(formatBytes(totalSize))}`
  );
  console.log(`  ${line()}`);
}

function renderViolations(violations) {
  const bySeverity = { critical: [], high: [], warn: [], info: [] };
  for (const v of violations) (bySeverity[v.severity] || bySeverity.info).push(v);

  for (const sev of ['critical', 'high', 'warn', 'info']) {
    const group = bySeverity[sev];
    if (!group.length) continue;

    console.log('');
    console.log(`  ${SEV_BADGE[sev](sev)}  ${kleur.dim(`${group.length} issue${group.length > 1 ? 's' : ''}`)}`);
    console.log('');

    const byLabel = {};
    for (const v of group) {
      const parts = v.message.split(':');
      const label = parts[0];
      if (!byLabel[label]) byLabel[label] = [];
      byLabel[label].push(v);
    }

    for (const [label, ruleViolations] of Object.entries(byLabel)) {
      const ico = SEV_COLOR[sev](`  ${SEV_ICON[sev]}`);
      
      if (ruleViolations.length === 1) {
        const v = ruleViolations[0];
        const parts = v.message.split(':');
        const rest = parts.slice(1).join(':');
        console.log(`${ico}  ${kleur.white(label)}${rest ? kleur.dim(':') + rest : ''}`);
      } else {
        console.log(`${ico}  ${kleur.white(label)}  ${kleur.dim(`(${ruleViolations.length} occurrences)`)}`);
        
        for (let i = 0; i < Math.min(3, ruleViolations.length); i++) {
          const v = ruleViolations[i];
          const parts = v.message.split(':');
          const rest = parts.slice(1).join(':').trim();
          console.log(`      ${kleur.dim('└─ ' + rest)}`);
        }
        
        if (ruleViolations.length > 3) {
          console.log(`      ${kleur.dim(`└─ ... and ${ruleViolations.length - 3} more`)}`);
        }
      }
    }
  }
}

function renderScore(violations, totalFiles, totalSize) {
  const score = computeScore(violations, totalFiles, totalSize);
  const { grade, label, color } = scoreGrade(score);
  const colorFn = GRADE_COLOR[color] || ((s) => s);

  const bar = renderScoreBar(score);

  console.log('');
  console.log(`  ${line()}`);
  console.log('');
  console.log(
    `  ${kleur.dim('safety score')}  ${colorFn(String(score).padStart(3))} / 100  ` +
    `${bar}  ${kleur.dim(`${grade} — ${label}`)}`
  );
}

function renderScoreBar(score) {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;

  let fillChar;
  let colorFn;
  if (score >= 90) { fillChar = '█'; colorFn = kleur.green; }
  else if (score >= 75) { fillChar = '█'; colorFn = kleur.cyan; }
  else if (score >= 55) { fillChar = '█'; colorFn = kleur.yellow; }
  else { fillChar = '█'; colorFn = kleur.red; }

  return colorFn(fillChar.repeat(filled)) + kleur.dim('·'.repeat(empty));
}

function renderSummaryLine(violations) {
  const counts = { critical: 0, high: 0, warn: 0, info: 0 };
  for (const v of violations) {
    if (counts[v.severity] !== undefined) counts[v.severity]++;
  }

  const parts = [];
  if (counts.critical) parts.push(SEV_COLOR.critical(`${counts.critical} critical`));
  if (counts.high)     parts.push(SEV_COLOR.high(`${counts.high} high`));
  if (counts.warn)     parts.push(SEV_COLOR.warn(`${counts.warn} warn`));
  if (counts.info)     parts.push(SEV_COLOR.info(`${counts.info} info`));

  if (parts.length === 0) {
    console.log(`\n  ${kleur.green('✔')} ${kleur.white().bold('Safe to ship')} ${kleur.dim('— no suspicious files detected')}`);
  } else {
    console.log(`\n  ${kleur.white().bold('Found')} ${parts.join(kleur.dim(', '))}`);
  }
}

function report(violations, totalFiles, totalSize, options = {}) {
  if (options.json) {
    return renderJson(violations, totalFiles, totalSize, options.packageName);
  }

  header(options.packageName, totalFiles, totalSize);

  if (violations.length === 0) {
    console.log('');
    console.log(`  ${kleur.green('✔')} ${kleur.white().bold('Safe to ship')} — no suspicious files detected`);
  } else {
    renderViolations(violations);
    renderSummaryLine(violations);
  }

  renderScore(violations, totalFiles, totalSize);
  
  const score = computeScore(violations, totalFiles, totalSize);
  const { grade } = scoreGrade(score);
  let verdict = 'PASS';
  let badgeFn = kleur.green().bold;
  if (grade === 'C' || grade === 'D') { verdict = 'REVIEW'; badgeFn = kleur.yellow().bold; }
  else if (grade === 'F') { verdict = 'BLOCK'; badgeFn = kleur.red().bold; }
  
  console.log(`  ${kleur.dim('Final verdict:')}  ${badgeFn(verdict)}`);
  
  if (options.badge) {
    generateBadge(score, options.badge);
    console.log(`  ${kleur.dim('Badge generated:')}  ${kleur.cyan(options.badge)}`);
  }
  
  console.log('');
}

function generateBadge(score, outputPath) {
  const fs = require('fs');
  let color = '#e05d44'; // red
  if (score >= 95) color = '#4c1'; // bright green
  else if (score >= 80) color = '#97ca00'; // light green
  else if (score >= 60) color = '#dfb317'; // yellow
  else if (score >= 40) color = '#fe7d37'; // orange

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="138" height="20" role="img" aria-label="npm-canary: ${score}/100">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="138" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="75" height="20" fill="#555"/>
    <rect x="75" width="63" height="20" fill="${color}"/>
    <rect width="138" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="385" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="650">npm-canary</text>
    <text x="385" y="140" transform="scale(.1)" fill="#fff" textLength="650">npm-canary</text>
    <text aria-hidden="true" x="1055" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="530">${score}/100</text>
    <text x="1055" y="140" transform="scale(.1)" fill="#fff" textLength="530">${score}/100</text>
  </g>
</svg>`;
  try { fs.writeFileSync(outputPath, svg, 'utf8'); } catch(e) {}
}

function renderJson(violations, totalFiles, totalSize, packageName) {
  const score = computeScore(violations, totalFiles, totalSize);
  const { grade, label } = scoreGrade(score);
  const out = {
    package: packageName || null,
    scanned: { files: totalFiles, bytes: totalSize },
    score: { value: score, grade, label },
    violations: violations.map((v) => ({
      rule: v.ruleId,
      severity: v.severity,
      file: v.file,
      size: v.size,
      message: v.message,
    })),
    summary: {
      critical: violations.filter((v) => v.severity === 'critical').length,
      high:     violations.filter((v) => v.severity === 'high').length,
      warn:     violations.filter((v) => v.severity === 'warn').length,
      info:     violations.filter((v) => v.severity === 'info').length,
      total:    violations.length,
    },
  };
  console.log(JSON.stringify(out, null, 2));
}

function reportCompare(result, options = {}) {
  const { a, b, sizeChange, fileCountChange, newViolations, fixedViolations, newFiles, removedFiles } = result;

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('');
  console.log(`  ${kleur.white().bold('npm-canary compare')} ${kleur.dim('——————————————————————————')}`);
  console.log(`  ${kleur.dim('from')}  ${kleur.cyan(a.name)}   ${kleur.dim('→')}   ${kleur.cyan(b.name)}`);
  console.log(`  ${line()}`);
  console.log('');

  const sizeArrow = sizeChange > 0 ? kleur.red(`+${formatBytes(sizeChange)}`) : kleur.green(formatBytes(sizeChange));
  const fileArrow = fileCountChange > 0
    ? kleur.red(`+${fileCountChange} files`)
    : fileCountChange < 0
    ? kleur.green(`${fileCountChange} files`)
    : kleur.dim('same file count');

  console.log(`  ${kleur.dim('size     ')} ${formatBytes(a.totalSize)} → ${formatBytes(b.totalSize)}  ${sizeArrow}`);
  console.log(`  ${kleur.dim('files    ')} ${a.fileCount} → ${b.fileCount}  ${fileArrow}`);
  console.log(`  ${kleur.dim('issues   ')} ${a.violations.length} → ${b.violations.length}`);
  console.log('');

  if (newFiles.length > 0) {
    console.log(`  ${kleur.yellow('+')} ${kleur.white().bold('New files')} ${kleur.dim(`(${newFiles.length})`)}`)
    for (const f of newFiles.slice(0, 10)) console.log(`    ${kleur.green('+')} ${f}`);
    if (newFiles.length > 10) console.log(`    ${kleur.dim(`… and ${newFiles.length - 10} more`)}`);
    console.log('');
  }

  if (removedFiles.length > 0) {
    console.log(`  ${kleur.dim('-')} ${kleur.white().bold('Removed files')} ${kleur.dim(`(${removedFiles.length})`)}`)
    for (const f of removedFiles.slice(0, 10)) console.log(`    ${kleur.red('-')} ${f}`);
    if (removedFiles.length > 10) console.log(`    ${kleur.dim(`… and ${removedFiles.length - 10} more`)}`);
    console.log('');
  }

  if (newViolations.length > 0) {
    console.log(`  ${kleur.red().bold('⚠ New issues in ' + b.name)}`);
    for (const v of newViolations) {
      console.log(`    ${SEV_COLOR[v.severity](SEV_ICON[v.severity])}  ${v.message}`);
    }
    console.log('');
  }

  if (fixedViolations.length > 0) {
    console.log(`  ${kleur.green().bold('✔ Fixed in ' + b.name)}`);
    for (const v of fixedViolations) {
      console.log(`    ${kleur.green('✔')}  ${v.message}`);
    }
    console.log('');
  }

  if (newViolations.length === 0 && fixedViolations.length === 0) {
    console.log(`  ${kleur.dim('No change in security posture.')}`);
    console.log('');
  }

  console.log(`  ${line()}`);
  console.log(`  ${kleur.dim('Security posture score:')}  ${kleur.white().bold(computeScore(b.violations, b.files.length, b.totalSize))} / 100`)
  console.log('');
}

function exitCode(violations, failOn = 'high') {
  const order = ['info', 'warn', 'high', 'critical'];
  const failIdx = order.indexOf(failOn);
  let worst = -1;
  for (const v of violations) {
    const idx = order.indexOf(v.severity);
    if (idx > worst) worst = idx;
  }
  if (worst >= failIdx && worst >= 0) return worst >= order.indexOf('critical') ? 2 : 1;
  return 0;
}

module.exports = { report, reportCompare, exitCode, formatBytes };

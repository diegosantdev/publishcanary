'use strict';

const { Command } = require('commander');
const path = require('path');
const kleur = require('kleur');

const { runCheck } = require('./check.js');
const { runAudit } = require('./audit.js');
const { runCompare } = require('./compare.js');
const { report, reportCompare, exitCode, formatBytes } = require('./reporter.js');
const { RULES } = require('./rules.js');
const { scanAllFiles } = require('./scanner.js');
const { createSpinner } = require('./spinner.js');

const pkg = require('../package.json');
const { startInteractive } = require('./interactive.js');

function runCLI(argv) {
  const program = new Command();

  program
    .name('npm-canary')
    .description('Publish safely. Detect secrets, source maps, and oversized files before and after npm publish.')
    .version(pkg.version, '-v, --version')
    .addHelpText('after', `
    ${kleur.dim('Examples:')}
      ${kleur.cyan('$ npm-canary check')}                            ${kleur.dim('scan before publish')}
      ${kleur.cyan('$ npm-canary audit react@18.2.0')}               ${kleur.dim('audit published package')}
      ${kleur.cyan('$ npm-canary audit-git instructkr/claw-code')}   ${kleur.dim('audit remote github repo')}
      ${kleur.cyan('$ npm-canary compare react@17.0.2 react@18.2.0')}${kleur.dim('  diff two versions')}
      ${kleur.cyan('$ npm-canary rules')}                            ${kleur.dim('list all rules')}
      ${kleur.cyan('$ npm-canary ui')}                               ${kleur.dim('open interactive menu')}
    `);

  program
    .command('ui')
    .description('Open interactive UI mode')
    .action(() => {
      startInteractive().catch((err) => {
        if (err.name !== 'ExitPromptError') {
          console.error(kleur.red(`\n  Fatal: ${err.message}`));
        }
        process.exit(1);
      });
    });

  program
    .command('check')
    .description('Scan local package before publishing — runs automatically as prepublishOnly')
    .option('-d, --dir <path>', 'Package directory to scan', process.cwd())
    .option('--json', 'Output as JSON')
    .option('--min-severity <level>', 'Minimum severity to report [info|warn|high|critical]', 'info')
    .option('--fail-on <level>', 'Exit non-zero on this severity or above [warn|high|critical]', 'high')
    .option('--rules <ids>', 'Comma-separated rule IDs to run (default: all)')
    .option('--no-secrets', 'Skip content-based secret scanning')
    .option('--threshold <mb>', 'Fail if total package exceeds this size in MB', parseFloat)
    .option('--badge <path>', 'Generate an SVG score badge at <path>')
    .action(async (options) => {
      const cwd = path.resolve(options.dir);
      const spinner = createSpinner('scanning pack manifest...');
      if (!options.json) spinner.start();

      const ruleIds = options.rules ? options.rules.split(',').map((r) => r.trim()) : null;

      let result;
      try {
        result = await runCheck(cwd, { rules: ruleIds, minSeverity: options.minSeverity });
      } catch (err) {
        spinner.fail(kleur.red(err.message));
        process.exit(1);
      }

      let violations = result.violations;

      if (options.secrets !== false) {
        const secretHits = scanAllFiles(result.files);
        violations = [...violations, ...secretHits];
      }

      spinner.succeed(
        kleur.dim(`${result.files.length} files  ·  ${formatBytes(result.totalSize)}`)
      );

      if (options.threshold && result.totalSize > options.threshold * 1024 * 1024) {
        violations.push({
          ruleId: 'size-budget',
          severity: 'high',
          file: '(package)',
          size: result.totalSize,
          message: `Package size budget exceeded: ${formatBytes(result.totalSize)} > ${options.threshold} MB`,
        });
      }

      report(violations, result.files.length, result.totalSize, {
        json: options.json,
        badge: options.badge,
        packageName: result.packageName,
      });

      process.exit(exitCode(violations, options.failOn));
    });

  program
    .command('audit <package>')
    .description('Audit any published npm package by name and optional version')
    .option('--json', 'Output as JSON')
    .option('--min-severity <level>', 'Minimum severity to report', 'info')
    .option('--fail-on <level>', 'Exit non-zero on this severity or above', 'high')
    .option('--rules <ids>', 'Comma-separated rule IDs to run')
    .option('--no-secrets', 'Skip content-based secret scanning')
    .option('--badge <path>', 'Generate an SVG score badge at <path>')
    .action(async (packageSpec, options) => {
      const spinner = createSpinner(`fetching ${packageSpec} from registry...`);
      if (!options.json) spinner.start();

      const ruleIds = options.rules ? options.rules.split(',').map((r) => r.trim()) : null;

      let result;
      try {
        result = await runAudit(packageSpec, { rules: ruleIds, minSeverity: options.minSeverity });
      } catch (err) {
        spinner.fail(kleur.red(err.message));
        process.exit(1);
      }

      let violations = result.violations;
      if (options.secrets !== false) {
        violations = [...violations, ...scanAllFiles(result.files)];
      }

      spinner.succeed(kleur.dim(`${result.files.length} files  ·  ${formatBytes(result.totalSize)}`));

      report(violations, result.files.length, result.totalSize, {
        json: options.json,
        badge: options.badge,
        packageName: result.packageName,
      });

      process.exit(exitCode(violations, options.failOn));
    });

  program
    .command('audit-git <repo>')
    .description('Audit a public or private GitHub repository (e.g., owner/repo)')
    .option('--ref <branch-or-tag>', 'Specific branch, tag, or commit to audit', '')
    .option('--token-env <envVar>', 'Environment variable containing GitHub token (e.g. GITHUB_TOKEN)', 'GITHUB_TOKEN')
    .option('--json', 'Output as JSON')
    .option('--min-severity <level>', 'Minimum severity to report', 'info')
    .option('--fail-on <level>', 'Exit non-zero on this severity or above', 'high')
    .option('--rules <ids>', 'Comma-separated rule IDs to run')
    .option('--no-secrets', 'Skip content-based secret scanning')
    .option('--badge <path>', 'Generate an SVG score badge at <path>')
    .action(async (repo, options) => {
      const { runAuditGit } = require('./audit-git.js');
      const spinner = createSpinner(`fetching ${repo} from GitHub...`);
      if (!options.json) spinner.start();

      const ruleIds = options.rules ? options.rules.split(',').map((r) => r.trim()) : null;
      const ref = options.ref || '';
      const token = process.env[options.tokenEnv] || process.env.GITHUB_TOKEN || null;

      let result;
      try {
        result = await runAuditGit(repo, {
          ref,
          token,
          rules: ruleIds,
          minSeverity: options.minSeverity,
        });
      } catch (err) {
        spinner.fail(kleur.red(err.message));
        process.exit(1);
      }

      let violations = result.violations;
      if (options.secrets !== false) {
        violations = [...violations, ...scanAllFiles(result.files)];
      }

      spinner.succeed(kleur.dim(`${result.files.length} files  ·  ${formatBytes(result.totalSize)}`));
      
      const ratelimit = result.meta.rateLimitInfo;
      if (!options.json && ratelimit.remaining) {
        console.log(`  ${kleur.dim(`GitHub API Rate limit: ${ratelimit.remaining}/${ratelimit.limit} remaining`)}\n`);
      }

      report(violations, result.files.length, result.totalSize, {
        json: options.json,
        badge: options.badge,
        packageName: result.packageName,
      });

      process.exit(exitCode(violations, options.failOn));
    });

  program
    .command('compare <pkg-a> <pkg-b>')
    .description('Diff two published versions — see what changed in file set and security posture')
    .option('--json', 'Output as JSON')
    .option('--no-secrets', 'Skip content-based secret scanning')
    .action(async (pkgA, pkgB, options) => {
      const spinner = createSpinner(`comparing ${pkgA}  →  ${pkgB} ...`);
      if (!options.json) spinner.start();

      let result;
      try {
        result = await runCompare(pkgA, pkgB, { secrets: options.secrets !== false });
      } catch (err) {
        spinner.fail(kleur.red(err.message));
        process.exit(1);
      }

      spinner.succeed(kleur.dim('comparison complete'));
      reportCompare(result, { json: options.json });
      process.exit(result.newViolations.length > 0 ? 1 : 0);
    });

  program
    .command('rules')
    .description('List all built-in detection rules')
    .option('--json', 'Output as JSON')
    .action((options) => {
      if (options.json) {
        const list = RULES.map((r) => ({ id: r.id, severity: r.severity, description: r.description }));
        console.log(JSON.stringify(list, null, 2));
        return;
      }

      const COLORS = {
        critical: (s) => kleur.red().bold(s),
        high:     (s) => kleur.yellow().bold(s),
        warn:     (s) => kleur.yellow(s),
        info:     (s) => kleur.cyan(s),
      };

      console.log('');
      console.log(`  ${kleur.white().bold('npm-canary')} ${kleur.dim('built-in rules')}  ${kleur.dim(`(${RULES.length} total)`)}`);
      console.log(`  ${kleur.dim('─'.repeat(52))}`);
      console.log('');

      const bySeverity = { critical: [], high: [], warn: [], info: [] };
      for (const r of RULES) (bySeverity[r.severity] || bySeverity.info).push(r);

      for (const sev of ['critical', 'high', 'warn', 'info']) {
        for (const r of bySeverity[sev]) {
          const badge = COLORS[sev](sev.padEnd(8));
          const id = kleur.white(r.id.padEnd(24));
          const desc = kleur.dim(r.description);
          console.log(`  ${badge}  ${id}  ${desc}`);
        }
      }
      console.log('');
      console.log(`  ${kleur.dim('+ 15 content-based secret patterns (AWS, GitHub, Stripe, OpenAI, Anthropic, …)')}`);
      console.log(`    ${kleur.dim('run')} ${kleur.cyan('npm-canary check')} ${kleur.dim('to activate them')}`);
      console.log('');
    });

  program.parseAsync(argv).catch((err) => {
    console.error(kleur.red(`  Fatal: ${err.message}`));
    process.exit(1);
  });
}

module.exports = { runCLI };

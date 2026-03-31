'use strict';

const kleur = require('kleur');
const pkg = require('../package.json');

const { runCheck } = require('./check.js');
const { runAudit } = require('./audit.js');
const { runCompare } = require('./compare.js');
const { report, reportCompare, formatBytes } = require('./reporter.js');
const { scanAllFiles } = require('./scanner.js');
const { createSpinner } = require('./spinner.js');

async function showHeader() {
  console.clear();
  console.log('');
  console.log(kleur.dim('┌────────────────────────────────────────────────────────┐'));
  console.log(kleur.dim('│') + kleur.bold().cyan('                 N P M  -  C A N A R Y                  ') + kleur.dim('│'));
  console.log(kleur.dim('│') + kleur.dim('       Catch what actually ships before publish.        ') + kleur.dim('│'));
  console.log(kleur.dim('├────────────────────────────────────────────────────────┤'));
  
  const vLeft = `  v${pkg.version}`;
  const vRight = `Node ${process.version}  `;
  const spaces = ' '.repeat(Math.max(0, 56 - vLeft.length - vRight.length));
  
  console.log(kleur.dim('│') + kleur.cyan(vLeft) + spaces + kleur.dim(vRight) + kleur.dim('│'));
  console.log(kleur.dim('└────────────────────────────────────────────────────────┘'));
  console.log('');
}

async function startInteractive() {
  const { select, input } = await import('@inquirer/prompts');

  async function pauseAndReturn() {
    console.log('');
    await input({ message: 'Press Enter to return to menu' });
  }

  while (true) {
    await showHeader();

    let action;
    try {
      action = await select({
        message: 'What would you like to do?',
        choices: [
          { name: '  [ SCAN ]   Local package pre-publish analysis', value: 'check' },
          { name: '  [ AUDIT ]  Query registry for remote package posture', value: 'audit' },
          { name: '  [ GITHUB ] Analyze a remote GitHub repository', value: 'auditgit' },
          { name: '  [ DIFF ]   Compare two published versions', value: 'compare' },
          { name: '  [ DOCS ]   Quick Start & Flag Reference', value: 'help' },
          { name: '  [ EXIT ]   Terminate session', value: 'exit' },
        ],
      });
    } catch (err) {
      if (err.name === 'ExitPromptError') {
        process.exit(0);
      }
      throw err;
    }

    try {
      if (action === 'exit') {
        console.log(kleur.dim('\n  Goodbye!\n'));
        process.exit(0);
      }

      if (action === 'help') {
        console.log('');
        console.log(kleur.cyan('  Quick Start Guide'));
        console.log(kleur.dim('  ─────────────────────────────────────'));
        console.log(`  ${kleur.white('Scan local package')}      ${kleur.dim('npm-canary check')}`);
        console.log(`  ${kleur.white('Audit published package')} ${kleur.dim('npm-canary audit react@18.2.0')}`);
        console.log(`  ${kleur.white('Compare versions')}        ${kleur.dim('npm-canary compare react@17.0.2 react@18.2.0')}`);
        console.log('');
        console.log(`  ${kleur.dim('Tip: Use')} ${kleur.cyan('npm-canary --help')} ${kleur.dim('for full flags.')}`);
        
        await pauseAndReturn();
        continue;
      }

      if (action === 'check') {
        const dir = process.cwd();
        console.log(`\n${kleur.dim('Scanning directory:')} ${kleur.white(dir)}\n`);
        const spinner = createSpinner('scanning package manifest...').start();
        
        let result;
        try {
          result = await runCheck(dir, { rules: null, minSeverity: 'info' });
        } catch (err) {
          spinner.fail(kleur.red(err.message));
          await pauseAndReturn();
          continue;
        }

        const secretHits = scanAllFiles(result.files);
        const violations = [...result.violations, ...secretHits];

        spinner.succeed(kleur.dim(`${result.files.length} files  ·  ${formatBytes(result.totalSize)}`));
        report(violations, result.files.length, result.totalSize, { packageName: result.packageName });
        
        await pauseAndReturn();
        continue;
      }

      if (action === 'audit') {
        const pkgSpec = await input({ message: 'Package to audit (e.g. react@18.2.0):', required: true });
        console.log('');
        
        const spinner = createSpinner(`fetching ${pkgSpec} from registry...`).start();
        let result;
        try {
          result = await runAudit(pkgSpec, { rules: null, minSeverity: 'info' });
        } catch (err) {
          spinner.fail(kleur.red(err.message));
          await pauseAndReturn();
          continue;
        }

        const secretHits = scanAllFiles(result.files);
        const violations = [...result.violations, ...secretHits];

        spinner.succeed(kleur.dim(`${result.files.length} files  ·  ${formatBytes(result.totalSize)}`));
        report(violations, result.files.length, result.totalSize, { packageName: result.packageName });

        await pauseAndReturn();
        continue;
      }

      if (action === 'auditgit') {
        const repo = await input({ message: 'GitHub repository (e.g. instructkr/claw-code):', required: true });
        const ref = await input({ message: 'Ref (branch/tag/commit, leave empty for default):' });
        const tokenEnv = await input({ message: 'Env var for Token (leave empty for default public/GITHUB_TOKEN):' });
        
        console.log('');
        const { runAuditGit } = require('./audit-git.js');
        const spinner = createSpinner(`fetching ${repo} from GitHub...`).start();

        let result;
        const token = process.env[tokenEnv || 'GITHUB_TOKEN'] || null;

        try {
          result = await runAuditGit(repo, { ref: ref.trim() || '', token, rules: null, minSeverity: 'info' });
        } catch (err) {
          spinner.fail(kleur.red(err.message));
          await pauseAndReturn();
          continue;
        }

        const secretHits = scanAllFiles(result.files);
        const violations = [...result.violations, ...secretHits];

        spinner.succeed(kleur.dim(`${result.files.length} files  ·  ${formatBytes(result.totalSize)}`));
        
        const ratelimit = result.meta.rateLimitInfo;
        if (ratelimit && ratelimit.remaining) {
          console.log(`  ${kleur.dim(`GitHub API Rate limit: ${ratelimit.remaining}/${ratelimit.limit} remaining`)}\n`);
        }

        report(violations, result.files.length, result.totalSize, { packageName: result.packageName });

        await pauseAndReturn();
        continue;
      }

      if (action === 'compare') {
        const pkgA = await input({ message: 'First version (e.g. react@17.0.2):', required: true });
        const pkgB = await input({ message: 'Second version (e.g. react@18.2.0):', required: true });
        console.log('');

        const spinner = createSpinner(`comparing ${pkgA}  →  ${pkgB} ...`).start();
        let result;
        try {
          result = await runCompare(pkgA, pkgB, { secrets: true });
        } catch (err) {
          spinner.fail(kleur.red(err.message));
          await pauseAndReturn();
          continue;
        }

        spinner.succeed(kleur.dim('comparison complete'));
        reportCompare(result, { json: false });

        await pauseAndReturn();
        continue;
      }

    } catch (err) {
      if (err.name === 'ExitPromptError') { // @inquirer/prompts Ctrl+C
        console.log(kleur.dim('\n  Action cancelled.'));
        process.exit(0);
      }
      console.error(kleur.red(`\nUnexpected error: ${err.message}`));
      await pauseAndReturn();
    }
  }
}

module.exports = { startInteractive };

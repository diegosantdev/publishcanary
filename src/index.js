#!/usr/bin/env node
'use strict';

const { startInteractive } = require('./interactive.js');
const { runCLI } = require('./cli.js');
const kleur = require('kleur');

const isInteractive = process.stdout.isTTY && process.stdin.isTTY;
const hasCommandArgs = process.argv.length > 2;

if (!hasCommandArgs) {
  if (isInteractive) {
    startInteractive().catch((err) => {
      if (err.name !== 'ExitPromptError') {
        console.error(kleur.red(`\n  Fatal: ${err.message}`));
      }
      process.exit(1);
    });
  } else {
    // Non-interactive environment and no args -> run help
    runCLI([...process.argv, '--help']);
  }
} else {
  runCLI(process.argv);
}

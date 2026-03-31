'use strict';

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const kleur = require('kleur');

function createSpinner(text) {
  let i = 0;
  let interval = null;
  const isTTY = process.stderr.isTTY;

  function render() {
    if (!isTTY) return;
    process.stderr.write(`\r  ${kleur.cyan(frames[i % frames.length])} ${kleur.dim(text)}`);
    i++;
  }

  return {
    start() {
      if (!isTTY) return;
      render();
      interval = setInterval(render, 80);
    },
    update(newText) {
      text = newText;
    },
    stop(finalLine) {
      if (interval) { clearInterval(interval); interval = null; }
      if (isTTY) {
        process.stderr.write('\r\x1b[2K');
      }
      if (finalLine) process.stderr.write(finalLine + '\n');
    },
    succeed(msg) {
      this.stop(`  ${kleur.green('✔')} ${msg}`);
    },
    fail(msg) {
      this.stop(`  ${kleur.red('✖')} ${msg}`);
    },
  };
}

module.exports = { createSpinner };

#!/usr/bin/env node

import main from './main.js';

// Check if skillskill is called directly from the command line. If so, start the cli. If not, the module is being imported by another module, so don't start.
const shouldStartCli = process.argv[1] === new URL('./main.js', import.meta.url).pathname;
if (shouldStartCli) {
  main();
}

export * from './core/index.js';
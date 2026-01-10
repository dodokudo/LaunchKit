#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const { execFile } = require('child_process');

function runBuild(projectRoot, configPath) {
  return new Promise((resolve, reject) => {
    execFile('node', ['scripts/build.js', configPath], { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function main() {
  const projectRoot = process.cwd();
  const configsDir = path.join(projectRoot, 'configs');
  const files = (await fs.readdir(configsDir)).filter((f) => f.endsWith('.json') && f !== 'lp-meta.json');
  for (const file of files) {
    const configPath = path.join('configs', file);
    console.log(`Building ${configPath} ...`);
    await runBuild(projectRoot, configPath);
  }
  console.log('All builds completed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

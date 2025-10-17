#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function main() {
  const [, , slug, daysArg = '2'] = process.argv;
  if (!slug) {
    console.error('Usage: node scripts/set-deadline.js <slug> [days]');
    process.exit(1);
  }
  const days = Number(daysArg);
  if (Number.isNaN(days)) {
    console.error('days must be a number');
    process.exit(1);
  }
  const projectRoot = path.resolve(__dirname, '..');
  const configPath = path.join(projectRoot, 'configs', `${slug}.json`);
  if (!(await fs.pathExists(configPath))) {
    console.error('Config not found:', configPath);
    process.exit(1);
  }
  const config = await fs.readJson(configPath);
  config.countdown = config.countdown || {};
  config.countdown.enabled = true;
  config.countdown.deadline = addDays(days);
  if (!config.countdown.label) config.countdown.label = '締切まで残り';
  await fs.outputJson(configPath, config, { spaces: 2 });
  console.log(`Updated countdown for ${slug} -> ${config.countdown.deadline}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

const TEMPLATE_CONFIGS = {
  optin: 'configs/optin-sample.json',
  seminar: 'configs/seminar-sample.json',
  webinar: 'configs/webinar-sample.json',
  consult: 'configs/consult-sample.json'
};

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
      result[key] = value;
    }
  });
  return result;
}

async function cloneHtmlIfNeeded(projectRoot, originalPath, slug) {
  if (!originalPath) return originalPath;
  const source = path.resolve(projectRoot, originalPath);
  const targetRel = originalPath.replace(/sample/gi, slug);
  const target = path.resolve(projectRoot, targetRel);
  if (await fs.pathExists(source)) {
    await fs.copy(source, target);
  } else {
    await fs.outputFile(target, '<p>コンテンツを追加してください。</p>\n');
  }
  return targetRel;
}

async function main() {
  const options = parseArgs();
  const type = options.type || 'optin';
  const slug = options.slug;
  const title = options.title || '新規LP';
  if (!slug) {
    console.error('Usage: node scripts/scaffold.js --type=optin --slug=my-campaign [--title="タイトル"]');
    process.exit(1);
  }
  if (!TEMPLATE_CONFIGS[type]) {
    console.error(`Unsupported type: ${type}. Available: ${Object.keys(TEMPLATE_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const templateConfigPath = path.resolve(projectRoot, TEMPLATE_CONFIGS[type]);
  if (!(await fs.pathExists(templateConfigPath))) {
    console.error(`Template config not found: ${templateConfigPath}`);
    process.exit(1);
  }

  const configRaw = await fs.readJson(templateConfigPath);
  configRaw.slug = slug;
  configRaw.meta = { ...(configRaw.meta || {}), title };

  if (configRaw.raw_html_file) {
    configRaw.raw_html_file = await cloneHtmlIfNeeded(projectRoot, configRaw.raw_html_file, slug);
  }

  if (Array.isArray(configRaw.sections)) {
    configRaw.sections = await Promise.all(
      configRaw.sections.map(async (section) => {
        const copy = { ...section };
        if (copy.html_file) {
          copy.html_file = await cloneHtmlIfNeeded(projectRoot, copy.html_file, slug);
        }
        return copy;
      })
    );
  }

  const targetConfigPath = path.resolve(projectRoot, 'configs', `${slug}.json`);
  await fs.outputJson(targetConfigPath, configRaw, { spaces: 2 });
  console.log(`Scaffolded config: ${path.relative(projectRoot, targetConfigPath)}`);
  console.log('Next steps:');
  console.log(`  1. 編集 -> ${path.relative(projectRoot, targetConfigPath)}`);
  console.log('  2. 必要に応じて生成された HTML スニペットを編集');
  console.log(`  3. npm run build:${['optin', 'consult'].includes(type) ? 'optin' : 'seminar'} -- configs/${slug}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

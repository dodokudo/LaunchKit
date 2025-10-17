#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const nunjucks = require('nunjucks');

async function main() {
  const [, , configArg] = process.argv;
  if (!configArg) {
    console.error('Usage: node scripts/build.js <config.json>');
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const configPath = path.resolve(projectRoot, configArg);

  let configRaw;
  try {
    configRaw = await fs.readFile(configPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read config: ${configPath}`);
    throw error;
  }

  const config = JSON.parse(configRaw);

  const templateRel = config.template || 'seminar/index.njk';
  const templatesDir = path.resolve(projectRoot, 'templates');
  const env = nunjucks.configure(templatesDir, { autoescape: false });

  const preparedSections = [];
  for (const section of config.sections || []) {
    const sectionCopy = { ...section };
    if (sectionCopy.html_file) {
      const possiblePaths = [
        path.resolve(projectRoot, sectionCopy.html_file),
        path.resolve(path.dirname(configPath), sectionCopy.html_file)
      ];
      let htmlContent = null;
      for (const candidate of possiblePaths) {
        if (await fs.pathExists(candidate)) {
          htmlContent = await fs.readFile(candidate, 'utf8');
          break;
        }
      }
      if (!htmlContent) {
        throw new Error(`HTML snippet not found for section: ${sectionCopy.html_file}`);
      }
      sectionCopy.html = htmlContent;
      delete sectionCopy.html_file;
    }
    preparedSections.push(sectionCopy);
  }

  const slug = config.slug || path.basename(configPath, path.extname(configPath));
  const distDir = path.resolve(projectRoot, 'dist', slug);
  await fs.emptyDir(distDir);

  const context = {
    meta: config.meta || {},
    paths: config.paths || { assets: './assets' },
    tag_manager: config.tag_manager || { head: [], body: [] },
    countdown: config.countdown || { enabled: false },
    caution: config.caution || {},
    video: config.video || null,
    sections: preparedSections,
    client_state: config.client_state
  };

  const html = env.render(templateRel, context);
  await fs.outputFile(path.join(distDir, 'index.html'), html);

  const assetsSource = config.assets_source
    ? path.resolve(projectRoot, config.assets_source)
    : path.resolve(projectRoot, 'seminar', 'assets');
  const assetsDest = path.join(distDir, 'assets');
  await fs.copy(assetsSource, assetsDest);

  console.log(`Generated ${path.join('dist', slug, 'index.html')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

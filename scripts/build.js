#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const nunjucks = require('nunjucks');
const cheerio = require('cheerio');

// HTMLから<body>のコンテンツのみを抽出する関数
function extractBodyContent(html) {
  // <!DOCTYPE html>で始まる完全なHTMLドキュメントかチェック
  if (html.trim().match(/^<!DOCTYPE\s+html/i)) {
    const $ = cheerio.load(html);
    $('[data-countdown-initialised]').removeAttr('data-countdown-initialised');
    $('body [style]').each((_, el) => {
      const style = $(el).attr('style');
      if (!style) return;
      const declarations = style
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => {
          const [prop] = part.split(':');
          return prop && prop.trim().toLowerCase() !== 'outline';
        });
      if (declarations.length) {
        $(el).attr('style', declarations.join('; ') + ';');
      } else {
        $(el).removeAttr('style');
      }
    });
    const fragments = [];
    const headStyles = $('head style')
      .toArray()
      .map((el) => $(el).toString().trim())
      .filter(Boolean);
    if (headStyles.length) {
      fragments.push(headStyles.join('\n'));
    }
    const bodyHtml = $('body').html();
    if (bodyHtml) {
      fragments.push(bodyHtml);
    }
    const combined = fragments.join('\n').trim();
    return combined || html;
  }
  return html;
}

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
      sectionCopy.html = extractBodyContent(htmlContent);
      delete sectionCopy.html_file;
    }
    preparedSections.push(sectionCopy);
  }

  const slug = config.slug || path.basename(configPath, path.extname(configPath));
  const distDir = path.resolve(projectRoot, 'dist', slug);
  await fs.emptyDir(distDir);

  // copy_raw: trueの場合、HTMLファイルをそのままコピーして終了
  if (config.copy_raw && config.raw_html_file) {
    const rawPath = path.resolve(projectRoot, config.raw_html_file);
    if (await fs.pathExists(rawPath)) {
      await fs.copy(rawPath, path.join(distDir, 'index.html'));
      // assetsもコピー
      if (config.assets_source) {
        const assetsSource = path.resolve(projectRoot, config.assets_source);
        const assetsDest = distDir;
        const files = await fs.readdir(assetsSource);
        for (const file of files) {
          if (file !== 'landing.html') {
            await fs.copy(path.join(assetsSource, file), path.join(assetsDest, file));
          }
        }
      }
      console.log(`Copied raw HTML to ${path.join('dist', slug, 'index.html')}`);
      return;
    }
  }

  const countdownConfig = { ...(config.countdown || {}) };
  countdownConfig.enabled = Boolean(countdownConfig.enabled);
  if (!countdownConfig.label) {
    countdownConfig.label = '締切まで残り';
  }

  const context = {
    meta: config.meta || {},
    paths: config.paths || { assets: './assets' },
    tag_manager: config.tag_manager || { head: [], body: [] },
    countdown: countdownConfig,
    caution: config.caution || {},
    video: config.video || null,
    sections: preparedSections,
    client_state: config.client_state,
    raw_html: null,
    footer_scripts: config.footer_scripts || [],
    sticky_cta: config.sticky_cta || { enabled: false },
    custom_styles: config.custom_styles || null
  };

  if (config.raw_html_file) {
    const rawPathCandidates = [
      path.resolve(projectRoot, config.raw_html_file),
      path.resolve(path.dirname(configPath), config.raw_html_file)
    ];
    for (const candidate of rawPathCandidates) {
      if (await fs.pathExists(candidate)) {
        const rawHtml = await fs.readFile(candidate, 'utf8');
        context.raw_html = extractBodyContent(rawHtml);
        break;
      }
    }
    if (!context.raw_html) {
      throw new Error(`raw_html_file not found: ${config.raw_html_file}`);
    }
  }

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

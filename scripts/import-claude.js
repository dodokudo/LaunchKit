#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');

const BLOCK_CLASS_MAP = {
  hero: ['hero'],
  section: ['section'],
  intro: ['section'],
  problems: ['section'],
  'problem-list': ['section', 'problem-list'],
  results: ['section', 'results'],
  highlight: ['section', 'highlight-box'],
  gifts: ['gift-box'],
  'gift-box': ['gift-box'],
  urgency: ['section', 'urgency'],
  ps: ['ps'],
  divider: ['divider'],
  'sticky-cta': ['sticky-cta'],
  countdown: ['countdown-banner']
};

const ROLE_CLASS_MAP = {
  lead: ['lead'],
  catch: ['catch'],
  'cta-copy': ['cta-copy'],
  'gift-title': ['gift-title'],
  'gift-value': ['gift-value'],
  'gift-item': ['gift-item'],
  'gift-total': ['gift-total'],
  highlight: ['highlight'],
  'urgency-alert': ['alert'],
  'ps-title': ['ps-title'],
  'primary-cta': ['cta-button'],
  'secondary-cta': ['cta-button'],
  'cta-button': ['cta-button'],
  'sticky-cta-label': ['sticky-cta__label'],
  'sticky-cta-link': ['sticky-cta__link'],
  countdown: ['countdown__value'],
  'countdown-label': ['countdown__label']
};

function cleanWhitespaceNodes($, root) {
  root.contents().each((_, node) => {
    if (node.type === 'text' && !node.data.trim()) {
      $(node).remove();
    }
  });
}

function applyBlockClass($, el) {
  const $el = $(el);
  const block = $el.attr('data-block');
  if (!block) return;
  const classes = BLOCK_CLASS_MAP[block] || ['section'];
  classes.forEach((cls) => $el.addClass(cls));
  if (block === 'hero') {
    $el.addClass('hero');
  }
}

function applyRoleClass($, el) {
  const $el = $(el);
  const role = $el.attr('data-role');
  if (!role) return;
  const classes = ROLE_CLASS_MAP[role];
  if (classes) {
    classes.forEach((cls) => $el.addClass(cls));
  }
  if (role === 'primary-cta' || role === 'secondary-cta') {
    if (!$el.is('a')) {
      $el.wrap('<a href="#"></a>');
    }
    $el.addClass('cta-button');
  }
  if (role === 'sticky-cta-link') {
    if (!$el.is('a')) {
      $el.wrap('<a href="#" class="sticky-cta__link"></a>');
      return;
    }
    $el.addClass('sticky-cta__link');
  }
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/import-claude.js <input.html> <output.html>');
    process.exit(1);
  }

  const absInput = path.resolve(process.cwd(), inputPath);
  const absOutput = path.resolve(process.cwd(), outputPath);

  if (!(await fs.pathExists(absInput))) {
    console.error(`Input file not found: ${absInput}`);
    process.exit(1);
  }

  const raw = await fs.readFile(absInput, 'utf8');
  const $ = cheerio.load(raw, { decodeEntities: false });

  $('style').remove();

  const body = $('body').length ? $('body') : $.root();
  cleanWhitespaceNodes($, body);

  const heroEl = body.find('[data-block="hero"]').first();
  let heroHtml = '';
  if (heroEl.length) {
    applyBlockClass($, heroEl);
    cleanWhitespaceNodes($, heroEl);
    heroHtml = $.html(heroEl);
    heroEl.remove();
  }

  const container = $('<div class="container"></div>');
  const nodes = body.contents().filter((_, node) => {
    if (node.type === 'text') {
      return node.data.trim().length > 0;
    }
    return true;
  });

  nodes.each((_, node) => {
    const $node = $(node);
    applyBlockClass($, $node);
    applyRoleClass($, $node);
    cleanWhitespaceNodes($, $node);

    $node.find('[data-block]').each((__, child) => {
      applyBlockClass($, child);
    });
    $node.find('[data-role]').each((__, child) => {
      applyRoleClass($, child);
    });

    container.append($node);
  });

  let outputHtml = '';
  if (heroHtml) {
    outputHtml += `${heroHtml}\n\n`;
  }
  outputHtml += $.html(container);

  await fs.outputFile(absOutput, outputHtml.trim() + '\n');
  console.log(`Converted HTML written to ${absOutput}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

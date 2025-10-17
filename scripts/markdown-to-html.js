#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/markdown-to-html.js <input.md> <output.html>');
    process.exit(1);
  }

  const absInput = path.resolve(process.cwd(), inputPath);
  const absOutput = path.resolve(process.cwd(), outputPath);

  if (!(await fs.pathExists(absInput))) {
    console.error(`Markdown file not found: ${absInput}`);
    process.exit(1);
  }

  const markdown = await fs.readFile(absInput, 'utf8');
  const html = marked.parse(markdown, {
    gfm: true,
    breaks: true
  });

  await fs.outputFile(absOutput, html.trim() + '\n');
  console.log(`Converted markdown -> HTML: ${absOutput}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

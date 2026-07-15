'use strict';

const fs = require('node:fs');
const path = require('node:path');

const HEADER_PATTERN = /^(\d{2}:\d{2}:\d{2})\t From (.+?) : (.*)$/;
const PRIVATE_OR_PROMOTIONAL_PATTERN = /(https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b0\d{1,4}-?\d{2,4}-?\d{3,4}\b|申し込|申込|カード|決済|分割|振込|入金|購入|契約)/i;
function parseClockSeconds(value) {
  const parts = String(value).split(':').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`invalid_clock_time:${value}`);
  }
  return (parts[0] * 60 * 60) + (parts[1] * 60) + parts[2];
}

function parseZoomChat(text) {
  const comments = [];
  for (const line of String(text).replace(/\r/g, '').split('\n')) {
    const match = line.match(HEADER_PATTERN);
    if (match) {
      comments.push({ time: match[1], name: match[2].trim(), message: match[3] });
    } else if (comments.length && line.trim()) {
      comments.at(-1).message += `\n${line.trim()}`;
    }
  }
  return comments;
}

function importZoomChat(text, { recordingStartsAt, maxMessageLength = 200 }) {
  const recordingStartSeconds = parseClockSeconds(recordingStartsAt);
  let previousElapsedSeconds = 0;
  let skippedCount = 0;

  const comments = parseZoomChat(text).flatMap((comment, index) => {
    const message = comment.message.trim();
    let elapsedSeconds = parseClockSeconds(comment.time) - recordingStartSeconds;
    if (elapsedSeconds < -12 * 60 * 60) elapsedSeconds += 24 * 60 * 60;

    const shouldSkip = elapsedSeconds < 0
      || !message
      || message.length > maxMessageLength
      || (comment.name !== '事務局' && PRIVATE_OR_PROMOTIONAL_PATTERN.test(message));

    if (shouldSkip) {
      skippedCount += 1;
      return [];
    }

    previousElapsedSeconds = Math.max(previousElapsedSeconds, elapsedSeconds);
    return [{
      id: `recorded-${index + 1}`,
      elapsedSeconds: previousElapsedSeconds,
      name: comment.name === '工藤' ? '工藤（主催者）' : comment.name,
      role: comment.name === '工藤' ? 'host' : comment.name === '事務局' ? 'office' : 'participant',
      message,
    }];
  });

  return {
    recordingStartsAt,
    importedCount: comments.length,
    skippedCount,
    comments,
  };
}

function main() {
  const [, , inputPath, outputPath, recordingStartsAt = '20:00:36'] = process.argv;
  if (!inputPath || !outputPath) {
    throw new Error('usage: node scripts/import-seminar-chat.js <chat.txt> <output.json> [recording start HH:MM:SS]');
  }

  const imported = importZoomChat(fs.readFileSync(inputPath, 'utf8'), { recordingStartsAt });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(imported, null, 2)}\n`);
  console.log(`Imported ${imported.importedCount} comments; skipped ${imported.skippedCount}.`);
}

if (require.main === module) main();

module.exports = {
  importZoomChat,
  parseClockSeconds,
  parseZoomChat,
};

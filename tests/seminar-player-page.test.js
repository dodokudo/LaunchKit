const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const page = fs.readFileSync(
  path.join(__dirname, '..', 'content', '1', 'landing.html'),
  'utf8',
);

test('LINE in-app browser starts with the normal playback button', () => {
  assert.doesNotMatch(page, /shouldOpenExternalBrowser/);
  assert.match(page, /startButton\.hidden = false;\s+lineExternalButton\.hidden = true;/);
  assert.match(page, /lineExternalButton\.hidden = !isLineInAppBrowser;/);
});

test('audible playback is requested directly from the start button handler', () => {
  assert.match(page, /function startViewing\(\)[\s\S]*?video\.muted = false;[\s\S]*?video\.play\(\)/);
  assert.match(page, /startButton\.addEventListener\('click', startViewing\)/);
});

test('the player does not repeatedly force the live position', () => {
  assert.doesNotMatch(page, /seekToLivePosition/);
  assert.doesNotMatch(page, /addEventListener\('seeking'/);
  assert.doesNotMatch(page, /addEventListener\('pause'/);
});

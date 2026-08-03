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

test('mobile header keeps the schedule status compact and only shows recovery help in LINE', () => {
  assert.doesNotMatch(page, /class="topbar"/);
  assert.match(page, /class="hero-heading"[\s\S]*class="broadcast-status" id="broadcastLabel"/);
  assert.match(page, /body\.is-line-browser \.line-browser-guide/);
  assert.match(page, /document\.body\.classList\.toggle\('is-line-browser', isLineInAppBrowser\)/);
});

test('audible playback is requested directly from the start button handler', () => {
  assert.match(page, /function startViewing\(\)[\s\S]*?video\.muted = false;[\s\S]*?video\.play\(\)/);
  assert.match(page, /startButton\.addEventListener\('click', startViewing\)/);
  assert.match(page, /function preparePlayback\(\)[\s\S]*?setAttribute\('playback-id', statusData\.playbackId\)/);
  assert.match(page, /statusData\.status === 'live'[\s\S]*?preparePlayback\(\)/);
});

test('Mux adaptive HLS is configured before audible playback', () => {
  assert.match(page, /@mux\/mux-player@3\.10\.1/);
  assert.match(page, /<mux-player id="seminarVideo" preload="auto"/);
  assert.match(page, /--controls: none/);
  assert.match(page, /setAttribute\('playback-token', statusData\.playbackToken\)[\s\S]*setAttribute\('playback-id', statusData\.playbackId\)/);
});

test('secret test mode starts the same stream after a 30 second countdown', () => {
  assert.match(page, /const testStartsAtMs = isTestMode \? Date\.now\(\) \+ 30_000 : null/);
  assert.match(page, /api\/video\/access\?test=\$\{encodeURIComponent\(testToken\)\}&startsAt=\$\{testStartsAtMs\}/);
  assert.match(page, /fetch\(accessUrl, \{ cache: 'no-store' \}\)/);
});

test('secret test mode keeps viewer comments enabled and isolated', () => {
  assert.match(page, /const commentsUrl = isTestMode[\s\S]*?api\/video\/comments\?test=/);
  assert.match(page, /commentFields\.disabled = false/);
  assert.match(page, /fetch\(commentsUrl, \{ cache: 'no-store' \}\)/);
  assert.match(page, /fetch\(commentsUrl, \{\s+method: 'POST'/);
  assert.doesNotMatch(page, /commentFields\.disabled = isTestMode/);
});

test('fullscreen keeps LINE and Apple mobile playback in the controlled page player', () => {
  assert.match(page, /if \(isAppleMobile \|\| isLineInAppBrowser\) \{\s+enterPseudoFullscreen\(\)/);
  assert.match(page, /stageGrid\.classList\.add\('is-pseudo-fullscreen'\)/);
  assert.match(page, /fullscreenExitButton\.addEventListener\('click', exitPseudoFullscreen\)/);
  assert.doesNotMatch(page, /webkitEnterFullscreen/);
  assert.match(page, /video\.requestFullscreen\?\.\(\) \|\| videoWrap\.requestFullscreen\?\.\(\)/);
  assert.match(page, /fullscreenButton\.addEventListener\('click',[\s\S]*?enterFullscreen\(\)/);
});

test('pseudo fullscreen keeps the video at the top and comments usable below it', () => {
  assert.match(page, /class="stage-grid" id="stageGrid"/);
  assert.match(page, /\.stage-grid\.is-pseudo-fullscreen,[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.match(page, /\.stage-grid\.is-pseudo-fullscreen \.video-wrap,[\s\S]*?height: min\(56\.25vw, 42dvh\)/);
  assert.match(page, /\.stage-grid\.is-pseudo-fullscreen \.comment-panel,[\s\S]*?min-height: 0/);
  assert.match(page, /\.stage-grid\.is-pseudo-fullscreen \.comment-list,[\s\S]*?max-height: none/);
});

test('mobile devices use the fullscreen-style stage by default without an exit button', () => {
  assert.match(page, /document\.body\.classList\.toggle\('is-mobile-stage', isMobileDevice\)/);
  assert.match(page, /body\.is-mobile-stage \.stage-grid/);
  assert.match(page, /body\.is-mobile-stage \.fullscreen-exit-button \{\s+display: none !important/);
});

test('comment input and submit button are side by side', () => {
  assert.match(page, /class="comment-entry-row"[\s\S]*?<textarea[\s\S]*?<button class="comment-submit"/);
  assert.match(page, /\.comment-entry-row \{ display: flex; align-items: stretch; gap: 8px; \}/);
});

test('viewer-facing playback buttons use concise labels', () => {
  assert.match(page, />視聴を開始する<\/button>/);
  assert.doesNotMatch(page, /音声を出して視聴開始する/);
  assert.doesNotMatch(page, /音声を読み込んでいます/);
});

test('the player does not repeatedly force the live position', () => {
  assert.doesNotMatch(page, /seekToLivePosition/);
  assert.doesNotMatch(page, /addEventListener\('seeking'/);
  assert.doesNotMatch(page, /addEventListener\('pause'/);
});

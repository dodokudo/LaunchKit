'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { importZoomChat } = require('../scripts/import-seminar-chat');
const seminarChat = require('../content/1/seminar-chat.json');

test('Zoomコメントを動画開始からの経過秒へ変換する', () => {
  const imported = importZoomChat([
    '20:00:46\t From 工藤 : ここです',
    '20:00:58\t From 山田太郎 : 聞こえています。',
    '20:01:16\t From 佐藤花子 : 聴こえてます',
    '20:01:20\t From 佐藤花子 : 1行目',
    '2行目',
  ].join('\n'), { recordingStartsAt: '20:00:36' });

  assert.equal(imported.comments.length, 4);
  assert.deepEqual(imported.comments[0], {
    id: 'recorded-1',
    elapsedSeconds: 10,
    name: '工藤（主催者）',
    role: 'host',
    message: 'ここです',
  });
  assert.deepEqual(imported.comments[1], {
    id: 'recorded-2',
    elapsedSeconds: 22,
    name: '山田太郎',
    role: 'participant',
    message: '聞こえています。',
  });
  assert.equal(imported.comments[2].elapsedSeconds, 40);
  assert.equal(imported.comments[2].message, '聴こえてます');
  assert.equal(imported.comments[3].elapsedSeconds, 44);
  assert.equal(imported.comments[3].message, '1行目\n2行目');
});

test('URL、申込・決済コメント、長文を含む全コメントを残す', () => {
  const imported = importZoomChat([
    '20:00:40\t From 事務局 : 運営投稿',
    '20:00:41\t From 山田太郎 : https://example.com',
    '20:00:42\t From 山田太郎 : カード決済で申し込みました',
    `20:00:43\t From 山田太郎 : ${'長'.repeat(201)}`,
    '20:00:44\t From 山田太郎 : 参考になりました',
  ].join('\n'), { recordingStartsAt: '20:00:36' });

  assert.deepEqual(imported.comments.map(({ name, role, message }) => ({ name, role, message })), [
    { name: '事務局', role: 'office', message: '運営投稿' },
    { name: '山田太郎', role: 'participant', message: 'https://example.com' },
    { name: '山田太郎', role: 'participant', message: 'カード決済で申し込みました' },
    { name: '山田太郎', role: 'participant', message: '長'.repeat(201) },
    { name: '山田太郎', role: 'participant', message: '参考になりました' },
  ]);
  assert.equal(imported.importedCount, 5);
  assert.equal(imported.skippedCount, 0);
});

test('事務局の音声確認案内を最初の視聴者回答の4秒前に表示する', () => {
  const officePrompt = seminarChat.comments.find((comment) => comment.id === 'office-audio-check');
  const nakamuraResponse = seminarChat.comments.find(
    (comment) => comment.id === 'supplemental-nakamura-audio-check',
  );
  const firstViewerResponse = seminarChat.comments.find((comment) => comment.id === 'recorded-2');

  assert.deepEqual(officePrompt, {
    id: 'office-audio-check',
    elapsedSeconds: 18,
    name: '事務局',
    role: 'office',
    message: '音声が聞こえたらコメントで教えてください',
  });
  assert.equal(firstViewerResponse.elapsedSeconds - officePrompt.elapsedSeconds, 4);
  assert.deepEqual(nakamuraResponse, {
    id: 'supplemental-nakamura-audio-check',
    elapsedSeconds: 21.5,
    name: '中村弘志',
    role: 'participant',
    message: '聞こえてます',
  });
  assert.equal(firstViewerResponse.elapsedSeconds - nakamuraResponse.elapsedSeconds, 0.5);
});

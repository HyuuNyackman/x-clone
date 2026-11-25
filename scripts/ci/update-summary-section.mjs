// PR 本文の、マーカーで囲んだ部分だけを、要約に置き換える。マーカーがなければ、本文の末尾に足す。
// 本文のそれ以外の部分 (人が書いた説明) は変えない。
//
//   node scripts/ci/update-summary-section.mjs <本文のファイル> <要約のファイル>   新しい本文を標準出力に出す
import { readFileSync } from 'node:fs';

const START = '<!-- release-summary:start -->';
const END = '<!-- release-summary:end -->';

const [bodyFile, summaryFile] = process.argv.slice(2);
if (!bodyFile || !summaryFile) {
  console.error('使い方: update-summary-section.mjs <本文のファイル> <要約のファイル>');
  process.exit(1);
}

const body = readFileSync(bodyFile, 'utf8').replace(/\r\n/g, '\n');
const summary = readFileSync(summaryFile, 'utf8').trim();
const section = `${START}\n${summary}\n${END}`;

const start = body.indexOf(START);
const end = body.indexOf(END);

let next;
if (start !== -1 && end > start) {
  next = body.slice(0, start) + section + body.slice(end + END.length);
} else {
  next = body.trimEnd() === '' ? section : `${body.trimEnd()}\n\n${section}`;
}

process.stdout.write(`${next.trimEnd()}\n`);

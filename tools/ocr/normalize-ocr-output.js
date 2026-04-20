#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

function usage() {
  console.log(`
사용법:
  node tools/ocr/normalize-ocr-output.js --id <game-id> --source <path> --raw-dir <dir> --out <file> [--lang <langs>]
`);
}

function parseArgs(argv) {
  const args = {
    id: '',
    source: '',
    rawDir: '',
    out: '',
    lang: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }

    const next = argv[i + 1] ?? '';
    if (arg === '--id') {
      args.id = next;
      i += 1;
    } else if (arg === '--source') {
      args.source = next;
      i += 1;
    } else if (arg === '--raw-dir') {
      args.rawDir = next;
      i += 1;
    } else if (arg === '--out') {
      args.out = next;
      i += 1;
    } else if (arg === '--lang') {
      args.lang = next;
      i += 1;
    } else {
      throw new Error(`알 수 없는 옵션입니다: ${arg}`);
    }
  }

  for (const [key, value] of Object.entries(args)) {
    if (key !== 'lang' && !value) {
      throw new Error(`필수 옵션이 없습니다: ${key}`);
    }
  }

  return args;
}

function normalizeText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n\n<!-- PAGE_BREAK -->\n\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function hasEnoughText(text) {
  const compact = text.replace(/\s/g, '');
  return compact.length >= 20;
}

function createReviewNotes(files) {
  const notes = [
    '# OCR 검수 노트',
    '',
    '- 원문 페이지 수와 OCR 섹션 수가 일치하는지 확인합니다.',
    '- 이름, 숫자, 시간, 조건, 금지 사항은 원본과 대조합니다.',
    '- 스토리, 대사, 장면 설명은 축약하지 않습니다.',
    '- OCR이 애매한 문장은 임의로 보정하지 말고 이 파일에 기록합니다.',
    '',
    '## 확인 항목',
    '',
  ];

  for (const file of files) {
    notes.push(`- [ ] ${file.label}`);
  }

  return `${notes.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(args.rawDir)) {
    throw new Error(`raw-dir을 찾을 수 없습니다: ${args.rawDir}`);
  }

  const txtFiles = readdirSync(args.rawDir)
    .filter((file) => file.toLowerCase().endsWith('.txt'))
    .sort();

  if (txtFiles.length === 0) {
    throw new Error(`OCR 텍스트 파일이 없습니다: ${args.rawDir}`);
  }

  const generatedAt = new Date().toISOString();
  const sections = [];
  const fileSummaries = [];

  for (const file of txtFiles) {
    const path = join(args.rawDir, file);
    const raw = readFileSync(path, 'utf8');
    const text = normalizeText(raw);
    const label = basename(file, '.txt');
    const status = hasEnoughText(text) ? 'ok' : 'review';

    fileSummaries.push({ file, label, status, charCount: text.length });

    sections.push([
      `## OCR Section: ${label}`,
      '',
      `<!-- source-file: ${file} -->`,
      `<!-- status: ${status} -->`,
      '',
      text || '<!-- REVIEW: OCR 결과가 비어 있습니다. 원본 페이지를 확인하세요. -->',
    ].join('\n'));
  }

  const header = [
    `# OCR 작업 텍스트: ${args.id}`,
    '',
    `- source: ${args.source}`,
    `- generatedAt: ${generatedAt}`,
    `- languages: ${args.lang || 'unknown'}`,
    '',
    '## 사용 원칙',
    '',
    '- 이 파일은 게임 패키지 생성 전 단계의 작업 텍스트입니다.',
    '- 스토리, 대사, 장면 설명은 축약하지 않습니다.',
    '- OCR 오류가 의심되는 문장은 원본과 대조하고, 임의로 보정하지 않습니다.',
    '- 누락 또는 불확실한 내용은 placeholder나 review note로 남깁니다.',
    '',
  ].join('\n');

  const output = `${header}${sections.join('\n\n---\n\n')}\n`;

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, output, 'utf8');

  const manifestPath = join(dirname(args.out), 'manifest.json');
  writeFileSync(
    manifestPath,
    `${JSON.stringify({
      id: args.id,
      source: args.source,
      generatedAt,
      languages: args.lang,
      rawDir: args.rawDir,
      output: args.out,
      files: fileSummaries,
    }, null, 2)}\n`,
    'utf8',
  );

  const reviewPath = join(dirname(args.out), 'review-notes.md');
  writeFileSync(reviewPath, createReviewNotes(fileSummaries), 'utf8');

  console.log(`정규화 완료: ${args.out}`);
  console.log(`매니페스트: ${manifestPath}`);
  console.log(`검수 노트: ${reviewPath}`);
}

try {
  main();
} catch (error) {
  console.error(`오류: ${error.message}`);
  process.exit(1);
}

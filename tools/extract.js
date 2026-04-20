#!/usr/bin/env node
/**
 * [1단계] 룰북 텍스트 추출기
 *
 * 룰북 이미지 또는 PDF 를 Claude Vision 으로 읽어서 텍스트 파일로 저장합니다.
 * 추출된 텍스트를 Claude Code 채팅에 붙여넣고 게임 패키지 생성을 요청하세요.
 *
 * 사용법:
 *   node extract.js <파일_또는_폴더> --id <게임ID>
 *
 * 예시:
 *   node extract.js input/rulebook.pdf --id detective-prohibited-area
 *   node extract.js input/             --id detective-prohibited-area
 *
 * 지원 형식: .png .jpg .jpeg .webp .pdf
 *
 * 결과: output/<id>-text.md
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');

const IMAGE_EXT  = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const SUPPORTED  = new Set([...IMAGE_EXT, '.pdf']);
const MIME_MAP   = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf':  'application/pdf',
};

// ── CLI 인수 파싱 ────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log(`
사용법: node extract.js <파일_또는_폴더> --id <게임ID>

예시:
  node extract.js input/rulebook.pdf --id detective-prohibited-area
  node extract.js input/             --id detective-prohibited-area
`);
    process.exit(0);
  }

  const result = { input: args[0], id: null };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--id') result.id = args[++i];
  }

  if (!result.id) {
    console.error('오류: --id 는 필수입니다.  예) --id detective-prohibited-area');
    process.exit(1);
  }
  if (!existsSync(result.input)) {
    console.error(`오류: 파일/폴더를 찾을 수 없습니다 → ${result.input}`);
    process.exit(1);
  }
  return result;
}

// ── 입력 파일 수집 ───────────────────────────────────────
function collectFiles(inputPath) {
  const stat = statSync(inputPath);
  if (stat.isFile()) {
    const ext = extname(inputPath).toLowerCase();
    if (!SUPPORTED.has(ext)) {
      console.error(`오류: 지원하지 않는 형식 (${ext}). png / jpg / pdf 만 가능합니다.`);
      process.exit(1);
    }
    return [inputPath];
  }

  const files = readdirSync(inputPath)
    .filter(f => SUPPORTED.has(extname(f).toLowerCase()))
    .sort()
    .map(f => join(inputPath, f));

  if (files.length === 0) {
    console.error(`오류: ${inputPath} 에서 이미지/PDF 파일을 찾을 수 없습니다.`);
    process.exit(1);
  }
  return files;
}

// ── 파일 → Claude API content block ─────────────────────
function toContentBlock(filePath) {
  const ext      = extname(filePath).toLowerCase();
  const data     = readFileSync(filePath).toString('base64');
  const mediaType = MIME_MAP[ext];

  if (ext === '.pdf') {
    return { type: 'document', source: { type: 'base64', media_type: mediaType, data } };
  }
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
}

// ── OCR 프롬프트 ─────────────────────────────────────────
const PROMPT = `이 파일에 있는 모든 텍스트를 정확하게 읽어서 출력해주세요.

규칙:
- 보이는 텍스트를 빠짐없이, 수정·요약하지 말고 그대로 옮겨 주세요.
- 페이지 구분은 "---" 로 표시해주세요.
- 제목처럼 보이는 텍스트는 ## 로 표시해주세요.
- 표(table)는 읽을 수 있는 형태로 그대로 표현해주세요.
- 그림/일러스트 영역은 [이미지: 간단한 설명] 으로 표시해주세요.
- 해석하거나 요약하지 마세요. 오직 읽기만 해주세요.`;

// ── 파일 1개 추출 ────────────────────────────────────────
async function extractOne(client, filePath, index, total) {
  const name = basename(filePath);
  const sizeMB = (statSync(filePath).size / 1024 / 1024).toFixed(1);
  console.log(`  [${index}/${total}] ${name}  (${sizeMB} MB)`);

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [toContentBlock(filePath), { type: 'text', text: PROMPT }],
    }],
  });

  return response.content[0].text;
}

// ── 메인 ─────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('오류: ANTHROPIC_API_KEY 가 없습니다.');
    console.error('tools/.env 파일에 키를 입력하세요. (.env.example 참고)');
    process.exit(1);
  }

  const client = new Anthropic();
  const files  = collectFiles(args.input);

  console.log(`\n[텍스트 추출] id: ${args.id}  파일 ${files.length}개`);
  console.log('─'.repeat(50));

  const sections = [];
  for (let i = 0; i < files.length; i++) {
    const text = await extractOne(client, files[i], i + 1, files.length);
    sections.push(`## 파일: ${basename(files[i])}\n\n${text}`);
  }

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const outPath = join(OUTPUT_DIR, `${args.id}-text.md`);
  writeFileSync(outPath, sections.join('\n\n---\n\n'), 'utf-8');

  console.log('\n─'.repeat(50));
  console.log(`\n완료 → ${outPath}`);
  console.log(`\n다음 단계:`);
  console.log(`  1. 위 파일을 열어서 텍스트가 제대로 읽혔는지 확인하세요.`);
  console.log(`  2. Claude Code 채팅에 텍스트를 붙여넣고 이렇게 요청하세요:`);
  console.log(`     "이 텍스트로 ${args.id} 게임 패키지를 만들어줘"`);
}

main().catch(err => {
  console.error('\n오류:', err.message);
  process.exit(1);
});

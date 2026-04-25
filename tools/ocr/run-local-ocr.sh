#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

INPUT_PATH=""
GAME_ID=""
LANGS="kor+eng+jpn"
PSM="6"
FORCE_OCR="false"

usage() {
  cat <<'USAGE'
사용법:
  npm run ocr:local -- --id <game-id> --input <pdf|image|folder> [options]

옵션:
  --id <game-id>          작업 ID. 예: detective-prohibited-area
  --input <path>          PDF, 이미지 파일, 이미지 폴더 경로
  --lang <langs>          Tesseract 언어. 기본값: kor+eng+jpn
  --psm <mode>            이미지 OCR page segmentation mode. 기본값: 6
  --force-ocr             PDF 안에 텍스트가 있어도 OCR을 강제 실행
  --help                  도움말 출력

예시:
  npm run ocr:local -- --id sample-game --input ./rulebook.pdf
  npm run ocr:local -- --id sample-game --input ./scans --lang kor+eng
USAGE
}

fail() {
  echo "오류: $*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_command() {
  command_exists "$1" || fail "'$1' 명령어가 없습니다. tools/ocr/README.md의 설치 방법을 확인하세요."
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id)
      GAME_ID="${2:-}"
      shift 2
      ;;
    --input)
      INPUT_PATH="${2:-}"
      shift 2
      ;;
    --lang)
      LANGS="${2:-}"
      shift 2
      ;;
    --psm)
      PSM="${2:-}"
      shift 2
      ;;
    --force-ocr)
      FORCE_OCR="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "알 수 없는 옵션입니다: $1"
      ;;
  esac
done

[[ -n "$GAME_ID" ]] || fail "--id가 필요합니다."
[[ -n "$INPUT_PATH" ]] || fail "--input이 필요합니다."
[[ -e "$INPUT_PATH" ]] || fail "입력 경로를 찾을 수 없습니다: $INPUT_PATH"

require_command node

WORK_DIR="$ROOT_DIR/workbench/ocr/$GAME_ID"
RAW_DIR="$WORK_DIR/raw-ocr"
SOURCE_DIR="$WORK_DIR/source"
OUTPUT_DIR="$WORK_DIR/output"
NORMALIZED_MD="$WORK_DIR/normalized.md"

mkdir -p "$RAW_DIR" "$SOURCE_DIR" "$OUTPUT_DIR"

copy_source() {
  local source="$1"
  if [[ -f "$source" ]]; then
    cp "$source" "$SOURCE_DIR/"
  fi
}

char_count() {
  if [[ -f "$1" ]]; then
    wc -m < "$1" | tr -d ' '
  else
    echo "0"
  fi
}

is_pdf() {
  local ext
  ext="$(printf '%s' "${1##*.}" | tr '[:upper:]' '[:lower:]')"
  [[ "$ext" == "pdf" ]]
}

is_image_file() {
  local ext
  ext="$(printf '%s' "${1##*.}" | tr '[:upper:]' '[:lower:]')"
  [[ "$ext" == "png" || "$ext" == "jpg" || "$ext" == "jpeg" || "$ext" == "webp" || "$ext" == "tif" || "$ext" == "tiff" ]]
}

extract_pdf() {
  local input="$1"
  local native_text="$RAW_DIR/0000-native-pdf.txt"
  local ocr_pdf="$OUTPUT_DIR/ocr-layer.pdf"
  local ocr_text="$RAW_DIR/0000-ocr-pdf.txt"

  copy_source "$input"

  if [[ "$FORCE_OCR" == "false" ]] && command_exists pdftotext; then
    echo "[1/3] PDF 내장 텍스트 추출 시도"
    pdftotext -layout "$input" "$native_text" || true

    local count
    count="$(char_count "$native_text")"
    if [[ "$count" -gt 100 ]]; then
      echo "[완료] PDF 내장 텍스트를 사용합니다. 문자 수: $count"
      return
    fi

    rm -f "$native_text"
    echo "[정보] 내장 텍스트가 없거나 너무 짧습니다. OCR로 전환합니다."
  fi

  require_command ocrmypdf
  require_command pdftotext

  echo "[1/3] OCR 텍스트 레이어 생성"
  ocrmypdf \
    --language "$LANGS" \
    --deskew \
    --rotate-pages \
    --skip-text \
    "$input" \
    "$ocr_pdf"

  echo "[2/3] OCR PDF에서 텍스트 추출"
  pdftotext -layout "$ocr_pdf" "$ocr_text"
}

extract_images() {
  local input="$1"
  local files=()

  require_command tesseract

  if [[ -f "$input" ]]; then
    is_image_file "$input" || fail "지원하지 않는 이미지 형식입니다: $input"
    files+=("$input")
    copy_source "$input"
  else
    while IFS= read -r file; do
      files+=("$file")
    done < <(find "$input" -maxdepth 1 -type f \( \
      -iname '*.png' -o \
      -iname '*.jpg' -o \
      -iname '*.jpeg' -o \
      -iname '*.webp' -o \
      -iname '*.tif' -o \
      -iname '*.tiff' \
    \) | sort)

    [[ "${#files[@]}" -gt 0 ]] || fail "이미지 파일을 찾을 수 없습니다: $input"
  fi

  echo "[1/3] 이미지 OCR 실행: ${#files[@]}개"

  local index=1
  local file
  for file in "${files[@]}"; do
    local out_base
    out_base="$RAW_DIR/$(printf '%04d' "$index")"
    echo "  - $(basename "$file")"
    tesseract "$file" "$out_base" -l "$LANGS" --psm "$PSM"
    index=$((index + 1))
  done
}

echo
echo "[로컬 OCR] id: $GAME_ID"
echo "입력: $INPUT_PATH"
echo "언어: $LANGS"
echo "출력: $WORK_DIR"
echo

if [[ -f "$INPUT_PATH" ]] && is_pdf "$INPUT_PATH"; then
  extract_pdf "$INPUT_PATH"
else
  extract_images "$INPUT_PATH"
fi

echo "[3/3] OCR 결과 정규화"
node "$SCRIPT_DIR/normalize-ocr-output.js" \
  --id "$GAME_ID" \
  --source "$INPUT_PATH" \
  --raw-dir "$RAW_DIR" \
  --out "$NORMALIZED_MD" \
  --lang "$LANGS"

echo
echo "완료:"
echo "  $NORMALIZED_MD"
echo
echo "다음 단계:"
echo "  1. normalized.md를 열어 OCR 오류와 누락 페이지를 확인합니다."
echo "  2. 문제가 있으면 원본 스캔 품질을 개선하거나 클라우드 OCR을 검토합니다."
echo "  3. 검수된 텍스트를 기준으로 rulebook-game-packager skill에 게임 패키지 생성을 요청합니다."

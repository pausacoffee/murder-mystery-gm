# 로컬 OCR 파이프라인

PDF 또는 이미지 스캔본 룰북을 로컬 OCR로 텍스트화하기 위한 전처리 도구입니다.

이 도구의 목표는 게임 패키지를 바로 만드는 것이 아니라, `rulebook-game-packager` skill이 사용할 수 있는 검수 가능한 작업 텍스트를 만드는 것입니다.

## 역할 분리

- OCR 파이프라인: PDF/이미지에서 텍스트를 추출합니다.
- 사람 검수: 이름, 숫자, 시간, 조건, 누락 페이지를 원본과 대조합니다.
- `rulebook-game-packager` skill: 검수된 텍스트를 `game.json`, `slides.html`, `rules.json`, `catalog.json`으로 구조화합니다.

LLM에게 스캔본을 직접 읽게 하는 방식은 대량 처리, 재현성, 누락 검출에 약합니다. OCR은 전용 도구로 처리하고, LLM은 OCR 이후 구조화에 사용하는 것을 기본 원칙으로 둡니다.

## 설치

macOS 기준:

```bash
brew install poppler
brew install tesseract
brew install tesseract-lang
brew install ocrmypdf
```

명령어 역할:

- `pdftotext`: 텍스트 PDF 또는 OCR 처리된 PDF에서 텍스트 추출
- `ocrmypdf`: 스캔 PDF에 OCR 텍스트 레이어 생성
- `tesseract`: 이미지 OCR 실행
- `tesseract-lang`: 한국어, 일본어 등 추가 언어 데이터

설치 확인:

```bash
pdftotext -v
ocrmypdf --version
tesseract --version
tesseract --list-langs
```

`kor`, `eng`, `jpn` 언어가 보이지 않으면 `tesseract-lang` 설치 상태를 확인합니다.

## 사용법

루트 디렉터리에서 실행합니다.

```bash
npm run ocr:local -- --id <game-id> --input <pdf|image|folder>
```

예시:

```bash
npm run ocr:local -- --id sample-game --input ./rulebook.pdf
npm run ocr:local -- --id sample-game --input ./scans --lang kor+eng
```

기본 언어는 `kor+eng+jpn`입니다.

일본어가 없는 한국어/영어 룰북이면 다음처럼 줄이는 편이 OCR 오류를 줄일 수 있습니다.

```bash
npm run ocr:local -- --id sample-game --input ./rulebook.pdf --lang kor+eng
```

PDF 안에 이미 텍스트가 있으면 OCR을 건너뛰고 내장 텍스트를 사용합니다. 무조건 OCR을 다시 돌리고 싶으면:

```bash
npm run ocr:local -- --id sample-game --input ./rulebook.pdf --force-ocr
```

## 출력

결과는 다음 위치에 생성됩니다.

```text
workbench/ocr/<game-id>/
  source/
  raw-ocr/
  output/
  normalized.md
  manifest.json
  review-notes.md
```

- `normalized.md`: 다음 단계에서 사용하는 작업 텍스트
- `manifest.json`: OCR 입력과 결과 파일 목록
- `review-notes.md`: 사람이 확인할 체크리스트
- `output/ocr-layer.pdf`: 스캔 PDF에 OCR 텍스트 레이어를 입힌 결과

`workbench/`는 작업 산출물 영역이므로 기본적으로 Git에 커밋하지 않습니다.

## 다음 단계

1. `workbench/ocr/<game-id>/normalized.md`를 엽니다.
2. `review-notes.md` 기준으로 원본과 대조합니다.
3. 오류가 많으면 스캔 해상도, 기울기, 언어 옵션을 조정해서 다시 실행합니다.
4. 검수된 텍스트로 `rulebook-game-packager` skill에 게임 패키지 생성을 요청합니다.

요청 예:

```text
rulebook-game-packager skill을 사용해서
workbench/ocr/sample-game/normalized.md를 기반으로 게임 패키지를 만들어 주세요.
스토리, 대사, 장면 설명은 축약하지 말고 슬라이드가 길면 여러 장으로 나누세요.
불확실한 OCR 문장은 placeholder 또는 review note로 남겨 주세요.
```

## 품질 기준

로컬 OCR 결과가 다음 조건을 만족하지 못하면 클라우드 OCR 검토 대상입니다.

- 페이지 누락이 없어야 합니다.
- 이름, 숫자, 시간, 조건이 안정적으로 읽혀야 합니다.
- 스토리 문단이 대량으로 깨지지 않아야 합니다.
- 일본어 세로쓰기, 작은 글씨, 배경 무늬가 많은 페이지에서 오류가 과도하지 않아야 합니다.

클라우드 OCR 후보는 Google Document AI, Azure AI Document Intelligence, AWS Textract, Naver CLOVA OCR입니다.

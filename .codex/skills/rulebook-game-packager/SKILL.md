---
name: rulebook-game-packager
description: Create or update a murder mystery GM game package from scanned rulebooks, OCR output, or extracted rulebook text. Use when converting source rulebooks into this repository's catalog/game package structure, including metadata, slides, rules, timers, transition guards, and review placeholders.
---

# 룰북 게임 패키지 생성기

머더 미스터리 룰북 스캔본, OCR 결과, 또는 정리된 텍스트를 이 저장소의 GM 게임 패키지 구조로 변환할 때 이 skill을 사용합니다.

이 skill은 OCR 엔진이 아닙니다. OCR은 `tools/ocr/`의 로컬 파이프라인으로 먼저 수행하고, 이 skill은 OCR 이후 텍스트를 해석해 `catalog`, `game.json`, `slides`, `rules`로 구조화합니다.

## 사용 방법

### 1. 스캔본 PDF 또는 이미지에서 시작하는 경우

먼저 루트 디렉터리에서 로컬 OCR을 실행합니다.

```bash
npm run ocr:local -- --id <game-id> --input <pdf|image|folder>
```

예시:

```bash
npm run ocr:local -- --id sample-game --input ./rulebook.pdf
npm run ocr:local -- --id sample-game --input ./scans --lang kor+eng
```

생성 결과:

```text
workbench/ocr/<game-id>/normalized.md
workbench/ocr/<game-id>/manifest.json
workbench/ocr/<game-id>/review-notes.md
```

그다음 사용자에게 `normalized.md`와 `review-notes.md`를 검수하도록 안내합니다. 이름, 숫자, 시간, 조건, 금지 사항은 특히 원본과 대조해야 합니다.

### 2. OCR 텍스트가 준비된 경우

검수된 텍스트를 기준으로 다음처럼 요청받으면 이 skill을 사용합니다.

```text
rulebook-game-packager skill을 사용해서
workbench/ocr/sample-game/normalized.md를 기반으로 게임 패키지를 만들어 주세요.
스토리, 대사, 장면 설명은 축약하지 말고 슬라이드가 길면 여러 장으로 나누세요.
불확실한 OCR 문장은 placeholder 또는 review note로 남겨 주세요.
```

### 3. 이미 정리된 룰북 텍스트가 제공된 경우

OCR 단계는 건너뛰고 바로 패키지 생성으로 진행합니다. 단, 원문이 불완전하거나 누락된 부분은 임의로 채우지 말고 검수 항목으로 남깁니다.

## 산출물 계약

필요에 따라 다음 파일을 생성하거나 수정합니다.

- `data/catalog.json`
- `games/<id>/game.json`
- `games/<id>/slides.html`
- `games/<id>/rules.json`
- `games/<id>/assets/` 참조. 실제 에셋이 있을 때만 연결합니다.

현재 마이그레이션 안정성을 위해 기본 슬라이드 산출물은 `slides.html`입니다. 렌더러가 `slides.json`을 충분히 지원하는 경우에만 `slides.json`을 사용합니다.

게임 전용 테마는 실제 override가 필요할 때만 `game.json`에 `theme`를 추가합니다. 단순 레이아웃 차이 때문에 새 테마 파일을 만들지 않습니다.

## 기본 작업 흐름

1. 입력 상태를 확인합니다.
   - 원본 PDF/이미지만 있는지
   - OCR 결과가 있는지
   - 검수된 텍스트인지
2. 메타데이터를 추출합니다.
   - 제목
   - 플레이어 수
   - 소요 시간
   - 시놉시스
   - 검색 별칭
3. 게임 흐름을 순서대로 추출합니다.
   - 도입
   - 준비
   - 파트
   - 페이즈
   - 조사/공유/토론
   - 투표/선택
   - 엔딩
4. 타이머 정보를 분리합니다.
   - 공용 타이머
   - 플레이어별 타이머
   - 페이즈 전환 조건
5. 룰북 내용을 슬라이드 타입으로 분류합니다.
6. 규칙 모달 데이터를 분리합니다.
   - 전체 규칙 탭
   - 현재 슬라이드 규칙 숏컷
7. 불확실한 내용은 placeholder 또는 review note로 남깁니다.
8. 카탈로그 항목을 추가해 검색과 라우팅이 가능하게 만듭니다.
9. `node --check app.js`와 `npm test`를 실행합니다.

## 슬라이드 분류 기준

- `story`: 서사, 도입문, 장면 설명, 대사
- `order`: 진행 순서, 게임 흐름, 페이즈 구조
- `timer`: 제한 시간 또는 플레이어별 시간 진행
- `rules`: 특정 규칙 설명
- `vote`: 투표 절차
- `selection`: 선택, 지목, 공개 절차
- `ending`: 엔딩 또는 마무리 안내
- `custom`: 위 타입으로 안전하게 분류하기 어려운 특수 안내

## 스토리 보존 규칙

스토리, 대사, 장면 설명은 축약하지 않습니다.

- 긴 본문은 여러 슬라이드로 나누되 정보량과 전개 순서를 유지합니다.
- 일본어 등 외국어 원문은 자연스러운 한국어 GM 문구로 옮기되, 임의 요약하지 않습니다.
- 분위기, 단서, 조건, 인물 관계가 담긴 문장은 삭제하지 않습니다.
- OCR 오류가 의심되는 문장은 추측으로 고치지 말고 review note를 남깁니다.
- 대사 문단은 가능하면 `story-dialogue` 스타일을 적용할 수 있게 별도 문단으로 분리합니다.
- 장면 전환이나 마지막 강조 문장은 `story-final-line` 적용 대상인지 검토합니다.

## 규칙 매핑

`전체 룰` 버튼은 게임 전체 규칙 모달입니다.

- `game.json > rules.tabs`에 전체 세션에서 참고할 규칙 탭을 구성합니다.
- `games/<id>/rules.json`로 외부화되어 있으면 그 구조를 따릅니다.
- 특정 슬라이드 전용 규칙만 전체 룰에 넣지 않습니다.

`현재 룰` 버튼은 현재 슬라이드의 단계별 숏컷입니다.

- 각 슬라이드에는 가능하면 `data-part-info-topic`을 지정합니다.
- topic은 현재 단계에서 바로 확인해야 하는 단일 규칙으로 좁힙니다.
- 좋은 예: `조사 페이즈`, `공유 페이즈`, `설정서와 비공개 정보`
- 나쁜 예: `기본 규칙`, `기타`, `참고`

## 전환 확인 규칙

다음 단계로 넘어가기 전에 확인이 필요한 경우, 게임별 JS 분기를 만들지 말고 슬라이드 데이터 속성을 사용합니다.

```html
<section
  class="slide"
  data-next-confirm-title="모든 플레이어가 설정서를 읽었습니까?"
  data-next-confirm-detail="다음 단계로 넘어가면 자기소개를 시작합니다."
  data-next-confirm-note="준비가 끝났을 때만 확인을 눌러 주세요."
>
```

사용 가능한 속성:

- `data-next-confirm-title`
- `data-next-confirm-detail`
- `data-next-confirm-note`

## 진행 순서 다이어그램 규칙

순서 다이어그램이나 흐름 표시에서 텍스트 화살표를 직접 쓰지 않습니다.

- 금지: `→`, `=>`, `->`
- 허용: CSS 또는 SVG 기반 벡터 화살표
- 기본 흐름 슬라이드는 위에서 아래로 흐르는 세로 구조를 우선합니다.
- 기존 `diagram`, `arrow`, `inline-flow-arrow` 스타일 패턴이 있으면 재사용합니다.

## 구현 제약

- 숫자, 이름, 조건, 시간, 페이지 누락을 추측하지 않습니다.
- 카탈로그 데이터는 검색용 경량 정보만 둡니다.
- 실행용 데이터는 게임 패키지에 둡니다.
- `app.js`에 게임별 하드코딩 분기를 늘리지 않습니다.
- `headerActions[]`, `rules.tabs`, `data-part-info-topic`, `data-next-confirm-*` 같은 선언형 데이터 구조를 우선합니다.
- 이미 지원 중인 게임의 동작을 의도 없이 바꾸지 않습니다.
- 게임별 테마가 꼭 필요하지 않으면 `styles/themes/default.css`를 사용합니다.

## 완료 보고

작업이 끝나면 다음을 구분해서 보고합니다.

- 확실하게 추출한 내용
- placeholder로 남긴 내용
- 원본 룰북과 사람이 대조해야 하는 내용
- 수정한 파일
- 실행한 검증 명령과 결과

# GM 화면 전면 개편 계획

## Summary
- 기존 상단 바 중심 GM 화면을 모바일 세로 모드 최적화 GM UX로 개편한다.
- GM 화면만 대상으로 하며 카탈로그/상세 화면은 이번 범위에서 제외한다.
- 모바일 세로 모드를 정식 지원하므로 기존 방향 전환 차단 가드는 비활성화한다.

## Key Changes
- GM 화면은 콘텐츠 상단 타이틀과 하단 floating bar 구조를 사용한다.
- 하단 floating bar는 모든 GM 화면 크기에 적용한다.
- 하단바 기본 순서는 홈, 더보기, 게임별 액션 영역, spacer, 현재 룰, 전체 룰, 이전, 다음으로 고정한다.
- 더보기는 BGM 전용이며 BGM이 활성화된 게임에서만 표시한다.
- 게임별 `headerActions[]`는 하단 floating bar의 액션 영역에 직접 표시한다.
- 기존 `rules.tabs`, `data-part-info-topic`, `data-next-confirm-*`, `headerActions[]` 데이터 계약은 유지한다.
- 모바일 세로 모드에서는 16:9 프레임 고정을 완화하고 슬라이드 본문 스크롤을 허용한다.

## Test Plan
- `node --check app.js`
- `npm test`
- `/titles`, `/titles/<routeName>`, `/titles/<routeName>/gm` 라우팅 확인
- 홈, 이전/다음, 현재 룰, 전체 룰, 게임별 액션, BGM 더보기 패널 확인
- 모바일 세로/가로, 태블릿, 데스크톱 주요 뷰포트에서 레이아웃 확인

## Assumptions
- `게임 개요` 직접 이동은 새 GM 하단바에서 제외한다.
- BGM 이름은 선택 라벨이 있으면 라벨을 쓰고, 없으면 트랙 파일명을 표시한다.
- 새 필수 JSON 스키마는 추가하지 않는다.

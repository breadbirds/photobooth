# AGENTS.md

## Think Before Coding

* 요구사항이 모호하면 추측하지 말고 질문한다.
* 여러 구현 방법이 있으면 가장 단순한 방법을 선택한다.
* 요청되지 않은 기능은 추가하지 않는다.
* 기존 패턴이 있으면 새로운 패턴을 만들지 않는다.

## Keep Changes Small

* 요청 범위의 코드만 수정한다.
* 관련 없는 리팩토링은 하지 않는다.
* 관련 없는 파일은 수정하지 않는다.
* 기존 코드 스타일을 따른다.
* 변경으로 인해 발생한 미사용 코드만 정리한다.

## Implementation Rules

* 새 코드는 TypeScript로 작성한다.
* `any` 타입을 사용하지 않는다.
* 프로덕션 코드에 `console.log`를 남기지 않는다.
* 새 의존성은 꼭 필요한 경우에만 추가한다.

## Next.js Rules

* 브라우저 API(`window`, `document`, `navigator`)는 Client Component에서만 사용한다.
* Client Component에는 `'use client';`를 명시한다.
* SSR 환경을 고려하여 구현한다.

## Verification

작업 완료 전 반드시 확인한다.

* 타입 에러가 없는가
* 빌드가 성공하는가
* 변경한 기능이 실제로 동작하는가

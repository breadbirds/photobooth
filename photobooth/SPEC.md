# SPEC.md

## 프로젝트 개요

SSAFY 수료식에서 사용할 웹 포토부스 앱.

사용자는 웹캠 앞에서 손 제스처를 취해 사진을 촬영할 수 있으며, 촬영된 사진은 QR코드를 통해 모바일에서 다운로드할 수 있다.

본 버전은 수료식 당일 안정적인 사용을 목표로 하는 MVP 버전이다.

---

# 기술 스택

* Next.js 14 (App Router)
* TypeScript
* Tailwind CSS
* MediaPipe Hands (CDN 동적 로드)
* qrcode
* Vercel
* Vercel Blob

---

# 패키지 설치

```bash
npm install qrcode @vercel/blob
npm install --save-dev @types/qrcode
```

MediaPipe는 npm 설치 없이 CDN으로 로드한다.

---

# 사용자 플로우

1. 사용자가 페이지에 접속한다.
2. 카메라 권한을 허용한다.
3. 실시간 카메라 화면이 표시된다.
4. 손 제스처가 감지된다.
5. V 사인을 0.8초 이상 유지한다.
6. 3초 카운트다운이 시작된다.
7. 카운트다운 중 주먹을 만들면 취소된다.
8. 카운트다운이 끝나면 자동 촬영된다.
9. 촬영 결과가 표시된다.
10. 사용자는 재촬영 또는 다운로드를 선택한다.
11. 다운로드 선택 시 사진이 Vercel Blob에 업로드된다.
12. Blob public URL로 QR 코드가 생성된다.
13. 모바일로 QR을 스캔하여 사진을 저장한다.

---

# 화면 상태

```txt
camera
  ↓
countdown
  ↓
preview
  ↓
qr

countdown
  ↓ 취소
camera

preview
  ↓ 재촬영
camera
```

규칙

* countdown 상태에서는 추가 V 사인 입력을 무시한다.
* preview 상태에서는 손 인식을 중단한다.
* qr 상태에서는 손 인식을 중단한다.
* 촬영 완료 후 추가 촬영이 중복 발생하면 안 된다.

---

# 화면 구성

## 메인 화면

구성 요소

* 카메라 미리보기
* 손 랜드마크 오버레이
* 촬영 상태 표시

상태 메시지

* 손을 인식 중입니다
* V 사인을 유지하세요
* 촬영 준비 중
* 촬영 완료

에러 메시지

* 카메라 접근 권한이 필요합니다. 브라우저 설정에서 허용해주세요.
* QR 생성에 실패했습니다. 다시 시도해주세요.

---

## 카운트다운 화면

카메라 화면 중앙에 크게 표시한다.

```txt
3
2
1
```

---

## 촬영 결과 화면

표시 항목

* 촬영된 사진
* 재촬영 버튼
* QR 다운로드 버튼

---

## QR 다운로드 모달

좌우 2단 구성

```txt
┌──────────────────────────────────────┐
│  [촬영된 사진]      [QR 코드]        │
│                                      │
│                     QR로 다운로드    │
│                     남은 시간: 30초  │
└──────────────────────────────────────┘
```

구성

* 왼쪽: 촬영된 사진 미리보기
* 오른쪽: QR 코드 160×160
* 안내 문구
* 남은 시간
* 30초 후 모달 자동 닫힘

주의

* QR 모달은 30초 후 닫히지만, Blob 파일 자체가 자동 삭제되는 것은 아니다.
* 행사 후 Blob에 저장된 사진은 수동 삭제하거나 별도 정리 스크립트로 삭제한다.

---

# 카메라 미러 정책

## 미리보기

`video` 태그에 미러 효과를 적용한다.

```css
transform: scaleX(-1);
```

셀카처럼 보이게 한다.

## 손 랜드마크 오버레이

`canvas` 태그에도 동일하게 미러 효과를 적용한다.

```css
transform: scaleX(-1);
```

미리보기와 랜드마크 위치가 일치해야 한다.

## 캡처

캡처 시에는 CSS transform 없이 원본 방향으로 저장한다.

```ts
ctx.drawImage(video, 0, 0);
```

저장되는 사진은 좌우 반전하지 않는다.

---

# 손 제스처

## V 사인

조건

* 검지 8번 끝이 6번 PIP 관절보다 위
* 중지 12번 끝이 10번 PIP 관절보다 위
* 약지 접힘
* 소지 접힘

0.8초 이상 유지 시 카운트다운을 시작한다.

---

## 주먹

조건

* 검지, 중지, 약지, 소지 끝이 모두 각 PIP 관절보다 아래

카운트다운 중 감지되면 촬영을 취소한다.

---

# 여러 명 촬영

MediaPipe Hands는 최대 2개의 손을 인식하도록 설정한다.

규칙

* 감지된 손 중 하나라도 V 사인을 0.8초 이상 유지하면 카운트다운을 시작한다.
* 감지된 손 중 하나라도 주먹이면 카운트다운을 취소한다.
* 카운트다운 시작 이후에는 추가 V 사인 입력을 무시한다.
* 단체 사진 촬영을 지원한다.

---

# MediaPipe 로드 방식

Next.js SSR 환경에서 `window` 접근 오류를 방지하기 위해 npm 설치 없이 CDN 동적 로드 방식을 사용한다.

`Camera.tsx` 내부 `useEffect` 안에서 실행한다.

```ts
const script1 = document.createElement('script');
script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';

const script2 = document.createElement('script');
script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
```

두 스크립트가 모두 로드된 후 Hands 인스턴스를 초기화한다.

---

# 클라이언트 컴포넌트

아래 컴포넌트는 파일 상단에 `'use client';` 선언이 필요하다.

* `components/Camera.tsx`
* `components/Countdown.tsx`
* `components/PhotoResult.tsx`
* `components/QRModal.tsx`

---

# 촬영

촬영 시점

* 카운트다운 종료 후

저장 형식

```ts
image/jpeg
```

품질

```ts
0.85
```

촬영 결과는 base64 data URL로 보관한다.

---

# 사진 합성 구조

향후 스티커 기능 확장을 고려하여 촬영 결과는 Canvas 레이어 합성 구조로 설계한다.

```txt
Photo
├─ Camera Layer
├─ Sticker Layer
└─ Overlay Layer
```

현재 MVP에서는 Camera Layer만 사용한다.

향후 스티커 기능 추가 시:

```ts
ctx.drawImage(video, 0, 0);

stickers.forEach((sticker) => {
  ctx.drawImage(sticker.image, sticker.x, sticker.y, sticker.width, sticker.height);
});
```

---

# QR 다운로드

흐름

1. 촬영 이미지 base64를 `POST /api/upload`로 전송한다.
2. 서버에서 base64를 Buffer로 변환한다.
3. 서버에서 Vercel Blob에 JPEG 파일을 업로드한다.
4. 서버는 Blob public URL을 반환한다.
5. 클라이언트는 Blob public URL로 QR 코드를 생성한다.
6. QR 모달에서 30초 타이머를 시작한다.
7. 30초 후 QR 모달을 닫는다.

---

# 저장소

실제 행사 배포에서는 Vercel Blob을 사용한다.

이유

* Vercel 서버 인스턴스가 달라도 동일한 파일 URL로 접근 가능
* QR 스캔 시 in-memory Map보다 404 가능성이 낮음
* S3보다 설정이 단순함
* 20대 내외 기기 동시 사용에 충분함

주의

* Blob public URL은 접근 가능한 공개 URL이다.
* URL을 아는 사람은 사진에 접근할 수 있다.
* 행사 후 Blob 파일을 수동 삭제하거나 정리 스크립트로 삭제한다.
* 자동 만료가 반드시 필요하면 추후 Vercel KV 또는 별도 정리 작업을 추가한다.

---

# API

## POST /api/upload

Request

```ts
{
  image: string; // data:image/jpeg;base64,... 형태
}
```

Response 성공

```ts
{
  url: string; // Vercel Blob public URL
}
```

Response 실패

```http
400 Bad Request
```

동작

* base64 이미지 수신
* `data:image/jpeg;base64,` 접두사 제거
* Buffer 변환
* `crypto.randomUUID()`로 파일명 생성
* Vercel Blob에 JPEG 업로드
* public URL 반환

---

# 사용하지 않는 API

## GET /api/photo/[id]

구현하지 않는다.

QR 코드는 별도 다운로드 API가 아니라 Vercel Blob public URL을 직접 가리킨다.

---

# next.config.ts

초기 MVP에서는 별도 CSP 설정을 추가하지 않는다.

MediaPipe CDN 로드가 차단되는 경우에만 CSP 설정을 검토한다.

---

# 디렉토리 구조

```txt
app/
├─ page.tsx
├─ layout.tsx
└─ api/
   └─ upload/
      └─ route.ts

components/
├─ Camera.tsx
├─ Countdown.tsx
├─ PhotoResult.tsx
└─ QRModal.tsx

public/

next.config.ts
```

---

# 구현 순서

1. 프로젝트 생성

```bash
npx create-next-app@latest photobooth --typescript --app --tailwind
```

2. 패키지 설치

```bash
npm install qrcode @vercel/blob
npm install --save-dev @types/qrcode
```

3. `app/api/upload/route.ts` 구현
4. `components/Camera.tsx` 구현
5. MediaPipe CDN 동적 로드 구현
6. 제스처 판정 구현
7. `components/Countdown.tsx` 구현
8. 촬영 기능 구현
9. `components/PhotoResult.tsx` 구현
10. `components/QRModal.tsx` 구현
11. `app/page.tsx` 조립
12. Vercel Blob 환경변수 설정
13. Vercel 배포

```bash
vercel --prod
```

---

# 비목표

이번 버전에서는 구현하지 않는다.

* 회원가입
* 로그인
* 관리자 페이지
* 사진 필터
* 사진 프레임
* 여러 장 촬영
* SNS 공유
* 갤러리
* 클라우드 영구 저장
* 손 제스처 기반 스티커 이동
* 스티커 UI

향후 버전에서 구현 가능

* 스티커 선택
* 스티커 위치 이동
* 스티커 크기 조절
* SSAFY 기수 프레임
* 수료식 장식 요소
* 손 제스처 기반 스티커 조작

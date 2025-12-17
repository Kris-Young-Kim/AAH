# ✅ TODO (Based on project docs)

- [ ] **초기 세팅**

  - [x] `boilerplate_modify.md` 지침 먼저 수행 후 Supabase/Clerk 설정 진행. _(지침 검토 완료)_
  - [x] `.env.local` 생성: Clerk 공개/비밀 키, Supabase URL/anon 키 반영(`env.example` 참고). _(파일 존재 확인)_
  - [x] 패키지 설치 완료(`pnpm install`). `pnpm config set allow-scripts "@clerk/shared sharp unrs-resolver"` 적용. `pnpm lint` 통과, `pnpm test` 스크립트 미정(없음).
  - [x] `spatiallink-ar/` 참고: App.tsx 구조 확인(Setup/Control 모드, 앵커/커서 상태, 모드 토글·스냅·피드백 UI) → 관리자 AR 뷰 설계 시 재사용 포인트 도출.
  - [x] `WebGazer-master/` 참고: README·`www/calibration.html`(9점 캘리브레이션, 정확도 측정, SweetAlert UI)·`js/calibration.js`(5회 클릭→노란색·정확도 계산 로직) 검토 및 반영. `src/hooks/useWebGazerCalibration.ts`로 9점 UI/5회 클릭/정확도(평균 분산) 처리, 탭 비활성 시 `webgazer.pause()`/resume 추가(`useWebGazer`).

- [ ] **UI/글꼴/테마**

  - [x] `globals.css`에서 Pretendard CDN 로드 및 `body` 기본 폰트 적용(메모리 요구사항 충족).
  - [x] Tailwind 기본 색 대비 WCAG 2.1 AA 확인(배경/전경 대비 확보, 버튼 기본 색상 `bg-gray-900 text-white` 적용), 버튼 최소 96x96px 유지(`globals.css` base 스타일 적용).
  - [x] `DEVELOPMENT_GUIDELINES.md` Spacing-First·명명 규칙 준수 여부 점검(기본 스타일 적용 시 margin 대신 gap/padding 유지, 네이밍 규칙 확인).

- [ ] **레이아웃 & 공통 프로바이더**

  - [x] `app/layout.tsx`에 ClerkProvider, Query/Theme Provider 정상 배치 확인.
  - [x] `middleware.ts`에서 보호 경로(`/admin`, `/access`)만 인증 보호(`createRouteMatcher`) 적용, API 포함 matcher 유지.

- [ ] **데이터베이스(Supabase, RLS 비활성 전제)**

  - [x] `users` 테이블: `clerk_user_id` upsert 로직 서버 액션(`syncUser`) 구현, RLS 비활성 전제 확인.
  - [x] `devices` 테이블: 좌표(x,y,z)·상태 필드 구조/인덱스(`idx_devices_user_id`) 확인 완료.
  - [x] SQL 스키마 `docs/AAH.sql` 정리(RLS 비활성 포함). Supabase에 적용 필요 시 해당 스키마 실행.
  - [x] **루틴 테이블 스키마**: `routines` 테이블(루틴 정보), `routine_devices` 테이블(루틴별 기기 및 실행 순서) 추가. 아침/저녁 루틴 타입 지원. _(마이그레이션 파일 생성 완료: `docs/migrations/create_routines_tables.sql`, Supabase SQL Editor에서 실행 필요)_

- [ ] **서버 액션**

  - [x] `syncUser(clerkId, email?)`: 로그인 직후 호출, 없으면 INSERT, 있으면 UPDATE.
  - [x] `saveDevice(deviceData)`: 보호자 모드 저장 후 `revalidatePath('/admin')`.
  - [x] `toggleDeviceStatus(deviceId, status)`: 상태 토글 후 재검증 및 성공/실패 로깅 추가.
  - [x] 핵심 액션 실행 시 로깅 남기기(요구사항). (`syncUser`, `saveDevice`, `toggleDeviceStatus` 콘솔 로깅 포함)
  - [x] **루틴 관련 서버 액션**: `listRoutines`, `createRoutine`, `updateRoutine`, `deleteRoutine`, `executeRoutine` (루틴에 포함된 모든 기기를 순차적으로 상태 변경). _(`src/app/actions.ts`에 구현 완료)_

- [ ] **클라이언트 상태 관리**

  - [x] Zustand 스토어 설계: 시선 좌표, 장치 목록, 입력 모드, 센서 권한 상태(`useStore`).
  - [x] 고빈도 값(시선 좌표)은 `setGazeFast`로 빠른 업데이트(React 재렌더 최소화).

- [ ] **Auth 플로우**

  - [x] `/` 로그인 후 모드 선택 UI 구현(보호자 vs 사용자) — 홈 카드로 접근 경로 제공.
  - [x] `ClerkLoaded` 시 `syncUser` 호출하여 Supabase와 동기화(`SyncUser` 컴포넌트, 전역 배치).

- [ ] **보호자 모드(`/admin`)**

  - [x] Three.js/R3F 캔버스 + DeviceOrientationControls 적용해 카메라 회전 동기화(`admin` 캔버스).
  - [x] 중앙 조준점 + "추가" 버튼으로 `camera.getWorldDirection().multiplyScalar(2)` 위치 저장.
  - [x] 마커 CRUD(추가/삭제/토글) UI 및 서버 액션 연동(이름·아이콘 표시, 삭제 버튼).
  - [x] 웹캠 배경 오버레이 및 센서/카메라 권한 요청 안내 버튼 배치. **안드로이드 스마트폰 중심으로 최적화, iOS는 추후 개발을 위해 기본 구조만 유지.**
  - [x] **용어 개선**: "입력 방식 설정" → "사용자가 어떻게 조작할까요?" 등 쉬운 용어로 변경, 각 입력 방식에 대한 설명 추가(직접 선택, 스캐닝 모드, 시선 추적, 음성 인식). **입력 방식 4가지로 명확히 정의: 직접 선택, 스캐닝 모드, 시선 추적, 음성 인식.**
  - [x] **음성 인식 입력 방식 추가**: 관리자 모드에서 음성 인식 옵션 추가, 사용자 모드에서 Web Speech API를 사용한 음성 명령 처리 구현.

- [ ] **사용자 모드(`/access`)**

  - [x] iOS 대응: "시작하기" 버튼에서 `DeviceOrientationEvent.requestPermission` 요청.
  - [x] 9점 캘리브레이션 오버레이 + 정확도 피드백(`useWebGazerCalibration` 연동).
  - [x] 가상 커서 렌더링 및 스무딩(이동 평균 등) 적용.
  - [x] 마그네틱 스냅: 버튼 히트박스 1.5배, 진입 시 커서 중심 보정.
  - [x] 드웰 클릭: 0~2000ms 진행도 표시 후 토글 실행.
  - [x] 뷰 리셋 버튼으로 카메라 기준 재정렬.
  - [x] **스캔 모드 UI 개선**: 현재 선택된 기기 강조 표시(하단 고정 UI, 기기 이름/순서 표시), 스캔 속도 조절 기능 추가(1초/2초/3초 선택 가능).
  - [x] **일상 루틴 기능**: 아침 루틴(불 켜기, 커튼 열기, TV 켜기), 저녁 루틴(불 끄기, 커튼 닫기, TV 끄기) UI 및 실행 기능. 루틴별 기기 그룹화 및 한 번에 실행 기능.
  - [x] **음성 인식 기능**: Web Speech API를 사용한 음성 명령 처리 (예: "거실 전등 켜", "TV 끄기" 등). 기기 이름 매칭 및 자동 재시작 기능 포함.

- [x] **실시간 동기화**

  - [x] `hooks/useDeviceSync`: Supabase Realtime 구독(UPDATE on `devices`)으로 상태 반영.
  - [x] 로컬 상태와 서버 상태 불일치 시 재조회/재구독 처리(30초 주기 검사, 구독 오류 시 자동 재구독).

- [x] **성능/보안**

  - [x] WebGazer lazy load 및 탭 비활성 시 `pause()` 처리(로컬 `docs/webgaze.js` 또는 CDN 선택 가능, visibilitychange 이벤트로 자동 pause/resume).
  - [x] R3F에서는 가벼운 스프라이트(빌보드) 사용, FPS 30+ 유지 확인(Billboard 컴포넌트, circleGeometry, performance 설정).
  - [x] 카메라 스트림/시선 데이터는 클라이언트 메모리 내 처리, 서버 미전송 명시(주석 및 로깅으로 명시).

- [x] **로그/분석**

  - [x] 주요 액션(로그인 후 sync, 기기 저장/토글, 캘리브레이션 완료) 콘솔/분석 이벤트 기록(`src/lib/analytics.ts` 유틸리티 생성, trackEvent 함수로 통합).
  - [x] 이벤트 스키마 정의: `user_synced`, `device_saved`, `device_toggled`, `device_deleted`, `calibration_started`, `calibration_completed`, `device_clicked` (향후 Google Analytics, PostHog, Vercel Analytics 등으로 확장 가능한 구조).

- [x] **테스트 계획**

  - [x] 테스트 계획 문서 작성 (`docs/TEST_PLAN.md`): 권한 플로우, 캘리브레이션, 스냅, 드웰, 멀티모달 입력, 환경별 QA, 성능 테스트, 접근성 테스트 시나리오 포함.
  - [x] 권한 플로우(Desktop Chrome) 자동 테스트 실행 (Chrome DevTools MCP 사용, `docs/TEST_RESULTS.md` 참고).
  - [ ] 권한 플로우(iOS/Android) 수동 테스트 실행 (브라우저 네이티브 다이얼로그로 인해 수동 필요).
  - [ ] 캘리브레이션 정확도·스냅·드웰 성공률 시나리오 테스트 실행(문서 TRD/PRD 기준, 웹캠 권한 필요로 수동 테스트).
  - [ ] 저조도/밝은 환경, 정면/누운 자세 등 QA 시나리오 실행.

- [ ] **문서화**
  - [ ] README/SETUP 업데이트: Pretendard, 권한 플로우, 핵심 명령어.
  - [ ] TRD/PRD/MVP 변경 사항 발생 시 반영, TODO 소거 이력 관리.

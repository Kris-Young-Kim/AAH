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

- [ ] **서버 액션**

  - [ ] `syncUser(clerkId, email?)`: 로그인 직후 호출, 없으면 INSERT, 있으면 UPDATE.
  - [ ] `saveDevice(deviceData)`: 보호자 모드 저장 후 `revalidatePath('/admin')`.
  - [ ] `toggleDeviceStatus(deviceId, status)`: 상태 토글 후 재검증 및 로깅 추가.
  - [ ] 핵심 액션 실행 시 로깅 남기기(요구사항).

- [ ] **클라이언트 상태 관리**

  - [ ] Zustand 스토어 설계: 시선 좌표, 장치 목록, 입력 모드, 센서 권한 상태.
  - [ ] 고빈도 값(시선 좌표)은 ref/setState 대신 빠른 업데이트 경로로 관리.

- [ ] **Auth 플로우**

  - [ ] `/` 로그인 후 모드 선택 UI 구현(보호자 vs 사용자).
  - [ ] `ClerkLoaded` 시 `syncUser` 호출하여 Supabase와 동기화.

- [ ] **보호자 모드(`/admin`)**

  - [ ] Three.js/R3F 캔버스 + DeviceOrientationControls 적용해 카메라 회전 동기화(`docs/slam.md` 참조).
  - [ ] 중앙 조준점 + “추가” 버튼으로 `camera.getWorldDirection().multiplyScalar(2)` 위치 저장.
  - [ ] 마커 CRUD(이름/아이콘/삭제) UI 및 서버 액션 연동.
  - [ ] 웹캠 배경 오버레이 및 권한 요청 안내 배치.

- [ ] **사용자 모드(`/access`)**

  - [ ] iOS 대응: “시작하기” 버튼 클릭 안에서 `DeviceOrientationEvent.requestPermission`.
  - [ ] 9점 캘리브레이션 UI(WebGazer 모델 학습) 및 정확도 피드백 표시(`docs/webgaze.js`, WebGazer-master 설정 참고).
  - [ ] 가상 커서 렌더링 및 스무딩(이동 평균 등) 적용.
  - [ ] 마그네틱 스냅: 버튼 히트박스 1.5배, 진입 시 커서 중심 보정.
  - [ ] 드웰 클릭: 0~2000ms 원형 진행바, 2000ms 도달 시 클릭 + 사운드 피드백.
  - [ ] 뷰 리셋 버튼으로 카메라 기준 재정렬.

- [ ] **실시간 동기화**

  - [ ] `hooks/useDeviceSync`: Supabase Realtime 구독(UPDATE on `devices`)으로 상태 반영.
  - [ ] 로컬 상태와 서버 상태 불일치 시 재조회/재구독 처리.

- [ ] **성능/보안**

  - [ ] WebGazer lazy load 및 탭 비활성 시 `pause()` 처리(로컬 `docs/webgaze.js` 또는 CDN 선택).
  - [ ] R3F에서는 가벼운 스프라이트(빌보드) 사용, FPS 30+ 유지 확인.
  - [ ] 카메라 스트림/시선 데이터는 클라이언트 메모리 내 처리, 서버 미전송 명시.

- [ ] **로그/분석**

  - [ ] 주요 액션(로그인 후 sync, 기기 저장/토글, 캘리브레이션 완료) 콘솔/분석 이벤트 기록.
  - [ ] Vercel Analytics 또는 PostHog 선택 후 최소 이벤트 스키마 정의.

- [ ] **테스트 계획**

  - [ ] 권한 플로우(iOS/Android/desktop) 수동 테스트.
  - [ ] 캘리브레이션 정확도·스냅·드웰 성공률 시나리오 테스트(문서 TRD/PRD 기준).
  - [ ] 저조도/밝은 환경, 정면/누운 자세 등 QA 시나리오 실행.

- [ ] **문서화**
  - [ ] README/SETUP 업데이트: Pretendard, 권한 플로우, 핵심 명령어.
  - [ ] TRD/PRD/MVP 변경 사항 발생 시 반영, TODO 소거 이력 관리.

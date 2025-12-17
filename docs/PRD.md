📝 PRD: All-Access Home (Product Requirements Document)
Project Code: AAH-2025-MVP
Date: 2025. 12. 15
Version: 1.0
Status: [승인 대기]
Author: Product Owner (PO) Team
1. 개요 (Introduction)
1.1. 제품 정의
All-Access Home은 신체적 제약이 있는 사용자가 별도의 고가 장비 없이, 웹 브라우저를 통해 자신의 생활 공간을 디지털 트윈(Digital Twin)화하고, 시선(Gaze) 및 다양한 입력 도구로 가전제품을 제어하는 SaaS형 보조공학 플랫폼이다.
1.2. 개발 목표 (MVP Goals)
Web Lite-SLAM 구현: 자이로스코프와 웹캠을 연동하여, 디바이스 회전에 따라 AR 마커가 공간에 고정되는 3DoF(Degrees of Freedom) 뷰어 개발.
멀티모달 입력 파이프라인 구축: WebGazer.js(시선)와 Pointer Event(마우스/터치)를 통합 처리하는 인터랙션 엔진 구현.
검증: 실제 장애인 사용자(또는 시뮬레이션 환경)가 90% 이상의 성공률로 전등 스위치를 켤 수 있는지 확인.
1.3. 스코프 (Scope)
In-Scope: 웹 기반 AR 뷰어, 기기 배치(Admin), 시선/마우스 제어(User), 가상 스위치 작동(Simulated IoT).
Out-of-Scope: 실제 물리적 IoT 허브 연동(MVP 이후), 복잡한 6DoF(이동) SLAM, 다국어 지원.
2. 사용자 스토리 (User Stories)
ID	Actor	User Story	Acceptance Criteria (수용 기준)
US-01	보호자	나는 앱에서 방을 비추며 전등 위치에 버튼을 생성하고 싶다.	카메라 화면 중앙에 버튼을 놓고 '저장'하면, 태블릿을 돌렸다가 다시 와도 그 자리에 버튼이 있어야 함.
US-02	사용자	나는 내 눈의 움직임만으로 정확하게 버튼을 누르고 싶다.	버튼 위에 시선이 2초 머무르면 클릭 이벤트가 발생하고 시각적 피드백이 제공되어야 함.
US-03	사용자	나는 시선이 흔들려도 버튼을 쉽게 선택하고 싶다.	커서가 버튼 반경 50px 내에 진입하면 버튼 중앙으로 자석처럼 붙어야 함(Snapping).
US-04	사용자	나는 조작이 서툴러도 '리셋'을 통해 다시 정면을 보고 싶다.	화면 구석 '중앙 정렬' 버튼을 응시하면 화면 뷰포트가 즉시 초기화되어야 함.
US-05	보호자	나는 IT 용어 없이 쉽게 사용자의 조작 방식을 설정하고 싶다.	"입력 방식 설정" 대신 "사용자가 어떻게 조작할까요?" 같은 쉬운 문구로 표시되고, 각 방식(직접 선택, 스캐닝 모드, 시선 추적, 음성 인식)에 대한 설명이 제공되어야 함.
US-06	사용자	나는 스캐닝 모드로 기기를 선택할 때 속도를 조절하고 싶다.	스캔 속도를 1~10초 중에서 선택할 수 있어야 하며, 현재 선택된 기기가 명확하게 표시되어야 함.
US-07	사용자	나는 아침에 일어나서 불을 켜고, 커튼을 열고, TV를 켤 수 있어야 한다.	아침 루틴 버튼을 한 번 누르면 관련된 모든 기기가 순차적으로 켜져야 함.
US-08	사용자	나는 밤에 잠들기 전에 불을 끄고, 커튼을 닫고, TV를 끌 수 있어야 한다.	저녁 루틴 버튼을 한 번 누르면 관련된 모든 기기가 순차적으로 꺼져야 함.
US-09	사용자	나는 음성으로 기기를 제어하고 싶다.	"거실 전등 켜", "TV 끄기" 같은 음성 명령으로 기기를 제어할 수 있어야 함.
3. 상세 기능 요구사항 (Functional Requirements)
3.1. 인증 및 온보딩 (Auth & Onboarding)
F-01. 소셜 로그인: Clerk 기반 Google/Kakao 로그인 지원.
F-02. 프로필 분기: 로그인 직후 Admin(보호자) vs User(사용자) 모드 선택.
F-03. 권한 요청: 최초 진입 시 카메라 및 동작/방향(DeviceMotion) 권한 허용 팝업 노출.
3.2. 보호자 모드: 공간 맵핑 (Admin: Space Setup)
F-04. Lite-SLAM 엔진:
DeviceOrientation API를 사용하여 디바이스의 Alpha(Z축), Beta(X축), Gamma(Y축) 회전값을 실시간 추적.
Three.js 카메라의 Rotation 값과 디바이스 회전값을 동기화.
F-05. AR 마커 배치 (Raycasting):
화면 중앙에 고정된 조준점(Reticle) 표시.
'추가(+)' 버튼 클릭 시, 현재 바라보는 방향의 구면 좌표계(Spherical Coordinates) 상에 가상 오브젝트 배치.
데이터 구조: { id, label, icon, yaw, pitch, scale } 저장.
F-06. 기기 관리 (CRUD): 배치된 마커의 이름 수정, 아이콘 변경, 삭제 기능.
F-06-1. 입력 방식 설정 UI 개선: "입력 방식 설정" → "사용자가 어떻게 조작할까요?" 등 쉬운 용어 사용, 각 입력 방식(직접 선택, 스캐닝 모드, 시선 추적, 음성 인식)에 대한 설명 제공.
F-13. 음성 인식 기능: Web Speech API를 사용하여 음성 명령을 인식하고 기기를 제어. 기기 이름과 명령어(켜기/끄기)를 매칭하여 처리.
3.3. 사용자 모드: 인터랙션 (User: Interaction)
F-07. 캘리브레이션 (9-Point Calibration):
화면 9개 지점(3x3 그리드)에 순차적으로 점 표시.
사용자가 클릭(또는 응시)할 때마다 WebGazer 모델 학습 데이터 업데이트.
정확도(Accuracy) 점수 표시 (예: "양호", "재시도 필요").
F-08. 멀티모달 입력 어댑터 (Input Adapter):
입력 소스를 추상화하여 단일 커서(Virtual Cursor)로 매핑. 지원 입력 방식: 직접 선택(마우스/터치), 스캐닝 모드(스위치/키보드), 시선 추적(WebGazer), 음성 인식(Web Speech API).
Source A (Eye): WebGazer X, Y 좌표 (Low Pass Filter 적용 필수).
Source B (Mouse/Switch): 표준 Pointer Event.
F-09. 스마트 타겟팅 (Magnetic Snap):
가상 커서가 AR 마커의 Hit-Box(실제 크기의 1.5배) 내에 진입하면, 커서 좌표를 마커 중심점으로 강제 보정.
스냅 상태에서는 미세한 눈 떨림 무시.
F-10. 드웰 클릭 (Dwell Click):
스냅 상태가 유지되는 시간 측정.
0ms ~ 2000ms: 마커 테두리에 원형 프로그레스 바(Ring UI) 애니메이션.
2000ms 도달: OnClick 이벤트 트리거 및 성공 사운드 재생.
F-10-1. 스캔 모드 UI 개선: 현재 선택된 기기를 하단 고정 UI로 강조 표시(기기 이름, 순서 번호), 스캔 속도 조절 기능(1초/2초/3초 선택 가능).
F-11. 일상 루틴 기능:
아침 루틴: 불 켜기, 커튼 열기, TV 켜기 등 기기 그룹을 한 번에 실행.
저녁 루틴: 불 끄기, 커튼 닫기, TV 끄기 등 기기 그룹을 한 번에 실행.
루틴별 기기 그룹화 및 순차 실행 기능.
3.4. 시스템 기능 (System)
F-12. 상태 동기화 (Realtime): Supabase Realtime을 통해 기기 상태(is_active) 변경 시 관리자 화면 및 사용자 화면에 즉시 반영 (색상 변경: Gray -> Yellow).
4. 데이터 요구사항 (Data Requirements)
4.1. Schema Design (Supabase)
Table: devices
| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| id | uuid | PK | 기기 고유 ID |
| owner_id | text | Index | Clerk User ID |
| name | text | Not Null | 기기 이름 (예: 거실 TV) |
| type | varchar | - | icon type ('light', 'fan', 'tv') |
| yaw | float | - | 가로 회전각 (0 ~ 360) |
| pitch | float | - | 세로 회전각 (-90 ~ 90) |
| status | boolean | Default false | On/Off 상태 |
Table: routines
| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| id | uuid | PK | 루틴 고유 ID |
| user_id | uuid | FK | 사용자 ID (users 테이블 참조) |
| name | text | Not Null | 루틴 이름 (예: 아침 루틴) |
| time_type | varchar | Check | 루틴 타입 ('morning', 'evening', 'custom') |
| created_at | timestamptz | - | 생성 시간 |
| updated_at | timestamptz | - | 수정 시간 |
Table: routine_devices
| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| id | uuid | PK | 루틴-기기 관계 ID |
| routine_id | uuid | FK | 루틴 ID (routines 테이블 참조) |
| device_id | uuid | FK | 기기 ID (devices 테이블 참조) |
| target_state | boolean | Not Null | 목표 상태 (true: 켜기, false: 끄기) |
| order_index | integer | Not Null | 실행 순서 |
4.2. Local Storage
calibration_data: WebGazer 학습 모델 데이터 (재방문 시 캘리브레이션 단축용).
5. 비기능 요구사항 (Non-Functional Requirements)
5.1. 성능 (Performance)
Frame Rate: 3D 렌더링 및 시선 추적 루프는 최소 30 FPS 유지.
Latency: 시선 이동 후 커서 반응 지연 100ms 미만.
Initial Load: PWA 캐싱 적용, Lighthouse 성능 점수 90점 이상.
5.2. 호환성 (Compatibility)
Browser: Chrome (Android/Desktop), Safari (iOS 17+ / iPadOS).
Device: 2022년 이후 출시된 보급형 태블릿 이상 (자이로 센서 필수).
5.3. 접근성 (Accessibility)
Contrast: 모든 UI 요소는 WCAG 2.1 AA 등급(4.5:1) 이상의 명도비 준수.
Size: 터치/응시 타겟의 최소 크기는 96x96 px 이상.
5.4. 보안 (Security)
Camera Data: 웹캠 스트림은 브라우저 메모리 내에서만 처리되며, 절대 외부 서버로 전송/저장되지 않음.
6. UI/UX 가이드라인 (Design Specs)
6.1. 레이아웃 (Layout)
Immersive View: 상단 주소창, 하단 네비게이션 바를 숨기는 전체 화면(Full-screen) 모드 권장.
HUD (Head-Up Display):
중앙: AR 뷰포트.
우측 상단: 설정(톱니바퀴) 아이콘.
좌측 하단: '뷰 리셋(Recenter)' 버튼 (항상 노출).
6.2. 피드백 (Feedback)
State: Normal (투명도 50%) -> Hover (투명도 100% + 크기 110% 확대) -> Active (색상 변경 + Glow 효과).
Sound: 청각적 피드백 제공 (Hover 진입 시 "틱", 클릭 성공 시 "딩동").
7. 기술 아키텍처 및 제약사항
7.1. 핵심 라이브러리 선정
Framework: Next.js 15 (App Router).
3D/AR: React Three Fiber (R3F) + Drei (HTML Overlay 활용).
Eye Tracking: WebGazer.js (Script Lazy Load).
State: Zustand (Transient update로 잦은 리렌더링 방지).
7.2. 기술적 제약 및 해결책 (Constraints)
Drift 현상 (위치 틀어짐): 저가형 자이로 센서는 시간이 지나면 좌표가 틀어짐.
Solution: UI에 항상 '화면 중앙 정렬(Reset View)' 버튼을 배치하여 사용자가 수동으로 영점을 잡을 수 있게 함.
iOS 권한 문제: iOS 13+에서는 동작 센서 접근 시 사용자 인터랙션(버튼 클릭) 후 권한 요청이 필수임.
Solution: '시작하기' 버튼을 눌러야만 센서 초기화가 되도록 플로우 설계.
8. 성공 지표 및 분석 (Analytics)
MVP 단계에서는 개인 식별 정보 없이 '사용성 데이터'만 수집한다 (PostHog 또는 Vercel Analytics 활용).
Retention: 캘리브레이션 완료 후 제어 화면 이탈률 (목표: < 20%).
Task Success: 버튼 클릭 성공 횟수 / 시도 횟수 (목표: > 80%).
Setup Time: 보호자 모드 진입 후 첫 기기 저장까지 걸린 시간 (목표: < 3분).
9. QA 테스트 시나리오 (예시)
조명 테스트: 어두운 방 vs 밝은 방에서 시선 추적 정확도 비교.
자세 테스트: 누워있는 상태(앙와위)에서 태블릿을 거치대에 두고 조작 시 AR 마커가 올바르게 보이는가?
입력 전환 테스트: 시선 제어 중 마우스를 연결했을 때 즉시 마우스 커서로 전환되는가?

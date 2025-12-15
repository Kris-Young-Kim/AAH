🛠️ TRD: All-Access Home (Technical Requirements Document)
항목	내용
Project Name	All-Access Home (MVP)
Version	1.0.0
Date	2025-12-15
Tech Stack	Next.js 15, Supabase, Clerk, Three.js (R3F), WebGazer.js
1. 시스템 아키텍처 (System Architecture)
1.1. 하이레벨 아키텍처 (High-Level Design)
이 시스템은 Client-Side Heavy 구조를 가집니다. 시선 추적과 AR 렌더링의 레이턴시(지연)를 최소화하기 위해 핵심 연산은 브라우저에서 처리하고, 서버는 데이터 영속성(저장)과 상태 동기화만 담당합니다.
code
Mermaid
graph TD
    subgraph Client [User Browser]
        A[Webcam Stream] --> B[WebGazer.js (Eye Tracking)]
        C[Device Sensors] --> D[Three.js / R3F (Lite-SLAM)]
        B --> E[Input Adapter (Smoothing Filter)]
        E --> F[Interaction Engine (Raycaster)]
        D --> F
        F --> G[UI / 3D Canvas]
    end

    subgraph Server [Next.js / Vercel]
        H[Server Actions (Next.js 15)]
        I[Clerk Middleware (Auth)]
    end

    subgraph Database [Supabase]
        J[(PostgreSQL Users/Devices)]
        K[Realtime Channel]
    end

    F -- "Action (Click)" --> H
    H --> J
    J -- "State Change Event" --> K
    K -- "Sync UI" --> G
1.2. 기술 스택 상세 (Tech Stack Details)
Frontend: Next.js 15.5.9 (App Router), React 19 (RC), Tailwind CSS 4.
Auth: Clerk (Next.js SDK).
Database: Supabase (PostgreSQL + Realtime).
3D/AR: @react-three/fiber (R3F), @react-three/drei (DeviceOrientationControls).
Computer Vision: webgazer.js (Script Load Strategy: lazyOnload).
State Management: Zustand (고빈도 상태 관리 - 시선 좌표 등).
2. 프론트엔드 구현 상세 (Frontend Specification)
2.1. 폴더 구조 (Directory Structure)
Next.js 15 App Router 표준을 따릅니다.
code
Text
/src
  ├── app/
  │   ├── layout.tsx         # ClerkProvider, RootLayout
  │   ├── page.tsx           # Landing Page
  │   ├── (auth)/            # sign-in, sign-up (Clerk)
  │   ├── admin/             # 보호자용 설정 페이지
  │   └── access/            # 장애인용 제어 페이지
  ├── components/
  │   ├── ar/                # 3D 관련 컴포넌트 (R3F)
  │   │   ├── ARCanvas.tsx
  │   │   ├── DeviceMarker.tsx
  │   │   └── CameraController.tsx
  │   ├── eye/               # 시선 추적 관련
  │   │   ├── EyeTracker.tsx
  │   │   └── CalibrationGrid.tsx
  │   └── ui/                # 공통 UI (Tailwind)
  ├── lib/
  │   ├── supabase.ts        # Supabase Client
  │   └── utils.ts
  ├── hooks/
  │   ├── useWebGazer.ts     # 시선 추적 로직 훅
  │   └── useDeviceSync.ts   # Supabase Realtime 훅
  ├── actions/
  │   └── device-actions.ts  # Server Actions (DB CRUD)
  └── types/
      └── index.ts           # TS Interfaces
2.2. 핵심 로직 1: Lite-SLAM (3D 좌표 매핑)
웹 브라우저에서는 깊이(Depth) 센서를 직접 쓸 수 없으므로 **"사용자를 중심으로 한 구(Sphere)면 좌표계"**를 사용합니다.
구현 방법:
@react-three/drei의 DeviceOrientationControls를 사용하여 카메라 회전 제어.
보호자가 기기 추가 버튼을 누르면:
현재 카메라가 바라보는 방향 벡터(Vector3)를 추출.
사용자 거리를 고정값(예: 2m)으로 곱하여 
(
x
,
y
,
z
)
(x,y,z)
 좌표 계산.
const position = camera.getWorldDirection().multiplyScalar(2);
DB에는 계산된 
x
,
y
,
z
x,y,z
 좌표를 저장.
2.3. 핵심 로직 2: 시선 추적 및 최적화
WebGazer는 CPU 부하가 크므로 최적화가 필수입니다.
초기화: next/script를 사용하여 메인 스레드 차단을 방지.
좌표 보정 (Smoothing):
Raw Data는 떨림(Jitter)이 심함.
이동 평균 필터(Moving Average) 또는 칼만 필터 적용.
SmoothX = (PrevX * 0.8) + (CurrentX * 0.2) (가중치 적용).
상태 관리: React useState를 쓰면 시선이 움직일 때마다 리렌더링되어 앱이 멈춥니다. Zustand의 useStore.setState 또는 Ref를 사용하여 DOM을 직접 조작(transform: translate(...))합니다.
2.4. 핵심 로직 3: 드웰 클릭 (Dwell Click)
알고리즘:
useFrame 루프(매 프레임)에서 시선 좌표(Raycaster)와 버튼(Mesh)의 충돌 감지.
충돌 시: timer 변수 증가.
비충돌 시: timer 0으로 리셋.
timer > 2.0s 도달 시: triggerClick() 함수 실행 및 상태 리셋.
3. 백엔드 및 데이터베이스 구현 (Backend Specification)
3.1. Server Actions (Next.js 15)
API Route(pages/api)를 만들지 않고 app/actions 폴더 내의 Server Action 함수를 통해 DB와 통신합니다.
syncUser(clerkId, email):
로그인 직후 호출.
users 테이블에 clerk_user_id가 없으면 INSERT, 있으면 UPDATE (Upsert).
saveDevice(deviceData):
보호자 모드에서 기기 위치 저장.
revalidatePath('/admin') 호출로 UI 갱신.
toggleDeviceStatus(deviceId, currentStatus):
사용자가 눈으로 클릭했을 때 호출.
Supabase의 devices 테이블 업데이트.
3.2. Supabase Realtime 설정
상태 동기화를 위해 클라이언트 컴포넌트에서 구독(Subscribe)을 설정합니다.
code
TypeScript
// hooks/useDeviceSync.ts 예시
const channel = supabase
  .channel('device-changes')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'devices' },
    (payload) => {
      // 변경된 기기 ID와 상태를 찾아 로컬 상태 업데이트
      updateLocalDeviceState(payload.new.id, payload.new.is_active);
    }
  )
  .subscribe();
4. 보안 및 권한 처리 (Security)
4.1. 사용자 인증 흐름
Clerk: 로그인 처리 및 JWT 발급.
Middleware: middleware.ts에서 /admin, /access 경로 접근 시 Clerk 세션 확인.
Supabase: DB 접근 시 users 테이블의 clerk_user_id를 외래키로 사용하여 데이터 격리.
4.2. 하드웨어 접근 권한
iOS 이슈: iOS 13+에서는 자이로 센서 접근 시 **"사용자의 명시적 클릭"**이 필요합니다.
해결책: /access 페이지 진입 시 바로 카메라를 켜지 않고, **[제어 시작하기]**라는 큰 버튼을 두어 클릭 이벤트 핸들러 안에서 DeviceOrientationEvent.requestPermission()을 호출합니다.
5. 성능 최적화 (Performance Optimization)
3D 렌더링: 복잡한 3D 모델(.glb) 대신 가벼운 **Billboard Sprite (이미지)**를 사용하여 마커를 표시합니다. (항상 카메라를 정면으로 바라보는 2D 이미지).
WebGazer 정지: /admin 페이지(보호자용)나 탭이 비활성화되었을 때는 WebGazer 프로세스를 pause() 하여 배터리를 절약합니다.
Supabase Quota 관리: 시선 좌표(x,y)는 절대 DB에 저장하지 않습니다. 오직 **클릭 이벤트(On/Off)**만 DB에 저장합니다.
6. 개발 로드맵 (Implementation Steps)
Step 1 (환경 설정): Next.js 프로젝트 생성, Clerk + Supabase 연동, DB 테이블 생성 (제공된 SQL 실행).
Step 2 (보호자 모드): R3F 설치, 웹캠 배경 깔기, DeviceOrientationControls 적용, 가상 마커 배치 및 DB 저장 구현.
Step 3 (사용자 모드 - 기초): 저장된 마커 불러와서 화면에 띄우기 (Realtime 연동).
Step 4 (시선 추적): WebGazer 연동, 캘리브레이션 UI, 시선 커서 시각화.
Step 5 (인터랙션): Raycaster 충돌 감지 및 드웰 클릭 로직 구현, 사운드 피드백 추가.
Step 6 (배포 및 테스트): Vercel 배포, 모바일 기기(아이패드/갤럭시탭) 실테스트.
이 문서를 기준으로 개발을 진행하시면, 기술적 불확실성을 최소화하고 안정적인 MVP를 구축하실 수 있습니다.
📂 폴더 구조 (Project Structure)
상세 구조는 DIR.md 파일을 참고하세요.
⚠️ 주의사항 (Known Issues)
iOS 권한: 아이폰/아이패드에서는 동작 및 방향 센서 접근 권한을 위해 '시작하기' 버튼 클릭이 필수입니다.
조명: 시선 추적은 조명 환경에 민감합니다. 얼굴이 잘 보이는 밝은 곳에서 사용하세요.
📄 License
This project is licensed under the MIT License.
code
Code

---

# 3. DIR.md

> 개발자가 프로젝트 구조를 한눈에 파악할 수 있도록 돕는 디렉토리 설명서입니다. Next.js 15의 App Router 구조를 반영했습니다.

```markdown
# 📂 Project Directory Structure

이 문서는 **All-Access Home** 프로젝트의 폴더 및 파일 구조에 대한 상세 설명입니다.
**Next.js 15 App Router** 방식을 따르고 있습니다.
/
├── .env.local # 환경 변수 (Clerk, Supabase Key) - Git 제외
├── middleware.ts # Clerk 인증 미들웨어 (라우트 보호)
├── next.config.mjs # Next.js 설정
├── tailwind.config.ts # Tailwind CSS 설정
├── tsconfig.json # TypeScript 설정
│
├── app/ # [Core] 앱 라우팅 및 페이지
│ ├── layout.tsx # Root Layout (ClerkProvider, Font 설정)
│ ├── page.tsx # 랜딩 페이지 (/)
│ ├── actions.ts # Server Actions (DB CRUD 로직)
│ │
│ ├── (auth)/ # 인증 관련 페이지 그룹
│ │ ├── sign-in/[[...sign-in]]/page.tsx
│ │ └── sign-up/[[...sign-up]]/page.tsx
│ │
│ ├── admin/ # [보호자 모드]
│ │ └── page.tsx # 기기 배치 및 설정 페이지
│ │
│ └── access/ # [사용자 모드]
│ └── page.tsx # 시선 추적 및 제어 페이지
│
├── components/ # [UI] 재사용 가능한 컴포넌트
│ ├── ar/ # AR 및 3D 관련 컴포넌트 (R3F)
│ │ ├── ARCanvas.tsx # Three.js 캔버스 래퍼
│ │ ├── DeviceMarker.tsx # 3D 공간에 떠 있는 버튼 객체
│ │ └── CameraController.tsx# 자이로 센서 기반 카메라 제어
│ │
│ ├── eye/ # 시선 추적 관련 컴포넌트
│ │ ├── EyeTracker.tsx # WebGazer 로직 핸들러
│ │ ├── Calibration.tsx # 9점 보정 UI
│ │ └── GazeCursor.tsx # 시선 위치 표시용 붉은 점
│ │
│ └── ui/ # 공통 UI 컴포넌트 (Button, Card 등)
│
├── hooks/ # [Logic] 커스텀 훅
│ ├── useWebGazer.ts # WebGazer 스크립트 로드 및 좌표 관리
│ ├── useDeviceSync.ts # Supabase Realtime 구독 훅
│ └── useStore.ts # Zustand 상태 관리 (전역 상태)
│
├── lib/ # [Config] 외부 라이브러리 설정
│ ├── supabase.ts # Supabase Client 인스턴스
│ └── utils.ts # 유틸리티 함수 (cn 등)
│
└── types/ # [Type] TypeScript 타입 정의
└── index.ts # User, Device 인터페이스 정의
code
Code

## 주요 디렉토리 설명

### `app/actions.ts`

Next.js 15의 **Server Actions**가 정의된 곳입니다. API 라우트를 별도로 만들지 않고, 이 파일의 함수를 클라이언트 컴포넌트에서 직접 호출하여 DB와 통신합니다. (예: `saveDevice`, `toggleDeviceStatus`)

### `components/ar/`

**React Three Fiber (R3F)**를 사용하는 3D 컴포넌트들입니다. HTML 요소가 아닌 Canvas 내부에서 렌더링되는 객체들이므로 일반 CSS로는 스타일링이 불가능할 수 있습니다.

### `hooks/useWebGazer.ts`

외부 스크립트인 `WebGazer.js`를 로드하고, 초기화하며, 메모리 누수를 방지하기 위해 언마운트 시 정리(Clean-up)하는 로직이 들어있습니다. 시선 좌표 데이터를 최적화(Smoothing)하는 로직도 이곳에 포함됩니다.
```

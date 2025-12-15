# All-Access Home (MVP)

시선·멀티모달 입력으로 공간을 제어하는 MVP용 Next.js 15 앱입니다. Pretendard
기본 폰트, Clerk 인증, Supabase(비 RLS) 연동, Admin/User 모드가 포함됩니다.

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
# 또는
pnpm install
# 또는
yarn install
```

### 2. 환경 변수 설정

`.env.example`을 복사해 `.env.local`을 만든 뒤 값을 채우세요.

- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- RLS는 사용하지 않습니다(서비스 롤 키는 선택).

### 3. Supabase 타입 생성 (선택)

```bash
pnpm generate:types
```

### 4. 개발 서버 실행

```bash
pnpm dev
```

> 서버 실행 전 사용자에게 확인 필수 지침이 있습니다.

## 📁 프로젝트 구조

```
boilerplate_new/
├── src/
│   ├── app/                 # Next.js App Router 페이지
│   │   ├── layout.tsx       # 루트 레이아웃
│   │   ├── page.tsx         # 홈 페이지
│   │   └── globals.css       # 전역 스타일
│   ├── components/          # 재사용 가능한 컴포넌트
│   ├── hooks/               # 커스텀 훅
│   ├── lib/                 # 유틸리티, 설정
│   │   ├── cn.ts            # 클래스명 유틸리티
│   │   ├── supabase/        # Supabase 클라이언트
│   │   └── icons/           # 아이콘 시스템
│   ├── providers/           # React Provider 컴포넌트
│   └── utils/               # 유틸리티 함수
├── scripts/                 # 스크립트 파일
├── public/                  # 정적 파일
├── database.types.ts        # Supabase 타입 정의
└── DEVELOPMENT_GUIDELINES.md # 개발 가이드라인
```

## 🛠 설정된 기능

### ✅ 핵심 포함 사항

- Next.js 15 App Router, Tailwind, React Query, next-themes
- Clerk 인증: `/sign-in`, `/sign-up`
- Supabase(비 RLS): users/devices CRUD 서버 액션
- Zustand 스토어: 시선 좌표, 장치 상태, 스냅/드웰 진행도
- Admin 모드(`/admin`): 방향벡터(2m) 기반 기기 추가/토글, 권한 안내
- User 모드(`/access`): 9점 캘리브레이션, 스냅 + 2초 드웰, WebGazer lazy load

## 📚 주요 가이드라인

### 컴포넌트 작성

- 불필요한 추상화 금지
- Spacing-First 정책 (gap 우선, margin 금지)
- Tailwind 유틸리티 우선 사용
- 인라인 style 금지

### 네이밍 규칙

- 컴포넌트: PascalCase (`ProductCard`)
- 훅: camelCase with `use` prefix (`useProduct`)
- 타입: PascalCase (`ProductData`)

### Export 규칙

- 단일 컴포넌트: `export default`
- 다중 export: named export
- 페이지 컴포넌트: 항상 `export default`

자세한 내용은 [DEVELOPMENT_GUIDELINES.md](./DEVELOPMENT_GUIDELINES.md)를 참고하세요.

## 🔧 스크립트

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start

# 린트 검사
npm run lint

# Supabase 타입 생성
npm run generate:types
```

## 📖 권한/UX 체크리스트

- iOS: DeviceOrientation 권한은 “시작하기” 버튼 클릭 안에서 요청하세요.
- WebGazer는 lazy load 후 탭 비활성화 시 자동 `pause` 처리(코드 포함).
- 버튼 최소 96px 권장, Pretendard 기본 폰트 적용.

## 🎨 디자인 시스템

### 컬러 팔레트

- `gray-10` ~ `gray-100`: 그레이 스케일
- `beige-10` ~ `beige-100`: 베이지 스케일

### 타이포그래피

- `text-display-1`: 60px, font-700
- `text-display-2`: 44px, font-700
- `text-h1`: 40px, font-700
- `text-h2`: 32px, font-700
- `text-body-0`: 24px
- `text-body-1`: 19px
- `text-body-2`: 17px
- `text-body-2-bold`: 17px, font-700

## 🚀 배포

### Vercel (권장)

[Vercel Platform](https://vercel.com/new)에 프로젝트를 import하면 자동으로 배포됩니다.

### 기타 플랫폼

```bash
npm run build
npm run start
```

## 📝 라이선스

MIT

---

이 boilerplate는 [DEVELOPMENT_GUIDELINES.md](./DEVELOPMENT_GUIDELINES.md)의 가이드라인을 따릅니다.
# AAH

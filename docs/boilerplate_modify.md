## 주의: 반드시 supabase, clerk 세팅 전 수행할 것것

# 통합 개발 가이드라인

## 🎯 핵심 원칙

### SOLID + 선언적(Declarative) + 불필요한 추상화 금지

#### ✅ 추상화 허용 기준
- **로직이 포함된 경우**: 상태 관리, 데이터 변환, 이벤트 처리
- **재사용이 명확한 경우**: 3곳 이상에서 동일한 패턴으로 사용
- **복잡한 조건부 렌더링**: 10줄 이상의 복잡한 조건 분기
- **외부 라이브러리 래핑**: API 호출, 서드파티 컴포넌트 통합

#### ❌ 금지 사항
- 단순 스타일링만 하는 래퍼 컴포넌트
- 컴포넌트 2-3개만 있는 폴더의 배럴 익스포트
- div + className만 있는 의미 없는 컨테이너 컴포넌트

```jsx
// ❌ 나쁜 예: 불필요한 추상화
function ResultCard({ children }) {
  return <div className="p-6 rounded-xl bg-white">{children}</div>
}

// ✅ 좋은 예: 직접 스타일링
<div className="p-6 rounded-xl bg-white">
  <PalletCalculatorResult />
</div>
```

## 🏷 네이밍 규칙

### 컴포넌트 네이밍
- **형식**: PascalCase
- **패턴**: `[Domain][Role][Variant|State]`
- **예시**: `ProductList`, `AiToolsSidebar`, `AuthLoginForm`
- **금지어**: `Common`, `Base`, `Util`, `Index`, `Test/Tmp`, `Styled*`

### 파일 구조 네이밍
```typescript
// 컴포넌트 파일
components/
├── CourseCard.tsx           // 단일 컴포넌트
├── CourseList.tsx          // 리스트 컴포넌트
├── CourseDetailModal.tsx   // 모달 컴포넌트
└── CourseFilter.tsx        // 필터 컴포넌트

// 훅 파일
hooks/
├── useCourses.ts           // 데이터 페칭 훅
├── useCourseFilter.ts      // 필터링 로직 훅
└── useCart.ts              // 장바구니 상태 훅

// 유틸리티 파일
utils/
├── courseTransform.ts      // 데이터 변환 함수
├── dateFormat.ts           // 날짜 포맷팅
└── validation.ts            // 유효성 검사
```

## 📦 Export 규칙

### 기본 원칙
- **단일 export**: 선언과 동시에 `export default` 사용
- **다중 export**: named export 사용
- **페이지 컴포넌트**: 항상 `export default` (Next.js 요구사항)
- **UI 라이브러리**: Shadcn 패턴 유지 (`export { Component }`)

```typescript
// 단일 컴포넌트 → default
export default function ProductCard({ product }: ProductCardProps) {
  /* ... */
}

// 여러 항목 → named export
export interface PalletFormData { /* ... */ }
export interface PalletResult { /* ... */ }
export function PalletCalculator() { /* ... */ }

// UI 라이브러리 → Shadcn 패턴
export { Button, buttonVariants };
```

## 🎨 스타일링 시스템

### Tailwind CSS 원칙
- **Tailwind 유틸리티 우선 사용**
- **인라인 style 금지** (style={{ }} 사용 금지)
- **styled-jsx 금지**
- **예외**: `globals.css`, 디자인 토큰, 서드파티 오버라이드

### 배경 이미지 처리 패턴
```jsx
// ❌ 나쁜 예: 인라인 스타일
<div 
  className="absolute inset-0 bg-cover bg-center bg-no-repeat"
  style={{
    backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0) 56%, rgba(0, 0, 0, 0.6) 100%), url('${detailImage}')`
  }}
/>

// ✅ 좋은 예: Image 컴포넌트 + 오버레이
<Image src={detailImage} alt="" fill priority className="object-cover" />
<div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" aria-hidden="true" />
```

### 그라디언트 처리
```jsx
// ❌ 나쁜 예: 인라인 radial-gradient
<div style={{
  background: 'radial-gradient(circle at 50% 45%, rgba(162, 162, 162, 0) 0%, rgba(0, 0, 0, 0.84) 84%, rgba(0, 0, 0, 1) 100%)'
}} />

// ✅ 좋은 예: Tailwind 그라디언트 클래스
<div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/84 to-black" />
```

### 동적 배경색 처리
```jsx
// ❌ 나쁜 예: 인라인 backgroundColor
<div style={{ backgroundColor: insight.backgroundColor || '#E1DFDF' }} />

// ✅ 좋은 예: Tailwind 클래스 사용
<div className="w-full h-full bg-gray-20" />
// 또는 동적 클래스 매핑
<div className={cn("w-full h-full", backgroundColorClass)} />
```

### Spacing-First 정책 ⚠️

#### 핵심 규칙
**외곽 여백은 최상단 래퍼의 padding, 형제 요소 간 간격은 부모의 gap으로만 관리**

```jsx
// ✅ 좋은 예: padding + gap
<div className="p-6 md:p-8">
  <div className="flex flex-col gap-4">
    <Card />
    <Card />
    <Card />
  </div>
</div>

// ❌ 나쁜 예: margin 사용
<div>
  <Card />
  <Card className="mt-4" />
  <Card className="mt-4" />
</div>
```

#### 레이아웃 패턴
```jsx
// 세로 스택
<div className="flex flex-col gap-4">

// 가로 정렬
<div className="flex gap-4">

// 그리드
<div className="grid gap-4">

// 반응형 (모바일 우선)
<div className="gap-3 md:gap-4 lg:gap-6">
<div className="p-4 md:p-6 lg:p-8">
```

### 디자인 시스템 컬러

#### 자체 컬러 팔레트 생성해서 정리 ****
```

#### 타이포그래피
```typescript
// Display & Heading
text-display-1  // 60px, font-700
text-display-2  // 44px, font-700
text-h1        // 40px, font-700
text-h2        // 32px, font-700

// Body
text-body-0     // 24px
text-body-1     // 19px
text-body-2     // 17px
text-body-2-bold // 17px, font-700
```

### 아이콘 시스템

```jsx
// 방법 1: Icon 컴포넌트 (권장)
import { Icon } from "@/lib/icons";
<Icon name="package" size={24} className="text-gray-60" />

// 방법 2: 개별 import
import { Package, CircleCheck } from "@/lib/icons";
<Package size={24} className="text-gray-60" />
```

## 🏗 SOLID 원칙 구현

### SRP (단일 책임)
```jsx
// hooks/useUserData.ts - 데이터 페칭만
export function useUserData() { /* ... */ }

// utils/userTransform.ts - 데이터 변환만
export function transformUserData(data) { /* ... */ }

// components/UserDashboard.tsx - UI 조합만
export function UserDashboard() {
  const data = useUserData();
  const view = transformUserData(data);
  return <Chart data={view} />;
}
```

### OCP (개방-폐쇄)
```typescript
export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-blue-500 text-white",
  secondary: "bg-gray-500 text-white",
  // 새 variant 추가는 여기만
};
```

### DIP (의존 역전)
```typescript
// 추상에 의존
export interface DataService<T> { 
  fetch(): Promise<T> 
}

export function DataDisplay<T>({ service }: { service: DataService<T> }) {
  // 구체적인 구현이 아닌 인터페이스에 의존
}
```

## 🔧 프로젝트 설정

### 필수 설정

#### tsconfig.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

#### cn 유틸리티
```typescript
// src/lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Next.js 15 특별 고려사항
```typescript
// 동적 라우트 파라미터는 Promise로 전달됨
export default async function CategoryPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  // ...
}
```

## 📋 개발 프로세스

### 작업 시작 전 체크리스트
- [ ] Development Guidelines 숙지
- [ ] 기존 컴포넌트 라이브러리 확인 (`/components/ui/`)
- [ ] Figma 디자인 전체 구조 파악
- [ ] 재사용 가능한 컴포넌트 식별
- [ ] 상태 관리 요구사항 분석

### 권장 개발 플로우
```
Phase 1: 설계 (20%)
├── 요구사항 분석
├── 컴포넌트 구조 설계
└── 가이드라인 준수 계획

Phase 2: 구현 (60%)
├── 컴포넌트별 순차 개발
├── 실시간 가이드라인 적용
└── 단위별 테스트

Phase 3: 통합 (20%)
├── 페이지 레벨 조합
├── 전체 빌드 테스트
└── 반응형 검증
```

## 🎨 Figma MCP 작업 가이드

### 워크플로우
1. MCP로 데이터 획득 (개발용 스크립트 경로로 분리)
2. 레이아웃/스타일/텍스트 토큰 추출
3. 상수/목데이터 분리 → 컴포넌트 분리 → 타입 정의
4. Tailwind로 스타일링 + 반응형

### Figma → Tailwind 매핑
```
layout.mode=row/column → flex flex-row/col
gap:20 → gap-5
padding:20 → p-5
width:448 → w-[448px] (불가피할 때만)
radius:16 → rounded-2xl
```

## 🧪 테스트 및 품질 관리

### 테스트 전략
- **E2E 테스트**: Playwright로 사용자 시나리오 테스트
- **컴포넌트 테스트**: 주요 비즈니스 로직 검증
- **타입 안전성**: TypeScript strict mode 활용

### 코드 품질 체크리스트
- [ ] TypeScript 타입 정의 완료
- [ ] ESLint 규칙 준수
- [ ] 접근성(ARIA) 속성 포함
- [ ] 반응형 디자인 검증
- [ ] 성능 최적화 (이미지 lazy loading 등)

## ✅ 최종 체크리스트

### 코드 구조
- [ ] 불필요한 추상화가 없는가?
- [ ] Export 규칙을 준수했는가?
- [ ] 네이밍 규칙을 따랐는가?

### 스타일링
- [ ] Spacing-First 정책 준수 (gap 우선, margin 금지)
- [ ] 디자인 시스템 컬러/타이포그래피 사용
- [ ] 정의된 아이콘 시스템 사용
- [ ] Tailwind 유틸리티 우선 사용

### 품질
- [ ] TypeScript 타입 정의
- [ ] SOLID 원칙 준수
- [ ] 컴포넌트 독립성 보장
- [ ] 반응형 대응 완료

## 🚫 금지 사항 요약

1. **불필요한 추상화**
   - 단순 스타일링 래퍼
   - 의미 없는 컨테이너
   - 과도한 배럴 익스포트

2. **Spacing 안티패턴**
   - 형제 간격을 위한 margin (mt, mb, mx, my)
   - 컴포넌트 외부 레이아웃 margin

3. **스타일링 안티패턴**
   - 하드코딩된 hex 컬러
   - styled-jsx 사용
   - 외부 이미지 URL 직접 사용

4. **네이밍 안티패턴**
   - Common, Base, Util 접두사
   - 구현 디테일 포함 (색상, 라이브러리명)

## 📝 Quick Reference

```jsx
// 컴포넌트 템플릿
export default function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  return (
    <div className="p-6 md:p-8"> {/* 외곽 padding */}
      <div className="flex flex-col gap-4"> {/* 형제 간격 gap */}
        <h2 className="text-h2 text-gray-100">제목</h2>
        <p className="text-body-2 text-gray-70">내용</p>
        <Button className="bg-beige-60 text-white">
          <Icon name="check" size={16} className="mr-2" />
          확인
        </Button>
      </div>
    </div>
  );
}
```

### 설정 완료 (Ready to Use)
- **React Query (@tanstack/react-query)** - 서버 상태 관리 (Provider 설정됨)
- **next-themes** - 다크모드 지원 (Provider 설정됨)
- **Supabase** - 백엔드 서비스 (클라이언트 설정됨)

### 향후 사용 예정 (Installed)
- **Zustand** - 글로벌 상태 관리 (장바구니, 사용자 정보 등)
- **React Hook Form** - 폼 상태 관리 (회원가입, 로그인 등)
- **Zod** - 스키마 검증
- **Axios** - HTTP 클라이언트 (백엔드 API 통신)
- **Framer Motion** - 페이지 전환, 인터랙션 애니메이션
- **date-fns** - 날짜/시간 처리
- **es-toolkit** - 유틸리티 함수 모음
- **ts-pattern** - 패턴 매칭
- **react-use** - React 훅 모음
- **clsx** + **tailwind-merge** - 조건부 클래스명 관리

## 🏗 컴포넌트 설계 원칙

### ❌ 불필요한 추상화 금지

#### 단순 래퍼 컴포넌트 지양

```jsx
<code_block_to_apply_changes_from>
```

#### 불필요한 배럴 익스포트 금지

```typescript
// ❌ 나쁜 예: 컴포넌트 2-3개만 있는 폴더의 index.ts
// components/course/index.ts
export * from './CourseCard';
export * from './CourseList';
export * from './CourseHeader';

// ✅ 좋은 예: 직접 import
import { CourseCard } from "@/components/course/CourseCard";
import { CourseList } from "@/components/course/CourseList";
```

#### 의미 없는 컨테이너 컴포넌트 지양

```jsx
// ❌ 나쁜 예: 단순히 div와 className만 있는 컨테이너
function CourseContentWrapper({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>
}

// ✅ 좋은 예: 직접 적용
<div className="flex flex-col gap-5">{children}</div>
```

### ✅ 추상화 허용 기준

다음 경우에만 추상화를 허용합니다:

1. **로직이 포함된 경우**: 상태 관리, 데이터 변환, 이벤트 처리 등
2. **재사용이 명확한 경우**: 3곳 이상에서 동일한 패턴으로 사용
3. **복잡한 조건부 렌더링**: 10줄 이상의 복잡한 조건 분기
4. **외부 라이브러리 래핑**: API 호출, 서드파티 컴포넌트 통합

```jsx
// ✅ 좋은 추상화 예시: 로직이 있는 경우
function useCourseData(courseId: string) {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // 복잡한 데이터 페칭 로직
    fetchCourse(courseId).then(setCourse).finally(() => setLoading(false));
  }, [courseId]);
  
  return { course, loading };
}

// ✅ 좋은 추상화 예시: 복잡한 조건부 렌더링
function CourseStatusBadge({ status, isEnrolled, hasDiscount }: CourseStatusBadgeProps) {
  // 10+ 줄의 복잡한 상태별 스타일링 로직
  const getStatusClasses = () => {
    if (isEnrolled) return "bg-green-100 text-green-800";
    if (hasDiscount) return "bg-red-100 text-red-800";
    if (status === 'popular') return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };
  
  const getStatusText = () => {
    if (isEnrolled) return "";
    if (hasDiscount) return "";
    if (status === 'popular') return "";
    return "일반";
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClasses()}`}>
      {getStatusText()}
    </span>
  );
}
```


### SOLID 원칙 적용

#### SRP (단일 책임 원칙)

```jsx
// hooks/useCourses.ts - 데이터 페칭만
export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses
  });
}

// utils/courseTransform.ts - 데이터 변환만
export function transformCourseData(course: Course): CourseView {
  return {
    ...course,
    formattedPrice: formatPrice(course.price),
    enrollmentRate: calculateEnrollmentRate(course)
  };
}

// components/CourseDashboard.tsx - UI 조합만
export function CourseDashboard() {
  const { data: courses } = useCourses();
  const transformedCourses = courses?.map(transformCourseData);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {transformedCourses?.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
```

#### OCP (개방-폐쇄 원칙)

```typescript
// types/course.ts
export type CourseStatus = "draft" | "published" | "archived";

export const courseStatusConfig: Record<CourseStatus, {
  label: string;
  color: string;
  icon: LucideIcon;
}> = {
  draft: { label: "초안", color: "gray", icon: Edit },
  published: { label: "공개", color: "green", icon: CheckCircle },
  archived: { label: "보관", color: "red", icon: Archive }
};

// 새 상태 추가는 여기만 수정하면 됨
```

##  컴포넌트 네이밍 규칙

### 도메인별 네이밍 패턴

#### 강의 도메인
```typescript
// 컴포넌트
CourseCard, CourseList, CourseHeader, CourseDetail
CourseEnrollment, CourseProgress, CourseReview

// 훅
useCourse, useCourseList, useCourseEnrollment
useCourseProgress, useCourseReview

// 타입
Course, CourseListResponse, CourseEnrollment
CourseProgress, CourseReview
```

#### 장바구니 도메인
```typescript
// 컴포넌트
CartButton, CartDrawer, CartItem, CartSummary
CartCheckout, CartEmpty

// 훅
useCart, useCartItems, useCartTotal
useCartCheckout, useCartValidation

// 타입
CartItem, CartSummary, CartCheckoutRequest
```

#### 결제 도메인
```typescript
// 컴포넌트
CheckoutForm, CheckoutSummary, CheckoutPayment
OrderConfirmation, OrderHistory

// 훅
useCheckout, usePayment, useOrderHistory
useOrderConfirmation

// 타입
CheckoutForm, PaymentMethod, Order, OrderHistory
```

#### 사용자 도메인
```typescript
// 컴포넌트
UserProfile, UserDashboard, UserSettings
UserEnrollment, UserProgress

// 훅
useUser, useUserProfile, useUserSettings
useUserEnrollment, useUserProgress

// 타입
User, UserProfile, UserSettings, UserEnrollment
```

### 네이밍 규칙

1. **컴포넌트**: PascalCase, 명사형
2. **훅**: camelCase, `use` 접두사
3. **타입**: PascalCase, 명사형
4. **상수**: UPPER_SNAKE_CASE
5. **함수**: camelCase, 동사형

```typescript
// ✅ 좋은 예
const CourseCard = () => { /* ... */ };
const useCourseData = () => { /* ... */ };
type CourseData = { /* ... */ };
const MAX_COURSES_PER_PAGE = 12;
const formatCoursePrice = (price: number) => { /* ... */ };

// ❌ 나쁜 예
const courseCard = () => { /* ... */ };
const UseCourseData = () => { /* ... */ };
type courseData = { /* ... */ };
const maxCoursesPerPage = 12;
const FormatCoursePrice = (price: number) => { /* ... */ };
```

## 📤 Export 규칙

### 기본 Export 사용

```typescript
// ✅ 좋은 예: 기본 export 사용
// components/CourseCard.tsx
export default function CourseCard({ course }: CourseCardProps) {
  return <div>{/* ... */}</div>;
}

// types/CourseCard.ts
export interface CourseCardProps {
  course: Course;
  onEnroll?: () => void;
}
```

### Named Export 사용 (유틸리티, 훅)

```typescript
// ✅ 좋은 예: named export 사용
// hooks/useCourse.ts
export function useCourse(courseId: string) {
  // ...
}

export function useCourseList() {
  // ...
}

// utils/courseUtils.ts
export function formatCoursePrice(price: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(price);
}

export function calculateDiscount(originalPrice: number, discountRate: number): number {
  return originalPrice * (1 - discountRate);
}
```

### Import 규칙

```typescript
// ✅ 좋은 예: 명확한 import
import CourseCard from "@/components/course/CourseCard";
import { useCourse, useCourseList } from "@/hooks/useCourse";
import { formatCoursePrice } from "@/utils/courseUtils";

// ❌ 나쁜 예: 불명확한 import
import CourseCard from "@/components/course";
import { useCourse } from "@/hooks";
import { formatCoursePrice } from "@/utils";
```

##  Spacing-First 정책

### 일관된 Spacing 사용

```css
/* 표준 spacing 값 */
space-y-1, space-y-2, space-y-3, space-y-4, space-y-6, space-y-8
gap-1, gap-2, gap-3, gap-4, gap-6, gap-8
p-1, p-2, p-3, p-4, p-6, p-8
m-1, m-2, m-3, m-4, m-6, m-8

/* 컴포넌트별 spacing 가이드 */
/* 카드 내부 */
p-4 md:p-6

/* 섹션 간격 */
py-8 md:py-12

/* 요소 간격 */
space-y-4 md:space-y-6
```

### Spacing 규칙

1. **컴포넌트 내부**: `p-4` 또는 `p-6`
2. **섹션 간격**: `py-8` 또는 `py-12`
3. **요소 간격**: `space-y-4` 또는 `gap-4`
4. **반응형**: 모바일에서 작게, 데스크톱에서 크게

```jsx
// ✅ 좋은 예: 일관된 spacing
function CourseCard({ course }: CourseCardProps) {
  return (
    <div className="p-4 md:p-6 bg-white rounded-lg shadow-sm border">
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">{course.title}</h3>
        <p className="text-gray-600 text-sm">{course.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-blue-600">
            {formatCoursePrice(course.price)}
          </span>
          <Button size="sm">버튼입니다</Button>
        </div>
      </div>
    </div>
  );
}
```

## ⚙️ Next.js 15 특화 설정

### App Router 사용

```typescript
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

### 동적 라우트 파라미터 처리

```typescript
// ✅ 올바른 예: Next.js 15
export default async function CoursePage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const course = await getCourseById(id);
  
  return <CourseDetail course={course} />;
}

// ❌ 잘못된 예: Next.js 14 이하 방식
export default function CoursePage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const { id } = params; // 타입 에러 발생
  // ...
}
```

### 이미지 최적화

```jsx
import Image from 'next/image';

// ✅ 좋은 예: Next.js Image 컴포넌트 사용
<Image
  src="/thumbnail.jpg"
  alt="썸네일"
  width={300}
  height={200}
  className="rounded-lg"
  priority={isAboveFold}
/>

// ❌ 나쁜 예: 일반 img 태그 사용
<img src="/thumbnail.jpg" alt=" 썸네일" />
```

### 메타데이터 설정

```typescript
// app/course/[id]/page.tsx
import { Metadata } from 'next';

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}): Promise<Metadata> {
  const { id } = await params;
  const course = await getCourseById(id);
  
  return {
    title: `${course.title} - 나의서비스`,
    description: course.description,
    openGraph: {
      title: course.title,
      description: course.description,
      images: [course.thumbnail],
    },
  };

### 디렉토리 규칙

1. **app/**: Next.js App Router 페이지
2. **components/**: 재사용 가능한 컴포넌트
3. **lib/**: 유틸리티, 설정, 타입 정의
4. **public/**: 정적 파일 (이미지, 아이콘 등)

## ✅ 최종 체크리스트

### 컴포넌트 작성 시
- [ ] 불필요한 래퍼 컴포넌트를 만들지 않았는가?
- [ ] 컴포넌트 이름이 도메인과 일치하는가?
- [ ] TypeScript 타입을 정의했는가?
- [ ] Tailwind CSS를 사용했는가?
- [ ] 반응형 디자인을 적용했는가?

### 코드 품질
- [ ] ESLint 에러가 없는가?
- [ ] TypeScript 에러가 없는가?
- [ ] 불필요한 추상화를 하지 않았는가?
- [ ] 일관된 네이밍 규칙을 따랐는가?
- [ ] 적절한 spacing을 사용했는가?

### Next.js 15 준수
- [ ] 동적 라우트에서 `await params`를 사용했는가?
- [ ] `next/image`를 사용했는가?
- [ ] 메타데이터를 설정했는가?
- [ ] App Router 구조를 따랐는가?

### 성능 최적화
- [ ] 불필요한 리렌더링을 방지했는가?
- [ ] 이미지를 최적화했는가?
- [ ] 적절한 캐싱을 사용했는가?
- [ ] 번들 크기를 고려했는가?

---

이 가이드라인을 따라 일관되고 유지보수 가능한 코드를 작성하세요. 🚀

---
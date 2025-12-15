# 프로젝트 설정 가이드

## 📋 초기 설정 단계

### 1단계: 의존성 설치

```bash
npm install
```

### 2단계: 환경 변수 설정

`env.example` 파일을 참고하여 `.env` 파일을 생성하세요:

```bash
# Windows
copy env.example .env

# macOS/Linux
cp env.example .env
```

`.env` 파일을 열어 다음 값들을 입력하세요:

```env
SUPABASE_PROJECT_REF=your-project-ref-here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3단계: Supabase 프로젝트 설정

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. Settings > API에서 다음 정보 확인:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Reference ID → `SUPABASE_PROJECT_REF`

### 4단계: Supabase 타입 생성 (선택사항)

Supabase 프로젝트를 설정한 후 데이터베이스 타입을 생성하세요:

```bash
npm run generate:types
```

이 명령어는 `database.types.ts` 파일을 생성합니다.

### 5단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## ✅ 설정 확인 체크리스트

- [ ] 의존성 설치 완료 (`npm install`)
- [ ] `.env` 파일 생성 및 값 입력
- [ ] Supabase 프로젝트 설정 완료
- [ ] 타입 생성 완료 (선택사항)
- [ ] 개발 서버 정상 실행 확인

## 🐛 문제 해결

### 환경 변수 오류

```
Error: Missing Supabase environment variables
```

**해결 방법**: `.env` 파일이 프로젝트 루트에 있고, 모든 Supabase 환경 변수가 올바르게 설정되었는지 확인하세요.

### 타입 생성 오류

```
SUPABASE_PROJECT_REF 환경 변수가 설정되지 않았습니다
```

**해결 방법**: `.env` 파일에 `SUPABASE_PROJECT_REF`를 추가하거나, 명령어 실행 시 직접 지정:

```bash
SUPABASE_PROJECT_REF=your-project-ref npm run generate:types
```

### 빌드 오류

TypeScript 오류가 발생하는 경우:

1. `database.types.ts` 파일이 있는지 확인
2. Supabase 타입 생성 실행: `npm run generate:types`
3. 타입이 없어도 작동하도록 하려면 `src/lib/supabase/client.ts`에서 타입 제거

## 📚 다음 단계

설정이 완료되면 다음을 진행하세요:

1. [개발 가이드라인](./DEVELOPMENT_GUIDELINES.md) 읽기
2. 첫 번째 컴포넌트 만들기
3. Supabase 연동 테스트

자세한 내용은 [README.md](./README.md)를 참고하세요.

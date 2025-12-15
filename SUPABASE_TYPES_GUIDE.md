# Supabase 타입 생성 가이드

## 📋 개요

Supabase 데이터베이스 스키마에서 TypeScript 타입을 자동으로 생성하는 기능입니다.

## 🚀 사용 방법

### 방법 1: npm 스크립트 사용 (권장)

프로젝트의 `package.json`에 다음 스크립트를 추가하세요:

```json
{
  "scripts": {
    "generate:types": "node scripts/generate-types.ts",
    "generate:types:bash": "bash scripts/generate-types.sh",
    "generate:types:win": "scripts\\generate-types.bat"
  }
}
```

그리고 `.env` 파일에 프로젝트 ID를 추가하세요:

```env
SUPABASE_PROJECT_REF=your-project-ref-here
```

실행:

```bash
npm run generate:types
```

### 방법 2: 직접 명령어 실행

#### Windows (CMD/PowerShell)

```cmd
set SUPABASE_PROJECT_REF=your-project-ref
npx -y supabase gen types typescript --project-id "%SUPABASE_PROJECT_REF%" --schema public > database.types.ts
```

#### macOS/Linux

```bash
export SUPABASE_PROJECT_REF=your-project-ref
npx -y supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > database.types.ts
```

### 방법 3: 스크립트 파일 직접 실행

#### Windows

```cmd
set SUPABASE_PROJECT_REF=your-project-ref
scripts\generate-types.bat
```

#### macOS/Linux

```bash
export SUPABASE_PROJECT_REF=your-project-ref
chmod +x scripts/generate-types.sh
./scripts/generate-types.sh
```

## 📁 출력 파일

생성된 타입 파일은 프로젝트 루트에 `database.types.ts`로 저장됩니다.

```typescript
// database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // ... 테이블 타입 정의
    }
    Views: {
      // ... 뷰 타입 정의
    }
    Functions: {
      // ... 함수 타입 정의
    }
  }
}
```

## 🔧 프로젝트에서 사용하기

생성된 타입을 Supabase 클라이언트에서 사용:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 이제 타입 안전하게 사용 가능
const { data, error } = await supabase
  .from('users')
  .select('*')
```

## 🔄 자동 업데이트

데이터베이스 스키마가 변경될 때마다 타입을 다시 생성하세요:

```bash
npm run generate:types
```

## ⚙️ 환경 변수 설정

### .env 파일 예시

```env
# Supabase 설정
SUPABASE_PROJECT_REF=abcdefghijklmnop
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 프로젝트 ID 찾기

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. Settings > General에서 "Reference ID" 확인

## 🐛 문제 해결

### 오류: "SUPABASE_PROJECT_REF 환경 변수가 설정되지 않았습니다"

`.env` 파일에 `SUPABASE_PROJECT_REF`를 추가하거나, 명령어 실행 시 직접 지정하세요:

```bash
SUPABASE_PROJECT_REF=your-project-ref npm run generate:types
```

### 오류: "Project not found"

프로젝트 ID가 올바른지 확인하세요. Supabase Dashboard에서 Reference ID를 다시 확인하세요.

### 타입이 생성되지 않음

1. Supabase CLI가 설치되어 있는지 확인: `npx supabase --version`
2. 인터넷 연결 확인
3. 프로젝트 ID가 올바른지 확인

## 📝 참고 사항

- 타입 생성은 Supabase API를 호출하므로 인터넷 연결이 필요합니다
- 스키마 변경 후에는 항상 타입을 다시 생성하세요
- 생성된 `database.types.ts` 파일은 Git에 커밋하는 것을 권장합니다

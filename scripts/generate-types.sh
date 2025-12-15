#!/bin/bash
# Supabase 타입 생성 스크립트 (Bash 버전)
# 
# 사용법:
#   ./scripts/generate-types.sh
#   또는
#   SUPABASE_PROJECT_REF=your-project-ref ./scripts/generate-types.sh

set -e

SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF:-}

if [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "❌ SUPABASE_PROJECT_REF 환경 변수가 설정되지 않았습니다."
  echo ""
  echo "사용법:"
  echo "  SUPABASE_PROJECT_REF=your-project-ref npm run generate:types"
  echo ""
  echo "또는 .env 파일에 다음을 추가하세요:"
  echo "  SUPABASE_PROJECT_REF=your-project-ref"
  exit 1
fi

echo "🔄 Supabase 타입 생성 중... (프로젝트: $SUPABASE_PROJECT_REF)"

npx -y supabase gen types typescript \
  --project-id "$SUPABASE_PROJECT_REF" \
  --schema public > database.types.ts

echo "✅ 타입 생성 완료: database.types.ts"

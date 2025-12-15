@echo off
REM Supabase 타입 생성 스크립트 (Windows 배치 파일)
REM 
REM 사용법:
REM   scripts\generate-types.bat
REM   또는
REM   set SUPABASE_PROJECT_REF=your-project-ref && scripts\generate-types.bat

if "%SUPABASE_PROJECT_REF%"=="" (
  echo ❌ SUPABASE_PROJECT_REF 환경 변수가 설정되지 않았습니다.
  echo.
  echo 사용법:
  echo   set SUPABASE_PROJECT_REF=your-project-ref ^&^& npm run generate:types
  echo.
  echo 또는 .env 파일에 다음을 추가하세요:
  echo   SUPABASE_PROJECT_REF=your-project-ref
  exit /b 1
)

echo 🔄 Supabase 타입 생성 중... (프로젝트: %SUPABASE_PROJECT_REF%)

npx -y supabase gen types typescript --project-id "%SUPABASE_PROJECT_REF%" --schema public > database.types.ts

if %ERRORLEVEL% EQU 0 (
  echo ✅ 타입 생성 완료: database.types.ts
) else (
  echo ❌ 타입 생성 실패
  exit /b 1
)

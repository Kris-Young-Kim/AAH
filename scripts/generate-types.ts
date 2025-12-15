#!/usr/bin/env node
/**
 * Supabase 타입 생성 스크립트
 * 
 * 사용법:
 *   npm run generate:types
 *   또는
 *   SUPABASE_PROJECT_REF=your-project-ref npm run generate:types
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!SUPABASE_PROJECT_REF) {
  console.error('❌ SUPABASE_PROJECT_REF 환경 변수가 설정되지 않았습니다.');
  console.log('\n사용법:');
  console.log('  SUPABASE_PROJECT_REF=your-project-ref npm run generate:types');
  console.log('\n또는 .env 파일에 다음을 추가하세요:');
  console.log('  SUPABASE_PROJECT_REF=your-project-ref');
  process.exit(1);
}

const outputPath = path.join(process.cwd(), 'database.types.ts');

try {
  console.log(`🔄 Supabase 타입 생성 중... (프로젝트: ${SUPABASE_PROJECT_REF})`);
  
  const command = `npx -y supabase gen types typescript --project-id "${SUPABASE_PROJECT_REF}" --schema public`;
  
  const output = execSync(command, { 
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  
  fs.writeFileSync(outputPath, output, 'utf-8');
  
  console.log(`✅ 타입 생성 완료: ${outputPath}`);
} catch (error: any) {
  console.error('❌ 타입 생성 실패:', error.message);
  process.exit(1);
}

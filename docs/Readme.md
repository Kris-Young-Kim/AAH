# 2. README.md
> 프로젝트의 얼굴입니다. 어떤 프로젝트인지, 어떻게 실행하는지 상세하게 설명합니다.

```markdown
# 👁️ All-Access Home (MVP)

> **"공간을 읽고, 시선으로 켜다."**
> 사지마비 및 중증 장애인을 위한 웹캠 기반 시선 추적 스마트홈 제어 플랫폼.

![Project Status](https://img.shields.io/badge/Status-MVP-orange)
![Tech Stack](https://img.shields.io/badge/Stack-Next.js_15_|_Supabase_|_Clerk-blue)

## 📖 프로젝트 소개

**All-Access Home**은 고가의 전용 보조공학 기기(안구 마우스 등) 없이, 누구나 가지고 있는 노트북이나 태블릿의 **웹캠**만으로 생활 공간을 제어할 수 있도록 돕는 웹 서비스입니다.

### 핵심 기능
- **Web Lite-SLAM:** 디바이스 센서를 활용해 내 방을 가상 공간에 매핑(Mapping).
- **AR 기기 배치:** 보호자가 카메라 화면을 보며 실제 가전 위치에 가상 버튼 배치.
- **Eye-Gaze Control:** 별도 장비 없이 눈동자 움직임만으로 버튼 클릭(Dwell Click).
- **Multimodal Input:** 시선 외에도 마우스, 스위치 등 다양한 입력 방식 지원.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS
- **Language:** TypeScript
- **Auth:** Clerk (Social Login)
- **Database:** Supabase (PostgreSQL, Realtime)
- **Engine:**
  - **Eye Tracking:** WebGazer.js
  - **3D/AR:** Three.js, React Three Fiber (R3F)
- **Deployment:** Vercel

---

## 🚀 시작하기 (Getting Started)

이 프로젝트를 로컬 환경에서 실행하기 위한 가이드입니다.

### 1. 레포지토리 클론
```bash
git clone https://github.com/your-username/all-access-home.git
cd all-access-home
2. 패키지 설치
code
Bash
npm install
# or
yarn install
3. 환경 변수 설정 (.env.local)
루트 디렉토리에 .env.local 파일을 생성하고 아래 키를 입력하세요.
code
Env
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
4. 데이터베이스 설정 (Supabase)
Supabase SQL Editor에서 /db/schema.sql (또는 제공된 SQL)을 실행하여 테이블을 생성하세요.
5. 개발 서버 실행
code
Bash
npm run dev
브라우저에서 http://localhost:3000으로 접속하세요.
📱 사용 방법 (User Guide)
로그인: 구글 계정 등으로 로그인합니다.
모드 선택:
보호자(Admin): /admin으로 이동하여 웹캠으로 방을 비추고, 기기(전등 등) 위치에 버튼을 추가합니다.
사용자(User): /access로 이동하여 9점 캘리브레이션(눈 보정)을 진행한 후, 화면에 떠 있는 버튼을 2초간 응시하여 작동시킵니다.
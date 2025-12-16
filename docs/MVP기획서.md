📘 All-Access Home: MVP 통합 기획서
1. 서비스 개요 (Service Overview)
서비스명: All-Access Home (올 액세스 홈)
한줄 정의: 고가의 장비 없이, 웹캠과 브라우저만으로 3D 공간을 매핑하고 시선(Eye) 및 다양한 도구로 가전을 제어하는 웹 기반 보조공학 플랫폼.
플랫폼: Web (PC, Tablet, Mobile) / PWA 지원.
2. 목적 (Purpose)
비용 절감: 수백만 원대 안구 마우스/환경 제어 장치(ECU)를 무료 또는 저비용 웹 기술로 대체.
접근성 혁신: 복잡한 앱 조작 대신, "쳐다보면 켜지는" 직관적인 공간 인터페이스 제공.
자립 지원: 중증 장애인이 타인의 도움 없이 스스로 생활 환경을 통제할 수 있는 권한 부여.
3. 배경 (Background)
시장 문제: 스마트홈 기기는 늘어났지만, 앱 인터페이스는 여전히 작고 복잡하여 지체 장애인이 사용하기 어려움.
기술 기회: WebXR, DeviceOrientation API, WebGazer.js 등 웹 기술의 발전으로 브라우저에서도 준수한 수준의 공간 인식과 시선 추적이 가능해짐.
Needs: 설치가 필요 없고(Zero-install), 수정이 간편한 소프트웨어 중심의 보조공학 솔루션 필요성 대두.
4. 타겟 유저 (Target User)
Primary (사용자): 척수 손상(SCI), 루게릭병(ALS) 등 상지 기능 제약이 있어 정밀한 손 조작이 어려운 중증 장애인.
Secondary (설정자/보호자): IT 기기에 익숙하지 않지만, 장애인 가족을 위해 환경을 설정해 주려는 보호자.
5. 핵심 기술 (Core Technology)
Web Lite-SLAM (3DoF): 디바이스의 자이로 센서(회전)와 카메라 화면을 동기화하여, 사용자가 고개를 돌려도 가상 버튼이 실제 사물 위치에 고정되도록 하는 공간 매핑 기술.
Multimodal Input Engine: 시선(Eye), 마우스, 스위치 등 서로 다른 입력 신호를 하나의 '가상 커서'로 통합 처리하는 어댑터.
Dwell Click (드웰 클릭): 별도의 클릭 동작 없이, 버튼을 일정 시간(2초) 응시하면 자동으로 실행되는 인터랙션 기술.
6. UX / 서비스 흐름 (Service Flow)
서비스는 **'설정(Admin)'**과 '제어(User)' 두 가지 모드로 명확히 분리됩니다.
Onboarding: 로그인 후 보호자/사용자 모드 선택.
Setup (보호자): 방을 둘러보며(Camera View) 전등, TV 위치에 '가상 버튼'을 붙임 (Drag & Drop).
Action (사용자): 캘리브레이션(영점 조절) 후, 화면 속 버튼을 응시하여 제어.
Feedback: 버튼이 켜지는 시각/청각 피드백 제공.
7. 주요 기능 (Key Features)
구분	기능명	상세 설명
공통	Clerk 인증	소셜 로그인(Google, Kakao) 및 사용자 세션 관리.
보호자	AR 공간 맵핑	화면 중앙 조준점을 실제 가전에 맞추고 버튼 생성 시 3D 좌표(x,y,z) 저장.
보호자	기기 관리	기기 아이콘(전등, TV 등) 설정 및 위치 수정/삭제.
보호자	입력 방식 설정	사용자의 조작 방식을 쉽게 설정(눈으로 조작, 마우스로 조작, 스캔 방식), 각 방식에 대한 설명 제공.
사용자	시선 캘리브레이션	9개의 점을 따라보며 시선 추적 정확도 향상.
사용자	스마트 타겟팅	커서가 버튼 근처에 가면 자석처럼 달라붙는(Snap) 보정 기능.
사용자	상태 동기화	기기 제어 시(On/Off), DB에 즉시 반영되고 UI 색상 변경.
사용자	스캔 모드 개선	스캔 속도 조절(1초/2초/3초), 현재 선택된 기기 강조 표시.
사용자	일상 루틴	아침 루틴(불 켜기, 커튼 열기, TV 켜기), 저녁 루틴(불 끄기, 커튼 닫기, TV 끄기) 한 번에 실행.
8. 데이터베이스 설계 (Database Schema)
Clerk의 user_id를 핵심키로 사용하여 Supabase와 연동합니다.
8.1. ERD (Entity Relationship Diagram) 구조
Users 테이블: 사용자 설정 정보 저장 (Clerk ID와 매핑)
Devices 테이블: 배치된 가상 버튼의 위치와 정보 저장
code
Mermaid
erDiagram
    USERS ||--o{ DEVICES : "owns"
    USERS ||--o{ ROUTINES : "owns"
    ROUTINES ||--o{ ROUTINE_DEVICES : "contains"
    DEVICES ||--o{ ROUTINE_DEVICES : "included_in"
    
    USERS {
        uuid id PK "Supabase 내부 ID"
        string clerk_user_id UK "Clerk 인증 ID (필수)"
        string email "이메일"
        string role "admin(보호자) / user(사용자)"
        string input_mode "eye / mouse / switch"
        timestamp created_at
    }

    DEVICES {
        uuid id PK
        uuid user_id FK "USERS 테이블의 id"
        string name "기기 이름 (예: 거실 전등)"
        string icon_type "light / tv / fan"
        float position_x "3D 공간 X 좌표"
        float position_y "3D 공간 Y 좌표"
        float position_z "3D 공간 Z 좌표"
        boolean is_active "On/Off 상태"
        timestamp created_at
    }
    
    ROUTINES {
        uuid id PK
        uuid user_id FK "USERS 테이블의 id"
        string name "루틴 이름 (예: 아침 루틴)"
        string time_type "morning / evening / custom"
        timestamp created_at
        timestamp updated_at
    }
    
    ROUTINE_DEVICES {
        uuid id PK
        uuid routine_id FK "ROUTINES 테이블의 id"
        uuid device_id FK "DEVICES 테이블의 id"
        boolean target_state "목표 상태 (true: 켜기, false: 끄기)"
        integer order_index "실행 순서"
    }
8.2. 테이블 상세 명세 (SQL DDL)
개발 시 Supabase SQL Editor에 바로 적용할 수 있는 코드입니다.
code
SQL
-- 1. Users Table (Clerk 연동을 위한 메타 데이터)
create table public.users (
  id uuid not null default gen_random_uuid() primary key,
  clerk_user_id text not null unique, -- Clerk ID 필수 저장
  email text,
  role text default 'user', -- 'admin' or 'user'
  input_mode text default 'eye', -- 기본 입력 방식
  created_at timestamptz default now()
);

-- 2. Devices Table (AR 마커 정보)
create table public.devices (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  icon_type text not null, -- 'light', 'tv', 'fan'
  position_x float8 not null default 0,
  position_y float8 not null default 0,
  position_z float8 not null default -2, -- 기본적으로 전방 2m
  is_active boolean default false,
  created_at timestamptz default now()
);

-- 3. Routines Table (일상 루틴)
create table public.routines (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  time_type text not null check (time_type in ('morning', 'evening', 'custom')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Routine Devices Table (루틴별 기기 및 실행 순서)
create table public.routine_devices (
  id uuid not null default gen_random_uuid() primary key,
  routine_id uuid not null references public.routines(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  target_state boolean not null, -- true: 켜기, false: 끄기
  order_index integer not null, -- 실행 순서
  unique(routine_id, device_id)
);

-- 5. Indexing (성능 최적화)
create index idx_users_clerk_id on public.users(clerk_user_id);
create index idx_devices_user_id on public.devices(user_id);
create index idx_routines_user_id on public.routines(user_id);
create index idx_routine_devices_routine_id on public.routine_devices(routine_id);
9. 유저 플로우 (User Flow)
랜딩 페이지부터 제어까지의 흐름을 도식화했습니다.
code
Mermaid
graph TD
    %% 스타일 정의
    classDef page fill:#f9f,stroke:#333,stroke-width:2px;
    classDef logic fill:#bbf,stroke:#333,stroke-width:1px;
    classDef db fill:#dfd,stroke:#333,stroke-width:1px;

    start((Start)) --> Landing[랜딩 페이지]
    Landing --> |로그인 클릭| ClerkAuth{Clerk 로그인}
    
    ClerkAuth --> |성공| CheckUser{DB에 유저 존재?}
    class CheckUser logic
    
    CheckUser -- No (첫 방문) --> CreateUser[User 테이블 생성<br>(clerk_user_id 저장)]
    class CreateUser db
    CheckUser -- Yes --> SelectMode[모드 선택 화면]
    CreateUser --> SelectMode
    
    SelectMode --> |보호자 모드| AdminPage[설정 페이지<br>/admin]
    SelectMode --> |사용자 모드| UserPage[제어 페이지<br>/access]
    
    subgraph "Admin Flow (설정)"
        AdminPage --> CameraView1[웹캠 뷰]
        CameraView1 --> DragDrop[가상 버튼 배치]
        DragDrop --> SaveDevice[기기 저장]
        SaveDevice --> |Insert| DeviceDB[(Devices Table)]
        class DeviceDB db
    end
    
    subgraph "User Flow (제어)"
        UserPage --> Calibration[9점 캘리브레이션]
        Calibration --> ControlView[공간 제어 뷰]
        ControlView --> EyeTrack[시선 추적 & 매핑]
        EyeTrack --> |2초 응시| ToggleAction[상태 변경]
        ToggleAction --> |Update| DeviceDB
        DeviceDB --> |Realtime| ControlView
    end
🧭 MVP 기획 검토 및 조언
작성해주신 요청 사항과 기술 스택(Next.js, Clerk, Supabase)을 종합적으로 검토했을 때, 성공적인 MVP를 위한 핵심 포인트는 다음과 같습니다.
clerk_user_id 처리 전략:
Clerk은 인증(Auth)만 담당하고, 실제 앱 데이터(기기 위치 등)는 Supabase에 있습니다.
로그인 완료 시점(ClerkLoaded 혹은 middleware)에 **Supabase의 users 테이블에 해당 clerk_user_id가 있는지 확인하고, 없으면 생성(Upsert)**하는 로직이 반드시 필요합니다. 그래야 devices 테이블이 users 테이블을 참조(Foreign Key)할 수 있습니다.
Lite-SLAM의 한계 인지:
웹캠만으로는 깊이(Depth) 인식이 어렵습니다. 따라서 기기 배치 시 
z
z
좌표(거리)는 고정값(예: 2미터 앞)으로 두고, 
x
,
y
x,y
 (방향) 위주로 매핑하는 것이 구현 난이도를 낮추고 UX를 단순화하는 지름길입니다.
반응형 권한 요청:
iOS 환경에서는 자이로 센서 사용 시 **'사용자의 명시적 클릭'**이 있어야 권한 팝업이 뜹니다. 따라서 캘리브레이션 시작 전에 반드시 "시작하기" 버튼을 눌러 권한을 얻는 단계가 유저 플로우에 포함되어야 합니다.
이 기획서와 구조도라면 개발자(혹은 Cursor AI)가 바로 코드를 작성하기에 충분히 구체적입니다. 바로 개발을 시작하셔도 좋습니다! 🚀
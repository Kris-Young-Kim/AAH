
개발자로서 프로젝트를 체계적으로 관리하고, 팀원(또는 미래의 자신)이나 오픈소스 기여자들에게 명확한 가이드를 제공하기 위한 3가지 핵심 문서를 작성해 드립니다.
이 내용을 각각의 파일명(Mermaid.md, README.md, DIR.md)으로 저장하여 프로젝트 루트에 포함시키면 됩니다.
1. Mermaid.md
프로젝트의 흐름, 아키텍처, 데이터베이스 구조를 시각화한 문서입니다. GitHub에서는 이 코드가 자동으로 다이어그램으로 렌더링됩니다.
code
Markdown
# 📊 System Diagrams

## 1. User Flow (사용자 흐름도)
사용자의 역할(보호자 vs 사용자)에 따른 진입 및 행동 흐름입니다.

```mermaid
graph TD
    %% 스타일 정의
    classDef page fill:#f9f,stroke:#333,stroke-width:2px;
    classDef logic fill:#bbf,stroke:#333,stroke-width:1px;
    classDef db fill:#dfd,stroke:#333,stroke-width:1px;

    start((Start)) --> Landing[랜딩 페이지]
    Landing --> |"시작하기"| ClerkAuth{Clerk 로그인}
    
    ClerkAuth --> |성공| CheckUser{DB에 유저 존재?}
    class CheckUser logic
    
    CheckUser -- No (첫 방문) --> CreateUser[User 테이블 생성<br>(clerk_user_id 저장)]
    class CreateUser db
    CheckUser -- Yes --> SelectMode[모드 선택 화면]
    CreateUser --> SelectMode
    
    SelectMode --> |"보호자 모드"| AdminPage[설정 페이지<br>/admin]
    SelectMode --> |"사용자 모드"| UserPage[제어 페이지<br>/access]
    
    subgraph "Admin Flow (설정)"
        AdminPage --> CameraView1[웹캠 뷰 + AR]
        CameraView1 --> |기기 위치로 이동| DragDrop[가상 버튼 배치]
        DragDrop --> SaveDevice[기기 저장]
        SaveDevice --> |Insert| DeviceDB[(Devices Table)]
        class DeviceDB db
    end
    
    subgraph "User Flow (제어)"
        UserPage --> Calibration[9점 캘리브레이션]
        Calibration --> ControlView[공간 제어 뷰]
        ControlView --> EyeTrack[시선 추적 & 매핑]
        EyeTrack --> |2초 응시 (Dwell)| ToggleAction[상태 변경]
        ToggleAction --> |Update| DeviceDB
        DeviceDB --> |Realtime Sync| ControlView
    end
2. System Architecture (시스템 아키텍처)
클라이언트(브라우저)와 서버, 데이터베이스 간의 데이터 처리 구조입니다.
code
Mermaid
graph TD
    subgraph Client [User Browser / PWA]
        A[Webcam Stream] --> B[WebGazer.js (Eye Tracking)]
        C[Device Sensors] --> D[Three.js / R3F (Lite-SLAM)]
        B --> E[Input Adapter (Smoothing Filter)]
        E --> F[Interaction Engine (Raycaster)]
        D --> F
        F --> G[UI / 3D Canvas]
    end

    subgraph Server [Next.js 15 / Vercel]
        H[Server Actions]
        I[Clerk Middleware]
    end

    subgraph Database [Supabase]
        J[(PostgreSQL Users/Devices)]
        K[Realtime Channel]
    end

    F -- "Action (Click)" --> H
    H --> J
    J -- "State Change Event" --> K
    K -- "Sync UI" --> G
3. Entity Relationship Diagram (ERD)
Supabase 데이터베이스 테이블 구조 및 관계도입니다.
code
Mermaid
erDiagram
    USERS ||--o{ DEVICES : "owns"
    
    USERS {
        uuid id PK "Supabase 내부 ID"
        varchar clerk_user_id UK "Clerk 인증 ID"
        varchar email
        varchar role "admin / user"
        varchar input_mode "eye / mouse / switch"
        timestamp created_at
    }

    DEVICES {
        uuid id PK
        uuid user_id FK
        varchar name "기기 이름"
        varchar icon_type "light / tv / fan"
        float position_x "3D X좌표"
        float position_y "3D Y좌표"
        float position_z "3D Z좌표 (Depth)"
        boolean is_active "On/Off 상태"
        timestamp created_at
    }
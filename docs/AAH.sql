-- ================================================================
-- [All-Access Home] MVP Database Schema for Supabase (PostgreSQL)
-- ================================================================

-- 1. 초기화 (기존 테이블 삭제)
-- CASCADE 옵션을 통해 의존 관계가 있는 테이블까지 안전하게 삭제합니다.
DROP TABLE IF EXISTS "devices" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- 2. 유틸리티 함수 생성 (updated_at 자동 갱신용)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Users 테이블 생성
CREATE TABLE "users" (
    "id"            UUID            NOT NULL    DEFAULT gen_random_uuid(),
    "clerk_user_id" VARCHAR(255)    NOT NULL,
    "email"         VARCHAR(255)    NULL,
    "role"          VARCHAR(50)     NULL        DEFAULT 'user',
    "input_mode"    VARCHAR(50)     NULL        DEFAULT 'eye',
    "created_at"    TIMESTAMPTZ     NOT NULL    DEFAULT now(),
    "updated_at"    TIMESTAMPTZ     NOT NULL    DEFAULT now(),

    -- 기본키 및 고유키 제약조건
    CONSTRAINT "pk_users" PRIMARY KEY ("id"),
    CONSTRAINT "users_clerk_user_id_key" UNIQUE ("clerk_user_id"),

    -- 값 제한 규칙 (Check Constraints)
    CONSTRAINT "check_role" CHECK (role IN ('admin', 'user')),
    CONSTRAINT "check_input_mode" CHECK (input_mode IN ('eye', 'mouse', 'switch', 'touch'))
);

-- Users 테이블 주석
COMMENT ON COLUMN "users"."id" IS 'Supabase 내부 고유 ID';
COMMENT ON COLUMN "users"."clerk_user_id" IS 'Clerk 인증 ID (식별자)';
COMMENT ON COLUMN "users"."role" IS '역할: admin(보호자), user(사용자)';
COMMENT ON COLUMN "users"."input_mode" IS '제어 방식: eye, mouse, switch, touch';

-- 4. Devices 테이블 생성
CREATE TABLE "devices" (
    "id"            UUID            NOT NULL    DEFAULT gen_random_uuid(),
    "user_id"       UUID            NOT NULL,
    "name"          VARCHAR(100)    NOT NULL,
    "icon_type"     VARCHAR(50)     NOT NULL,
    "position_x"    FLOAT8          NOT NULL    DEFAULT 0,
    "position_y"    FLOAT8          NOT NULL    DEFAULT 0,
    "position_z"    FLOAT8          NOT NULL    DEFAULT -2.0,
    "is_active"     BOOLEAN         NOT NULL    DEFAULT false,
    "created_at"    TIMESTAMPTZ     NOT NULL    DEFAULT now(),
    "updated_at"    TIMESTAMPTZ     NOT NULL    DEFAULT now(),

    -- 기본키 제약조건
    CONSTRAINT "pk_devices" PRIMARY KEY ("id"),

    -- 외래키 설정 (Cascade Delete)
    CONSTRAINT "fk_devices_user" FOREIGN KEY ("user_id")
        REFERENCES "users" ("id") ON DELETE CASCADE,

    -- 값 제한 규칙
    CONSTRAINT "check_icon_type" CHECK (icon_type IN ('light', 'tv', 'fan', 'plug', 'curtain'))
);

-- Devices 테이블 주석
COMMENT ON COLUMN "devices"."user_id" IS '기기 소유자 ID (FK)';
COMMENT ON COLUMN "devices"."icon_type" IS '아이콘 타입 (light, tv, fan, plug, curtain)';
COMMENT ON COLUMN "devices"."position_x" IS '3D 좌표 X';
COMMENT ON COLUMN "devices"."position_z" IS '3D 좌표 Z (Depth 기본값 -2.0)';
COMMENT ON COLUMN "devices"."is_active" IS '작동 상태 (On/Off)';

-- 5. 인덱스 설정 (조회 성능 최적화)
-- 로그인 시 Clerk ID로 빠른 조회를 위해
CREATE INDEX "idx_users_clerk_user_id" ON "users" ("clerk_user_id");
-- 특정 유저의 기기 목록을 빠르게 불러오기 위해
CREATE INDEX "idx_devices_user_id" ON "devices" ("user_id");

-- 6. 트리거 설정 (수정 시간 자동 기록)
CREATE TRIGGER "trigger_update_timestamp_users"
    BEFORE UPDATE ON "users"
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER "trigger_update_timestamp_devices"
    BEFORE UPDATE ON "devices"
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- 7. RLS 설정 (MVP용 비활성화)
-- 개발 단계에서 권한 오류 없이 DB에 접근하기 위해 RLS를 끕니다.
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "devices" DISABLE ROW LEVEL SECURITY;
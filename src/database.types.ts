// Supabase 타입 정의
// npm run generate:types 명령어로 자동 생성됩니다
// 
// 현재는 빈 타입으로 설정되어 있으며, Supabase 프로젝트 설정 후
// generate:types 스크립트를 실행하여 실제 타입을 생성하세요.

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
      users: {
        Row: {
          id: string;
          clerk_user_id: string;
          email: string | null;
          role: string | null;
          input_mode: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          email?: string | null;
          role?: string | null;
          input_mode?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          email?: string | null;
          role?: string | null;
          input_mode?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          icon_type: string;
          position_x: number;
          position_y: number;
          position_z: number;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          icon_type: string;
          position_x?: number;
          position_y?: number;
          position_z?: number;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          icon_type?: string;
          position_x?: number;
          position_y?: number;
          position_z?: number;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      routines: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          time_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          time_type: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          time_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_routines_user";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      routine_devices: {
        Row: {
          id: string;
          routine_id: string;
          device_id: string;
          target_state: boolean;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          routine_id: string;
          device_id: string;
          target_state: boolean;
          order_index: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          routine_id?: string;
          device_id?: string;
          target_state?: boolean;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_routine_devices_routine";
            columns: ["routine_id"];
            referencedRelation: "routines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_routine_devices_device";
            columns: ["device_id"];
            referencedRelation: "devices";
            referencedColumns: ["id"];
          }
        ];
      };
    }
    Views: {
      // 타입 생성 후 자동으로 채워집니다
    }
    Functions: {
      // 타입 생성 후 자동으로 채워집니다
    }
  }
}

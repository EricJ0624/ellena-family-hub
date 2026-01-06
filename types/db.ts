/**
 * Supabase Database Type Definitions
 * 
 * 이 파일은 Supabase 데이터베이스의 타입 정의를 포함합니다.
 * @supabase/supabase-js와 함께 사용하여 타입 안전성을 보장합니다.
 */

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
      groups: {
        Row: {
          id: string
          name: string
          invite_code: string
          owner_id: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code: string
          owner_id: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          owner_id?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      memberships: {
        Row: {
          user_id: string
          group_id: string
          role: 'ADMIN' | 'MEMBER'
          joined_at: string
        }
        Insert: {
          user_id: string
          group_id: string
          role?: 'ADMIN' | 'MEMBER'
          joined_at?: string
        }
        Update: {
          user_id?: string
          group_id?: string
          role?: 'ADMIN' | 'MEMBER'
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_group_id_fkey"
            columns: ["group_id"]
            referencedRelation: "groups"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          nickname: string | null
          avatar_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          nickname?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          nickname?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      location_requests: {
        Row: {
          id: string
          requester_id: string
          target_id: string
          status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
          created_at: string
          updated_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          target_id: string
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled'
          created_at?: string
          updated_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          target_id?: string
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled'
          created_at?: string
          updated_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_requests_requester_id_fkey"
            columns: ["requester_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_requests_target_id_fkey"
            columns: ["target_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_locations: {
        Row: {
          user_id: string
          latitude: number
          longitude: number
          address: string | null
          last_updated: string
          created_at: string
        }
        Insert: {
          user_id: string
          latitude: number
          longitude: number
          address?: string | null
          last_updated?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          latitude?: number
          longitude?: number
          address?: string | null
          last_updated?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      group_members_view: {
        Row: {
          group_id: string
          group_name: string
          invite_code: string
          owner_id: string
          group_avatar_url: string | null
          group_created_at: string
          user_id: string
          role: 'ADMIN' | 'MEMBER'
          joined_at: string
          email: string | null
          nickname: string | null
          user_avatar_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      join_group_by_invite_code: {
        Args: {
          invite_code_param: string
        }
        Returns: string
      }
      add_group_owner_as_admin: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      update_groups_updated_at_column: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
    }
    Enums: {
      membership_role: 'ADMIN' | 'MEMBER'
      location_request_status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// 타입 헬퍼
export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

// 그룹 관련 타입 별칭
export type Group = Database["public"]["Tables"]["groups"]["Row"]
export type GroupInsert = Database["public"]["Tables"]["groups"]["Insert"]
export type GroupUpdate = Database["public"]["Tables"]["groups"]["Update"]

export type Membership = Database["public"]["Tables"]["memberships"]["Row"]
export type MembershipInsert = Database["public"]["Tables"]["memberships"]["Insert"]
export type MembershipUpdate = Database["public"]["Tables"]["memberships"]["Update"]

export type GroupMemberView = Database["public"]["Views"]["group_members_view"]["Row"]

export type MembershipRole = Database["public"]["Enums"]["membership_role"]


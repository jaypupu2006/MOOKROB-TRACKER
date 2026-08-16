export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      notifications: {
        Row: {
          body: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["mookrob_status"] | null
          id: string
          read_at: string | null
          restaurant_id: string
          title: string
          to_status: Database["public"]["Enums"]["mookrob_status"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["mookrob_status"] | null
          id?: string
          read_at?: string | null
          restaurant_id: string
          title: string
          to_status: Database["public"]["Enums"]["mookrob_status"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["mookrob_status"] | null
          id?: string
          read_at?: string | null
          restaurant_id?: string
          title?: string
          to_status?: Database["public"]["Enums"]["mookrob_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          distance_meters: number | null
          id: string
          note: string | null
          reported_status: Database["public"]["Enums"]["mookrob_status"]
          restaurant_id: string
          user_id: string
          user_lat: number | null
          user_lng: number | null
        }
        Insert: {
          created_at?: string
          distance_meters?: number | null
          id?: string
          note?: string | null
          reported_status: Database["public"]["Enums"]["mookrob_status"]
          restaurant_id: string
          user_id: string
          user_lat?: number | null
          user_lng?: number | null
        }
        Update: {
          created_at?: string
          distance_meters?: number | null
          id?: string
          note?: string | null
          reported_status?: Database["public"]["Enums"]["mookrob_status"]
          restaurant_id?: string
          user_id?: string
          user_lat?: number | null
          user_lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_status: {
        Row: {
          confidence_score: number
          last_updated: string | null
          report_count: number
          restaurant_id: string
          status: Database["public"]["Enums"]["mookrob_status"]
        }
        Insert: {
          confidence_score?: number
          last_updated?: string | null
          report_count?: number
          restaurant_id: string
          status?: Database["public"]["Enums"]["mookrob_status"]
        }
        Update: {
          confidence_score?: number
          last_updated?: string | null
          report_count?: number
          restaurant_id?: string
          status?: Database["public"]["Enums"]["mookrob_status"]
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_status_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          area: string
          category: string
          close_time: string
          created_at: string
          geog: unknown
          hours_note: string | null
          id: string
          image_url: string | null
          latitude: number
          longitude: number
          name: string
          open_time: string
          price_max: number
          price_min: number
          rating: number
          slug: string
        }
        Insert: {
          address: string
          area: string
          category?: string
          close_time?: string
          created_at?: string
          geog?: unknown
          hours_note?: string | null
          id?: string
          image_url?: string | null
          latitude: number
          longitude: number
          name: string
          open_time?: string
          price_max?: number
          price_min?: number
          rating?: number
          slug: string
        }
        Update: {
          address?: string
          area?: string
          category?: string
          close_time?: string
          created_at?: string
          geog?: unknown
          hours_note?: string | null
          id?: string
          image_url?: string | null
          latitude?: number
          longitude?: number
          name?: string
          open_time?: string
          price_max?: number
          price_min?: number
          rating?: number
          slug?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          accurate_reports: number
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          id: string
          total_reports: number
          trust_score: number
          username: string
        }
        Insert: {
          accurate_reports?: number
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          total_reports?: number
          trust_score?: number
          username: string
        }
        Update: {
          accurate_reports?: number
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          total_reports?: number
          trust_score?: number
          username?: string
        }
        Relationships: []
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          notifications_enabled: boolean
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notifications_enabled?: boolean
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notifications_enabled?: boolean
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlists_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_trust_score: { Args: { _report_id: string }; Returns: undefined }
      business_day_start: { Args: { _open_time: string }; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      ensure_profile: {
        Args: { _username?: string }
        Returns: {
          accurate_reports: number
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          id: string
          total_reports: number
          trust_score: number
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_report_expired: {
        Args: { _created_at: string; _open_time: string }
        Returns: boolean
      }
      nearby_restaurants: {
        Args: {
          _lat: number
          _limit?: number
          _lng: number
          _radius_meters?: number
        }
        Returns: {
          address: string
          area: string
          category: string
          close_time: string
          confidence_score: number
          distance_meters: number
          hours_note: string
          id: string
          image_url: string
          last_updated: string
          latitude: number
          longitude: number
          name: string
          open_time: string
          price_max: number
          price_min: number
          rating: number
          report_count: number
          slug: string
          status: Database["public"]["Enums"]["mookrob_status"]
        }[]
      }
      recalc_restaurant_status: {
        Args: { _restaurant_id: string }
        Returns: undefined
      }
      report_weight: {
        Args: {
          _created_at: string
          _distance_meters: number
          _trust_score: number
        }
        Returns: number
      }
      reset_stale_restaurant_status: { Args: never; Returns: number }
      status_code: {
        Args: { _status: Database["public"]["Enums"]["mookrob_status"] }
        Returns: number
      }
    }
    Enums: {
      mookrob_status: "available" | "low" | "out" | "unknown"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      mookrob_status: ["available", "low", "out", "unknown"],
    },
  },
} as const

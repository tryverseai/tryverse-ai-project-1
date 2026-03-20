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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      allowed_domains: {
        Row: {
          api_key_id: string
          created_at: string
          domain: string
          id: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          domain: string
          id?: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          domain?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allowed_domains_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_value: string
          last_used_at: string | null
          name: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_value: string
          last_used_at?: string | null
          name?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_value?: string
          last_used_at?: string | null
          name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      early_access_requests: {
        Row: {
          biggest_challenge: string
          brand_name: string
          created_at: string
          customer_confidence: string
          email: string
          first_name: string
          heard_about: string | null
          id: string
          monthly_revenue: string
          must_have_features: Json
          platform: string
          prior_solution_notes: string | null
          product_range: string
          return_rate: string
          role: string
          timeline: string
          top_return_reason: string
          tried_solutions: Json
          website_url: string
        }
        Insert: {
          biggest_challenge: string
          brand_name: string
          created_at?: string
          customer_confidence: string
          email: string
          first_name: string
          heard_about?: string | null
          id?: string
          monthly_revenue: string
          must_have_features?: Json
          platform: string
          prior_solution_notes?: string | null
          product_range: string
          return_rate: string
          role: string
          timeline: string
          top_return_reason: string
          tried_solutions?: Json
          website_url: string
        }
        Update: {
          biggest_challenge?: string
          brand_name?: string
          created_at?: string
          customer_confidence?: string
          email?: string
          first_name?: string
          heard_about?: string | null
          id?: string
          monthly_revenue?: string
          must_have_features?: Json
          platform?: string
          prior_solution_notes?: string | null
          product_range?: string
          return_rate?: string
          role?: string
          timeline?: string
          top_return_reason?: string
          tried_solutions?: Json
          website_url?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          provider: string
          reference: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          provider?: string
          reference: string
          status: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          provider?: string
          reference?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_products: number
          name: string
          price_ngn: number
          price_usd: number
          tryons_per_month: number
        }
        Insert: {
          created_at?: string
          features?: Json
          id: string
          is_active?: boolean
          max_products?: number
          name: string
          price_ngn?: number
          price_usd?: number
          tryons_per_month?: number
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_products?: number
          name?: string
          price_ngn?: number
          price_usd?: number
          tryons_per_month?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          user_id: string
          name: string
          image_url: string | null
          category: string
          product_url: string | null
          tryons_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          image_url?: string | null
          category: string
          product_url?: string | null
          tryons_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          image_url?: string | null
          category?: string
          product_url?: string | null
          tryons_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          id: string
          name: string | null
          first_name: string | null
          last_name: string | null
          company_name: string | null
          email: string
          phone_number: string | null
          category: string
          subject: string
          message: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          name?: string | null
          first_name?: string | null
          last_name?: string | null
          company_name?: string | null
          email: string
          phone_number?: string | null
          category: string
          subject: string
          message: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          first_name?: string | null
          last_name?: string | null
          company_name?: string | null
          email?: string
          phone_number?: string | null
          category?: string
          subject?: string
          message?: string
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          brand_name: string
          compliance_onboarding_completed_at: string | null
          contact_email: string | null
          created_at: string
          current_plan_id: string | null
          free_credits_remaining: number
          free_credits_total: number
          full_name: string | null
          id: string
          is_blocked: boolean
          monthly_credits_remaining: number
          monthly_credits_total: number
          onboarding_goals: string[] | null
          role: string | null
          updated_at: string
          website_url: string | null
          widget_activated: boolean
          widget_auto_detect: boolean | null
          widget_collect_analytics: boolean | null
          widget_fit_recommendations: boolean | null
          widget_show_models: boolean | null
        }
        Insert: {
          brand_name?: string
          compliance_onboarding_completed_at?: string | null
          contact_email?: string | null
          created_at?: string
          current_plan_id?: string | null
          free_credits_remaining?: number
          free_credits_total?: number
          full_name?: string | null
          id: string
          is_blocked?: boolean
          monthly_credits_remaining?: number
          monthly_credits_total?: number
          onboarding_goals?: string[] | null
          role?: string | null
          updated_at?: string
          website_url?: string | null
          widget_activated?: boolean
          widget_auto_detect?: boolean | null
          widget_collect_analytics?: boolean | null
          widget_fit_recommendations?: boolean | null
          widget_show_models?: boolean | null
        }
        Update: {
          brand_name?: string
          compliance_onboarding_completed_at?: string | null
          contact_email?: string | null
          created_at?: string
          current_plan_id?: string | null
          free_credits_remaining?: number
          free_credits_total?: number
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          monthly_credits_remaining?: number
          monthly_credits_total?: number
          onboarding_goals?: string[] | null
          role?: string | null
          updated_at?: string
          website_url?: string | null
          widget_activated?: boolean
          widget_auto_detect?: boolean | null
          widget_collect_analytics?: boolean | null
          widget_fit_recommendations?: boolean | null
          widget_show_models?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          api_key_id: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          api_key_id?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          provider: string
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          provider?: string
          provider_subscription_id?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          provider?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tryons: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          id: string
          person_image: string
          product_image: string
          result_image: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          category: string
          completed_at?: string | null
          created_at?: string
          id?: string
          person_image: string
          product_image: string
          result_image?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          person_image?: string
          product_image?: string
          result_image?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tryons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_api_key: {
        Args: { p_name?: string }
        Returns: {
          created_at: string
          id: string
          key_value: string
          last_used_at: string | null
          name: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "api_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

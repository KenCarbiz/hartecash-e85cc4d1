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
      activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          performed_by: string | null
          submission_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          submission_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          preferred_date: string
          preferred_time: string
          status: string
          submission_token: string | null
          vehicle_info: string | null
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          preferred_date: string
          preferred_time: string
          status?: string
          submission_token?: string | null
          vehicle_info?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          preferred_date?: string
          preferred_time?: string
          status?: string
          submission_token?: string | null
          vehicle_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_submission_token_fkey"
            columns: ["submission_token"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["token"]
          },
        ]
      }
      consent_log: {
        Row: {
          consent_text: string
          consent_type: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          form_source: string
          id: string
          ip_address: string | null
          submission_token: string | null
          user_agent: string | null
        }
        Insert: {
          consent_text: string
          consent_type?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          form_source: string
          id?: string
          ip_address?: string | null
          submission_token?: string | null
          user_agent?: string | null
        }
        Update: {
          consent_text?: string
          consent_type?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          form_source?: string
          id?: string
          ip_address?: string | null
          submission_token?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      offer_rules: {
        Row: {
          adjustment_pct: number
          created_at: string
          criteria: Json
          dealership_id: string
          flag_in_dashboard: boolean
          id: string
          is_active: boolean
          name: string
          priority: number
          rule_type: string
        }
        Insert: {
          adjustment_pct?: number
          created_at?: string
          criteria?: Json
          dealership_id?: string
          flag_in_dashboard?: boolean
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          rule_type?: string
        }
        Update: {
          adjustment_pct?: number
          created_at?: string
          criteria?: Json
          dealership_id?: string
          flag_in_dashboard?: boolean
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          rule_type?: string
        }
        Relationships: []
      }
      offer_settings: {
        Row: {
          bb_value_basis: string
          created_at: string
          dealership_id: string
          deductions_config: Json
          global_adjustment_pct: number
          id: string
          updated_at: string
        }
        Insert: {
          bb_value_basis?: string
          created_at?: string
          dealership_id?: string
          deductions_config?: Json
          global_adjustment_pct?: number
          id?: string
          updated_at?: string
        }
        Update: {
          bb_value_basis?: string
          created_at?: string
          dealership_id?: string
          deductions_config?: Json
          global_adjustment_pct?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_admin_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone_number: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone_number?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone_number?: string | null
          user_id?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          accidents: string | null
          acv_value: number | null
          address_city: string | null
          address_state: string | null
          address_street: string | null
          appointment_date: string | null
          appointment_set: boolean
          appraised_by: string | null
          bb_tradein_avg: number | null
          bb_wholesale_avg: number | null
          check_request_done: boolean
          created_at: string
          docs_uploaded: boolean
          drivable: string | null
          drivetrain: string | null
          email: string | null
          engine_issues: string[] | null
          estimated_offer_high: number | null
          estimated_offer_low: number | null
          exterior_color: string | null
          exterior_damage: string[] | null
          id: string
          interior_damage: string[] | null
          internal_notes: string | null
          is_hot_lead: boolean
          lead_source: string
          loan_balance: string | null
          loan_company: string | null
          loan_payment: string | null
          loan_status: string | null
          matched_rule_ids: string[] | null
          mechanical_issues: string[] | null
          mileage: string | null
          modifications: string | null
          moonroof: string | null
          name: string | null
          next_step: string | null
          num_keys: string | null
          offered_price: number | null
          overall_condition: string | null
          phone: string | null
          photos_uploaded: boolean
          plate: string | null
          progress_status: string
          smoked_in: string | null
          state: string | null
          status_updated_at: string | null
          status_updated_by: string | null
          tech_issues: string[] | null
          tires_replaced: string | null
          token: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_year: string | null
          vin: string | null
          windshield_damage: string | null
          zip: string | null
        }
        Insert: {
          accidents?: string | null
          acv_value?: number | null
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          appointment_date?: string | null
          appointment_set?: boolean
          appraised_by?: string | null
          bb_tradein_avg?: number | null
          bb_wholesale_avg?: number | null
          check_request_done?: boolean
          created_at?: string
          docs_uploaded?: boolean
          drivable?: string | null
          drivetrain?: string | null
          email?: string | null
          engine_issues?: string[] | null
          estimated_offer_high?: number | null
          estimated_offer_low?: number | null
          exterior_color?: string | null
          exterior_damage?: string[] | null
          id?: string
          interior_damage?: string[] | null
          internal_notes?: string | null
          is_hot_lead?: boolean
          lead_source?: string
          loan_balance?: string | null
          loan_company?: string | null
          loan_payment?: string | null
          loan_status?: string | null
          matched_rule_ids?: string[] | null
          mechanical_issues?: string[] | null
          mileage?: string | null
          modifications?: string | null
          moonroof?: string | null
          name?: string | null
          next_step?: string | null
          num_keys?: string | null
          offered_price?: number | null
          overall_condition?: string | null
          phone?: string | null
          photos_uploaded?: boolean
          plate?: string | null
          progress_status?: string
          smoked_in?: string | null
          state?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          tech_issues?: string[] | null
          tires_replaced?: string | null
          token?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: string | null
          vin?: string | null
          windshield_damage?: string | null
          zip?: string | null
        }
        Update: {
          accidents?: string | null
          acv_value?: number | null
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          appointment_date?: string | null
          appointment_set?: boolean
          appraised_by?: string | null
          bb_tradein_avg?: number | null
          bb_wholesale_avg?: number | null
          check_request_done?: boolean
          created_at?: string
          docs_uploaded?: boolean
          drivable?: string | null
          drivetrain?: string | null
          email?: string | null
          engine_issues?: string[] | null
          estimated_offer_high?: number | null
          estimated_offer_low?: number | null
          exterior_color?: string | null
          exterior_damage?: string[] | null
          id?: string
          interior_damage?: string[] | null
          internal_notes?: string | null
          is_hot_lead?: boolean
          lead_source?: string
          loan_balance?: string | null
          loan_company?: string | null
          loan_payment?: string | null
          loan_status?: string | null
          matched_rule_ids?: string[] | null
          mechanical_issues?: string[] | null
          mileage?: string | null
          modifications?: string | null
          moonroof?: string | null
          name?: string | null
          next_step?: string | null
          num_keys?: string | null
          offered_price?: number | null
          overall_condition?: string | null
          phone?: string | null
          photos_uploaded?: boolean
          plate?: string | null
          progress_status?: string
          smoked_in?: string | null
          state?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          tech_issues?: string[] | null
          tires_replaced?: string | null
          token?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: string | null
          vin?: string | null
          windshield_damage?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_staff: {
        Args: never
        Returns: {
          display_name: string
          email: string
          phone_number: string
          role: string
          role_id: string
          user_id: string
        }[]
      }
      get_submission_by_token: {
        Args: { _token: string }
        Returns: {
          id: string
          name: string
          photos_uploaded: boolean
          vehicle_make: string
          vehicle_model: string
          vehicle_year: string
        }[]
      }
      get_submission_portal: {
        Args: { _token: string }
        Returns: {
          acv_value: number
          bb_tradein_avg: number
          created_at: string
          docs_uploaded: boolean
          email: string
          estimated_offer_high: number
          estimated_offer_low: number
          exterior_color: string
          id: string
          loan_status: string
          mileage: string
          name: string
          offered_price: number
          overall_condition: string
          phone: string
          photos_uploaded: boolean
          progress_status: string
          token: string
          vehicle_make: string
          vehicle_model: string
          vehicle_year: string
          vin: string
          zip: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      lookup_submission_by_contact: {
        Args: { _email: string; _phone: string }
        Returns: {
          name: string
          token: string
          vehicle_make: string
          vehicle_model: string
          vehicle_year: string
        }[]
      }
      mark_docs_uploaded: { Args: { _token: string }; Returns: undefined }
      mark_photos_uploaded: { Args: { _token: string }; Returns: undefined }
      remove_staff_role: { Args: { _role_id: string }; Returns: undefined }
      update_staff_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _role_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "sales_bdc" | "used_car_manager" | "gsm_gm"
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
      app_role: ["admin", "user", "sales_bdc", "used_car_manager", "gsm_gm"],
    },
  },
} as const

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
          store_location: string | null
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
          store_location?: string | null
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
          store_location?: string | null
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
      dealership_locations: {
        Row: {
          address: string | null
          city: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          show_in_footer: boolean
          show_in_scheduling: boolean
          sort_order: number
          state: string
        }
        Insert: {
          address?: string | null
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          show_in_footer?: boolean
          show_in_scheduling?: boolean
          sort_order?: number
          state?: string
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          show_in_footer?: boolean
          show_in_scheduling?: boolean
          sort_order?: number
          state?: string
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          status: string
          submission_id: string
          touch_number: number
          triggered_by: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          submission_id: string
          touch_number: number
          triggered_by?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          submission_id?: string
          touch_number?: number
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_config: {
        Row: {
          created_at: string
          dealership_id: string
          id: string
          q_accidents: boolean
          q_drivable: boolean
          q_drivetrain: boolean
          q_engine_issues: boolean
          q_exterior_color: boolean
          q_exterior_damage: boolean
          q_interior_damage: boolean
          q_loan_details: boolean
          q_mechanical_issues: boolean
          q_modifications: boolean
          q_moonroof: boolean
          q_next_step: boolean
          q_num_keys: boolean
          q_overall_condition: boolean
          q_smoked_in: boolean
          q_tech_issues: boolean
          q_tires_replaced: boolean
          q_windshield_damage: boolean
          step_condition_history: boolean
          step_vehicle_build: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          dealership_id?: string
          id?: string
          q_accidents?: boolean
          q_drivable?: boolean
          q_drivetrain?: boolean
          q_engine_issues?: boolean
          q_exterior_color?: boolean
          q_exterior_damage?: boolean
          q_interior_damage?: boolean
          q_loan_details?: boolean
          q_mechanical_issues?: boolean
          q_modifications?: boolean
          q_moonroof?: boolean
          q_next_step?: boolean
          q_num_keys?: boolean
          q_overall_condition?: boolean
          q_smoked_in?: boolean
          q_tech_issues?: boolean
          q_tires_replaced?: boolean
          q_windshield_damage?: boolean
          step_condition_history?: boolean
          step_vehicle_build?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          dealership_id?: string
          id?: string
          q_accidents?: boolean
          q_drivable?: boolean
          q_drivetrain?: boolean
          q_engine_issues?: boolean
          q_exterior_color?: boolean
          q_exterior_damage?: boolean
          q_interior_damage?: boolean
          q_loan_details?: boolean
          q_mechanical_issues?: boolean
          q_modifications?: boolean
          q_moonroof?: boolean
          q_next_step?: boolean
          q_num_keys?: boolean
          q_overall_condition?: boolean
          q_smoked_in?: boolean
          q_tech_issues?: boolean
          q_tires_replaced?: boolean
          q_windshield_damage?: boolean
          step_condition_history?: boolean
          step_vehicle_build?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      lookup_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_hash: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_hash: string
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          appointment_channels: string[]
          created_at: string
          customer_appointment_channels: string[]
          customer_appointment_reminder_channels: string[]
          customer_appointment_rescheduled_channels: string[]
          customer_offer_accepted_channels: string[]
          customer_offer_ready_channels: string[]
          dealership_id: string
          docs_uploaded_channels: string[]
          email_recipients: string[]
          hot_lead_channels: string[]
          id: string
          new_submission_channels: string[]
          notify_appointment_booked: boolean
          notify_customer_appointment_booked: boolean
          notify_customer_appointment_reminder: boolean
          notify_customer_appointment_rescheduled: boolean
          notify_customer_offer_accepted: boolean
          notify_customer_offer_ready: boolean
          notify_docs_uploaded: boolean
          notify_hot_lead: boolean
          notify_new_submission: boolean
          notify_photos_uploaded: boolean
          notify_staff_customer_accepted: boolean
          notify_staff_deal_completed: boolean
          notify_status_change: boolean
          photos_uploaded_channels: string[]
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          sms_recipients: string[]
          staff_customer_accepted_channels: string[]
          staff_deal_completed_channels: string[]
          status_change_channels: string[]
          updated_at: string
        }
        Insert: {
          appointment_channels?: string[]
          created_at?: string
          customer_appointment_channels?: string[]
          customer_appointment_reminder_channels?: string[]
          customer_appointment_rescheduled_channels?: string[]
          customer_offer_accepted_channels?: string[]
          customer_offer_ready_channels?: string[]
          dealership_id?: string
          docs_uploaded_channels?: string[]
          email_recipients?: string[]
          hot_lead_channels?: string[]
          id?: string
          new_submission_channels?: string[]
          notify_appointment_booked?: boolean
          notify_customer_appointment_booked?: boolean
          notify_customer_appointment_reminder?: boolean
          notify_customer_appointment_rescheduled?: boolean
          notify_customer_offer_accepted?: boolean
          notify_customer_offer_ready?: boolean
          notify_docs_uploaded?: boolean
          notify_hot_lead?: boolean
          notify_new_submission?: boolean
          notify_photos_uploaded?: boolean
          notify_staff_customer_accepted?: boolean
          notify_staff_deal_completed?: boolean
          notify_status_change?: boolean
          photos_uploaded_channels?: string[]
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sms_recipients?: string[]
          staff_customer_accepted_channels?: string[]
          staff_deal_completed_channels?: string[]
          status_change_channels?: string[]
          updated_at?: string
        }
        Update: {
          appointment_channels?: string[]
          created_at?: string
          customer_appointment_channels?: string[]
          customer_appointment_reminder_channels?: string[]
          customer_appointment_rescheduled_channels?: string[]
          customer_offer_accepted_channels?: string[]
          customer_offer_ready_channels?: string[]
          dealership_id?: string
          docs_uploaded_channels?: string[]
          email_recipients?: string[]
          hot_lead_channels?: string[]
          id?: string
          new_submission_channels?: string[]
          notify_appointment_booked?: boolean
          notify_customer_appointment_booked?: boolean
          notify_customer_appointment_reminder?: boolean
          notify_customer_appointment_rescheduled?: boolean
          notify_customer_offer_accepted?: boolean
          notify_customer_offer_ready?: boolean
          notify_docs_uploaded?: boolean
          notify_hot_lead?: boolean
          notify_new_submission?: boolean
          notify_photos_uploaded?: boolean
          notify_staff_customer_accepted?: boolean
          notify_staff_deal_completed?: boolean
          notify_status_change?: boolean
          photos_uploaded_channels?: string[]
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sms_recipients?: string[]
          staff_customer_accepted_channels?: string[]
          staff_deal_completed_channels?: string[]
          status_change_channels?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      offer_rules: {
        Row: {
          adjustment_pct: number
          adjustment_type: string
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
          adjustment_type?: string
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
          adjustment_type?: string
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
          age_tiers: Json
          bb_value_basis: string
          condition_multipliers: Json
          created_at: string
          dealership_id: string
          deduction_amounts: Json
          deductions_config: Json
          global_adjustment_pct: number
          id: string
          mileage_tiers: Json
          offer_ceiling: number | null
          offer_floor: number
          recon_cost: number
          updated_at: string
        }
        Insert: {
          age_tiers?: Json
          bb_value_basis?: string
          condition_multipliers?: Json
          created_at?: string
          dealership_id?: string
          deduction_amounts?: Json
          deductions_config?: Json
          global_adjustment_pct?: number
          id?: string
          mileage_tiers?: Json
          offer_ceiling?: number | null
          offer_floor?: number
          recon_cost?: number
          updated_at?: string
        }
        Update: {
          age_tiers?: Json
          bb_value_basis?: string
          condition_multipliers?: Json
          created_at?: string
          dealership_id?: string
          deduction_amounts?: Json
          deductions_config?: Json
          global_adjustment_pct?: number
          id?: string
          mileage_tiers?: Json
          offer_ceiling?: number | null
          offer_floor?: number
          recon_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      opt_outs: {
        Row: {
          channel: string
          created_at: string
          email: string | null
          id: string
          phone: string | null
          submission_id: string | null
          token: string
        }
        Insert: {
          channel?: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          submission_id?: string | null
          token: string
        }
        Update: {
          channel?: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          submission_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "opt_outs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
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
          profile_image_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone_number?: string | null
          profile_image_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone_number?: string | null
          profile_image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      site_config: {
        Row: {
          accent_color: string
          address: string | null
          comparison_features: Json
          competitor_columns: Json
          created_at: string
          dealership_id: string
          dealership_name: string
          email: string | null
          enable_animations: boolean
          favicon_url: string | null
          hero_headline: string
          hero_subtext: string
          id: string
          logo_url: string | null
          logo_white_url: string | null
          phone: string | null
          price_guarantee_days: number
          primary_color: string
          review_request_message: string
          review_request_subject: string
          stats_cars_purchased: string | null
          stats_rating: string | null
          stats_reviews_count: string | null
          stats_years_in_business: string | null
          success_color: string
          tagline: string
          updated_at: string
          use_animated_calculating: boolean
          website_url: string | null
        }
        Insert: {
          accent_color?: string
          address?: string | null
          comparison_features?: Json
          competitor_columns?: Json
          created_at?: string
          dealership_id?: string
          dealership_name?: string
          email?: string | null
          enable_animations?: boolean
          favicon_url?: string | null
          hero_headline?: string
          hero_subtext?: string
          id?: string
          logo_url?: string | null
          logo_white_url?: string | null
          phone?: string | null
          price_guarantee_days?: number
          primary_color?: string
          review_request_message?: string
          review_request_subject?: string
          stats_cars_purchased?: string | null
          stats_rating?: string | null
          stats_reviews_count?: string | null
          stats_years_in_business?: string | null
          success_color?: string
          tagline?: string
          updated_at?: string
          use_animated_calculating?: boolean
          website_url?: string | null
        }
        Update: {
          accent_color?: string
          address?: string | null
          comparison_features?: Json
          competitor_columns?: Json
          created_at?: string
          dealership_id?: string
          dealership_name?: string
          email?: string | null
          enable_animations?: boolean
          favicon_url?: string | null
          hero_headline?: string
          hero_subtext?: string
          id?: string
          logo_url?: string | null
          logo_white_url?: string | null
          phone?: string | null
          price_guarantee_days?: number
          primary_color?: string
          review_request_message?: string
          review_request_subject?: string
          stats_cars_purchased?: string | null
          stats_rating?: string | null
          stats_reviews_count?: string | null
          stats_years_in_business?: string | null
          success_color?: string
          tagline?: string
          updated_at?: string
          use_animated_calculating?: boolean
          website_url?: string | null
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
          review_requested: boolean
          review_requested_at: string | null
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
          review_requested?: boolean
          review_requested_at?: string | null
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
          review_requested?: boolean
          review_requested_at?: string | null
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
      testimonials: {
        Row: {
          author_name: string
          created_at: string
          id: string
          is_active: boolean
          location: string
          rating: number
          review_text: string
          sort_order: number
          updated_at: string
          vehicle: string | null
        }
        Insert: {
          author_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string
          rating?: number
          review_text: string
          sort_order?: number
          updated_at?: string
          vehicle?: string | null
        }
        Update: {
          author_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string
          rating?: number
          review_text?: string
          sort_order?: number
          updated_at?: string
          vehicle?: string | null
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
      vehicle_image_cache: {
        Row: {
          cache_key: string
          created_at: string
          exterior_color: string
          id: string
          storage_path: string
          vehicle_make: string
          vehicle_model: string
          vehicle_style: string | null
          vehicle_year: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          exterior_color?: string
          id?: string
          storage_path: string
          vehicle_make: string
          vehicle_model: string
          vehicle_style?: string | null
          vehicle_year: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          exterior_color?: string
          id?: string
          storage_path?: string
          vehicle_make?: string
          vehicle_model?: string
          vehicle_style?: string | null
          vehicle_year?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_offer: { Args: { _token: string }; Returns: undefined }
      cleanup_old_lookup_attempts: { Args: never; Returns: undefined }
      get_all_staff: {
        Args: never
        Returns: {
          display_name: string
          email: string
          phone_number: string
          profile_image_url: string
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
          appointment_set: boolean
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

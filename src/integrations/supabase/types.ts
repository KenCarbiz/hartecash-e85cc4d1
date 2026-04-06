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
          dealership_id: string
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
          dealership_id?: string
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
          dealership_id?: string
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
      changelog_entries: {
        Row: {
          created_at: string
          dealership_id: string
          description: string
          entry_date: string
          icon: string
          id: string
          is_active: boolean
          items: string[]
          sort_order: number
          tag: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dealership_id?: string
          description?: string
          entry_date?: string
          icon?: string
          id?: string
          is_active?: boolean
          items?: string[]
          sort_order?: number
          tag?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dealership_id?: string
          description?: string
          entry_date?: string
          icon?: string
          id?: string
          is_active?: boolean
          items?: string[]
          sort_order?: number
          tag?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      consent_log: {
        Row: {
          consent_text: string
          consent_type: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          dealership_id: string
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
          dealership_id?: string
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
          dealership_id?: string
          form_source?: string
          id?: string
          ip_address?: string | null
          submission_token?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      damage_reports: {
        Row: {
          ai_model: string
          confidence_score: number
          created_at: string
          damage_detected: boolean
          damage_items: Json
          dealership_id: string
          id: string
          overall_severity: string
          photo_category: string
          photo_path: string
          raw_response: Json | null
          submission_id: string
          suggested_condition: string | null
        }
        Insert: {
          ai_model?: string
          confidence_score?: number
          created_at?: string
          damage_detected?: boolean
          damage_items?: Json
          dealership_id?: string
          id?: string
          overall_severity?: string
          photo_category: string
          photo_path: string
          raw_response?: Json | null
          submission_id: string
          suggested_condition?: string | null
        }
        Update: {
          ai_model?: string
          confidence_score?: number
          created_at?: string
          damage_detected?: boolean
          damage_items?: Json
          dealership_id?: string
          id?: string
          overall_severity?: string
          photo_category?: string
          photo_path?: string
          raw_response?: Json | null
          submission_id?: string
          suggested_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_reports_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_accounts: {
        Row: {
          architecture: string
          bdc_model: string
          billing_date: number | null
          created_at: string
          dealership_id: string
          id: string
          onboarded_by: string | null
          onboarding_answers: Json | null
          onboarding_signature_dealer: string | null
          onboarding_signature_staff: string | null
          onboarding_signed_at: string | null
          onboarding_status: string
          plan_cost: number
          plan_tier: string
          special_instructions: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          architecture?: string
          bdc_model?: string
          billing_date?: number | null
          created_at?: string
          dealership_id?: string
          id?: string
          onboarded_by?: string | null
          onboarding_answers?: Json | null
          onboarding_signature_dealer?: string | null
          onboarding_signature_staff?: string | null
          onboarding_signed_at?: string | null
          onboarding_status?: string
          plan_cost?: number
          plan_tier?: string
          special_instructions?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          architecture?: string
          bdc_model?: string
          billing_date?: number | null
          created_at?: string
          dealership_id?: string
          id?: string
          onboarded_by?: string | null
          onboarding_answers?: Json | null
          onboarding_signature_dealer?: string | null
          onboarding_signature_staff?: string | null
          onboarding_signed_at?: string | null
          onboarding_status?: string
          plan_cost?: number
          plan_tier?: string
          special_instructions?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dealership_locations: {
        Row: {
          address: string | null
          all_brands: boolean
          center_zip: string | null
          city: string
          corporate_logo_dark_url: string | null
          corporate_logo_url: string | null
          coverage_radius_miles: number | null
          created_at: string
          dealership_id: string
          excluded_oem_brands: string[]
          id: string
          is_active: boolean
          logo_layout: string
          name: string
          oem_brands: string[]
          oem_logo_urls: string[]
          show_corporate_logo: boolean
          show_corporate_on_landing_only: boolean
          show_in_footer: boolean
          show_in_scheduling: boolean
          sort_order: number
          state: string
          temporarily_offline: boolean
          use_bdc: boolean
          zip_codes: string[]
        }
        Insert: {
          address?: string | null
          all_brands?: boolean
          center_zip?: string | null
          city: string
          corporate_logo_dark_url?: string | null
          corporate_logo_url?: string | null
          coverage_radius_miles?: number | null
          created_at?: string
          dealership_id?: string
          excluded_oem_brands?: string[]
          id?: string
          is_active?: boolean
          logo_layout?: string
          name: string
          oem_brands?: string[]
          oem_logo_urls?: string[]
          show_corporate_logo?: boolean
          show_corporate_on_landing_only?: boolean
          show_in_footer?: boolean
          show_in_scheduling?: boolean
          sort_order?: number
          state?: string
          temporarily_offline?: boolean
          use_bdc?: boolean
          zip_codes?: string[]
        }
        Update: {
          address?: string | null
          all_brands?: boolean
          center_zip?: string | null
          city?: string
          corporate_logo_dark_url?: string | null
          corporate_logo_url?: string | null
          coverage_radius_miles?: number | null
          created_at?: string
          dealership_id?: string
          excluded_oem_brands?: string[]
          id?: string
          is_active?: boolean
          logo_layout?: string
          name?: string
          oem_brands?: string[]
          oem_logo_urls?: string[]
          show_corporate_logo?: boolean
          show_corporate_on_landing_only?: boolean
          show_in_footer?: boolean
          show_in_scheduling?: boolean
          sort_order?: number
          state?: string
          temporarily_offline?: boolean
          use_bdc?: boolean
          zip_codes?: string[]
        }
        Relationships: []
      }
      depth_policies: {
        Row: {
          all_brands: boolean
          created_at: string
          dealership_id: string
          id: string
          is_active: boolean
          max_mileage: number | null
          max_vehicle_age_years: number | null
          min_brake_depth: number
          min_tire_depth: number
          name: string
          oem_brands: string[]
          policy_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          all_brands?: boolean
          created_at?: string
          dealership_id?: string
          id?: string
          is_active?: boolean
          max_mileage?: number | null
          max_vehicle_age_years?: number | null
          min_brake_depth?: number
          min_tire_depth?: number
          name: string
          oem_brands?: string[]
          policy_type?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          all_brands?: boolean
          created_at?: string
          dealership_id?: string
          id?: string
          is_active?: boolean
          max_mileage?: number | null
          max_vehicle_age_years?: number | null
          min_brake_depth?: number
          min_tire_depth?: number
          name?: string
          oem_brands?: string[]
          policy_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          channel: string
          created_at: string
          dealership_id: string
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
          dealership_id?: string
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
          dealership_id?: string
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
          offer_before_details: boolean
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
          offer_before_details?: boolean
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
          offer_before_details?: boolean
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
      inspection_config: {
        Row: {
          created_at: string
          custom_items: Json
          dealership_id: string
          default_inspection_mode: string
          disabled_fields: Json
          enable_tire_adjustments: boolean
          id: string
          require_notes: Json
          require_photos: Json
          section_electrical: boolean
          section_exterior: boolean
          section_glass: boolean
          section_interior: boolean
          section_measurements: boolean
          section_mechanical: boolean
          section_order: Json
          section_tires: boolean
          show_battery_health: boolean
          show_brake_pad_measurements: boolean
          show_oil_life: boolean
          show_paint_readings: boolean
          show_tire_tread_depth: boolean
          tire_adjustment_mode: string
          tire_credit_per_32: number
          tire_credit_threshold: number
          tire_deduct_per_32: number
          tire_deduct_threshold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_items?: Json
          dealership_id?: string
          default_inspection_mode?: string
          disabled_fields?: Json
          enable_tire_adjustments?: boolean
          id?: string
          require_notes?: Json
          require_photos?: Json
          section_electrical?: boolean
          section_exterior?: boolean
          section_glass?: boolean
          section_interior?: boolean
          section_measurements?: boolean
          section_mechanical?: boolean
          section_order?: Json
          section_tires?: boolean
          show_battery_health?: boolean
          show_brake_pad_measurements?: boolean
          show_oil_life?: boolean
          show_paint_readings?: boolean
          show_tire_tread_depth?: boolean
          tire_adjustment_mode?: string
          tire_credit_per_32?: number
          tire_credit_threshold?: number
          tire_deduct_per_32?: number
          tire_deduct_threshold?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_items?: Json
          dealership_id?: string
          default_inspection_mode?: string
          disabled_fields?: Json
          enable_tire_adjustments?: boolean
          id?: string
          require_notes?: Json
          require_photos?: Json
          section_electrical?: boolean
          section_exterior?: boolean
          section_glass?: boolean
          section_interior?: boolean
          section_measurements?: boolean
          section_mechanical?: boolean
          section_order?: Json
          section_tires?: boolean
          show_battery_health?: boolean
          show_brake_pad_measurements?: boolean
          show_oil_life?: boolean
          show_paint_readings?: boolean
          show_tire_tread_depth?: boolean
          tire_adjustment_mode?: string
          tire_credit_per_32?: number
          tire_credit_threshold?: number
          tire_deduct_per_32?: number
          tire_deduct_threshold?: number
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
      notification_log: {
        Row: {
          channel: string
          created_at: string
          dealership_id: string
          error_message: string | null
          id: string
          recipient: string
          status: string
          submission_id: string | null
          trigger_key: string
        }
        Insert: {
          channel: string
          created_at?: string
          dealership_id?: string
          error_message?: string | null
          id?: string
          recipient: string
          status?: string
          submission_id?: string | null
          trigger_key: string
        }
        Update: {
          channel?: string
          created_at?: string
          dealership_id?: string
          error_message?: string | null
          id?: string
          recipient?: string
          status?: string
          submission_id?: string | null
          trigger_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          abandoned_lead_channels: string[]
          appointment_channels: string[]
          created_at: string
          customer_appointment_channels: string[]
          customer_appointment_reminder_channels: string[]
          customer_appointment_rescheduled_channels: string[]
          customer_offer_accepted_channels: string[]
          customer_offer_increased_channels: string[]
          customer_offer_ready_channels: string[]
          dealership_id: string
          docs_uploaded_channels: string[]
          email_recipients: string[]
          hot_lead_channels: string[]
          id: string
          new_submission_channels: string[]
          notify_abandoned_lead: boolean
          notify_appointment_booked: boolean
          notify_customer_appointment_booked: boolean
          notify_customer_appointment_reminder: boolean
          notify_customer_appointment_rescheduled: boolean
          notify_customer_offer_accepted: boolean
          notify_customer_offer_increased: boolean
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
          staff_trigger_recipients: Json
          status_change_channels: string[]
          updated_at: string
        }
        Insert: {
          abandoned_lead_channels?: string[]
          appointment_channels?: string[]
          created_at?: string
          customer_appointment_channels?: string[]
          customer_appointment_reminder_channels?: string[]
          customer_appointment_rescheduled_channels?: string[]
          customer_offer_accepted_channels?: string[]
          customer_offer_increased_channels?: string[]
          customer_offer_ready_channels?: string[]
          dealership_id?: string
          docs_uploaded_channels?: string[]
          email_recipients?: string[]
          hot_lead_channels?: string[]
          id?: string
          new_submission_channels?: string[]
          notify_abandoned_lead?: boolean
          notify_appointment_booked?: boolean
          notify_customer_appointment_booked?: boolean
          notify_customer_appointment_reminder?: boolean
          notify_customer_appointment_rescheduled?: boolean
          notify_customer_offer_accepted?: boolean
          notify_customer_offer_increased?: boolean
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
          staff_trigger_recipients?: Json
          status_change_channels?: string[]
          updated_at?: string
        }
        Update: {
          abandoned_lead_channels?: string[]
          appointment_channels?: string[]
          created_at?: string
          customer_appointment_channels?: string[]
          customer_appointment_reminder_channels?: string[]
          customer_appointment_rescheduled_channels?: string[]
          customer_offer_accepted_channels?: string[]
          customer_offer_increased_channels?: string[]
          customer_offer_ready_channels?: string[]
          dealership_id?: string
          docs_uploaded_channels?: string[]
          email_recipients?: string[]
          hot_lead_channels?: string[]
          id?: string
          new_submission_channels?: string[]
          notify_abandoned_lead?: boolean
          notify_appointment_booked?: boolean
          notify_customer_appointment_booked?: boolean
          notify_customer_appointment_reminder?: boolean
          notify_customer_appointment_rescheduled?: boolean
          notify_customer_offer_accepted?: boolean
          notify_customer_offer_increased?: boolean
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
          staff_trigger_recipients?: Json
          status_change_channels?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          dealership_id: string
          id: string
          subject: string | null
          trigger_key: string
          updated_at: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          dealership_id?: string
          id?: string
          subject?: string | null
          trigger_key: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          dealership_id?: string
          id?: string
          subject?: string | null
          trigger_key?: string
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
          color_desirability: Json
          condition_basis_map: Json
          condition_equipment_map: Json
          condition_multipliers: Json
          created_at: string
          dealer_pack: number
          dealership_id: string
          deduction_amounts: Json
          deduction_modes: Json
          deductions_config: Json
          global_adjustment_pct: number
          hide_pack_from_appraisal: boolean
          high_mileage_penalty: Json
          id: string
          low_mileage_bonus: Json
          mileage_tiers: Json
          offer_ceiling: number | null
          offer_floor: number
          recon_cost: number
          regional_adjustment_pct: number
          retail_profit_basis: string
          retail_search_radius: number
          seasonal_adjustment: Json
          updated_at: string
        }
        Insert: {
          age_tiers?: Json
          bb_value_basis?: string
          color_desirability?: Json
          condition_basis_map?: Json
          condition_equipment_map?: Json
          condition_multipliers?: Json
          created_at?: string
          dealer_pack?: number
          dealership_id?: string
          deduction_amounts?: Json
          deduction_modes?: Json
          deductions_config?: Json
          global_adjustment_pct?: number
          hide_pack_from_appraisal?: boolean
          high_mileage_penalty?: Json
          id?: string
          low_mileage_bonus?: Json
          mileage_tiers?: Json
          offer_ceiling?: number | null
          offer_floor?: number
          recon_cost?: number
          regional_adjustment_pct?: number
          retail_profit_basis?: string
          retail_search_radius?: number
          seasonal_adjustment?: Json
          updated_at?: string
        }
        Update: {
          age_tiers?: Json
          bb_value_basis?: string
          color_desirability?: Json
          condition_basis_map?: Json
          condition_equipment_map?: Json
          condition_multipliers?: Json
          created_at?: string
          dealer_pack?: number
          dealership_id?: string
          deduction_amounts?: Json
          deduction_modes?: Json
          deductions_config?: Json
          global_adjustment_pct?: number
          hide_pack_from_appraisal?: boolean
          high_mileage_penalty?: Json
          id?: string
          low_mileage_bonus?: Json
          mileage_tiers?: Json
          offer_ceiling?: number | null
          offer_floor?: number
          recon_cost?: number
          regional_adjustment_pct?: number
          retail_profit_basis?: string
          retail_search_radius?: number
          seasonal_adjustment?: Json
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
      permission_access_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          requested_group_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          requested_group_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          requested_group_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_access_requests_requested_group_id_fkey"
            columns: ["requested_group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_groups: {
        Row: {
          allowed_sections: string[]
          created_at: string
          description: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          allowed_sections?: string[]
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          allowed_sections?: string[]
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      photo_config: {
        Row: {
          created_at: string
          dealership_id: string
          description: string
          id: string
          is_enabled: boolean
          is_required: boolean
          label: string
          orientation: string
          shot_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dealership_id?: string
          description?: string
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          label: string
          orientation?: string
          shot_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dealership_id?: string
          description?: string
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          label?: string
          orientation?: string
          shot_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_model_access_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      pricing_models: {
        Row: {
          age_tiers: Json
          bb_value_basis: string
          color_desirability: Json
          condition_basis_map: Json
          condition_equipment_map: Json
          condition_multipliers: Json
          created_at: string
          created_by: string | null
          dealership_id: string
          deduction_amounts: Json
          deduction_modes: Json
          deductions_config: Json
          description: string
          global_adjustment_pct: number
          high_mileage_penalty: Json
          id: string
          is_active: boolean
          is_default: boolean
          low_mileage_bonus: Json
          mileage_tiers: Json
          name: string
          offer_ceiling: number | null
          offer_floor: number
          priority: number
          recon_cost: number
          regional_adjustment_pct: number
          schedule_end: string | null
          schedule_start: string | null
          seasonal_adjustment: Json
          updated_at: string
        }
        Insert: {
          age_tiers?: Json
          bb_value_basis?: string
          color_desirability?: Json
          condition_basis_map?: Json
          condition_equipment_map?: Json
          condition_multipliers?: Json
          created_at?: string
          created_by?: string | null
          dealership_id?: string
          deduction_amounts?: Json
          deduction_modes?: Json
          deductions_config?: Json
          description?: string
          global_adjustment_pct?: number
          high_mileage_penalty?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          low_mileage_bonus?: Json
          mileage_tiers?: Json
          name: string
          offer_ceiling?: number | null
          offer_floor?: number
          priority?: number
          recon_cost?: number
          regional_adjustment_pct?: number
          schedule_end?: string | null
          schedule_start?: string | null
          seasonal_adjustment?: Json
          updated_at?: string
        }
        Update: {
          age_tiers?: Json
          bb_value_basis?: string
          color_desirability?: Json
          condition_basis_map?: Json
          condition_equipment_map?: Json
          condition_multipliers?: Json
          created_at?: string
          created_by?: string | null
          dealership_id?: string
          deduction_amounts?: Json
          deduction_modes?: Json
          deductions_config?: Json
          description?: string
          global_adjustment_pct?: number
          high_mileage_penalty?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          low_mileage_bonus?: Json
          mileage_tiers?: Json
          name?: string
          offer_ceiling?: number | null
          offer_floor?: number
          priority?: number
          recon_cost?: number
          regional_adjustment_pct?: number
          schedule_end?: string | null
          schedule_start?: string | null
          seasonal_adjustment?: Json
          updated_at?: string
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
      promotions: {
        Row: {
          bonus_amount: number
          created_at: string
          dealership_id: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          show_on_portal: boolean
          show_on_widget: boolean
          starts_at: string
          updated_at: string
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          dealership_id?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          show_on_portal?: boolean
          show_on_widget?: boolean
          starts_at?: string
          updated_at?: string
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          dealership_id?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          show_on_portal?: boolean
          show_on_widget?: boolean
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          dealership_id: string
          id: string
          notes: string | null
          referral_code: string
          referred_by_staff: string | null
          referred_name: string | null
          referred_submission_id: string | null
          referrer_email: string | null
          referrer_name: string | null
          referrer_phone: string | null
          referrer_token: string | null
          reward_amount: number | null
          reward_type: string | null
          rewarded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          dealership_id?: string
          id?: string
          notes?: string | null
          referral_code: string
          referred_by_staff?: string | null
          referred_name?: string | null
          referred_submission_id?: string | null
          referrer_email?: string | null
          referrer_name?: string | null
          referrer_phone?: string | null
          referrer_token?: string | null
          reward_amount?: number | null
          reward_type?: string | null
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          dealership_id?: string
          id?: string
          notes?: string | null
          referral_code?: string
          referred_by_staff?: string | null
          referred_name?: string | null
          referred_submission_id?: string | null
          referrer_email?: string | null
          referrer_name?: string | null
          referrer_phone?: string | null
          referrer_token?: string | null
          reward_amount?: number | null
          reward_type?: string | null
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_submission_id_fkey"
            columns: ["referred_submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_config: {
        Row: {
          about_hero_headline: string
          about_hero_subtext: string
          about_milestones: Json
          about_story: string
          about_values: Json
          accent_color: string
          address: string | null
          assign_auto_zip: boolean
          assign_buying_center: boolean
          assign_customer_picks: boolean
          assign_oem_brand_match: boolean
          business_hours: Json | null
          buying_center_location_id: string | null
          comparison_features: Json
          competitor_columns: Json
          created_at: string
          cta_accept_color: string
          cta_offer_color: string
          dealership_id: string
          dealership_name: string
          email: string | null
          enable_animations: boolean
          enable_dl_ocr: boolean
          facebook_url: string | null
          favicon_url: string | null
          google_review_url: string | null
          hero_headline: string
          hero_layout: string
          hero_subtext: string
          id: string
          instagram_url: string | null
          logo_url: string | null
          logo_white_url: string | null
          phone: string | null
          photo_allow_color_change: boolean
          photo_overlay_color: string
          price_guarantee_days: number
          primary_color: string
          referral_program_enabled: boolean
          referral_reward_sell_amount: number
          referral_reward_sell_enabled: boolean
          referral_reward_trade_amount: number
          referral_reward_trade_enabled: boolean
          review_request_message: string
          review_request_subject: string
          service_hero_headline: string
          service_hero_subtext: string
          show_request_access: boolean
          stats_cars_purchased: string | null
          stats_rating: string | null
          stats_reviews_count: string | null
          stats_years_in_business: string | null
          success_color: string
          tagline: string
          tiktok_url: string | null
          track_abandoned_leads: boolean
          trade_hero_headline: string
          trade_hero_subtext: string
          updated_at: string
          use_animated_calculating: boolean
          vehicle_image_angle: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          about_hero_headline?: string
          about_hero_subtext?: string
          about_milestones?: Json
          about_story?: string
          about_values?: Json
          accent_color?: string
          address?: string | null
          assign_auto_zip?: boolean
          assign_buying_center?: boolean
          assign_customer_picks?: boolean
          assign_oem_brand_match?: boolean
          business_hours?: Json | null
          buying_center_location_id?: string | null
          comparison_features?: Json
          competitor_columns?: Json
          created_at?: string
          cta_accept_color?: string
          cta_offer_color?: string
          dealership_id?: string
          dealership_name?: string
          email?: string | null
          enable_animations?: boolean
          enable_dl_ocr?: boolean
          facebook_url?: string | null
          favicon_url?: string | null
          google_review_url?: string | null
          hero_headline?: string
          hero_layout?: string
          hero_subtext?: string
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          logo_white_url?: string | null
          phone?: string | null
          photo_allow_color_change?: boolean
          photo_overlay_color?: string
          price_guarantee_days?: number
          primary_color?: string
          referral_program_enabled?: boolean
          referral_reward_sell_amount?: number
          referral_reward_sell_enabled?: boolean
          referral_reward_trade_amount?: number
          referral_reward_trade_enabled?: boolean
          review_request_message?: string
          review_request_subject?: string
          service_hero_headline?: string
          service_hero_subtext?: string
          show_request_access?: boolean
          stats_cars_purchased?: string | null
          stats_rating?: string | null
          stats_reviews_count?: string | null
          stats_years_in_business?: string | null
          success_color?: string
          tagline?: string
          tiktok_url?: string | null
          track_abandoned_leads?: boolean
          trade_hero_headline?: string
          trade_hero_subtext?: string
          updated_at?: string
          use_animated_calculating?: boolean
          vehicle_image_angle?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          about_hero_headline?: string
          about_hero_subtext?: string
          about_milestones?: Json
          about_story?: string
          about_values?: Json
          accent_color?: string
          address?: string | null
          assign_auto_zip?: boolean
          assign_buying_center?: boolean
          assign_customer_picks?: boolean
          assign_oem_brand_match?: boolean
          business_hours?: Json | null
          buying_center_location_id?: string | null
          comparison_features?: Json
          competitor_columns?: Json
          created_at?: string
          cta_accept_color?: string
          cta_offer_color?: string
          dealership_id?: string
          dealership_name?: string
          email?: string | null
          enable_animations?: boolean
          enable_dl_ocr?: boolean
          facebook_url?: string | null
          favicon_url?: string | null
          google_review_url?: string | null
          hero_headline?: string
          hero_layout?: string
          hero_subtext?: string
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          logo_white_url?: string | null
          phone?: string | null
          photo_allow_color_change?: boolean
          photo_overlay_color?: string
          price_guarantee_days?: number
          primary_color?: string
          referral_program_enabled?: boolean
          referral_reward_sell_amount?: number
          referral_reward_sell_enabled?: boolean
          referral_reward_trade_amount?: number
          referral_reward_trade_enabled?: boolean
          review_request_message?: string
          review_request_subject?: string
          service_hero_headline?: string
          service_hero_subtext?: string
          show_request_access?: boolean
          stats_cars_purchased?: string | null
          stats_rating?: string | null
          stats_reviews_count?: string | null
          stats_years_in_business?: string | null
          success_color?: string
          tagline?: string
          tiktok_url?: string | null
          track_abandoned_leads?: boolean
          trade_hero_headline?: string
          trade_hero_subtext?: string
          updated_at?: string
          use_animated_calculating?: boolean
          vehicle_image_angle?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_config_buying_center_location_id_fkey"
            columns: ["buying_center_location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permission_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          individual_sections: string[]
          permission_group_id: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          individual_sections?: string[]
          permission_group_id?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          individual_sections?: string[]
          permission_group_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permission_assignments_permission_group_id_fkey"
            columns: ["permission_group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          accidents: string | null
          acv_value: number | null
          address_city: string | null
          address_state: string | null
          address_street: string | null
          ai_condition_score: string | null
          ai_damage_summary: string | null
          appointment_date: string | null
          appointment_set: boolean
          appraisal_finalized: boolean
          appraisal_finalized_at: string | null
          appraisal_finalized_by: string | null
          appraised_by: string | null
          assigned_rep_email: string | null
          bb_add_deducts: Json | null
          bb_base_whole_avg: number | null
          bb_class_name: string | null
          bb_drivetrain: string | null
          bb_engine: string | null
          bb_fuel_type: string | null
          bb_mileage_adj: number | null
          bb_msrp: number | null
          bb_regional_adj: number | null
          bb_retail_avg: number | null
          bb_selected_options: string[] | null
          bb_tradein_avg: number | null
          bb_transmission: string | null
          bb_value_tiers: Json | null
          bb_wholesale_avg: number | null
          brake_lf: number | null
          brake_lr: number | null
          brake_rf: number | null
          brake_rr: number | null
          check_request_done: boolean
          created_at: string
          dealership_id: string
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
          inspection_data: Json | null
          inspection_pin: string | null
          inspector_grade: string | null
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
          referral_code: string | null
          review_requested: boolean
          review_requested_at: string | null
          salesperson_name: string | null
          smoked_in: string | null
          state: string | null
          status_updated_at: string | null
          status_updated_by: string | null
          store_location_id: string | null
          tech_issues: string[] | null
          tire_adjustment: number | null
          tire_lf: number | null
          tire_lr: number | null
          tire_rf: number | null
          tire_rr: number | null
          tires_replaced: string | null
          token: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_year: string | null
          vin: string | null
          vin_verified: boolean
          windshield_damage: string | null
          zip: string | null
        }
        Insert: {
          accidents?: string | null
          acv_value?: number | null
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          ai_condition_score?: string | null
          ai_damage_summary?: string | null
          appointment_date?: string | null
          appointment_set?: boolean
          appraisal_finalized?: boolean
          appraisal_finalized_at?: string | null
          appraisal_finalized_by?: string | null
          appraised_by?: string | null
          assigned_rep_email?: string | null
          bb_add_deducts?: Json | null
          bb_base_whole_avg?: number | null
          bb_class_name?: string | null
          bb_drivetrain?: string | null
          bb_engine?: string | null
          bb_fuel_type?: string | null
          bb_mileage_adj?: number | null
          bb_msrp?: number | null
          bb_regional_adj?: number | null
          bb_retail_avg?: number | null
          bb_selected_options?: string[] | null
          bb_tradein_avg?: number | null
          bb_transmission?: string | null
          bb_value_tiers?: Json | null
          bb_wholesale_avg?: number | null
          brake_lf?: number | null
          brake_lr?: number | null
          brake_rf?: number | null
          brake_rr?: number | null
          check_request_done?: boolean
          created_at?: string
          dealership_id?: string
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
          inspection_data?: Json | null
          inspection_pin?: string | null
          inspector_grade?: string | null
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
          referral_code?: string | null
          review_requested?: boolean
          review_requested_at?: string | null
          salesperson_name?: string | null
          smoked_in?: string | null
          state?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          store_location_id?: string | null
          tech_issues?: string[] | null
          tire_adjustment?: number | null
          tire_lf?: number | null
          tire_lr?: number | null
          tire_rf?: number | null
          tire_rr?: number | null
          tires_replaced?: string | null
          token?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: string | null
          vin?: string | null
          vin_verified?: boolean
          windshield_damage?: string | null
          zip?: string | null
        }
        Update: {
          accidents?: string | null
          acv_value?: number | null
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          ai_condition_score?: string | null
          ai_damage_summary?: string | null
          appointment_date?: string | null
          appointment_set?: boolean
          appraisal_finalized?: boolean
          appraisal_finalized_at?: string | null
          appraisal_finalized_by?: string | null
          appraised_by?: string | null
          assigned_rep_email?: string | null
          bb_add_deducts?: Json | null
          bb_base_whole_avg?: number | null
          bb_class_name?: string | null
          bb_drivetrain?: string | null
          bb_engine?: string | null
          bb_fuel_type?: string | null
          bb_mileage_adj?: number | null
          bb_msrp?: number | null
          bb_regional_adj?: number | null
          bb_retail_avg?: number | null
          bb_selected_options?: string[] | null
          bb_tradein_avg?: number | null
          bb_transmission?: string | null
          bb_value_tiers?: Json | null
          bb_wholesale_avg?: number | null
          brake_lf?: number | null
          brake_lr?: number | null
          brake_rf?: number | null
          brake_rr?: number | null
          check_request_done?: boolean
          created_at?: string
          dealership_id?: string
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
          inspection_data?: Json | null
          inspection_pin?: string | null
          inspector_grade?: string | null
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
          referral_code?: string | null
          review_requested?: boolean
          review_requested_at?: string | null
          salesperson_name?: string | null
          smoked_in?: string | null
          state?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          store_location_id?: string | null
          tech_issues?: string[] | null
          tire_adjustment?: number | null
          tire_lf?: number | null
          tire_lr?: number | null
          tire_rf?: number | null
          tire_rr?: number | null
          tires_replaced?: string | null
          token?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: string | null
          vin?: string | null
          vin_verified?: boolean
          windshield_damage?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_store_location_id_fkey"
            columns: ["store_location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          custom_domain: string | null
          dealership_id: string
          display_name: string
          id: string
          is_active: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          dealership_id: string
          display_name?: string
          id?: string
          is_active?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          dealership_id?: string
          display_name?: string
          id?: string
          is_active?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_name: string
          created_at: string
          dealership_id: string
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
          dealership_id?: string
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
          dealership_id?: string
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
          dealership_id: string
          id: string
          location_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          dealership_id?: string
          id?: string
          location_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          dealership_id?: string
          id?: string
          location_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
        ]
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
      can_view_submission: {
        Args: {
          _submission_dealership_id: string
          _submission_location_id: string
          _user_id: string
        }
        Returns: boolean
      }
      cleanup_old_lookup_attempts: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_all_staff: {
        Args: { _dealership_id?: string }
        Returns: {
          display_name: string
          email: string
          location_id: string
          phone_number: string
          profile_image_url: string
          role: string
          role_id: string
          user_id: string
        }[]
      }
      get_inspection_damage: {
        Args: { _submission_id: string }
        Returns: {
          damage_items: Json
        }[]
      }
      get_inspection_data: {
        Args: { _submission_id: string }
        Returns: {
          ai_condition_score: string
          ai_damage_summary: string
          exterior_color: string
          inspection_pin: string
          mileage: string
          overall_condition: string
          vehicle_make: string
          vehicle_model: string
          vehicle_year: string
          vin: string
        }[]
      }
      get_submission_by_token: {
        Args: { _token: string }
        Returns: {
          id: string
          name: string
          photos_uploaded: boolean
          state: string
          vehicle_make: string
          vehicle_model: string
          vehicle_year: string
          vin: string
          zip: string
        }[]
      }
      get_submission_portal: {
        Args: { _token: string }
        Returns: {
          acv_value: number
          appointment_set: boolean
          bb_tradein_avg: number
          brake_lf: number
          brake_lr: number
          brake_rf: number
          brake_rr: number
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
          tire_lf: number
          tire_lr: number
          tire_rf: number
          tire_rr: number
          token: string
          vehicle_make: string
          vehicle_model: string
          vehicle_year: string
          vin: string
          zip: string
        }[]
      }
      get_tenant_by_domain: {
        Args: { _domain: string }
        Returns: {
          dealership_id: string
          display_name: string
          slug: string
        }[]
      }
      get_user_dealership_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      remove_staff_role: { Args: { _role_id: string }; Returns: undefined }
      save_mobile_inspection:
        | {
            Args: {
              _internal_notes: string
              _overall_condition?: string
              _submission_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _brake_lf?: number
              _brake_lr?: number
              _brake_rf?: number
              _brake_rr?: number
              _inspector_grade?: string
              _internal_notes: string
              _overall_condition?: string
              _submission_id: string
              _tire_lf?: number
              _tire_lr?: number
              _tire_rf?: number
              _tire_rr?: number
            }
            Returns: Json
          }
      update_staff_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _role_id: string
        }
        Returns: undefined
      }
      verify_inspection_pin: {
        Args: { _pin: string; _submission_id: string }
        Returns: boolean
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

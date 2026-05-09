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
          submission_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          submission_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          submission_id?: string | null
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
          imported_at: string | null
          imported_from_dms: string | null
          legacy_id: string | null
          notes: string | null
          preferred_date: string
          preferred_time: string
          status: string
          store_location: string | null
          store_location_id: string | null
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
          imported_at?: string | null
          imported_from_dms?: string | null
          legacy_id?: string | null
          notes?: string | null
          preferred_date: string
          preferred_time: string
          status?: string
          store_location?: string | null
          store_location_id?: string | null
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
          imported_at?: string | null
          imported_from_dms?: string | null
          legacy_id?: string | null
          notes?: string | null
          preferred_date?: string
          preferred_time?: string
          status?: string
          store_location?: string | null
          store_location_id?: string | null
          submission_token?: string | null
          vehicle_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_store_location_id_fkey"
            columns: ["store_location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_submission_token_fkey"
            columns: ["submission_token"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["token"]
          },
        ]
      }
      bdc_call_tasks: {
        Row: {
          assigned_email: string | null
          assigned_role: string | null
          cadence_state: string
          cadence_step: number
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_at: string
          id: string
          intent: string
          outcome: string | null
          outcome_notes: string | null
          priority: number
          rep_context: Json
          status: string
          submission_id: string
          updated_at: string
        }
        Insert: {
          assigned_email?: string | null
          assigned_role?: string | null
          cadence_state: string
          cadence_step?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string
          id?: string
          intent: string
          outcome?: string | null
          outcome_notes?: string | null
          priority?: number
          rep_context?: Json
          status?: string
          submission_id: string
          updated_at?: string
        }
        Update: {
          assigned_email?: string | null
          assigned_role?: string | null
          cadence_state?: string
          cadence_step?: number
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_at?: string
          id?: string
          intent?: string
          outcome?: string | null
          outcome_notes?: string | null
          priority?: number
          rep_context?: Json
          status?: string
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bdc_call_tasks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      boost_bump_rules: {
        Row: {
          bump_amount: number
          dealership_id: string
          enabled: boolean
          id: string
          signal_key: string
          updated_at: string
        }
        Insert: {
          bump_amount?: number
          dealership_id: string
          enabled?: boolean
          id?: string
          signal_key: string
          updated_at?: string
        }
        Update: {
          bump_amount?: number
          dealership_id?: string
          enabled?: boolean
          id?: string
          signal_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      cadence_log: {
        Row: {
          cadence_state: string
          channel: string
          fired_at: string
          id: string
          outcome: string
          outcome_detail: string | null
          step: number
          submission_id: string
          trigger_key: string | null
        }
        Insert: {
          cadence_state: string
          channel: string
          fired_at?: string
          id?: string
          outcome?: string
          outcome_detail?: string | null
          step: number
          submission_id: string
          trigger_key?: string | null
        }
        Update: {
          cadence_state?: string
          channel?: string
          fired_at?: string
          id?: string
          outcome?: string
          outcome_detail?: string | null
          step?: number
          submission_id?: string
          trigger_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadence_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
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
          imported_at: string | null
          imported_from_dms: string | null
          ip_address: string | null
          legacy_id: string | null
          store_location_id: string | null
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
          imported_at?: string | null
          imported_from_dms?: string | null
          ip_address?: string | null
          legacy_id?: string | null
          store_location_id?: string | null
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
          imported_at?: string | null
          imported_from_dms?: string | null
          ip_address?: string | null
          legacy_id?: string | null
          store_location_id?: string | null
          submission_token?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_log_store_location_id_fkey"
            columns: ["store_location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_events: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          body_html: string | null
          body_text: string | null
          channel: string
          created_at: string
          dealership_id: string
          direction: string
          id: string
          metadata: Json
          occurred_at: string
          source_id: string | null
          source_table: string | null
          submission_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          body_html?: string | null
          body_text?: string | null
          channel: string
          created_at?: string
          dealership_id?: string
          direction?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source_id?: string | null
          source_table?: string | null
          submission_id: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          body_html?: string | null
          body_text?: string | null
          channel?: string
          created_at?: string
          dealership_id?: string
          direction?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          source_id?: string | null
          source_table?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_phases: {
        Row: {
          advances_to: string | null
          call_type: string
          content: string
          created_at: string
          created_from_call_id: string | null
          dealership_id: string
          id: string
          is_active: boolean
          last_promoted_at: string | null
          loss_count: number
          parent_variant_id: string | null
          phase_key: string
          phase_position: string
          retired_at: string | null
          signal_keywords: string[]
          sort_order: number
          updated_at: string
          use_when: string | null
          variant_id: string | null
          variant_label: string
          win_count: number
        }
        Insert: {
          advances_to?: string | null
          call_type: string
          content: string
          created_at?: string
          created_from_call_id?: string | null
          dealership_id?: string
          id?: string
          is_active?: boolean
          last_promoted_at?: string | null
          loss_count?: number
          parent_variant_id?: string | null
          phase_key: string
          phase_position: string
          retired_at?: string | null
          signal_keywords?: string[]
          sort_order?: number
          updated_at?: string
          use_when?: string | null
          variant_id?: string | null
          variant_label: string
          win_count?: number
        }
        Update: {
          advances_to?: string | null
          call_type?: string
          content?: string
          created_at?: string
          created_from_call_id?: string | null
          dealership_id?: string
          id?: string
          is_active?: boolean
          last_promoted_at?: string | null
          loss_count?: number
          parent_variant_id?: string | null
          phase_key?: string
          phase_position?: string
          retired_at?: string | null
          signal_keywords?: string[]
          sort_order?: number
          updated_at?: string
          use_when?: string | null
          variant_id?: string | null
          variant_label?: string
          win_count?: number
        }
        Relationships: []
      }
      customer_data_access_log: {
        Row: {
          created_at: string
          dealership_id: string | null
          id: string
          metadata: Json
          request_path: string | null
          resource_kind: string
          staff_label: string | null
          staff_user_id: string | null
          submission_id: string | null
          voice_call_id: string | null
        }
        Insert: {
          created_at?: string
          dealership_id?: string | null
          id?: string
          metadata?: Json
          request_path?: string | null
          resource_kind: string
          staff_label?: string | null
          staff_user_id?: string | null
          submission_id?: string | null
          voice_call_id?: string | null
        }
        Update: {
          created_at?: string
          dealership_id?: string | null
          id?: string
          metadata?: Json
          request_path?: string | null
          resource_kind?: string
          staff_label?: string | null
          staff_user_id?: string | null
          submission_id?: string | null
          voice_call_id?: string | null
        }
        Relationships: []
      }
      customer_data_request: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          dealership_id: string | null
          expires_at: string
          fulfilled_at: string | null
          id: string
          kind: string
          metadata: Json
          request_token: string
          requested_at: string
          status: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          dealership_id?: string | null
          expires_at?: string
          fulfilled_at?: string | null
          id?: string
          kind: string
          metadata?: Json
          request_token?: string
          requested_at?: string
          status?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          dealership_id?: string | null
          expires_at?: string
          fulfilled_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          request_token?: string
          requested_at?: string
          status?: string
        }
        Relationships: []
      }
      customer_signals: {
        Row: {
          created_at: string
          created_from_call_id: string | null
          customer_state: string
          dealership_id: string
          do_not_say: string[]
          hand_off_to_human: boolean
          id: string
          is_active: boolean
          last_promoted_at: string | null
          loss_count: number
          parent_variant_id: string | null
          recommended_posture: string
          response_variants: string[]
          retired_at: string | null
          signal_key: string
          signal_phrases: string[]
          sort_order: number
          updated_at: string
          variant_id: string | null
          variant_label: string
          win_count: number
        }
        Insert: {
          created_at?: string
          created_from_call_id?: string | null
          customer_state: string
          dealership_id?: string
          do_not_say?: string[]
          hand_off_to_human?: boolean
          id?: string
          is_active?: boolean
          last_promoted_at?: string | null
          loss_count?: number
          parent_variant_id?: string | null
          recommended_posture: string
          response_variants?: string[]
          retired_at?: string | null
          signal_key: string
          signal_phrases?: string[]
          sort_order?: number
          updated_at?: string
          variant_id?: string | null
          variant_label?: string
          win_count?: number
        }
        Update: {
          created_at?: string
          created_from_call_id?: string | null
          customer_state?: string
          dealership_id?: string
          do_not_say?: string[]
          hand_off_to_human?: boolean
          id?: string
          is_active?: boolean
          last_promoted_at?: string | null
          loss_count?: number
          parent_variant_id?: string | null
          recommended_posture?: string
          response_variants?: string[]
          retired_at?: string | null
          signal_key?: string
          signal_phrases?: string[]
          sort_order?: number
          updated_at?: string
          variant_id?: string | null
          variant_label?: string
          win_count?: number
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
          imported_at: string | null
          imported_from_dms: string | null
          legacy_id: string | null
          overall_severity: string
          photo_category: string
          photo_path: string
          raw_response: Json | null
          store_location_id: string | null
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
          imported_at?: string | null
          imported_from_dms?: string | null
          legacy_id?: string | null
          overall_severity?: string
          photo_category: string
          photo_path: string
          raw_response?: Json | null
          store_location_id?: string | null
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
          imported_at?: string | null
          imported_from_dms?: string | null
          legacy_id?: string | null
          overall_severity?: string
          photo_category?: string
          photo_path?: string
          raw_response?: Json | null
          store_location_id?: string | null
          submission_id?: string
          suggested_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_reports_store_location_id_fkey"
            columns: ["store_location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      data_egress_log: {
        Row: {
          created_at: string
          dealership_id: string
          download_url: string | null
          error_message: string | null
          expires_at: string | null
          export_kind: string
          exported_by_email: string | null
          exported_by_user_id: string | null
          file_bytes: number | null
          file_path: string | null
          filters: Json
          id: string
          row_counts: Json
          status: string
          table_names: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          dealership_id: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_kind?: string
          exported_by_email?: string | null
          exported_by_user_id?: string | null
          file_bytes?: number | null
          file_path?: string | null
          filters?: Json
          id?: string
          row_counts?: Json
          status?: string
          table_names?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          dealership_id?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          export_kind?: string
          exported_by_email?: string | null
          exported_by_user_id?: string | null
          file_bytes?: number | null
          file_path?: string | null
          filters?: Json
          id?: string
          row_counts?: Json
          status?: string
          table_names?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      dealer_accounts: {
        Row: {
          architecture: string
          bdc_model: string
          billing_date: number | null
          click_to_dial_record_calls: boolean
          created_at: string
          dealer_group_id: string | null
          dealership_id: string
          display_name: string | null
          id: string
          max_locations: number
          offer_logic_approver_role: string
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
          twilio_from_number: string | null
          updated_at: string
          voice_ai_api_key: string | null
          voice_ai_enabled: boolean | null
          voice_ai_from_number: string | null
          voice_ai_max_bump_amount: number | null
          voice_ai_provider: string
          voice_ai_transfer_number: string | null
        }
        Insert: {
          architecture?: string
          bdc_model?: string
          billing_date?: number | null
          click_to_dial_record_calls?: boolean
          created_at?: string
          dealer_group_id?: string | null
          dealership_id?: string
          display_name?: string | null
          id?: string
          max_locations?: number
          offer_logic_approver_role?: string
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
          twilio_from_number?: string | null
          updated_at?: string
          voice_ai_api_key?: string | null
          voice_ai_enabled?: boolean | null
          voice_ai_from_number?: string | null
          voice_ai_max_bump_amount?: number | null
          voice_ai_provider?: string
          voice_ai_transfer_number?: string | null
        }
        Update: {
          architecture?: string
          bdc_model?: string
          billing_date?: number | null
          click_to_dial_record_calls?: boolean
          created_at?: string
          dealer_group_id?: string | null
          dealership_id?: string
          display_name?: string | null
          id?: string
          max_locations?: number
          offer_logic_approver_role?: string
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
          twilio_from_number?: string | null
          updated_at?: string
          voice_ai_api_key?: string | null
          voice_ai_enabled?: boolean | null
          voice_ai_from_number?: string | null
          voice_ai_max_bump_amount?: number | null
          voice_ai_provider?: string
          voice_ai_transfer_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_accounts_dealer_group_id_fkey"
            columns: ["dealer_group_id"]
            isOneToOne: false
            referencedRelation: "dealer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_groups: {
        Row: {
          billing_email: string | null
          created_at: string
          custom_domain: string | null
          display_name: string | null
          id: string
          master_msa_signed_at: string | null
          master_msa_url: string | null
          name: string
          notes: string | null
          parent_group_id: string | null
          primary_contact_user_id: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          custom_domain?: string | null
          display_name?: string | null
          id?: string
          master_msa_signed_at?: string | null
          master_msa_url?: string | null
          name: string
          notes?: string | null
          parent_group_id?: string | null
          primary_contact_user_id?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          custom_domain?: string | null
          display_name?: string | null
          id?: string
          master_msa_signed_at?: string | null
          master_msa_url?: string | null
          name?: string
          notes?: string | null
          parent_group_id?: string | null
          primary_contact_user_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "dealer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_subscriptions: {
        Row: {
          billing_cycle: string
          bundle_id: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          dealership_id: string
          id: string
          last_synced_at: string | null
          monthly_amount: number | null
          product_ids: string[]
          rooftop_activation_id: string | null
          rooftop_count: number
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          stripe_subscription_id: string | null
          tier_ids: string[]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          bundle_id?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          dealership_id?: string
          id?: string
          last_synced_at?: string | null
          monthly_amount?: number | null
          product_ids?: string[]
          rooftop_activation_id?: string | null
          rooftop_count?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          tier_ids?: string[]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          bundle_id?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          dealership_id?: string
          id?: string
          last_synced_at?: string | null
          monthly_amount?: number | null
          product_ids?: string[]
          rooftop_activation_id?: string | null
          rooftop_count?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          tier_ids?: string[]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_subscriptions_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "platform_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_subscriptions_rooftop_activation_id_fkey"
            columns: ["rooftop_activation_id"]
            isOneToOne: false
            referencedRelation: "rooftop_activations"
            referencedColumns: ["id"]
          },
        ]
      }
      dealership_locations: {
        Row: {
          about_hero_headline: string | null
          about_hero_subtext: string | null
          about_image_url: string | null
          about_image_urls: string[]
          about_story: string | null
          accent_color: string | null
          address: string | null
          all_brands: boolean
          business_hours: Json | null
          center_zip: string | null
          city: string
          corporate_logo_dark_url: string | null
          corporate_logo_url: string | null
          coverage_radius_miles: number | null
          created_at: string
          dealership_id: string
          dealership_name: string | null
          email: string | null
          established_year: number | null
          excluded_oem_brands: string[]
          facebook_url: string | null
          favicon_url: string | null
          google_review_url: string | null
          hero_headline: string | null
          hero_layout: string | null
          hero_subtext: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          landing_template: string | null
          location_type: string
          logo_layout: string
          logo_url: string | null
          logo_white_url: string | null
          name: string
          oem_brands: string[]
          oem_logo_urls: string[]
          phone: string | null
          price_guarantee_days: number | null
          primary_color: string | null
          secondary_logo_dark_url: string | null
          secondary_logo_url: string | null
          service_hero_headline: string | null
          service_hero_subtext: string | null
          show_corporate_logo: boolean
          show_corporate_on_landing_only: boolean
          show_in_footer: boolean
          show_in_inspection: boolean
          show_in_scheduling: boolean
          sort_order: number
          state: string
          stats_cars_purchased: string | null
          stats_rating: string | null
          stats_reviews_count: string | null
          stats_years_in_business: string | null
          success_color: string | null
          tagline: string | null
          temporarily_offline: boolean
          tiktok_url: string | null
          trade_hero_headline: string | null
          trade_hero_subtext: string | null
          use_bdc: boolean
          use_corporate_about: boolean
          use_corporate_established_year: boolean
          website_url: string | null
          youtube_url: string | null
          zip_codes: string[]
        }
        Insert: {
          about_hero_headline?: string | null
          about_hero_subtext?: string | null
          about_image_url?: string | null
          about_image_urls?: string[]
          about_story?: string | null
          accent_color?: string | null
          address?: string | null
          all_brands?: boolean
          business_hours?: Json | null
          center_zip?: string | null
          city: string
          corporate_logo_dark_url?: string | null
          corporate_logo_url?: string | null
          coverage_radius_miles?: number | null
          created_at?: string
          dealership_id?: string
          dealership_name?: string | null
          email?: string | null
          established_year?: number | null
          excluded_oem_brands?: string[]
          facebook_url?: string | null
          favicon_url?: string | null
          google_review_url?: string | null
          hero_headline?: string | null
          hero_layout?: string | null
          hero_subtext?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          landing_template?: string | null
          location_type?: string
          logo_layout?: string
          logo_url?: string | null
          logo_white_url?: string | null
          name: string
          oem_brands?: string[]
          oem_logo_urls?: string[]
          phone?: string | null
          price_guarantee_days?: number | null
          primary_color?: string | null
          secondary_logo_dark_url?: string | null
          secondary_logo_url?: string | null
          service_hero_headline?: string | null
          service_hero_subtext?: string | null
          show_corporate_logo?: boolean
          show_corporate_on_landing_only?: boolean
          show_in_footer?: boolean
          show_in_inspection?: boolean
          show_in_scheduling?: boolean
          sort_order?: number
          state?: string
          stats_cars_purchased?: string | null
          stats_rating?: string | null
          stats_reviews_count?: string | null
          stats_years_in_business?: string | null
          success_color?: string | null
          tagline?: string | null
          temporarily_offline?: boolean
          tiktok_url?: string | null
          trade_hero_headline?: string | null
          trade_hero_subtext?: string | null
          use_bdc?: boolean
          use_corporate_about?: boolean
          use_corporate_established_year?: boolean
          website_url?: string | null
          youtube_url?: string | null
          zip_codes?: string[]
        }
        Update: {
          about_hero_headline?: string | null
          about_hero_subtext?: string | null
          about_image_url?: string | null
          about_image_urls?: string[]
          about_story?: string | null
          accent_color?: string | null
          address?: string | null
          all_brands?: boolean
          business_hours?: Json | null
          center_zip?: string | null
          city?: string
          corporate_logo_dark_url?: string | null
          corporate_logo_url?: string | null
          coverage_radius_miles?: number | null
          created_at?: string
          dealership_id?: string
          dealership_name?: string | null
          email?: string | null
          established_year?: number | null
          excluded_oem_brands?: string[]
          facebook_url?: string | null
          favicon_url?: string | null
          google_review_url?: string | null
          hero_headline?: string | null
          hero_layout?: string | null
          hero_subtext?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          landing_template?: string | null
          location_type?: string
          logo_layout?: string
          logo_url?: string | null
          logo_white_url?: string | null
          name?: string
          oem_brands?: string[]
          oem_logo_urls?: string[]
          phone?: string | null
          price_guarantee_days?: number | null
          primary_color?: string | null
          secondary_logo_dark_url?: string | null
          secondary_logo_url?: string | null
          service_hero_headline?: string | null
          service_hero_subtext?: string | null
          show_corporate_logo?: boolean
          show_corporate_on_landing_only?: boolean
          show_in_footer?: boolean
          show_in_inspection?: boolean
          show_in_scheduling?: boolean
          sort_order?: number
          state?: string
          stats_cars_purchased?: string | null
          stats_rating?: string | null
          stats_reviews_count?: string | null
          stats_years_in_business?: string | null
          success_color?: string | null
          tagline?: string | null
          temporarily_offline?: boolean
          tiktok_url?: string | null
          trade_hero_headline?: string | null
          trade_hero_subtext?: string | null
          use_bdc?: boolean
          use_corporate_about?: boolean
          use_corporate_established_year?: boolean
          website_url?: string | null
          youtube_url?: string | null
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
      document_config: {
        Row: {
          conditional_on: string | null
          created_at: string
          customer_visible: boolean
          dealership_id: string
          description: string
          doc_id: string
          id: string
          label: string
          ocr_pipeline: string | null
          role: string
          sort_order: number
          staff_only: boolean
          updated_at: string
        }
        Insert: {
          conditional_on?: string | null
          created_at?: string
          customer_visible?: boolean
          dealership_id?: string
          description?: string
          doc_id: string
          id?: string
          label: string
          ocr_pipeline?: string | null
          role?: string
          sort_order?: number
          staff_only?: boolean
          updated_at?: string
        }
        Update: {
          conditional_on?: string | null
          created_at?: string
          customer_visible?: boolean
          dealership_id?: string
          description?: string
          doc_id?: string
          id?: string
          label?: string
          ocr_pipeline?: string | null
          role?: string
          sort_order?: number
          staff_only?: boolean
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
      embed_events: {
        Row: {
          created_at: string
          dealership_id: string
          event_type: string
          id: string
          intent: string | null
          page_url: string | null
          payload: Json | null
          session_id: string | null
          submission_token: string | null
          tier: number | null
          user_agent: string | null
          vehicle_label: string | null
          vehicle_msrp: number | null
        }
        Insert: {
          created_at?: string
          dealership_id: string
          event_type: string
          id?: string
          intent?: string | null
          page_url?: string | null
          payload?: Json | null
          session_id?: string | null
          submission_token?: string | null
          tier?: number | null
          user_agent?: string | null
          vehicle_label?: string | null
          vehicle_msrp?: number | null
        }
        Update: {
          created_at?: string
          dealership_id?: string
          event_type?: string
          id?: string
          intent?: string | null
          page_url?: string | null
          payload?: Json | null
          session_id?: string | null
          submission_token?: string | null
          tier?: number | null
          user_agent?: string | null
          vehicle_label?: string | null
          vehicle_msrp?: number | null
        }
        Relationships: []
      }
      error_log: {
        Row: {
          call_id: string | null
          context: Json
          created_at: string
          dealership_id: string | null
          id: string
          message: string
          severity: string
          source: string
          stack: string | null
          submission_id: string | null
          user_id: string | null
        }
        Insert: {
          call_id?: string | null
          context?: Json
          created_at?: string
          dealership_id?: string | null
          id?: string
          message: string
          severity?: string
          source: string
          stack?: string | null
          submission_id?: string | null
          user_id?: string | null
        }
        Update: {
          call_id?: string | null
          context?: Json
          created_at?: string
          dealership_id?: string | null
          id?: string
          message?: string
          severity?: string
          source?: string
          stack?: string | null
          submission_id?: string | null
          user_id?: string | null
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
          imported_at: string | null
          imported_from_dms: string | null
          legacy_id: string | null
          status: string
          store_location_id: string | null
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
          imported_at?: string | null
          imported_from_dms?: string | null
          legacy_id?: string | null
          status?: string
          store_location_id?: string | null
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
          imported_at?: string | null
          imported_from_dms?: string | null
          legacy_id?: string | null
          status?: string
          store_location_id?: string | null
          submission_id?: string
          touch_number?: number
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_store_location_id_fkey"
            columns: ["store_location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
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
          ai_photos_min_required: number
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
          step_ai_photos: boolean
          step_condition_history: boolean
          step_vehicle_build: boolean
          updated_at: string
        }
        Insert: {
          ai_photos_min_required?: number
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
          step_ai_photos?: boolean
          step_condition_history?: boolean
          step_vehicle_build?: boolean
          updated_at?: string
        }
        Update: {
          ai_photos_min_required?: number
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
          step_ai_photos?: boolean
          step_condition_history?: boolean
          step_vehicle_build?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      industry_intel: {
        Row: {
          applies_to_segments: string[]
          citable_number: string | null
          created_at: string
          created_from_call_id: string | null
          dealership_id: string
          evidence_url: string | null
          id: string
          is_active: boolean
          last_promoted_at: string | null
          last_verified_at: string | null
          loss_count: number
          parent_variant_id: string | null
          retired_at: string | null
          scope: string
          short_claim: string
          sort_order: number
          topic: string
          updated_at: string
          use_when: string | null
          variant_id: string | null
          variant_label: string
          win_count: number
        }
        Insert: {
          applies_to_segments?: string[]
          citable_number?: string | null
          created_at?: string
          created_from_call_id?: string | null
          dealership_id?: string
          evidence_url?: string | null
          id?: string
          is_active?: boolean
          last_promoted_at?: string | null
          last_verified_at?: string | null
          loss_count?: number
          parent_variant_id?: string | null
          retired_at?: string | null
          scope: string
          short_claim: string
          sort_order?: number
          topic: string
          updated_at?: string
          use_when?: string | null
          variant_id?: string | null
          variant_label?: string
          win_count?: number
        }
        Update: {
          applies_to_segments?: string[]
          citable_number?: string | null
          created_at?: string
          created_from_call_id?: string | null
          dealership_id?: string
          evidence_url?: string | null
          id?: string
          is_active?: boolean
          last_promoted_at?: string | null
          last_verified_at?: string | null
          loss_count?: number
          parent_variant_id?: string | null
          retired_at?: string | null
          scope?: string
          short_claim?: string
          sort_order?: number
          topic?: string
          updated_at?: string
          use_when?: string | null
          variant_id?: string | null
          variant_label?: string
          win_count?: number
        }
        Relationships: []
      }
      inspection_config: {
        Row: {
          brake_input_mode: string
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
          tire_brake_input_mode: string
          tire_credit_per_32: number
          tire_credit_threshold: number
          tire_deduct_per_32: number
          tire_deduct_threshold: number
          tire_input_mode: string
          updated_at: string
        }
        Insert: {
          brake_input_mode?: string
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
          tire_brake_input_mode?: string
          tire_credit_per_32?: number
          tire_credit_threshold?: number
          tire_deduct_per_32?: number
          tire_deduct_threshold?: number
          tire_input_mode?: string
          updated_at?: string
        }
        Update: {
          brake_input_mode?: string
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
          tire_brake_input_mode?: string
          tire_credit_per_32?: number
          tire_credit_threshold?: number
          tire_deduct_per_32?: number
          tire_deduct_threshold?: number
          tire_input_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspection_config_overrides: {
        Row: {
          brake_input_mode: string | null
          created_at: string
          dealership_id: string
          id: string
          location_id: string
          tire_input_mode: string | null
          updated_at: string
        }
        Insert: {
          brake_input_mode?: string | null
          created_at?: string
          dealership_id: string
          id?: string
          location_id: string
          tire_input_mode?: string | null
          updated_at?: string
        }
        Update: {
          brake_input_mode?: string | null
          created_at?: string
          dealership_id?: string
          id?: string
          location_id?: string
          tire_input_mode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_config_overrides_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_channels: {
        Row: {
          channel: string
          enabled: boolean | null
          location_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel: string
          enabled?: boolean | null
          location_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel?: string
          enabled?: boolean | null
          location_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_channels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempt_log: {
        Row: {
          attempted_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_addr: unknown
          succeeded: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_addr?: unknown
          succeeded: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_addr?: unknown
          succeeded?: boolean
          user_agent?: string | null
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
      mfa_audit_log: {
        Row: {
          created_at: string
          dealership_id: string | null
          event_kind: string
          factor_type: string | null
          id: string
          ip_addr: unknown
          metadata: Json
          user_agent: string | null
          user_id: string
          user_label: string | null
        }
        Insert: {
          created_at?: string
          dealership_id?: string | null
          event_kind: string
          factor_type?: string | null
          id?: string
          ip_addr?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id: string
          user_label?: string | null
        }
        Update: {
          created_at?: string
          dealership_id?: string | null
          event_kind?: string
          factor_type?: string | null
          id?: string
          ip_addr?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string
          user_label?: string | null
        }
        Relationships: []
      }
      mfa_backup_codes: {
        Row: {
          code_hash: string
          consumed_ip: unknown
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          consumed_ip?: unknown
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          consumed_ip?: unknown
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mfa_enforcement_config: {
        Row: {
          dealership_id: string
          grace_period_days: number
          require_mfa: boolean
          required_for_roles: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          dealership_id: string
          grace_period_days?: number
          require_mfa?: boolean
          required_for_roles?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          dealership_id?: string
          grace_period_days?: number
          require_mfa?: boolean
          required_for_roles?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          dealership_id: string
          delivered_at: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          imported_at: string | null
          imported_from_dms: string | null
          legacy_id: string | null
          provider_message_id: string | null
          recipient: string
          status: string
          store_location_id: string | null
          submission_id: string | null
          trigger_key: string
        }
        Insert: {
          channel: string
          created_at?: string
          dealership_id?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          imported_at?: string | null
          imported_from_dms?: string | null
          legacy_id?: string | null
          provider_message_id?: string | null
          recipient: string
          status?: string
          store_location_id?: string | null
          submission_id?: string | null
          trigger_key: string
        }
        Update: {
          channel?: string
          created_at?: string
          dealership_id?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          imported_at?: string | null
          imported_from_dms?: string | null
          legacy_id?: string | null
          provider_message_id?: string | null
          recipient?: string
          status?: string
          store_location_id?: string | null
          submission_id?: string | null
          trigger_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_store_location_id_fkey"
            columns: ["store_location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
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
          cadence_authorized_bump_pct: number
          cadence_enabled: boolean
          cadence_reengage_max_days: number
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
          cadence_authorized_bump_pct?: number
          cadence_enabled?: boolean
          cadence_reengage_max_days?: number
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
          cadence_authorized_bump_pct?: number
          cadence_enabled?: boolean
          cadence_reengage_max_days?: number
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
      objection_playbook: {
        Row: {
          category: string
          created_at: string
          customer_concern: string
          customer_signals: string[]
          dealer_reframe: string
          dealership_id: string
          escalation_path: string | null
          fires_on: Json
          id: string
          is_active: boolean
          label: string
          objection_key: string
          proof_points: Json
          sort_order: number
          updated_at: string
          voice_ai_snippet: string | null
        }
        Insert: {
          category: string
          created_at?: string
          customer_concern: string
          customer_signals?: string[]
          dealer_reframe: string
          dealership_id?: string
          escalation_path?: string | null
          fires_on?: Json
          id?: string
          is_active?: boolean
          label: string
          objection_key: string
          proof_points?: Json
          sort_order?: number
          updated_at?: string
          voice_ai_snippet?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          customer_concern?: string
          customer_signals?: string[]
          dealer_reframe?: string
          dealership_id?: string
          escalation_path?: string | null
          fires_on?: Json
          id?: string
          is_active?: boolean
          label?: string
          objection_key?: string
          proof_points?: Json
          sort_order?: number
          updated_at?: string
          voice_ai_snippet?: string | null
        }
        Relationships: []
      }
      offer_approval_requests: {
        Row: {
          acv_breach: number | null
          acv_value_at_request: number | null
          applied_at: string | null
          current_offer: number | null
          dealership_id: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          delta: number | null
          id: string
          reason: string
          reason_notes: string | null
          requested_at: string
          requested_by: string | null
          requested_by_role: string | null
          requested_offer: number
          status: string
          submission_id: string
        }
        Insert: {
          acv_breach?: number | null
          acv_value_at_request?: number | null
          applied_at?: string | null
          current_offer?: number | null
          dealership_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          delta?: number | null
          id?: string
          reason?: string
          reason_notes?: string | null
          requested_at?: string
          requested_by?: string | null
          requested_by_role?: string | null
          requested_offer: number
          status?: string
          submission_id: string
        }
        Update: {
          acv_breach?: number | null
          acv_value_at_request?: number | null
          applied_at?: string | null
          current_offer?: number | null
          dealership_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          delta?: number | null
          id?: string
          reason?: string
          reason_notes?: string | null
          requested_at?: string
          requested_by?: string | null
          requested_by_role?: string | null
          requested_offer?: number
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_approval_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_bumps: {
        Row: {
          bump_amount: number
          created_at: string
          dealership_id: string
          id: string
          line_items: Json | null
          new_offer: number
          previous_offer: number
          source: string
          submission_id: string
        }
        Insert: {
          bump_amount: number
          created_at?: string
          dealership_id: string
          id?: string
          line_items?: Json | null
          new_offer: number
          previous_offer: number
          source?: string
          submission_id: string
        }
        Update: {
          bump_amount?: number
          created_at?: string
          dealership_id?: string
          id?: string
          line_items?: Json | null
          new_offer?: number
          previous_offer?: number
          source?: string
          submission_id?: string
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
          archetype_deduction_overrides: Json | null
          auto_firm_offer_pct: number | null
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
          floor_plan_rate_pct: number
          global_adjustment_pct: number
          hide_pack_from_appraisal: boolean
          high_mileage_penalty: Json
          id: string
          learning_threshold: number
          lot_cost_per_day: number
          low_mileage_bonus: Json
          manager_pin: string
          max_market_pct: number | null
          mileage_tiers: Json
          offer_ceiling: number | null
          offer_floor: number
          payment_selection_timing: string
          pricing_reveal_mode: string
          range_high_mode: string
          range_high_percent: number | null
          range_high_source: string | null
          range_low_source: string
          recon_cost: number
          regional_adjustment_pct: number
          retail_profit_basis: string
          retail_search_radius: number
          retail_search_zip: string | null
          seasonal_adjustment: Json
          show_range_before_final: boolean
          strategy_mode: string | null
          target_gross_min: number
          updated_at: string
          wholesale_only_age_years: number
          wholesale_only_mileage: number
        }
        Insert: {
          age_tiers?: Json
          archetype_deduction_overrides?: Json | null
          auto_firm_offer_pct?: number | null
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
          floor_plan_rate_pct?: number
          global_adjustment_pct?: number
          hide_pack_from_appraisal?: boolean
          high_mileage_penalty?: Json
          id?: string
          learning_threshold?: number
          lot_cost_per_day?: number
          low_mileage_bonus?: Json
          manager_pin?: string
          max_market_pct?: number | null
          mileage_tiers?: Json
          offer_ceiling?: number | null
          offer_floor?: number
          payment_selection_timing?: string
          pricing_reveal_mode?: string
          range_high_mode?: string
          range_high_percent?: number | null
          range_high_source?: string | null
          range_low_source?: string
          recon_cost?: number
          regional_adjustment_pct?: number
          retail_profit_basis?: string
          retail_search_radius?: number
          retail_search_zip?: string | null
          seasonal_adjustment?: Json
          show_range_before_final?: boolean
          strategy_mode?: string | null
          target_gross_min?: number
          updated_at?: string
          wholesale_only_age_years?: number
          wholesale_only_mileage?: number
        }
        Update: {
          age_tiers?: Json
          archetype_deduction_overrides?: Json | null
          auto_firm_offer_pct?: number | null
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
          floor_plan_rate_pct?: number
          global_adjustment_pct?: number
          hide_pack_from_appraisal?: boolean
          high_mileage_penalty?: Json
          id?: string
          learning_threshold?: number
          lot_cost_per_day?: number
          low_mileage_bonus?: Json
          manager_pin?: string
          max_market_pct?: number | null
          mileage_tiers?: Json
          offer_ceiling?: number | null
          offer_floor?: number
          payment_selection_timing?: string
          pricing_reveal_mode?: string
          range_high_mode?: string
          range_high_percent?: number | null
          range_high_source?: string | null
          range_low_source?: string
          recon_cost?: number
          regional_adjustment_pct?: number
          retail_profit_basis?: string
          retail_search_radius?: number
          retail_search_zip?: string | null
          seasonal_adjustment?: Json
          show_range_before_final?: boolean
          strategy_mode?: string | null
          target_gross_min?: number
          updated_at?: string
          wholesale_only_age_years?: number
          wholesale_only_mileage?: number
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
          boost_role: string
          created_at: string
          dealership_id: string
          description: string
          id: string
          is_enabled: boolean
          is_required: boolean
          label: string
          orientation: string
          pre_appointment_role: string
          shot_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          boost_role?: string
          created_at?: string
          dealership_id?: string
          description?: string
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          label: string
          orientation?: string
          pre_appointment_role?: string
          shot_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          boost_role?: string
          created_at?: string
          dealership_id?: string
          description?: string
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          label?: string
          orientation?: string
          pre_appointment_role?: string
          shot_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pii_retention_config: {
        Row: {
          customer_memory_retention_days: number
          dealership_id: string
          notification_log_retention_days: number
          recording_url_retention_days: number
          updated_at: string
          voice_transcript_retention_days: number
        }
        Insert: {
          customer_memory_retention_days?: number
          dealership_id: string
          notification_log_retention_days?: number
          recording_url_retention_days?: number
          updated_at?: string
          voice_transcript_retention_days?: number
        }
        Update: {
          customer_memory_retention_days?: number
          dealership_id?: string
          notification_log_retention_days?: number
          recording_url_retention_days?: number
          updated_at?: string
          voice_transcript_retention_days?: number
        }
        Relationships: []
      }
      platform_bundles: {
        Row: {
          annual_price: number | null
          created_at: string
          description: string
          id: string
          is_available_for_new_subs: boolean
          is_enterprise: boolean
          is_featured: boolean
          monthly_price: number
          name: string
          product_ids: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          annual_price?: number | null
          created_at?: string
          description?: string
          id?: string
          is_available_for_new_subs?: boolean
          is_enterprise?: boolean
          is_featured?: boolean
          monthly_price?: number
          name: string
          product_ids?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          annual_price?: number | null
          created_at?: string
          description?: string
          id?: string
          is_available_for_new_subs?: boolean
          is_enterprise?: boolean
          is_featured?: boolean
          monthly_price?: number
          name?: string
          product_ids?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_pricing_model: {
        Row: {
          annual_discount_pct: number
          bundle_overrides: Json
          id: string
          multi_location_overrides: Json
          tier_overrides: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          annual_discount_pct?: number
          bundle_overrides?: Json
          id?: string
          multi_location_overrides?: Json
          tier_overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          annual_discount_pct?: number
          bundle_overrides?: Json
          id?: string
          multi_location_overrides?: Json
          tier_overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_product_tiers: {
        Row: {
          allow_overage: boolean
          annual_price: number | null
          created_at: string
          description: string | null
          features: string[]
          id: string
          included_with_product_ids: string[]
          inventory_limit: number | null
          is_active: boolean
          is_introductory: boolean
          monthly_price: number
          name: string
          overage_price_per_unit: number | null
          product_id: string
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          allow_overage?: boolean
          annual_price?: number | null
          created_at?: string
          description?: string | null
          features?: string[]
          id?: string
          included_with_product_ids?: string[]
          inventory_limit?: number | null
          is_active?: boolean
          is_introductory?: boolean
          monthly_price?: number
          name: string
          overage_price_per_unit?: number | null
          product_id: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allow_overage?: boolean
          annual_price?: number | null
          created_at?: string
          description?: string | null
          features?: string[]
          id?: string
          included_with_product_ids?: string[]
          inventory_limit?: number | null
          is_active?: boolean
          is_introductory?: boolean
          monthly_price?: number
          name?: string
          overage_price_per_unit?: number | null
          product_id?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_product_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "platform_products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_products: {
        Row: {
          base_url: string
          created_at: string
          description: string
          icon_name: string
          id: string
          is_active: boolean
          is_available_for_new_subs: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_url?: string
          created_at?: string
          description?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          is_available_for_new_subs?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          description?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          is_available_for_new_subs?: boolean
          name?: string
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
          approval_status: string
          approved_at: string | null
          approved_by: string | null
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
          market_adjustment: Json | null
          max_market_pct: number | null
          mileage_tiers: Json
          name: string
          offer_ceiling: number | null
          offer_floor: number
          priority: number
          recon_cost: number
          regional_adjustment_pct: number
          rejection_reason: string | null
          retail_search_zip: string | null
          schedule_end: string | null
          schedule_start: string | null
          seasonal_adjustment: Json
          strategy_mode: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          age_tiers?: Json
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
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
          market_adjustment?: Json | null
          max_market_pct?: number | null
          mileage_tiers?: Json
          name: string
          offer_ceiling?: number | null
          offer_floor?: number
          priority?: number
          recon_cost?: number
          regional_adjustment_pct?: number
          rejection_reason?: string | null
          retail_search_zip?: string | null
          schedule_end?: string | null
          schedule_start?: string | null
          seasonal_adjustment?: Json
          strategy_mode?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          age_tiers?: Json
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
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
          market_adjustment?: Json | null
          max_market_pct?: number | null
          mileage_tiers?: Json
          name?: string
          offer_ceiling?: number | null
          offer_floor?: number
          priority?: number
          recon_cost?: number
          regional_adjustment_pct?: number
          rejection_reason?: string | null
          retail_search_zip?: string | null
          schedule_end?: string | null
          schedule_start?: string | null
          seasonal_adjustment?: Json
          strategy_mode?: string
          submitted_at?: string | null
          submitted_by?: string | null
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
      prospect_demo_views: {
        Row: {
          demo_id: string
          id: string
          occurred_at: string
          referrer: string | null
          user_agent: string | null
          visitor_hash: string | null
        }
        Insert: {
          demo_id: string
          id?: string
          occurred_at?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Update: {
          demo_id?: string
          id?: string
          occurred_at?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_demo_views_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "prospect_demos"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_demos: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          dealer_name: string | null
          expires_at: string
          home_screenshot: string | null
          home_url: string | null
          id: string
          listing_screenshot: string | null
          listing_url: string | null
          pitch_line: string | null
          share_token: string
          updated_at: string
          vdp_screenshot: string | null
          vdp_url: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          dealer_name?: string | null
          expires_at?: string
          home_screenshot?: string | null
          home_url?: string | null
          id?: string
          listing_screenshot?: string | null
          listing_url?: string | null
          pitch_line?: string | null
          share_token: string
          updated_at?: string
          vdp_screenshot?: string | null
          vdp_url?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          dealer_name?: string | null
          expires_at?: string
          home_screenshot?: string | null
          home_url?: string | null
          id?: string
          listing_screenshot?: string | null
          listing_url?: string | null
          pitch_line?: string | null
          share_token?: string
          updated_at?: string
          vdp_screenshot?: string | null
          vdp_url?: string | null
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
      rooftop_activations: {
        Row: {
          activated_at: string
          activated_by_user_id: string | null
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          dealer_group_id: string
          dealership_id: string
          id: string
          location_id: string | null
          notes: string | null
          pilot_ends_at: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string
          activated_by_user_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          dealer_group_id: string
          dealership_id: string
          id?: string
          location_id?: string | null
          notes?: string | null
          pilot_ends_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string
          activated_by_user_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          dealer_group_id?: string
          dealership_id?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          pilot_ends_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooftop_activations_dealer_group_id_fkey"
            columns: ["dealer_group_id"]
            isOneToOne: false
            referencedRelation: "dealer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooftop_activations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      rooftop_detach_log: {
        Row: {
          dealership_id: string
          from_dealer_group_id: string | null
          id: string
          performed_at: string
          performed_by_email: string | null
          performed_by_user_id: string | null
          reason: string
          snapshot: Json
          to_dealer_group_id: string | null
        }
        Insert: {
          dealership_id: string
          from_dealer_group_id?: string | null
          id?: string
          performed_at?: string
          performed_by_email?: string | null
          performed_by_user_id?: string | null
          reason: string
          snapshot?: Json
          to_dealer_group_id?: string | null
        }
        Update: {
          dealership_id?: string
          from_dealer_group_id?: string | null
          id?: string
          performed_at?: string
          performed_by_email?: string | null
          performed_by_user_id?: string | null
          reason?: string
          snapshot?: Json
          to_dealer_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooftop_detach_log_from_dealer_group_id_fkey"
            columns: ["from_dealer_group_id"]
            isOneToOne: false
            referencedRelation: "dealer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooftop_detach_log_to_dealer_group_id_fkey"
            columns: ["to_dealer_group_id"]
            isOneToOne: false
            referencedRelation: "dealer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      site_config: {
        Row: {
          about_hero_headline: string
          about_hero_subtext: string
          about_image_url: string | null
          about_image_urls: string[]
          about_milestones: Json
          about_story: string
          about_values: Json
          accent_color: string
          address: string | null
          ai_auto_bump_confidence_floor: number
          ai_auto_bump_daily_cap: number
          ai_auto_bump_enabled: boolean
          ai_auto_bump_max_dollars: number
          ai_auto_bump_max_pct: number
          ai_photo_reappraisal: boolean
          assign_auto_zip: boolean
          assign_buying_center: boolean
          assign_customer_picks: boolean
          assign_oem_brand_match: boolean
          business_hours: Json | null
          buying_center_location_id: string | null
          comparison_features: Json
          competitor_columns: Json
          condition_card_style: string
          created_at: string
          cta_accept_color: string
          cta_offer_color: string
          customer_file_accent: string | null
          customer_file_accent_2: string | null
          dealership_id: string
          dealership_name: string
          demo_mode: boolean
          demo_offer_amount: number
          email: string | null
          embed_config: Json
          embed_escalation_enabled: boolean
          embed_escalation_max_tier: number
          enable_animations: boolean
          enable_dl_ocr: boolean
          established_year: number | null
          facebook_url: string | null
          favicon_url: string | null
          file_layout: string | null
          ghost_headline: string | null
          ghost_screen: string
          ghost_subhead: string | null
          google_review_url: string | null
          hero_headline: string
          hero_layout: string
          hero_subtext: string
          id: string
          instagram_url: string | null
          landing_cta_color: string | null
          landing_cta_text_color: string | null
          landing_form_density: string
          landing_form_variant: string
          landing_lookup_default: string
          landing_template: string
          logo_url: string | null
          logo_white_url: string | null
          phone: string | null
          photo_allow_color_change: boolean
          photo_overlay_color: string
          pickup_offered: boolean
          price_guarantee_days: number
          primary_color: string
          referral_program_enabled: boolean
          referral_reward_buy_amount: number
          referral_reward_buy_enabled: boolean
          referral_reward_sell_amount: number
          referral_reward_sell_buy_amount: number
          referral_reward_sell_buy_enabled: boolean
          referral_reward_sell_enabled: boolean
          referral_reward_trade_amount: number
          referral_reward_trade_enabled: boolean
          referral_reward_type: string
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
          tcpa_disclosure: string
          tcpa_disclosure_version: number
          text_scale: number | null
          tiktok_url: string | null
          top_bar_bg: string | null
          top_bar_bg_2: string | null
          top_bar_height: number | null
          top_bar_shimmer: boolean | null
          top_bar_shimmer_speed: number | null
          top_bar_shimmer_style: string | null
          top_bar_style: string | null
          top_bar_text: string | null
          track_abandoned_leads: boolean
          trade_hero_headline: string
          trade_hero_subtext: string
          ui_refresh_enabled: boolean
          ui_scale: number | null
          updated_at: string
          use_animated_calculating: boolean
          value_props: Json | null
          vehicle_image_angle: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          about_hero_headline?: string
          about_hero_subtext?: string
          about_image_url?: string | null
          about_image_urls?: string[]
          about_milestones?: Json
          about_story?: string
          about_values?: Json
          accent_color?: string
          address?: string | null
          ai_auto_bump_confidence_floor?: number
          ai_auto_bump_daily_cap?: number
          ai_auto_bump_enabled?: boolean
          ai_auto_bump_max_dollars?: number
          ai_auto_bump_max_pct?: number
          ai_photo_reappraisal?: boolean
          assign_auto_zip?: boolean
          assign_buying_center?: boolean
          assign_customer_picks?: boolean
          assign_oem_brand_match?: boolean
          business_hours?: Json | null
          buying_center_location_id?: string | null
          comparison_features?: Json
          competitor_columns?: Json
          condition_card_style?: string
          created_at?: string
          cta_accept_color?: string
          cta_offer_color?: string
          customer_file_accent?: string | null
          customer_file_accent_2?: string | null
          dealership_id?: string
          dealership_name?: string
          demo_mode?: boolean
          demo_offer_amount?: number
          email?: string | null
          embed_config?: Json
          embed_escalation_enabled?: boolean
          embed_escalation_max_tier?: number
          enable_animations?: boolean
          enable_dl_ocr?: boolean
          established_year?: number | null
          facebook_url?: string | null
          favicon_url?: string | null
          file_layout?: string | null
          ghost_headline?: string | null
          ghost_screen?: string
          ghost_subhead?: string | null
          google_review_url?: string | null
          hero_headline?: string
          hero_layout?: string
          hero_subtext?: string
          id?: string
          instagram_url?: string | null
          landing_cta_color?: string | null
          landing_cta_text_color?: string | null
          landing_form_density?: string
          landing_form_variant?: string
          landing_lookup_default?: string
          landing_template?: string
          logo_url?: string | null
          logo_white_url?: string | null
          phone?: string | null
          photo_allow_color_change?: boolean
          photo_overlay_color?: string
          pickup_offered?: boolean
          price_guarantee_days?: number
          primary_color?: string
          referral_program_enabled?: boolean
          referral_reward_buy_amount?: number
          referral_reward_buy_enabled?: boolean
          referral_reward_sell_amount?: number
          referral_reward_sell_buy_amount?: number
          referral_reward_sell_buy_enabled?: boolean
          referral_reward_sell_enabled?: boolean
          referral_reward_trade_amount?: number
          referral_reward_trade_enabled?: boolean
          referral_reward_type?: string
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
          tcpa_disclosure?: string
          tcpa_disclosure_version?: number
          text_scale?: number | null
          tiktok_url?: string | null
          top_bar_bg?: string | null
          top_bar_bg_2?: string | null
          top_bar_height?: number | null
          top_bar_shimmer?: boolean | null
          top_bar_shimmer_speed?: number | null
          top_bar_shimmer_style?: string | null
          top_bar_style?: string | null
          top_bar_text?: string | null
          track_abandoned_leads?: boolean
          trade_hero_headline?: string
          trade_hero_subtext?: string
          ui_refresh_enabled?: boolean
          ui_scale?: number | null
          updated_at?: string
          use_animated_calculating?: boolean
          value_props?: Json | null
          vehicle_image_angle?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          about_hero_headline?: string
          about_hero_subtext?: string
          about_image_url?: string | null
          about_image_urls?: string[]
          about_milestones?: Json
          about_story?: string
          about_values?: Json
          accent_color?: string
          address?: string | null
          ai_auto_bump_confidence_floor?: number
          ai_auto_bump_daily_cap?: number
          ai_auto_bump_enabled?: boolean
          ai_auto_bump_max_dollars?: number
          ai_auto_bump_max_pct?: number
          ai_photo_reappraisal?: boolean
          assign_auto_zip?: boolean
          assign_buying_center?: boolean
          assign_customer_picks?: boolean
          assign_oem_brand_match?: boolean
          business_hours?: Json | null
          buying_center_location_id?: string | null
          comparison_features?: Json
          competitor_columns?: Json
          condition_card_style?: string
          created_at?: string
          cta_accept_color?: string
          cta_offer_color?: string
          customer_file_accent?: string | null
          customer_file_accent_2?: string | null
          dealership_id?: string
          dealership_name?: string
          demo_mode?: boolean
          demo_offer_amount?: number
          email?: string | null
          embed_config?: Json
          embed_escalation_enabled?: boolean
          embed_escalation_max_tier?: number
          enable_animations?: boolean
          enable_dl_ocr?: boolean
          established_year?: number | null
          facebook_url?: string | null
          favicon_url?: string | null
          file_layout?: string | null
          ghost_headline?: string | null
          ghost_screen?: string
          ghost_subhead?: string | null
          google_review_url?: string | null
          hero_headline?: string
          hero_layout?: string
          hero_subtext?: string
          id?: string
          instagram_url?: string | null
          landing_cta_color?: string | null
          landing_cta_text_color?: string | null
          landing_form_density?: string
          landing_form_variant?: string
          landing_lookup_default?: string
          landing_template?: string
          logo_url?: string | null
          logo_white_url?: string | null
          phone?: string | null
          photo_allow_color_change?: boolean
          photo_overlay_color?: string
          pickup_offered?: boolean
          price_guarantee_days?: number
          primary_color?: string
          referral_program_enabled?: boolean
          referral_reward_buy_amount?: number
          referral_reward_buy_enabled?: boolean
          referral_reward_sell_amount?: number
          referral_reward_sell_buy_amount?: number
          referral_reward_sell_buy_enabled?: boolean
          referral_reward_sell_enabled?: boolean
          referral_reward_trade_amount?: number
          referral_reward_trade_enabled?: boolean
          referral_reward_type?: string
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
          tcpa_disclosure?: string
          tcpa_disclosure_version?: number
          text_scale?: number | null
          tiktok_url?: string | null
          top_bar_bg?: string | null
          top_bar_bg_2?: string | null
          top_bar_height?: number | null
          top_bar_shimmer?: boolean | null
          top_bar_shimmer_speed?: number | null
          top_bar_shimmer_style?: string | null
          top_bar_style?: string | null
          top_bar_text?: string | null
          track_abandoned_leads?: boolean
          trade_hero_headline?: string
          trade_hero_subtext?: string
          ui_refresh_enabled?: boolean
          ui_scale?: number | null
          updated_at?: string
          use_animated_calculating?: boolean
          value_props?: Json | null
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
      stripe_events: {
        Row: {
          id: string
          livemode: boolean
          processed_at: string | null
          received_at: string
          summary: string | null
          type: string
        }
        Insert: {
          id: string
          livemode: boolean
          processed_at?: string | null
          received_at?: string
          summary?: string | null
          type: string
        }
        Update: {
          id?: string
          livemode?: boolean
          processed_at?: string | null
          received_at?: string
          summary?: string | null
          type?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          accidents: string | null
          acv_set_at: string | null
          acv_status: string
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
          appraisal_started_at: string | null
          appraised_by: string | null
          appraised_by_user_id: string | null
          arrival_link_sent_at: string | null
          arrived_at: string | null
          assigned_at: string | null
          assigned_bdc_rep_id: string | null
          assigned_rep_email: string | null
          assigned_salesperson_id: string | null
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
          cadence_last_touch_at: string | null
          cadence_next_due_at: string | null
          cadence_paused_until: string | null
          cadence_started_at: string | null
          cadence_state: string | null
          cadence_step: number
          check_request_done: boolean
          created_at: string
          customer_memory: Json
          dealership_id: string
          decline_reason: string | null
          decline_reason_at: string | null
          decline_reason_source: string | null
          docs_uploaded: boolean
          drivable: string | null
          drivetrain: string | null
          email: string | null
          embed_source: string | null
          embed_vehicle_label: string | null
          embed_vehicle_msrp: number | null
          engine_issues: string[] | null
          estimated_offer_high: number | null
          estimated_offer_low: number | null
          exterior_color: string | null
          exterior_damage: string[] | null
          id: string
          imported_at: string | null
          imported_from_dms: string | null
          inspection_completed_at: string | null
          inspection_data: Json | null
          inspection_pin: string | null
          inspector_grade: string | null
          interior_damage: string[] | null
          internal_notes: string | null
          is_hot_lead: boolean
          lead_source: string
          legacy_id: string | null
          loan_balance: string | null
          loan_company: string | null
          loan_payment: string | null
          loan_status: string | null
          manager_override_amount: number | null
          manager_override_by: string | null
          manager_override_reason: string | null
          matched_rule_ids: string[] | null
          mechanical_issues: string[] | null
          mileage: string | null
          modifications: string | null
          moonroof: string | null
          name: string | null
          next_step: string | null
          num_keys: string | null
          offer_made_at: string | null
          offered_price: number | null
          on_the_way_at: string | null
          outcome_accepted: boolean | null
          outcome_days_to_sale: number | null
          outcome_entered_at: string | null
          outcome_entered_by: string | null
          outcome_recon_actual: number | null
          outcome_sale_price: number | null
          outcome_wholesale_price: number | null
          outcome_wholesaled: boolean | null
          overall_condition: string | null
          pending_slot_proposals: Json | null
          phone: string | null
          photos_uploaded: boolean
          plate: string | null
          progress_status: string
          referral_code: string | null
          review_requested: boolean
          review_requested_at: string | null
          salesperson_name: string | null
          self_checkin_at: string | null
          self_checkin_status: string | null
          smoked_in: string | null
          state: string | null
          status_updated_at: string | null
          status_updated_by: string | null
          store_location_id: string | null
          tcpa_consent_at: string | null
          tcpa_consent_ip: string | null
          tcpa_consent_text: string | null
          tcpa_consent_version: number | null
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
          acv_set_at?: string | null
          acv_status?: string
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
          appraisal_started_at?: string | null
          appraised_by?: string | null
          appraised_by_user_id?: string | null
          arrival_link_sent_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          assigned_bdc_rep_id?: string | null
          assigned_rep_email?: string | null
          assigned_salesperson_id?: string | null
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
          cadence_last_touch_at?: string | null
          cadence_next_due_at?: string | null
          cadence_paused_until?: string | null
          cadence_started_at?: string | null
          cadence_state?: string | null
          cadence_step?: number
          check_request_done?: boolean
          created_at?: string
          customer_memory?: Json
          dealership_id?: string
          decline_reason?: string | null
          decline_reason_at?: string | null
          decline_reason_source?: string | null
          docs_uploaded?: boolean
          drivable?: string | null
          drivetrain?: string | null
          email?: string | null
          embed_source?: string | null
          embed_vehicle_label?: string | null
          embed_vehicle_msrp?: number | null
          engine_issues?: string[] | null
          estimated_offer_high?: number | null
          estimated_offer_low?: number | null
          exterior_color?: string | null
          exterior_damage?: string[] | null
          id?: string
          imported_at?: string | null
          imported_from_dms?: string | null
          inspection_completed_at?: string | null
          inspection_data?: Json | null
          inspection_pin?: string | null
          inspector_grade?: string | null
          interior_damage?: string[] | null
          internal_notes?: string | null
          is_hot_lead?: boolean
          lead_source?: string
          legacy_id?: string | null
          loan_balance?: string | null
          loan_company?: string | null
          loan_payment?: string | null
          loan_status?: string | null
          manager_override_amount?: number | null
          manager_override_by?: string | null
          manager_override_reason?: string | null
          matched_rule_ids?: string[] | null
          mechanical_issues?: string[] | null
          mileage?: string | null
          modifications?: string | null
          moonroof?: string | null
          name?: string | null
          next_step?: string | null
          num_keys?: string | null
          offer_made_at?: string | null
          offered_price?: number | null
          on_the_way_at?: string | null
          outcome_accepted?: boolean | null
          outcome_days_to_sale?: number | null
          outcome_entered_at?: string | null
          outcome_entered_by?: string | null
          outcome_recon_actual?: number | null
          outcome_sale_price?: number | null
          outcome_wholesale_price?: number | null
          outcome_wholesaled?: boolean | null
          overall_condition?: string | null
          pending_slot_proposals?: Json | null
          phone?: string | null
          photos_uploaded?: boolean
          plate?: string | null
          progress_status?: string
          referral_code?: string | null
          review_requested?: boolean
          review_requested_at?: string | null
          salesperson_name?: string | null
          self_checkin_at?: string | null
          self_checkin_status?: string | null
          smoked_in?: string | null
          state?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          store_location_id?: string | null
          tcpa_consent_at?: string | null
          tcpa_consent_ip?: string | null
          tcpa_consent_text?: string | null
          tcpa_consent_version?: number | null
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
          acv_set_at?: string | null
          acv_status?: string
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
          appraisal_started_at?: string | null
          appraised_by?: string | null
          appraised_by_user_id?: string | null
          arrival_link_sent_at?: string | null
          arrived_at?: string | null
          assigned_at?: string | null
          assigned_bdc_rep_id?: string | null
          assigned_rep_email?: string | null
          assigned_salesperson_id?: string | null
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
          cadence_last_touch_at?: string | null
          cadence_next_due_at?: string | null
          cadence_paused_until?: string | null
          cadence_started_at?: string | null
          cadence_state?: string | null
          cadence_step?: number
          check_request_done?: boolean
          created_at?: string
          customer_memory?: Json
          dealership_id?: string
          decline_reason?: string | null
          decline_reason_at?: string | null
          decline_reason_source?: string | null
          docs_uploaded?: boolean
          drivable?: string | null
          drivetrain?: string | null
          email?: string | null
          embed_source?: string | null
          embed_vehicle_label?: string | null
          embed_vehicle_msrp?: number | null
          engine_issues?: string[] | null
          estimated_offer_high?: number | null
          estimated_offer_low?: number | null
          exterior_color?: string | null
          exterior_damage?: string[] | null
          id?: string
          imported_at?: string | null
          imported_from_dms?: string | null
          inspection_completed_at?: string | null
          inspection_data?: Json | null
          inspection_pin?: string | null
          inspector_grade?: string | null
          interior_damage?: string[] | null
          internal_notes?: string | null
          is_hot_lead?: boolean
          lead_source?: string
          legacy_id?: string | null
          loan_balance?: string | null
          loan_company?: string | null
          loan_payment?: string | null
          loan_status?: string | null
          manager_override_amount?: number | null
          manager_override_by?: string | null
          manager_override_reason?: string | null
          matched_rule_ids?: string[] | null
          mechanical_issues?: string[] | null
          mileage?: string | null
          modifications?: string | null
          moonroof?: string | null
          name?: string | null
          next_step?: string | null
          num_keys?: string | null
          offer_made_at?: string | null
          offered_price?: number | null
          on_the_way_at?: string | null
          outcome_accepted?: boolean | null
          outcome_days_to_sale?: number | null
          outcome_entered_at?: string | null
          outcome_entered_by?: string | null
          outcome_recon_actual?: number | null
          outcome_sale_price?: number | null
          outcome_wholesale_price?: number | null
          outcome_wholesaled?: boolean | null
          overall_condition?: string | null
          pending_slot_proposals?: Json | null
          phone?: string | null
          photos_uploaded?: boolean
          plate?: string | null
          progress_status?: string
          referral_code?: string | null
          review_requested?: boolean
          review_requested_at?: string | null
          salesperson_name?: string | null
          self_checkin_at?: string | null
          self_checkin_status?: string | null
          smoked_in?: string | null
          state?: string | null
          status_updated_at?: string | null
          status_updated_by?: string | null
          store_location_id?: string | null
          tcpa_consent_at?: string | null
          tcpa_consent_ip?: string | null
          tcpa_consent_text?: string | null
          tcpa_consent_version?: number | null
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
      tenant_channels: {
        Row: {
          channel: string
          dealership_id: string
          enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel: string
          dealership_id?: string
          enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel?: string
          dealership_id?: string
          enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tenant_role_section_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          dealership_id: string
          id: string
          location_id: string | null
          role: string
          section_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed: boolean
          created_at?: string
          dealership_id: string
          id?: string
          location_id?: string | null
          role: string
          section_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed?: boolean
          created_at?: string
          dealership_id?: string
          id?: string
          location_id?: string | null
          role?: string
          section_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_role_section_permissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_view_log: {
        Row: {
          ended_at: string | null
          ended_reason: string | null
          id: string
          reason: string
          started_at: string
          super_admin_email: string
          super_admin_user_id: string
          target_dealership_id: string
          target_display_name: string
          user_agent: string | null
        }
        Insert: {
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          reason: string
          started_at?: string
          super_admin_email: string
          super_admin_user_id: string
          target_dealership_id: string
          target_display_name: string
          user_agent?: string | null
        }
        Update: {
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          reason?: string
          started_at?: string
          super_admin_email?: string
          super_admin_user_id?: string
          target_dealership_id?: string
          target_display_name?: string
          user_agent?: string | null
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
          location_id: string | null
          slug: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          dealership_id: string
          display_name?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          slug: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          dealership_id?: string
          display_name?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          slug?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "dealership_locations"
            referencedColumns: ["id"]
          },
        ]
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
      trade_up_incentives: {
        Row: {
          active_until: string | null
          bonus_amount: number
          created_at: string
          dealership_id: string
          description: string | null
          disclaimer: string | null
          headline: string
          id: string
          inventory_price_ceiling: number | null
          inventory_price_floor: number | null
          inventory_scope: string
          inventory_url: string | null
          is_active: boolean
          sort_order: number
          trigger_moment: string
          updated_at: string
        }
        Insert: {
          active_until?: string | null
          bonus_amount?: number
          created_at?: string
          dealership_id: string
          description?: string | null
          disclaimer?: string | null
          headline: string
          id?: string
          inventory_price_ceiling?: number | null
          inventory_price_floor?: number | null
          inventory_scope?: string
          inventory_url?: string | null
          is_active?: boolean
          sort_order?: number
          trigger_moment: string
          updated_at?: string
        }
        Update: {
          active_until?: string | null
          bonus_amount?: number
          created_at?: string
          dealership_id?: string
          description?: string | null
          disclaimer?: string | null
          headline?: string
          id?: string
          inventory_price_ceiling?: number | null
          inventory_price_floor?: number | null
          inventory_scope?: string
          inventory_url?: string | null
          is_active?: boolean
          sort_order?: number
          trigger_moment?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          click_to_dial_dnd: boolean
          click_to_dial_quiet_end: string | null
          click_to_dial_quiet_start: string | null
          click_to_dial_quiet_tz: string | null
          dealer_group_id: string | null
          dealership_id: string
          id: string
          is_platform_admin: boolean
          licensed_states: string[] | null
          location_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          click_to_dial_dnd?: boolean
          click_to_dial_quiet_end?: string | null
          click_to_dial_quiet_start?: string | null
          click_to_dial_quiet_tz?: string | null
          dealer_group_id?: string | null
          dealership_id?: string
          id?: string
          is_platform_admin?: boolean
          licensed_states?: string[] | null
          location_id?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          click_to_dial_dnd?: boolean
          click_to_dial_quiet_end?: string | null
          click_to_dial_quiet_start?: string | null
          click_to_dial_quiet_tz?: string | null
          dealer_group_id?: string | null
          dealership_id?: string
          id?: string
          is_platform_admin?: boolean
          licensed_states?: string[] | null
          location_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_dealer_group_id_fkey"
            columns: ["dealer_group_id"]
            isOneToOne: false
            referencedRelation: "dealer_groups"
            referencedColumns: ["id"]
          },
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
      voice_agent_persona: {
        Row: {
          ai_disclosure_line: string | null
          created_at: string
          created_from_call_id: string | null
          dealership_id: string
          greeting_style: string | null
          hard_constraints: string[]
          id: string
          is_active: boolean
          last_promoted_at: string | null
          loss_count: number
          mission_block: string
          parent_variant_id: string | null
          persona_name: string
          retired_at: string | null
          signoff_style: string | null
          sort_order: number
          success_criteria: string
          updated_at: string
          variant_id: string | null
          voice_rules: string
          win_count: number
        }
        Insert: {
          ai_disclosure_line?: string | null
          created_at?: string
          created_from_call_id?: string | null
          dealership_id?: string
          greeting_style?: string | null
          hard_constraints?: string[]
          id?: string
          is_active?: boolean
          last_promoted_at?: string | null
          loss_count?: number
          mission_block: string
          parent_variant_id?: string | null
          persona_name: string
          retired_at?: string | null
          signoff_style?: string | null
          sort_order?: number
          success_criteria: string
          updated_at?: string
          variant_id?: string | null
          voice_rules: string
          win_count?: number
        }
        Update: {
          ai_disclosure_line?: string | null
          created_at?: string
          created_from_call_id?: string | null
          dealership_id?: string
          greeting_style?: string | null
          hard_constraints?: string[]
          id?: string
          is_active?: boolean
          last_promoted_at?: string | null
          loss_count?: number
          mission_block?: string
          parent_variant_id?: string | null
          persona_name?: string
          retired_at?: string | null
          signoff_style?: string | null
          sort_order?: number
          success_criteria?: string
          updated_at?: string
          variant_id?: string | null
          voice_rules?: string
          win_count?: number
        }
        Relationships: []
      }
      voice_call_grades: {
        Row: {
          call_id: string
          composite_score: number
          created_at: string
          dim_brand_tone: number | null
          dim_close_control: number | null
          dim_compliance: number | null
          dim_hallucination: number | null
          dim_motivation_disco: number | null
          dim_objection_handle: number | null
          dim_pacing: number | null
          dim_quote_band: number | null
          dim_transfer_hygiene: number | null
          dim_vehicle_confirm: number | null
          gating_failed: boolean
          golden_pinned: boolean
          grader: string
          grader_model: string | null
          id: string
          pii_redacted_at: string | null
          rationale: string | null
          run_id: string | null
        }
        Insert: {
          call_id: string
          composite_score: number
          created_at?: string
          dim_brand_tone?: number | null
          dim_close_control?: number | null
          dim_compliance?: number | null
          dim_hallucination?: number | null
          dim_motivation_disco?: number | null
          dim_objection_handle?: number | null
          dim_pacing?: number | null
          dim_quote_band?: number | null
          dim_transfer_hygiene?: number | null
          dim_vehicle_confirm?: number | null
          gating_failed?: boolean
          golden_pinned?: boolean
          grader?: string
          grader_model?: string | null
          id?: string
          pii_redacted_at?: string | null
          rationale?: string | null
          run_id?: string | null
        }
        Update: {
          call_id?: string
          composite_score?: number
          created_at?: string
          dim_brand_tone?: number | null
          dim_close_control?: number | null
          dim_compliance?: number | null
          dim_hallucination?: number | null
          dim_motivation_disco?: number | null
          dim_objection_handle?: number | null
          dim_pacing?: number | null
          dim_quote_band?: number | null
          dim_transfer_hygiene?: number | null
          dim_vehicle_confirm?: number | null
          gating_failed?: boolean
          golden_pinned?: boolean
          grader?: string
          grader_model?: string | null
          id?: string
          pii_redacted_at?: string | null
          rationale?: string | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_grades_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_voice_call_quality"
            referencedColumns: ["call_id"]
          },
          {
            foreignKeyName: "voice_call_grades_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_voice_call_quality_with_nps"
            referencedColumns: ["call_id"]
          },
          {
            foreignKeyName: "voice_call_grades_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_call_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_grades_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "voice_grade_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_call_log: {
        Row: {
          answered_by: string | null
          attempt_number: number | null
          bump_offered: number | null
          campaign_id: string | null
          consent_verified: boolean | null
          created_at: string
          customer_name: string | null
          dealership_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          feedback_captured_at: string | null
          feedback_comment: string | null
          feedback_request_channel: string | null
          feedback_request_sent_at: string | null
          feedback_score: number | null
          feedback_token: string | null
          id: string
          memory_hook_offered: string | null
          memory_hook_used: boolean | null
          memory_hook_used_within_20s: boolean | null
          metadata: Json | null
          opt_out_requested: boolean | null
          original_offer: number | null
          outcome: string | null
          phone_number: string
          pii_redacted_at: string | null
          provider_call_id: string | null
          provider_response: Json | null
          recording_url: string | null
          retry_scheduled_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          submission_id: string
          summary: string | null
          tcpa_disclosure_given: boolean | null
          transcript: string | null
          vehicle_info: string | null
        }
        Insert: {
          answered_by?: string | null
          attempt_number?: number | null
          bump_offered?: number | null
          campaign_id?: string | null
          consent_verified?: boolean | null
          created_at?: string
          customer_name?: string | null
          dealership_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          feedback_captured_at?: string | null
          feedback_comment?: string | null
          feedback_request_channel?: string | null
          feedback_request_sent_at?: string | null
          feedback_score?: number | null
          feedback_token?: string | null
          id?: string
          memory_hook_offered?: string | null
          memory_hook_used?: boolean | null
          memory_hook_used_within_20s?: boolean | null
          metadata?: Json | null
          opt_out_requested?: boolean | null
          original_offer?: number | null
          outcome?: string | null
          phone_number: string
          pii_redacted_at?: string | null
          provider_call_id?: string | null
          provider_response?: Json | null
          recording_url?: string | null
          retry_scheduled_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          submission_id: string
          summary?: string | null
          tcpa_disclosure_given?: boolean | null
          transcript?: string | null
          vehicle_info?: string | null
        }
        Update: {
          answered_by?: string | null
          attempt_number?: number | null
          bump_offered?: number | null
          campaign_id?: string | null
          consent_verified?: boolean | null
          created_at?: string
          customer_name?: string | null
          dealership_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          feedback_captured_at?: string | null
          feedback_comment?: string | null
          feedback_request_channel?: string | null
          feedback_request_sent_at?: string | null
          feedback_score?: number | null
          feedback_token?: string | null
          id?: string
          memory_hook_offered?: string | null
          memory_hook_used?: boolean | null
          memory_hook_used_within_20s?: boolean | null
          metadata?: Json | null
          opt_out_requested?: boolean | null
          original_offer?: number | null
          outcome?: string | null
          phone_number?: string
          pii_redacted_at?: string | null
          provider_call_id?: string | null
          provider_response?: Json | null
          recording_url?: string | null
          retry_scheduled_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          submission_id?: string
          summary?: string | null
          tcpa_disclosure_given?: boolean | null
          transcript?: string | null
          vehicle_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_call_turns: {
        Row: {
          asr_confidence: number | null
          call_id: string
          created_at: string
          emotion_score: number | null
          emotion_top: string | null
          end_ms: number | null
          first_token_ms: number | null
          id: string
          matched_signal_key: string | null
          metadata: Json
          pii_redacted_at: string | null
          sentiment: string | null
          sentiment_score: number | null
          silence_before_ms: number | null
          speaker: string
          start_ms: number | null
          text: string
          total_token_ms: number | null
          turn_index: number
          was_interrupted: boolean
        }
        Insert: {
          asr_confidence?: number | null
          call_id: string
          created_at?: string
          emotion_score?: number | null
          emotion_top?: string | null
          end_ms?: number | null
          first_token_ms?: number | null
          id?: string
          matched_signal_key?: string | null
          metadata?: Json
          pii_redacted_at?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          silence_before_ms?: number | null
          speaker: string
          start_ms?: number | null
          text?: string
          total_token_ms?: number | null
          turn_index: number
          was_interrupted?: boolean
        }
        Update: {
          asr_confidence?: number | null
          call_id?: string
          created_at?: string
          emotion_score?: number | null
          emotion_top?: string | null
          end_ms?: number | null
          first_token_ms?: number | null
          id?: string
          matched_signal_key?: string | null
          metadata?: Json
          pii_redacted_at?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          silence_before_ms?: number | null
          speaker?: string
          start_ms?: number | null
          text?: string
          total_token_ms?: number | null
          turn_index?: number
          was_interrupted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_turns_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_voice_call_quality"
            referencedColumns: ["call_id"]
          },
          {
            foreignKeyName: "voice_call_turns_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_voice_call_quality_with_nps"
            referencedColumns: ["call_id"]
          },
          {
            foreignKeyName: "voice_call_turns_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_call_log"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_call_variants_used: {
        Row: {
          call_id: string
          id: string
          recorded_at: string
          slot_key: string
          source_table: string
          thompson_draw: number | null
          variant_id: string
        }
        Insert: {
          call_id: string
          id?: string
          recorded_at?: string
          slot_key: string
          source_table: string
          thompson_draw?: number | null
          variant_id: string
        }
        Update: {
          call_id?: string
          id?: string
          recorded_at?: string
          slot_key?: string
          source_table?: string
          thompson_draw?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_variants_used_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_voice_call_quality"
            referencedColumns: ["call_id"]
          },
          {
            foreignKeyName: "voice_call_variants_used_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_voice_call_quality_with_nps"
            referencedColumns: ["call_id"]
          },
          {
            foreignKeyName: "voice_call_variants_used_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_call_log"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_campaigns: {
        Row: {
          calling_hours_end: string | null
          calling_hours_start: string | null
          created_at: string
          dealership_id: string
          id: string
          max_call_duration: number | null
          max_calls_per_day: number | null
          name: string
          retry_attempts: number | null
          retry_delay_hours: number | null
          script_template: string
          status: string
          target_criteria: Json
          total_calls_made: number | null
          total_connected: number | null
          total_converted: number | null
          transfer_phone: string | null
          updated_at: string
          voice_id: string | null
          voice_provider: string
        }
        Insert: {
          calling_hours_end?: string | null
          calling_hours_start?: string | null
          created_at?: string
          dealership_id: string
          id?: string
          max_call_duration?: number | null
          max_calls_per_day?: number | null
          name: string
          retry_attempts?: number | null
          retry_delay_hours?: number | null
          script_template: string
          status?: string
          target_criteria?: Json
          total_calls_made?: number | null
          total_connected?: number | null
          total_converted?: number | null
          transfer_phone?: string | null
          updated_at?: string
          voice_id?: string | null
          voice_provider?: string
        }
        Update: {
          calling_hours_end?: string | null
          calling_hours_start?: string | null
          created_at?: string
          dealership_id?: string
          id?: string
          max_call_duration?: number | null
          max_calls_per_day?: number | null
          name?: string
          retry_attempts?: number | null
          retry_delay_hours?: number | null
          script_template?: string
          status?: string
          target_criteria?: Json
          total_calls_made?: number | null
          total_connected?: number | null
          total_converted?: number | null
          transfer_phone?: string | null
          updated_at?: string
          voice_id?: string | null
          voice_provider?: string
        }
        Relationships: []
      }
      voice_grade_runs: {
        Row: {
          avg_composite: number | null
          avg_dim_brand_tone: number | null
          avg_dim_close_control: number | null
          avg_dim_compliance: number | null
          avg_dim_hallucination: number | null
          avg_dim_motivation_disco: number | null
          avg_dim_objection_handle: number | null
          avg_dim_pacing: number | null
          avg_dim_quote_band: number | null
          avg_dim_transfer_hygiene: number | null
          avg_dim_vehicle_confirm: number | null
          baseline_run_id: string | null
          created_at: string
          failed_calls: number | null
          finished_at: string | null
          gating_fail_count: number | null
          id: string
          notes: string | null
          rubric_version: string | null
          run_label: string
          started_at: string
          succeeded_calls: number | null
          total_calls: number | null
          triggered_by: string | null
        }
        Insert: {
          avg_composite?: number | null
          avg_dim_brand_tone?: number | null
          avg_dim_close_control?: number | null
          avg_dim_compliance?: number | null
          avg_dim_hallucination?: number | null
          avg_dim_motivation_disco?: number | null
          avg_dim_objection_handle?: number | null
          avg_dim_pacing?: number | null
          avg_dim_quote_band?: number | null
          avg_dim_transfer_hygiene?: number | null
          avg_dim_vehicle_confirm?: number | null
          baseline_run_id?: string | null
          created_at?: string
          failed_calls?: number | null
          finished_at?: string | null
          gating_fail_count?: number | null
          id?: string
          notes?: string | null
          rubric_version?: string | null
          run_label: string
          started_at?: string
          succeeded_calls?: number | null
          total_calls?: number | null
          triggered_by?: string | null
        }
        Update: {
          avg_composite?: number | null
          avg_dim_brand_tone?: number | null
          avg_dim_close_control?: number | null
          avg_dim_compliance?: number | null
          avg_dim_hallucination?: number | null
          avg_dim_motivation_disco?: number | null
          avg_dim_objection_handle?: number | null
          avg_dim_pacing?: number | null
          avg_dim_quote_band?: number | null
          avg_dim_transfer_hygiene?: number | null
          avg_dim_vehicle_confirm?: number | null
          baseline_run_id?: string | null
          created_at?: string
          failed_calls?: number | null
          finished_at?: string | null
          gating_fail_count?: number | null
          id?: string
          notes?: string | null
          rubric_version?: string | null
          run_label?: string
          started_at?: string
          succeeded_calls?: number | null
          total_calls?: number | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_grade_runs_baseline_run_id_fkey"
            columns: ["baseline_run_id"]
            isOneToOne: false
            referencedRelation: "voice_grade_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_pipeline_jobs: {
        Row: {
          call_id: string
          created_at: string
          enrich_attempts: number
          grade_attempts: number
          id: string
          last_error: string | null
          next_retry_at: string
          status: string
          updated_at: string
        }
        Insert: {
          call_id: string
          created_at?: string
          enrich_attempts?: number
          grade_attempts?: number
          id?: string
          last_error?: string | null
          next_retry_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          enrich_attempts?: number
          grade_attempts?: number
          id?: string
          last_error?: string | null
          next_retry_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_pipeline_jobs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "v_voice_call_quality"
            referencedColumns: ["call_id"]
          },
          {
            foreignKeyName: "voice_pipeline_jobs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "v_voice_call_quality_with_nps"
            referencedColumns: ["call_id"]
          },
          {
            foreignKeyName: "voice_pipeline_jobs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "voice_call_log"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_script_templates: {
        Row: {
          category: string | null
          created_at: string
          dealership_id: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          script_template: string
          variables: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          dealership_id?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          script_template: string
          variables?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string
          dealership_id?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          script_template?: string
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      v_bulk_access_anomalies: {
        Row: {
          dealership_id: string | null
          distinct_in_window: number | null
          staff_label: string | null
          staff_user_id: string | null
          window_start: string | null
        }
        Relationships: []
      }
      v_cron_health_recent: {
        Row: {
          command: string | null
          end_time: string | null
          jobname: string | null
          return_message: string | null
          schedule: string | null
          start_time: string | null
          status: string | null
        }
        Relationships: []
      }
      v_dealership_mfa_status: {
        Row: {
          dealership_id: string | null
          enrolled_staff: number | null
          enrollment_pct: number | null
          missing_high_priv_count: number | null
          total_staff: number | null
        }
        Relationships: []
      }
      v_dealership_privacy_posture: {
        Row: {
          active_opt_outs: number | null
          bulk_access_anomalies_14d: number | null
          customer_memory_retention_days: number | null
          dealership_id: string | null
          distinct_staff_pii_viewers_30d: number | null
          fulfilled_requests_90d: number | null
          last_memory_redact_at: string | null
          last_voice_redact_at: string | null
          notification_log_retention_days: number | null
          oldest_unredacted_call_at: string | null
          pending_data_requests: number | null
          recording_url_retention_days: number | null
          retention_config_updated_at: string | null
          staff_pii_views_30d: number | null
          voice_transcript_retention_days: number | null
        }
        Insert: {
          active_opt_outs?: never
          bulk_access_anomalies_14d?: never
          customer_memory_retention_days?: number | null
          dealership_id?: string | null
          distinct_staff_pii_viewers_30d?: never
          fulfilled_requests_90d?: never
          last_memory_redact_at?: never
          last_voice_redact_at?: never
          notification_log_retention_days?: number | null
          oldest_unredacted_call_at?: never
          pending_data_requests?: never
          recording_url_retention_days?: number | null
          retention_config_updated_at?: string | null
          staff_pii_views_30d?: never
          voice_transcript_retention_days?: number | null
        }
        Update: {
          active_opt_outs?: never
          bulk_access_anomalies_14d?: never
          customer_memory_retention_days?: number | null
          dealership_id?: string | null
          distinct_staff_pii_viewers_30d?: never
          fulfilled_requests_90d?: never
          last_memory_redact_at?: never
          last_voice_redact_at?: never
          notification_log_retention_days?: number | null
          oldest_unredacted_call_at?: never
          pending_data_requests?: never
          recording_url_retention_days?: number | null
          retention_config_updated_at?: string | null
          staff_pii_views_30d?: never
          voice_transcript_retention_days?: number | null
        }
        Relationships: []
      }
      v_error_log_recent: {
        Row: {
          first_seen_at: string | null
          last_seen_at: string | null
          occurrences: number | null
          sample_message: string | null
          severity: string | null
          source: string | null
        }
        Relationships: []
      }
      v_login_attempts_recent: {
        Row: {
          email: string | null
          failures: number | null
          ip_addr: unknown
          last_attempt_at: string | null
          successes: number | null
          total_attempts: number | null
        }
        Relationships: []
      }
      v_unmatched_customer_phrases: {
        Row: {
          avg_call_composite: number | null
          cluster_key: string | null
          dealership_id: string | null
          distinct_calls: number | null
          last_seen_at: string | null
          occurrence_count: number | null
          sample_text: string | null
        }
        Relationships: []
      }
      v_voice_call_quality: {
        Row: {
          call_id: string | null
          call_outcome: string | null
          composite_score: number | null
          customer_name: string | null
          dealership_id: string | null
          dim_compliance: number | null
          dim_hallucination: number | null
          dim_quote_band: number | null
          duration_seconds: number | null
          gating_failed: boolean | null
          grader_model: string | null
          grader_rationale: string | null
          started_at: string | null
          submission_id: string | null
          vehicle_info: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_voice_call_quality_with_nps: {
        Row: {
          call_id: string | null
          call_outcome: string | null
          composite_score: number | null
          customer_name: string | null
          dealership_id: string | null
          dim_compliance: number | null
          dim_hallucination: number | null
          dim_quote_band: number | null
          duration_seconds: number | null
          feedback_captured_at: string | null
          feedback_comment: string | null
          feedback_score: number | null
          gating_failed: boolean | null
          grader_model: string | null
          grader_rationale: string | null
          started_at: string | null
          submission_id: string | null
          vehicle_info: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_log_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_offer: { Args: { _token: string }; Returns: undefined }
      activation_in_pilot: {
        Args: { _activation_id: string }
        Returns: boolean
      }
      add_customer_memory_item: {
        Args: {
          _fact: string
          _kind?: string
          _source_call_id?: string
          _submission_id: string
        }
        Returns: undefined
      }
      apply_boost_bump: {
        Args: {
          _bump_amount: number
          _line_items: Json
          _new_offer: number
          _previous_offer: number
          _source: string
          _token: string
        }
        Returns: string
      }
      apply_voice_call_outcome: {
        Args: {
          _call_id: string
          _outcome_score: number
          _retire_gating_failures?: boolean
        }
        Returns: undefined
      }
      assign_submission_user: {
        Args: { _role: string; _submission_id: string; _user_id: string }
        Returns: undefined
      }
      can_act_in_state: {
        Args: { _state: string; _user_id: string }
        Returns: boolean
      }
      can_touch: {
        Args: { _channel: string; _submission_id: string }
        Returns: {
          decision: string
          reason: string
        }[]
      }
      can_view_submission: {
        Args: {
          _submission_dealership_id: string
          _submission_location_id: string
          _user_id: string
        }
        Returns: boolean
      }
      channel_enabled: {
        Args: { _channel: string; _dealership_id: string; _location_id: string }
        Returns: boolean
      }
      cleanup_old_lookup_attempts: { Args: never; Returns: undefined }
      compile_voice_agent_prompt:
        | {
            Args: {
              _call_type?: string
              _dealership_id?: string
              _submission_id?: string
            }
            Returns: string
          }
        | {
            Args: {
              _call_id?: string
              _call_type?: string
              _dealership_id?: string
              _submission_id?: string
            }
            Returns: string
          }
      consume_mfa_backup_code: { Args: { _code: string }; Returns: Json }
      cron_health_check: { Args: never; Returns: undefined }
      customer_self_checkin: {
        Args: { _status: string; _token: string }
        Returns: Json
      }
      decay_voice_variant_counts: { Args: never; Returns: undefined }
      decide_offer_request: {
        Args: {
          _decision: string
          _decision_notes?: string
          _request_id: string
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detach_rooftop: {
        Args: {
          _dealership_id: string
          _performed_by_email?: string
          _performed_by_user_id?: string
          _reason: string
          _to_dealer_group_id: string
        }
        Returns: string
      }
      effective_inspection_input_modes: {
        Args: { _dealership_id: string; _location_id: string }
        Returns: {
          brake_mode: string
          tire_mode: string
        }[]
      }
      effective_user_sections: {
        Args: { _sections: Json; _user_id: string }
        Returns: string[]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_voice_pipeline_job: {
        Args: { _call_id: string }
        Returns: undefined
      }
      expire_pilots: { Args: never; Returns: number }
      export_customer_data: { Args: { _token: string }; Returns: Json }
      finalize_voice_grade_run: { Args: { _run_id: string }; Returns: Json }
      generate_mfa_backup_codes: { Args: never; Returns: Json }
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
      get_call_feedback_context:
        | {
            Args: { _token: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_call_feedback_context(_token => text), public.get_call_feedback_context(_token => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"[]
          }
        | {
            Args: { _token: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_call_feedback_context(_token => text), public.get_call_feedback_context(_token => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      get_customer_arrival_page: {
        Args: { _token: string }
        Returns: {
          appointment_date: string
          appointment_time: string
          customer_first_name: string
          dealership_id: string
          dealership_name: string
          plate: string
          progress_status: string
          salesperson_name: string
          self_checkin_at: string
          self_checkin_status: string
          submission_id: string
          vehicle_make: string
          vehicle_model: string
          vehicle_trim: string
          vehicle_year: string
          vin_last6: string
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
      get_objection_playbook_for_voice: {
        Args: { _dealership_id?: string }
        Returns: string
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
          location_id: string
          slug: string
        }[]
      }
      get_user_dealer_group_id: { Args: { _user_id: string }; Returns: string }
      get_user_dealership_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dealer_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_login_locked: { Args: { _email: string; _ip?: string }; Returns: Json }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      licensed_states_valid: { Args: { _states: string[] }; Returns: boolean }
      log_customer_data_access: {
        Args: {
          _metadata?: Json
          _request_path?: string
          _resource_kind: string
          _submission_id: string
          _voice_call_id: string
        }
        Returns: undefined
      }
      log_mfa_event: {
        Args: { _event_kind: string; _factor_type?: string; _metadata?: Json }
        Returns: undefined
      }
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
      mark_call_golden: {
        Args: { _call_id: string; _pinned?: boolean }
        Returns: Json
      }
      mark_docs_uploaded: { Args: { _token: string }; Returns: undefined }
      mark_photos_uploaded: { Args: { _token: string }; Returns: undefined }
      mark_voice_pipeline_job: {
        Args: {
          _bump?: string
          _call_id: string
          _error?: string
          _status: string
        }
        Returns: undefined
      }
      merge_rooftop: {
        Args: {
          _create_pilot?: boolean
          _dealership_id: string
          _performed_by_email?: string
          _performed_by_user_id?: string
          _reason: string
          _to_dealer_group_id: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pickup_stuck_voice_pipeline_jobs: {
        Args: { _limit?: number }
        Returns: {
          call_id: string
          enrich_attempts: number
          grade_attempts: number
          id: string
          status: string
        }[]
      }
      purge_customer_data: { Args: { _token: string }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recent_boost_bump: {
        Args: { _token: string; _within_seconds?: number }
        Returns: {
          bump_amount: number
          created_at: string
          id: string
          line_items: Json
          new_offer: number
          previous_offer: number
        }[]
      }
      record_login_attempt: {
        Args: {
          _email: string
          _ip?: string
          _reason?: string
          _success: boolean
          _ua?: string
        }
        Returns: undefined
      }
      redact_old_customer_memory: { Args: never; Returns: Json }
      redact_old_voice_pii: { Args: never; Returns: Json }
      remove_staff_role: { Args: { _role_id: string }; Returns: undefined }
      report_error: {
        Args: {
          _call_id?: string
          _context?: Json
          _dealership_id?: string
          _message: string
          _severity?: string
          _source: string
          _stack?: string
          _submission_id?: string
        }
        Returns: string
      }
      request_customer_data_action: {
        Args: { _email?: string; _kind?: string; _phone?: string }
        Returns: Json
      }
      request_offer_increase: {
        Args: {
          _reason?: string
          _reason_notes?: string
          _requested_by_role?: string
          _requested_offer: number
          _submission_id: string
        }
        Returns: Json
      }
      require_mfa_for_user: { Args: never; Returns: Json }
      role_requires_state_license: { Args: { _role: string }; Returns: boolean }
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
      set_my_call_availability: {
        Args: {
          p_dnd: boolean
          p_phone: string
          p_quiet_end: string
          p_quiet_start: string
          p_quiet_tz: string
        }
        Returns: undefined
      }
      submit_call_feedback:
        | {
            Args: { _comment?: string; _score: number; _token: string }
            Returns: Json
          }
        | {
            Args: { _comment?: string; _score: number; _token: string }
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
      app_role:
        | "admin"
        | "user"
        | "sales_bdc"
        | "used_car_manager"
        | "gsm_gm"
        | "gm"
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
      app_role: [
        "admin",
        "user",
        "sales_bdc",
        "used_car_manager",
        "gsm_gm",
        "gm",
      ],
    },
  },
} as const

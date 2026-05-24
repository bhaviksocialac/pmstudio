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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_drafts: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["ai_draft_kind"]
          meta: Json
          project_id: string | null
          recipient_id: string | null
          recipient_kind: string
          recipient_name: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["ai_draft_status"]
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["ai_draft_kind"]
          meta?: Json
          project_id?: string | null
          recipient_id?: string | null
          recipient_kind: string
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["ai_draft_status"]
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ai_draft_kind"]
          meta?: Json
          project_id?: string | null
          recipient_id?: string | null
          recipient_kind?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["ai_draft_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          project_id: string | null
          status: Database["public"]["Enums"]["approval_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          order_index: number
          percentage: number
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          id?: string
          order_index?: number
          percentage?: number
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          order_index?: number
          percentage?: number
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      change_orders: {
        Row: {
          additional_cost: number
          client_note: string | null
          created_at: string
          decided_at: string | null
          description: string
          id: string
          project_id: string
          reason: string | null
          requested_at: string | null
          status: Database["public"]["Enums"]["change_order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_cost?: number
          client_note?: string | null
          created_at?: string
          decided_at?: string | null
          description: string
          id?: string
          project_id: string
          reason?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["change_order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_cost?: number
          client_note?: string | null
          created_at?: string
          decided_at?: string | null
          description?: string
          id?: string
          project_id?: string
          reason?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["change_order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          flat_number: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          phone: string | null
          pincode: string | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          flat_number?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          flat_number?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      email_log: {
        Row: {
          client_id: string | null
          created_at: string
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["email_kind"]
          meta: Json
          project_id: string | null
          provider_id: string | null
          recipient_email: string
          recipient_name: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind: Database["public"]["Enums"]["email_kind"]
          meta?: Json
          project_id?: string | null
          provider_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["email_kind"]
          meta?: Json
          project_id?: string | null
          provider_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          due_at: string | null
          id: string
          milestone: string | null
          number: string | null
          paid_at: string | null
          project_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          milestone?: string | null
          number?: string | null
          paid_at?: string | null
          project_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          milestone?: string | null
          number?: string | null
          paid_at?: string | null
          project_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          location: string | null
          notes: string | null
          project_id: string | null
          scheduled_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          scheduled_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          project_id?: string | null
          scheduled_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          from_me: boolean
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          sent_at: string
          thread_with: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          from_me?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          sent_at?: string
          thread_with?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          from_me?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          sent_at?: string
          thread_with?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          approval_id: string | null
          client_message_template: string | null
          created_at: string
          description: string | null
          id: string
          invoice_amount: number
          invoice_id: string | null
          kind: Database["public"]["Enums"]["milestone_kind"]
          name: string
          order_index: number
          project_id: string
          status: Database["public"]["Enums"]["milestone_status"]
          trigger: Json
          triggered_at: string | null
          triggered_on_time: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_id?: string | null
          client_message_template?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_amount?: number
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["milestone_kind"]
          name: string
          order_index?: number
          project_id: string
          status?: Database["public"]["Enums"]["milestone_status"]
          trigger?: Json
          triggered_at?: string | null
          triggered_on_time?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_id?: string | null
          client_message_template?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_amount?: number
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["milestone_kind"]
          name?: string
          order_index?: number
          project_id?: string
          status?: Database["public"]["Enums"]["milestone_status"]
          trigger?: Json
          triggered_at?: string | null
          triggered_on_time?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      one_time_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          item_key: string
          label: string
          paid_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          item_key: string
          label: string
          paid_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          item_key?: string
          label?: string
          paid_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          project_id: string | null
          scope: string | null
          status: Database["public"]["Enums"]["payment_status"]
          submitted_at: string
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          project_id?: string | null
          scope?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          project_id?: string | null
          scope?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_subcategories: {
        Row: {
          checklist: Json
          contractor_name: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          order_index: number
          phase: string
          project_id: string
          signed_off_at: string | null
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          checklist?: Json
          contractor_name?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          order_index?: number
          phase: string
          project_id: string
          signed_off_at?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          checklist?: Json
          contractor_name?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          phase?: string
          project_id?: string
          signed_off_at?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      phase_subcategory_vendors: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_index: number
          scope: string | null
          subcategory_id: string
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_index?: number
          scope?: string | null
          subcategory_id: string
          updated_at?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_index?: number
          scope?: string | null
          subcategory_id?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string | null
          project_id: string | null
          room: string | null
          status: Database["public"]["Enums"]["photo_status"]
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          project_id?: string | null
          room?: string | null
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          project_id?: string | null
          room?: string | null
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          studio_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          studio_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          studio_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_contractors: {
        Row: {
          category: string | null
          created_at: string
          expected_days: number
          id: string
          name: string
          phone: string | null
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          expected_days?: number
          id?: string
          name: string
          phone?: string | null
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          expected_days?: number
          id?: string
          name?: string
          phone?: string | null
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_phases: {
        Row: {
          completion: number
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          order_index: number
          phase: Database["public"]["Enums"]["project_phase"]
          project_id: string
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completion?: number
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          order_index: number
          phase: Database["public"]["Enums"]["project_phase"]
          project_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completion?: number
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          phase?: Database["public"]["Enums"]["project_phase"]
          project_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_rooms: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_vendors: {
        Row: {
          created_at: string
          expected_delivery: string | null
          id: string
          notes: string | null
          po_amount: number
          project_id: string
          scope: string | null
          status: string
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          po_amount?: number
          project_id: string
          scope?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          po_amount?: number
          project_id?: string
          scope?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number
          city: string | null
          client_id: string | null
          completion: number
          country: string | null
          created_at: string
          description: string | null
          end_date: string | null
          expected_handover: string | null
          flat_number: string | null
          health: Database["public"]["Enums"]["project_health"]
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          phase: Database["public"]["Enums"]["project_phase"]
          pincode: string | null
          spent: number
          start_date: string | null
          state: string | null
          street: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number
          city?: string | null
          client_id?: string | null
          completion?: number
          country?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          expected_handover?: string | null
          flat_number?: string | null
          health?: Database["public"]["Enums"]["project_health"]
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          phase?: Database["public"]["Enums"]["project_phase"]
          pincode?: string | null
          spent?: number
          start_date?: string | null
          state?: string | null
          street?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number
          city?: string | null
          client_id?: string | null
          completion?: number
          country?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          expected_handover?: string | null
          flat_number?: string | null
          health?: Database["public"]["Enums"]["project_health"]
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          phase?: Database["public"]["Enums"]["project_phase"]
          pincode?: string | null
          spent?: number
          start_date?: string | null
          state?: string | null
          street?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      room_scope_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          label: string
          order_index: number
          project_id: string
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          label: string
          order_index?: number
          project_id: string
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          order_index?: number
          project_id?: string
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_attendance: {
        Row: {
          attendance_date: string
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_outside_geofence: boolean
          checked_in_at: string | null
          contractor_id: string
          created_at: string
          hours_on_site: number | null
          id: string
          present: boolean
          project_id: string
          updated_at: string
          user_id: string
          work_done: string | null
          workers_count: number
        }
        Insert: {
          attendance_date?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_outside_geofence?: boolean
          checked_in_at?: string | null
          contractor_id: string
          created_at?: string
          hours_on_site?: number | null
          id?: string
          present?: boolean
          project_id: string
          updated_at?: string
          user_id: string
          work_done?: string | null
          workers_count?: number
        }
        Update: {
          attendance_date?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_outside_geofence?: boolean
          checked_in_at?: string | null
          contractor_id?: string
          created_at?: string
          hours_on_site?: number | null
          id?: string
          present?: boolean
          project_id?: string
          updated_at?: string
          user_id?: string
          work_done?: string | null
          workers_count?: number
        }
        Relationships: []
      }
      site_reports: {
        Row: {
          auto_generated: boolean
          created_at: string
          id: string
          issues: string | null
          location: string | null
          pdf_url: string | null
          photo_urls: Json
          project_id: string
          report_date: string
          sent_to_client_at: string | null
          summary: Json
          updated_at: string
          user_id: string
          work_done: string | null
          workers_present: number | null
        }
        Insert: {
          auto_generated?: boolean
          created_at?: string
          id?: string
          issues?: string | null
          location?: string | null
          pdf_url?: string | null
          photo_urls?: Json
          project_id: string
          report_date?: string
          sent_to_client_at?: string | null
          summary?: Json
          updated_at?: string
          user_id: string
          work_done?: string | null
          workers_present?: number | null
        }
        Update: {
          auto_generated?: boolean
          created_at?: string
          id?: string
          issues?: string | null
          location?: string | null
          pdf_url?: string | null
          photo_urls?: Json
          project_id?: string
          report_date?: string
          sent_to_client_at?: string | null
          summary?: Json
          updated_at?: string
          user_id?: string
          work_done?: string | null
          workers_present?: number | null
        }
        Relationships: []
      }
      snags: {
        Row: {
          after_photo_url: string | null
          before_photo_url: string | null
          contractor_name: string | null
          created_at: string
          deadline: string | null
          description: string
          id: string
          linked_task_id: string | null
          photo_url: string | null
          priority: string
          project_id: string
          raised_date: string
          reopen_reason: string | null
          resolved_at: string | null
          room: string | null
          status: Database["public"]["Enums"]["snag_status"]
          target_fix_date: string | null
          updated_at: string
          user_id: string
          vendor_id: string | null
          verified_at: string | null
          verified_by: string | null
          work_type: string | null
        }
        Insert: {
          after_photo_url?: string | null
          before_photo_url?: string | null
          contractor_name?: string | null
          created_at?: string
          deadline?: string | null
          description: string
          id?: string
          linked_task_id?: string | null
          photo_url?: string | null
          priority?: string
          project_id: string
          raised_date?: string
          reopen_reason?: string | null
          resolved_at?: string | null
          room?: string | null
          status?: Database["public"]["Enums"]["snag_status"]
          target_fix_date?: string | null
          updated_at?: string
          user_id: string
          vendor_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          work_type?: string | null
        }
        Update: {
          after_photo_url?: string | null
          before_photo_url?: string | null
          contractor_name?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          linked_task_id?: string | null
          photo_url?: string | null
          priority?: string
          project_id?: string
          raised_date?: string
          reopen_reason?: string | null
          resolved_at?: string | null
          room?: string | null
          status?: Database["public"]["Enums"]["snag_status"]
          target_fix_date?: string | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          work_type?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          razorpay_plan_id: string | null
          razorpay_subscription_id: string | null
          short_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan: string
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          short_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          short_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          action_label: string | null
          action_required: boolean
          actual_end: string | null
          actual_start: string | null
          agency: string | null
          area: string | null
          areas: Json
          assignee: string | null
          attachments: Json
          completion_pct: number
          contractor: string | null
          created_at: string
          delayed: boolean
          depends_on: Json
          description: string | null
          done: boolean
          due_date: string | null
          id: string
          ifa_date: string | null
          ifc_date: string | null
          ifr_date: string | null
          ifr_type: string | null
          mailed: boolean
          notes: string | null
          parent_task_id: string | null
          phase: string | null
          planned_end: string | null
          planned_start: string | null
          priority: string
          project_id: string | null
          room: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          vendor_id: string | null
          work_type: string | null
          work_types: Json
        }
        Insert: {
          action_label?: string | null
          action_required?: boolean
          actual_end?: string | null
          actual_start?: string | null
          agency?: string | null
          area?: string | null
          areas?: Json
          assignee?: string | null
          attachments?: Json
          completion_pct?: number
          contractor?: string | null
          created_at?: string
          delayed?: boolean
          depends_on?: Json
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          ifa_date?: string | null
          ifc_date?: string | null
          ifr_date?: string | null
          ifr_type?: string | null
          mailed?: boolean
          notes?: string | null
          parent_task_id?: string | null
          phase?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          project_id?: string | null
          room?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          vendor_id?: string | null
          work_type?: string | null
          work_types?: Json
        }
        Update: {
          action_label?: string | null
          action_required?: boolean
          actual_end?: string | null
          actual_start?: string | null
          agency?: string | null
          area?: string | null
          areas?: Json
          assignee?: string | null
          attachments?: Json
          completion_pct?: number
          contractor?: string | null
          created_at?: string
          delayed?: boolean
          depends_on?: Json
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          ifa_date?: string | null
          ifc_date?: string | null
          ifr_date?: string | null
          ifr_type?: string | null
          mailed?: boolean
          notes?: string | null
          parent_task_id?: string | null
          phase?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          project_id?: string | null
          room?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
          work_type?: string | null
          work_types?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_options: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      vendor_deliveries: {
        Row: {
          created_at: string
          expected_date: string
          id: string
          item: string
          project_id: string
          status: Database["public"]["Enums"]["vendor_delivery_status"]
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          expected_date: string
          id?: string
          item: string
          project_id: string
          status?: Database["public"]["Enums"]["vendor_delivery_status"]
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          expected_date?: string
          id?: string
          item?: string
          project_id?: string
          status?: Database["public"]["Enums"]["vendor_delivery_status"]
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          bank_account: string | null
          category: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          flat_number: string | null
          gst: string | null
          id: string
          ifsc: string | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          pan: string | null
          payment_terms: string | null
          phone: string | null
          pincode: string | null
          rating: number | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          bank_account?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          flat_number?: string | null
          gst?: string | null
          id?: string
          ifsc?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          pan?: string | null
          payment_terms?: string | null
          phone?: string | null
          pincode?: string | null
          rating?: number | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          bank_account?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          flat_number?: string | null
          gst?: string | null
          id?: string
          ifsc?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          pan?: string | null
          payment_terms?: string | null
          phone?: string | null
          pincode?: string | null
          rating?: number | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["whatsapp_group_kind"]
          label: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["whatsapp_group_kind"]
          label: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["whatsapp_group_kind"]
          label?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ai_draft_kind:
        | "weekly_report"
        | "vendor_followup"
        | "delay_notice"
        | "holding"
        | "event_notification"
        | "attendance_summary"
      ai_draft_status: "pending" | "sent" | "discarded"
      approval_status: "pending" | "approved" | "rejected"
      change_order_status:
        | "draft"
        | "pending_client"
        | "approved"
        | "rejected"
        | "active"
      email_kind:
        | "welcome"
        | "invoice"
        | "milestone"
        | "weekly_summary"
        | "daily_report"
      email_status:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed"
      invoice_status: "draft" | "sent" | "paid" | "overdue"
      message_kind: "client" | "vendor"
      milestone_kind: "room" | "phase" | "work_type" | "custom"
      milestone_status: "pending" | "triggered" | "invoice_sent" | "paid"
      payment_status: "pending" | "approved" | "paid" | "held"
      photo_status: "pending" | "approved" | "rejected"
      project_health: "on-track" | "attention" | "urgent"
      project_phase:
        | "Survey"
        | "Design"
        | "Procurement"
        | "Execution"
        | "Finishing"
        | "Handover"
      project_type: "residential" | "commercial"
      snag_status:
        | "open"
        | "in_progress"
        | "resolved"
        | "fixed"
        | "verified"
        | "closed"
        | "reopened"
      vendor_delivery_status: "pending" | "delivered" | "delayed"
      whatsapp_group_kind: "client" | "design" | "execution" | "accounts"
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
      ai_draft_kind: [
        "weekly_report",
        "vendor_followup",
        "delay_notice",
        "holding",
        "event_notification",
        "attendance_summary",
      ],
      ai_draft_status: ["pending", "sent", "discarded"],
      approval_status: ["pending", "approved", "rejected"],
      change_order_status: [
        "draft",
        "pending_client",
        "approved",
        "rejected",
        "active",
      ],
      email_kind: [
        "welcome",
        "invoice",
        "milestone",
        "weekly_summary",
        "daily_report",
      ],
      email_status: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "complained",
        "failed",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue"],
      message_kind: ["client", "vendor"],
      milestone_kind: ["room", "phase", "work_type", "custom"],
      milestone_status: ["pending", "triggered", "invoice_sent", "paid"],
      payment_status: ["pending", "approved", "paid", "held"],
      photo_status: ["pending", "approved", "rejected"],
      project_health: ["on-track", "attention", "urgent"],
      project_phase: [
        "Survey",
        "Design",
        "Procurement",
        "Execution",
        "Finishing",
        "Handover",
      ],
      project_type: ["residential", "commercial"],
      snag_status: [
        "open",
        "in_progress",
        "resolved",
        "fixed",
        "verified",
        "closed",
        "reopened",
      ],
      vendor_delivery_status: ["pending", "delivered", "delayed"],
      whatsapp_group_kind: ["client", "design", "execution", "accounts"],
    },
  },
} as const

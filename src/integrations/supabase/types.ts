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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          booking_enabled: boolean | null
          club_facility_id: string
          club_id: string
          cost_per_session: number | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          max_capacity: number | null
          monthly_fee: number
          notes: string | null
          picture_url: string | null
          requires_prebooking: boolean | null
          sessions_per_week: number
          title: string
          updated_at: string | null
        }
        Insert: {
          booking_enabled?: boolean | null
          club_facility_id: string
          club_id: string
          cost_per_session?: number | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          max_capacity?: number | null
          monthly_fee: number
          notes?: string | null
          picture_url?: string | null
          requires_prebooking?: boolean | null
          sessions_per_week?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          booking_enabled?: boolean | null
          club_facility_id?: string
          club_id?: string
          cost_per_session?: number | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          max_capacity?: number | null
          monthly_fee?: number
          notes?: string | null
          picture_url?: string | null
          requires_prebooking?: boolean | null
          sessions_per_week?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_club_facility_id_fkey"
            columns: ["club_facility_id"]
            isOneToOne: false
            referencedRelation: "club_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_facility_id_fkey"
            columns: ["club_facility_id"]
            isOneToOne: false
            referencedRelation: "club_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_schedules: {
        Row: {
          activity_id: string
          created_at: string | null
          day_of_week: string
          end_time: string
          id: string
          notes: string | null
          start_time: string
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          day_of_week: string
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          day_of_week?: string
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_schedules_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_skills: {
        Row: {
          activity_id: string
          created_at: string | null
          id: string
          skill_category: string | null
          skill_name: string
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          id?: string
          skill_category?: string | null
          skill_name: string
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          id?: string
          skill_category?: string | null
          skill_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_skills_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number_encrypted: string
          bank_name: string
          club_id: string
          created_at: string | null
          iban_encrypted: string | null
          id: string
          is_primary: boolean | null
          swift_code_encrypted: string | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number_encrypted: string
          bank_name: string
          club_id: string
          created_at?: string | null
          iban_encrypted?: string | null
          id?: string
          is_primary?: boolean | null
          swift_code_encrypted?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number_encrypted?: string
          bank_name?: string
          club_id?: string
          created_at?: string | null
          iban_encrypted?: string | null
          id?: string
          is_primary?: boolean | null
          swift_code_encrypted?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          avatar_url: string | null
          blood_type: string | null
          created_at: string | null
          date_of_birth: string
          gender: string
          id: string
          name: string
          nationality: string
          parent_user_id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          blood_type?: string | null
          created_at?: string | null
          date_of_birth: string
          gender: string
          id?: string
          name: string
          nationality?: string
          parent_user_id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          blood_type?: string | null
          created_at?: string | null
          date_of_birth?: string
          gender?: string
          id?: string
          name?: string
          nationality?: string
          parent_user_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      club_amenities: {
        Row: {
          available: boolean | null
          club_id: string
          created_at: string | null
          icon: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          available?: boolean | null
          club_id: string
          created_at?: string | null
          icon: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          available?: boolean | null
          club_id?: string
          created_at?: string | null
          icon?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_amenities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_classes: {
        Row: {
          available: boolean | null
          club_id: string
          created_at: string | null
          duration: number | null
          gender_restriction: string | null
          id: string
          instructor_id: string | null
          max_capacity: number | null
          name: string
          time: string
          updated_at: string | null
        }
        Insert: {
          available?: boolean | null
          club_id: string
          created_at?: string | null
          duration?: number | null
          gender_restriction?: string | null
          id?: string
          instructor_id?: string | null
          max_capacity?: number | null
          name: string
          time: string
          updated_at?: string | null
        }
        Update: {
          available?: boolean | null
          club_id?: string
          created_at?: string | null
          duration?: number | null
          gender_restriction?: string | null
          id?: string
          instructor_id?: string | null
          max_capacity?: number | null
          name?: string
          time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_classes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "club_instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      club_community_posts: {
        Row: {
          author_avatar: string | null
          author_name: string
          club_id: string
          comments_count: number | null
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          posted_at: string | null
          updated_at: string | null
        }
        Insert: {
          author_avatar?: string | null
          author_name: string
          club_id: string
          comments_count?: number | null
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          posted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          author_avatar?: string | null
          author_name?: string
          club_id?: string
          comments_count?: number | null
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          posted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_community_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_facilities: {
        Row: {
          address: string
          club_id: string
          created_at: string | null
          description: string | null
          id: string
          is_available: boolean | null
          is_rentable: boolean | null
          latitude: number
          longitude: number
          map_zoom: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          address: string
          club_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          is_rentable?: boolean | null
          latitude: number
          longitude: number
          map_zoom?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          club_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          is_rentable?: boolean | null
          latitude?: number
          longitude?: number
          map_zoom?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_facilities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_instructors: {
        Row: {
          achievements: string | null
          bio: string | null
          certifications: string | null
          club_id: string
          club_rating: number | null
          created_at: string | null
          credentials: string | null
          experience: string
          id: string
          image_url: string | null
          link_tree: Json | null
          member_id: string | null
          name: string
          offers_personal_training: boolean | null
          rating: number | null
          specialty: string
          specialty_tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          achievements?: string | null
          bio?: string | null
          certifications?: string | null
          club_id: string
          club_rating?: number | null
          created_at?: string | null
          credentials?: string | null
          experience: string
          id?: string
          image_url?: string | null
          link_tree?: Json | null
          member_id?: string | null
          name: string
          offers_personal_training?: boolean | null
          rating?: number | null
          specialty: string
          specialty_tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          achievements?: string | null
          bio?: string | null
          certifications?: string | null
          club_id?: string
          club_rating?: number | null
          created_at?: string | null
          credentials?: string | null
          experience?: string
          id?: string
          image_url?: string | null
          link_tree?: Json | null
          member_id?: string | null
          name?: string
          offers_personal_training?: boolean | null
          rating?: number | null
          specialty?: string
          specialty_tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_instructors_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_instructors_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          achievements: number | null
          avatar_url: string | null
          child_id: string | null
          club_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_instructor: boolean | null
          joined_date: string | null
          leave_reason: string | null
          left_date: string | null
          name: string
          payment_screenshot_url: string | null
          rank: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          achievements?: number | null
          avatar_url?: string | null
          child_id?: string | null
          club_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_instructor?: boolean | null
          joined_date?: string | null
          leave_reason?: string | null
          left_date?: string | null
          name: string
          payment_screenshot_url?: string | null
          rank: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          achievements?: number | null
          avatar_url?: string | null
          child_id?: string | null
          club_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_instructor?: boolean | null
          joined_date?: string | null
          leave_reason?: string | null
          left_date?: string | null
          name?: string
          payment_screenshot_url?: string | null
          rank?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_members_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_packages: {
        Row: {
          activity_type: string | null
          age_max: number | null
          age_min: number | null
          booking_enabled: boolean | null
          club_id: string
          created_at: string | null
          description: string | null
          discount_code: string | null
          discount_percentage: number | null
          duration_months: number
          duration_type: string | null
          end_date: string | null
          gender_restriction: string | null
          id: string
          is_popular: boolean | null
          max_bookings: number | null
          name: string
          picture_url: string | null
          popularity: number | null
          price: number
          session_count: number | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          activity_type?: string | null
          age_max?: number | null
          age_min?: number | null
          booking_enabled?: boolean | null
          club_id: string
          created_at?: string | null
          description?: string | null
          discount_code?: string | null
          discount_percentage?: number | null
          duration_months: number
          duration_type?: string | null
          end_date?: string | null
          gender_restriction?: string | null
          id?: string
          is_popular?: boolean | null
          max_bookings?: number | null
          name: string
          picture_url?: string | null
          popularity?: number | null
          price: number
          session_count?: number | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_type?: string | null
          age_max?: number | null
          age_min?: number | null
          booking_enabled?: boolean | null
          club_id?: string
          created_at?: string | null
          description?: string | null
          discount_code?: string | null
          discount_percentage?: number | null
          duration_months?: number
          duration_type?: string | null
          end_date?: string | null
          gender_restriction?: string | null
          id?: string
          is_popular?: boolean | null
          max_bookings?: number | null
          name?: string
          picture_url?: string | null
          popularity?: number | null
          price?: number
          session_count?: number | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_packages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_partners: {
        Row: {
          category: string | null
          club_id: string
          contact_info: Json | null
          created_at: string | null
          description: string | null
          discount_text: string | null
          id: string
          logo_url: string | null
          name: string
          requirements: string | null
          terms: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          club_id: string
          contact_info?: Json | null
          created_at?: string | null
          description?: string | null
          discount_text?: string | null
          id?: string
          logo_url?: string | null
          name: string
          requirements?: string | null
          terms?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          club_id?: string
          contact_info?: Json | null
          created_at?: string | null
          description?: string | null
          discount_text?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          requirements?: string | null
          terms?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_partners_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_pictures: {
        Row: {
          club_id: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string
        }
        Insert: {
          club_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url: string
        }
        Update: {
          club_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_pictures_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_products: {
        Row: {
          category: string
          club_id: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          in_stock: boolean | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          category: string
          club_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          club_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_products_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_reviews: {
        Row: {
          club_id: string
          comment: string
          created_at: string | null
          id: string
          rating: number
          reviewer_name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          club_id: string
          comment: string
          created_at?: string | null
          id?: string
          rating: number
          reviewer_name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          club_id?: string
          comment?: string
          created_at?: string | null
          id?: string
          rating?: number
          reviewer_name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_statistics: {
        Row: {
          active_members: number | null
          average_session_minutes: number | null
          calories_burned: number | null
          club_id: string
          created_at: string | null
          id: string
          total_workouts: number | null
          updated_at: string | null
        }
        Insert: {
          active_members?: number | null
          average_session_minutes?: number | null
          calories_burned?: number | null
          club_id: string
          created_at?: string | null
          id?: string
          total_workouts?: number | null
          updated_at?: string | null
        }
        Update: {
          active_members?: number | null
          average_session_minutes?: number | null
          calories_burned?: number | null
          club_id?: string
          created_at?: string | null
          id?: string
          total_workouts?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_statistics_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_swift_code: string | null
          business_owner_id: string | null
          child_code_prefix: string | null
          classes_count: number | null
          club_email: string | null
          club_phone: string | null
          club_phone_code: string | null
          club_slug: string | null
          commercial_registration_number: string | null
          country_iso: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          enrollment_fee: number | null
          expense_code_prefix: string | null
          favicon_url: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          image_url: string | null
          invoice_code_prefix: string | null
          link_tree: Json | null
          location: string | null
          logo_url: string | null
          map_zoom: number | null
          member_code_prefix: string | null
          members_count: number | null
          name: string
          opening_hours: Json | null
          owner_contact: string | null
          owner_contact_code: string | null
          owner_email: string | null
          owner_name: string | null
          peak_hours: string | null
          rating: number | null
          receipt_code_prefix: string | null
          slogan: string | null
          slogan_explanation: string | null
          specialist_code_prefix: string | null
          timezone: string | null
          trainers_count: number | null
          updated_at: string | null
          vat_percentage: number | null
          vat_registration_number: string | null
          welcoming_message: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift_code?: string | null
          business_owner_id?: string | null
          child_code_prefix?: string | null
          classes_count?: number | null
          club_email?: string | null
          club_phone?: string | null
          club_phone_code?: string | null
          club_slug?: string | null
          commercial_registration_number?: string | null
          country_iso?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          enrollment_fee?: number | null
          expense_code_prefix?: string | null
          favicon_url?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          image_url?: string | null
          invoice_code_prefix?: string | null
          link_tree?: Json | null
          location?: string | null
          logo_url?: string | null
          map_zoom?: number | null
          member_code_prefix?: string | null
          members_count?: number | null
          name: string
          opening_hours?: Json | null
          owner_contact?: string | null
          owner_contact_code?: string | null
          owner_email?: string | null
          owner_name?: string | null
          peak_hours?: string | null
          rating?: number | null
          receipt_code_prefix?: string | null
          slogan?: string | null
          slogan_explanation?: string | null
          specialist_code_prefix?: string | null
          timezone?: string | null
          trainers_count?: number | null
          updated_at?: string | null
          vat_percentage?: number | null
          vat_registration_number?: string | null
          welcoming_message?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift_code?: string | null
          business_owner_id?: string | null
          child_code_prefix?: string | null
          classes_count?: number | null
          club_email?: string | null
          club_phone?: string | null
          club_phone_code?: string | null
          club_slug?: string | null
          commercial_registration_number?: string | null
          country_iso?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          enrollment_fee?: number | null
          expense_code_prefix?: string | null
          favicon_url?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          image_url?: string | null
          invoice_code_prefix?: string | null
          link_tree?: Json | null
          location?: string | null
          logo_url?: string | null
          map_zoom?: number | null
          member_code_prefix?: string | null
          members_count?: number | null
          name?: string
          opening_hours?: Json | null
          owner_contact?: string | null
          owner_contact_code?: string | null
          owner_email?: string | null
          owner_name?: string | null
          peak_hours?: string | null
          rating?: number | null
          receipt_code_prefix?: string | null
          slogan?: string | null
          slogan_explanation?: string | null
          specialist_code_prefix?: string | null
          timezone?: string | null
          trainers_count?: number | null
          updated_at?: string | null
          vat_percentage?: number | null
          vat_registration_number?: string | null
          welcoming_message?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          club_id: string
          created_at: string | null
          id: string
          last_message_at: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_operating_hours: {
        Row: {
          club_facility_id: string
          created_at: string | null
          day_of_week: string
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          club_facility_id: string
          created_at?: string | null
          day_of_week: string
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          club_facility_id?: string
          created_at?: string | null
          day_of_week?: string
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_operating_hours_club_facility_id_fkey"
            columns: ["club_facility_id"]
            isOneToOne: false
            referencedRelation: "club_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_pictures: {
        Row: {
          club_facility_id: string
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
        }
        Insert: {
          club_facility_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
        }
        Update: {
          club_facility_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_pictures_club_facility_id_fkey"
            columns: ["club_facility_id"]
            isOneToOne: false
            referencedRelation: "club_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_pictures_facility_id_fkey"
            columns: ["club_facility_id"]
            isOneToOne: false
            referencedRelation: "club_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_rentable_times: {
        Row: {
          club_facility_id: string
          created_at: string | null
          day_of_week: string
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          club_facility_id: string
          created_at?: string | null
          day_of_week: string
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          club_facility_id?: string
          created_at?: string | null
          day_of_week?: string
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_rentable_times_club_facility_id_fkey"
            columns: ["club_facility_id"]
            isOneToOne: false
            referencedRelation: "club_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_rentable_times_facility_id_fkey"
            columns: ["club_facility_id"]
            isOneToOne: false
            referencedRelation: "club_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_certifications: {
        Row: {
          awarded_date: string
          certificate_image_url: string | null
          certificate_name: string
          certificate_number: string | null
          created_at: string | null
          description: string | null
          expiry_date: string | null
          id: string
          instructor_id: string
          issuing_organization: string
          updated_at: string | null
        }
        Insert: {
          awarded_date: string
          certificate_image_url?: string | null
          certificate_name: string
          certificate_number?: string | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          instructor_id: string
          issuing_organization: string
          updated_at?: string | null
        }
        Update: {
          awarded_date?: string
          certificate_image_url?: string | null
          certificate_name?: string
          certificate_number?: string | null
          created_at?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          instructor_id?: string
          issuing_organization?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_certifications_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "club_instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          instructor_id: string
          member_id: string
          rating: number
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          instructor_id: string
          member_id: string
          rating: number
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          instructor_id?: string
          member_id?: string
          rating?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_reviews_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "club_instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_reviews_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_acquired_skills: {
        Row: {
          acquired_date: string | null
          acquired_from_activity_id: string | null
          created_at: string | null
          id: string
          membership_history_id: string
          skill_category: string | null
          skill_name: string
        }
        Insert: {
          acquired_date?: string | null
          acquired_from_activity_id?: string | null
          created_at?: string | null
          id?: string
          membership_history_id: string
          skill_category?: string | null
          skill_name: string
        }
        Update: {
          acquired_date?: string | null
          acquired_from_activity_id?: string | null
          created_at?: string | null
          id?: string
          membership_history_id?: string
          skill_category?: string | null
          skill_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_acquired_skills_acquired_from_activity_id_fkey"
            columns: ["acquired_from_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_acquired_skills_membership_history_id_fkey"
            columns: ["membership_history_id"]
            isOneToOne: false
            referencedRelation: "membership_history"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_history: {
        Row: {
          child_id: string | null
          club_id: string
          created_at: string | null
          duration_days: number
          id: string
          joined_date: string
          leave_reason: string | null
          left_date: string
          member_name: string
          user_id: string | null
        }
        Insert: {
          child_id?: string | null
          club_id: string
          created_at?: string | null
          duration_days: number
          id?: string
          joined_date: string
          leave_reason?: string | null
          left_date: string
          member_name: string
          user_id?: string | null
        }
        Update: {
          child_id?: string | null
          club_id?: string
          created_at?: string | null
          duration_days?: number
          id?: string
          joined_date?: string
          leave_reason?: string | null
          left_date?: string
          member_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_history_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_requests: {
        Row: {
          club_id: string
          created_at: string | null
          id: string
          notes: string | null
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id: string
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          club_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          club_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          club_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      package_activities: {
        Row: {
          activity_id: string | null
          class_id: string | null
          created_at: string | null
          id: string
          instructor_id: string | null
          package_id: string
        }
        Insert: {
          activity_id?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          instructor_id?: string | null
          package_id: string
        }
        Update: {
          activity_id?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          instructor_id?: string | null
          package_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_activities_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "club_instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_activities_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "club_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_enrollments: {
        Row: {
          created_at: string | null
          enrolled_at: string | null
          enrollment_transaction_id: string | null
          id: string
          is_active: boolean | null
          member_id: string
          package_id: string
          package_price_version_id: string | null
          package_transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enrolled_at?: string | null
          enrollment_transaction_id?: string | null
          id?: string
          is_active?: boolean | null
          member_id: string
          package_id: string
          package_price_version_id?: string | null
          package_transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enrolled_at?: string | null
          enrollment_transaction_id?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string
          package_id?: string
          package_price_version_id?: string | null
          package_transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_enrollments_enrollment_transaction_id_fkey"
            columns: ["enrollment_transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_enrollments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_enrollments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "club_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_enrollments_package_price_version_id_fkey"
            columns: ["package_price_version_id"]
            isOneToOne: false
            referencedRelation: "package_price_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_enrollments_package_transaction_id_fkey"
            columns: ["package_transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      package_price_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          package_id: string
          price: number
          valid_from: string
          valid_until: string | null
          vat_percentage: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          package_id: string
          price: number
          valid_from?: string
          valid_until?: string | null
          vat_percentage?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          package_id?: string
          price?: number
          valid_from?: string
          valid_until?: string | null
          vat_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_price_history_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "club_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          blood_type: string | null
          country_code: string
          created_at: string | null
          date_of_birth: string
          email: string | null
          gender: string
          id: string
          name: string
          nationality: string
          phone: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          blood_type?: string | null
          country_code: string
          created_at?: string | null
          date_of_birth: string
          email?: string | null
          gender: string
          id?: string
          name: string
          nationality: string
          phone: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          blood_type?: string | null
          country_code?: string
          created_at?: string | null
          date_of_birth?: string
          email?: string | null
          gender?: string
          id?: string
          name?: string
          nationality?: string
          phone?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transaction_history: {
        Row: {
          change_type: string
          changed_at: string | null
          changed_by: string
          id: string
          new_values: Json | null
          notes: string | null
          previous_values: Json | null
          transaction_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string | null
          changed_by: string
          id?: string
          new_values?: Json | null
          notes?: string | null
          previous_values?: Json | null
          transaction_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string | null
          changed_by?: string
          id?: string
          new_values?: Json | null
          notes?: string | null
          previous_values?: Json | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_ledger: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: Database["public"]["Enums"]["expense_category"] | null
          change_history: Json | null
          club_id: string
          created_at: string | null
          created_by: string | null
          description: string
          enrollment_id: string | null
          id: string
          is_refund: boolean | null
          member_email: string | null
          member_id: string | null
          member_name: string | null
          member_phone: string | null
          notes: string | null
          package_price_version_id: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_screenshot_url: string | null
          payment_status: string | null
          receipt_number: string | null
          reference_id: string | null
          refund_amount: number | null
          refund_proof_url: string | null
          refunded_transaction_id: string | null
          rejection_reason: string | null
          total_amount: number
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
          updated_by: string | null
          vat_amount: number
          vat_percentage_applied: number
          version: number | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          change_history?: Json | null
          club_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          enrollment_id?: string | null
          id?: string
          is_refund?: boolean | null
          member_email?: string | null
          member_id?: string | null
          member_name?: string | null
          member_phone?: string | null
          notes?: string | null
          package_price_version_id?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_screenshot_url?: string | null
          payment_status?: string | null
          receipt_number?: string | null
          reference_id?: string | null
          refund_amount?: number | null
          refund_proof_url?: string | null
          refunded_transaction_id?: string | null
          rejection_reason?: string | null
          total_amount: number
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
          updated_by?: string | null
          vat_amount?: number
          vat_percentage_applied?: number
          version?: number | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: Database["public"]["Enums"]["expense_category"] | null
          change_history?: Json | null
          club_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          enrollment_id?: string | null
          id?: string
          is_refund?: boolean | null
          member_email?: string | null
          member_id?: string | null
          member_name?: string | null
          member_phone?: string | null
          notes?: string | null
          package_price_version_id?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_screenshot_url?: string | null
          payment_status?: string | null
          receipt_number?: string | null
          reference_id?: string | null
          refund_amount?: number | null
          refund_proof_url?: string | null
          refunded_transaction_id?: string | null
          rejection_reason?: string | null
          total_amount?: number
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
          updated_by?: string | null
          vat_amount?: number
          vat_percentage_applied?: number
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_ledger_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_ledger_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "package_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_ledger_package_price_version_id_fkey"
            columns: ["package_price_version_id"]
            isOneToOne: false
            referencedRelation: "package_price_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_ledger_refunded_transaction_id_fkey"
            columns: ["refunded_transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      calculate_package_popularity: {
        Args: { p_package_id: string }
        Returns: number
      }
      generate_receipt_number: { Args: { p_club_id: string }; Returns: string }
      get_registered_users_count: { Args: never; Returns: number }
      get_user_role_for_login: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_profile_for_login: {
        Args: { identifier: string }
        Returns: {
          avatar_url: string
          email: string
          name: string
          nationality: string
          phone: string
          user_id: string
        }[]
      }
      process_member_leave: {
        Args: { p_leave_reason?: string; p_member_id: string }
        Returns: Json
      }
      recalculate_all_package_popularity: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "business_owner"
      expense_category:
        | "rent"
        | "utilities"
        | "equipment"
        | "salaries"
        | "maintenance"
        | "marketing"
        | "insurance"
        | "other"
      transaction_type:
        | "enrollment_fee"
        | "package_fee"
        | "expense"
        | "refund"
        | "product_sale"
        | "facility_rental"
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
      app_role: ["admin", "user", "super_admin", "business_owner"],
      expense_category: [
        "rent",
        "utilities",
        "equipment",
        "salaries",
        "maintenance",
        "marketing",
        "insurance",
        "other",
      ],
      transaction_type: [
        "enrollment_fee",
        "package_fee",
        "expense",
        "refund",
        "product_sale",
        "facility_rental",
      ],
    },
  },
} as const

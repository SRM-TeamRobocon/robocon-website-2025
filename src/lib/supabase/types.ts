export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          name: string;
          role: string;
          domain: string | null;
          year: string | null;
          photo_url: string | null;
          linkedin_url: string | null;
          instagram_url: string | null;
          facebook_url: string | null;
          is_active: boolean;
          display_order: number;
          member_account_id: string | null;
          lead_username: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          role: string;
          domain?: string | null;
          year?: string | null;
          photo_url?: string | null;
          linkedin_url?: string | null;
          instagram_url?: string | null;
          facebook_url?: string | null;
          is_active?: boolean;
          display_order?: number;
          member_account_id?: string | null;
          lead_username?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>;
        Relationships: [];
      };
      member_accounts: {
        Row: {
          id: string;
          name: string;
          email: string;
          domain: string;
          reg_no: string;
          department: string;
          course: string;
          phone: string | null;
          password_hash: string;
          email_verified: boolean;
          verification_token: string | null;
          verification_expires: string | null;
          is_approved: boolean;
          approved_at: string | null;
          role: string;
          created_at: string;
          password_enc: string | null;
          reset_otp_hash: string | null;
          reset_otp_expires: string | null;
          reset_otp_attempts: number;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          domain: string;
          reg_no: string;
          department: string;
          course: string;
          phone?: string | null;
          password_hash: string;
          email_verified?: boolean;
          verification_token?: string | null;
          verification_expires?: string | null;
          is_approved?: boolean;
          approved_at?: string | null;
          role?: string;
          created_at?: string;
          password_enc?: string | null;
          reset_otp_hash?: string | null;
          reset_otp_expires?: string | null;
          reset_otp_attempts?: number;
        };
        Update: Partial<Database["public"]["Tables"]["member_accounts"]["Insert"]>;
        Relationships: [];
      };
      content_edits: {
        Row: {
          id: string;
          resource: string;
          record_id: string | null;
          action: string;
          payload: Json;
          submitted_by: string;
          status: string;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource: string;
          record_id?: string | null;
          action: string;
          payload: Json;
          submitted_by: string;
          status?: string;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_edits"]["Insert"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          abstract: string | null;
          cover_image_url: string | null;
          cover_width: number | null;
          cover_height: number | null;
          gallery_urls: string[] | null;
          shortkey: string | null;
          tech_stack: string[] | null;
          year: string | null;
          competition: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          abstract?: string | null;
          cover_image_url?: string | null;
          cover_width?: number | null;
          cover_height?: number | null;
          gallery_urls?: string[] | null;
          shortkey?: string | null;
          tech_stack?: string[] | null;
          year?: string | null;
          competition?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      achievements: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          abstract: string | null;
          cover_image_url: string | null;
          cover_width: number | null;
          cover_height: number | null;
          gallery_urls: string[] | null;
          achievement_date: string | null;
          competition: string | null;
          rank: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          abstract?: string | null;
          cover_image_url?: string | null;
          cover_width?: number | null;
          cover_height?: number | null;
          gallery_urls?: string[] | null;
          achievement_date?: string | null;
          competition?: string | null;
          rank?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["achievements"]["Insert"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          abstract: string | null;
          cover_image_url: string | null;
          cover_width: number | null;
          cover_height: number | null;
          gallery_urls: string[] | null;
          event_date: string | null;
          location: string | null;
          registration_link: string | null;
          is_upcoming: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          abstract?: string | null;
          cover_image_url?: string | null;
          cover_width?: number | null;
          cover_height?: number | null;
          gallery_urls?: string[] | null;
          event_date?: string | null;
          location?: string | null;
          registration_link?: string | null;
          is_upcoming?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      alumni: {
        Row: {
          id: string;
          name: string;
          domain: string | null;
          designation: string | null;
          about: string | null;
          description: string | null;
          profession: string | null;
          batch: string | null;
          photo_url: string | null;
          linkedin_url: string | null;
          instagram_url: string | null;
          facebook_url: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain?: string | null;
          designation?: string | null;
          about?: string | null;
          description?: string | null;
          profession?: string | null;
          batch?: string | null;
          photo_url?: string | null;
          linkedin_url?: string | null;
          instagram_url?: string | null;
          facebook_url?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alumni"]["Insert"]>;
        Relationships: [];
      };
      gallery: {
        Row: {
          id: string;
          album_id: string;
          image_url: string;
          title: string | null;
          content: string | null;
          display_order: number;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          album_id: string;
          image_url: string;
          title?: string | null;
          content?: string | null;
          display_order?: number;
          uploaded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gallery"]["Insert"]>;
        Relationships: [];
      };
      gallery_albums: {
        Row: {
          id: string;
          title: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gallery_albums"]["Insert"]>;
        Relationships: [];
      };
      contact_submissions: {
        Row: {
          id: string;
          name: string;
          email: string;
          message: string;
          submitted_at: string;
          is_read: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          message: string;
          submitted_at?: string;
          is_read?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["contact_submissions"]["Insert"]>;
        Relationships: [];
      };
      blogs: {
        Row: {
          id: string;
          title: string;
          slug: string;
          cover_image_url: string | null;
          content: Json;
          visibility: string;
          status: string;
          submitted_by: string | null;
          author_username: string;
          author_name: string;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          cover_image_url?: string | null;
          content?: Json;
          visibility?: string;
          status?: string;
          submitted_by?: string | null;
          author_username: string;
          author_name: string;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          published_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blogs"]["Insert"]>;
        Relationships: [];
      };
      timetables: {
        Row: {
          id: string;
          owner_username: string;
          owner_name: string;
          domain: string | null;
          schedule: Json;
          campus: string;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_username: string;
          owner_name: string;
          domain?: string | null;
          schedule?: Json;
          campus?: string;
          updated_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["timetables"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

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
      group_teams: {
        Row: {
          bonus_points: number
          fairplay_points: number
          group_id: string
          id: string
          manual_position: number | null
          team_id: string
          tournament_id: string
        }
        Insert: {
          bonus_points?: number
          fairplay_points?: number
          group_id: string
          id?: string
          manual_position?: number | null
          team_id: string
          tournament_id: string
        }
        Update: {
          bonus_points?: number
          fairplay_points?: number
          group_id?: string
          id?: string
          manual_position?: number | null
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          phase_id: string
          scoring_system_id: string | null
          sort_order: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          phase_id: string
          scoring_system_id?: string | null
          sort_order?: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          phase_id?: string
          scoring_system_id?: string | null
          sort_order?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "tournament_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_scoring_system_id_fkey"
            columns: ["scoring_system_id"]
            isOneToOne: false
            referencedRelation: "tournament_scoring_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      match_stats: {
        Row: {
          created_at: string
          id: string
          match_id: string
          minute: number | null
          player_name: string
          stat_type: Database["public"]["Enums"]["stat_type"]
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          minute?: number | null
          player_name: string
          stat_type: Database["public"]["Enums"]["stat_type"]
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          minute?: number | null
          player_name?: string
          stat_type?: Database["public"]["Enums"]["stat_type"]
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_stats_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_penalties: number | null
          away_score: number | null
          away_slot_label: string | null
          away_team_id: string | null
          created_at: string
          field: string | null
          group_id: string | null
          home_penalties: number | null
          home_score: number | null
          home_slot_label: string | null
          home_team_id: string | null
          id: string
          is_played: boolean
          match_date: string | null
          match_name: string | null
          match_time: string | null
          phase_id: string
          referee: string | null
          round_number: number | null
          scoring_system_id: string | null
          set_scores: Json | null
          tournament_id: string
        }
        Insert: {
          away_penalties?: number | null
          away_score?: number | null
          away_slot_label?: string | null
          away_team_id?: string | null
          created_at?: string
          field?: string | null
          group_id?: string | null
          home_penalties?: number | null
          home_score?: number | null
          home_slot_label?: string | null
          home_team_id?: string | null
          id?: string
          is_played?: boolean
          match_date?: string | null
          match_name?: string | null
          match_time?: string | null
          phase_id: string
          referee?: string | null
          round_number?: number | null
          scoring_system_id?: string | null
          set_scores?: Json | null
          tournament_id: string
        }
        Update: {
          away_penalties?: number | null
          away_score?: number | null
          away_slot_label?: string | null
          away_team_id?: string | null
          created_at?: string
          field?: string | null
          group_id?: string | null
          home_penalties?: number | null
          home_score?: number | null
          home_slot_label?: string | null
          home_team_id?: string | null
          id?: string
          is_played?: boolean
          match_date?: string | null
          match_name?: string | null
          match_time?: string | null
          phase_id?: string
          referee?: string | null
          round_number?: number | null
          scoring_system_id?: string | null
          set_scores?: Json | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "tournament_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_scoring_system_id_fkey"
            columns: ["scoring_system_id"]
            isOneToOne: false
            referencedRelation: "tournament_scoring_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_progressions: {
        Row: {
          created_at: string
          from_group_id: string | null
          from_phase_id: string
          from_position: number
          id: string
          to_group_id: string | null
          to_phase_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          from_group_id?: string | null
          from_phase_id: string
          from_position: number
          id?: string
          to_group_id?: string | null
          to_phase_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          from_group_id?: string | null
          from_phase_id?: string
          from_position?: number
          id?: string
          to_group_id?: string | null
          to_phase_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_progressions_from_group_id_fkey"
            columns: ["from_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_progressions_from_phase_id_fkey"
            columns: ["from_phase_id"]
            isOneToOne: false
            referencedRelation: "tournament_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_progressions_to_group_id_fkey"
            columns: ["to_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_progressions_to_phase_id_fkey"
            columns: ["to_phase_id"]
            isOneToOne: false
            referencedRelation: "tournament_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_progressions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          birth_date: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          photo_url: string | null
          position: Database["public"]["Enums"]["player_position"] | null
          shirt_number: number | null
          team_id: string
          tournament_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          photo_url?: string | null
          position?: Database["public"]["Enums"]["player_position"] | null
          shirt_number?: number | null
          team_id: string
          tournament_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          photo_url?: string | null
          position?: Database["public"]["Enums"]["player_position"] | null
          shirt_number?: number | null
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "tournament_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          organization: string | null
          phone: string | null
          phone_country_code: string | null
          postal_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization?: string | null
          phone?: string | null
          phone_country_code?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization?: string | null
          phone?: string | null
          phone_country_code?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ranking_rules: {
        Row: {
          created_at: string
          id: string
          phase_id: string | null
          rule_order: Json
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phase_id?: string | null
          rule_order?: Json
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phase_id?: string | null
          rule_order?: Json
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_rules_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "tournament_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      slots: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          phase_id: string
          ref_group_id: string | null
          ref_phase_id: string | null
          ref_position: number | null
          slot_code: string
          sort_order: number
          team_id: string | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          phase_id: string
          ref_group_id?: string | null
          ref_phase_id?: string | null
          ref_position?: number | null
          slot_code: string
          sort_order?: number
          team_id?: string | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          phase_id?: string
          ref_group_id?: string | null
          ref_phase_id?: string | null
          ref_position?: number | null
          slot_code?: string
          sort_order?: number
          team_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slots_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "tournament_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_ref_group_id_fkey"
            columns: ["ref_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_ref_phase_id_fkey"
            columns: ["ref_phase_id"]
            isOneToOne: false
            referencedRelation: "tournament_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          id: string
          name: string
          photo_url: string | null
          role: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          role?: string
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          role?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      standing_colors: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string | null
          phase_id: string | null
          position_from: number
          position_to: number
          tournament_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          label?: string | null
          phase_id?: string | null
          position_from: number
          position_to: number
          tournament_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string | null
          phase_id?: string | null
          position_from?: number
          position_to?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_colors_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "tournament_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standing_colors_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          abbreviation: string | null
          category_id: string | null
          country: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          team_photo_url: string | null
          tournament_id: string
        }
        Insert: {
          abbreviation?: string | null
          category_id?: string | null
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          team_photo_url?: string | null
          tournament_id: string
        }
        Update: {
          abbreviation?: string | null
          category_id?: string | null
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          team_photo_url?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_attachments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_categories: {
        Row: {
          created_at: string
          fields: Json | null
          id: string
          name: string
          planner_breaks: Json | null
          referees: Json | null
          sort_order: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          fields?: Json | null
          id?: string
          name: string
          planner_breaks?: Json | null
          referees?: Json | null
          sort_order?: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          fields?: Json | null
          id?: string
          name?: string
          planner_breaks?: Json | null
          referees?: Json | null
          sort_order?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_locations: {
        Row: {
          created_at: string
          id: string
          name: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_locations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_phases: {
        Row: {
          category_id: string | null
          created_at: string
          emoji: string | null
          id: string
          logo_url: string | null
          match_config: Json | null
          name: string
          phase_label: string | null
          phase_logo_url: string | null
          phase_number: number
          phase_type: Database["public"]["Enums"]["phase_type"]
          position_offset: number
          scoring_system_id: string | null
          sort_order: number
          tournament_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          logo_url?: string | null
          match_config?: Json | null
          name: string
          phase_label?: string | null
          phase_logo_url?: string | null
          phase_number?: number
          phase_type?: Database["public"]["Enums"]["phase_type"]
          position_offset?: number
          scoring_system_id?: string | null
          sort_order?: number
          tournament_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          logo_url?: string | null
          match_config?: Json | null
          name?: string
          phase_label?: string | null
          phase_logo_url?: string | null
          phase_number?: number
          phase_type?: Database["public"]["Enums"]["phase_type"]
          position_offset?: number
          scoring_system_id?: string | null
          sort_order?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_phases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_phases_scoring_system_id_fkey"
            columns: ["scoring_system_id"]
            isOneToOne: false
            referencedRelation: "tournament_scoring_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_phases_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_polls: {
        Row: {
          active: boolean
          created_at: string
          id: string
          options: Json
          question: string
          tournament_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          options?: Json
          question: string
          tournament_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          options?: Json
          question?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_polls_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_scoring_systems: {
        Row: {
          big_win_threshold: number
          created_at: string
          decisive_set: boolean
          decisive_set_goal_diff: boolean
          h2h_sub_rules: Json
          id: string
          name: string
          no_draws: boolean
          num_sets: number
          playoff_mode: boolean
          points_big_win: number
          points_draw: number
          points_draw_no_goals: number
          points_draw_with_goals: number
          points_loss: number
          points_loss_overtime: number
          points_win: number
          points_win_overtime: number
          scoring_type: string
          set_points_mode: string
          set_result_points: Json
          sort_order: number
          tiebreaker_rules: Json
          tournament_id: string
        }
        Insert: {
          big_win_threshold?: number
          created_at?: string
          decisive_set?: boolean
          decisive_set_goal_diff?: boolean
          h2h_sub_rules?: Json
          id?: string
          name?: string
          no_draws?: boolean
          num_sets?: number
          playoff_mode?: boolean
          points_big_win?: number
          points_draw?: number
          points_draw_no_goals?: number
          points_draw_with_goals?: number
          points_loss?: number
          points_loss_overtime?: number
          points_win?: number
          points_win_overtime?: number
          scoring_type?: string
          set_points_mode?: string
          set_result_points?: Json
          sort_order?: number
          tiebreaker_rules?: Json
          tournament_id: string
        }
        Update: {
          big_win_threshold?: number
          created_at?: string
          decisive_set?: boolean
          decisive_set_goal_diff?: boolean
          h2h_sub_rules?: Json
          id?: string
          name?: string
          no_draws?: boolean
          num_sets?: number
          playoff_mode?: boolean
          points_big_win?: number
          points_draw?: number
          points_draw_no_goals?: number
          points_draw_with_goals?: number
          points_loss?: number
          points_loss_overtime?: number
          points_win?: number
          points_win_overtime?: number
          scoring_type?: string
          set_points_mode?: string
          set_result_points?: Json
          sort_order?: number
          tiebreaker_rules?: Json
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_scoring_systems_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_slideshows: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          name: string
          options: Json
          slides: Json
          sort_order: number
          sponsor_bar: Json
          tournament_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          name?: string
          options?: Json
          slides?: Json
          sort_order?: number
          sponsor_bar?: Json
          tournament_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          name?: string
          options?: Json
          slides?: Json
          sort_order?: number
          sponsor_bar?: Json
          tournament_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournament_sponsors: {
        Row: {
          created_at: string
          id: string
          logo_url: string
          name: string
          sort_order: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url: string
          name?: string
          sort_order?: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string
          name?: string
          sort_order?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_sponsors_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          break_duration: number | null
          cover_url: string | null
          created_at: string
          date_mode: string
          description: string | null
          enable_assists: boolean
          enable_fairplay: boolean
          enable_goalscorers: boolean
          enable_red_cards: boolean
          enable_yellow_cards: boolean
          end_date: string | null
          fields: Json | null
          format_display_mode: string
          full_placement: boolean
          id: string
          is_esport: boolean
          is_multi_category: boolean
          is_public: boolean
          logo_url: string | null
          match_days: Json
          match_duration: number | null
          name: string
          nextgen_rounds: number | null
          nextgen_size: number | null
          num_fields: number | null
          owner_id: string
          planner_breaks: Json | null
          points_draw: number
          points_loss: number
          points_win: number
          referees: Json | null
          referees_label: string
          scoring_type: string
          show_country: boolean
          show_public_assists: boolean
          show_public_fairplay: boolean
          show_public_top_scorers: boolean
          slideshow_config: Json
          sport: string | null
          standings_columns: Json
          start_date: string | null
          status: string
          team_count: number
          teams_label: string
          tournament_type: Database["public"]["Enums"]["tournament_type"]
          updated_at: string
          view_display_style: string
          view_link_active: boolean
          view_link_token: string | null
          view_theme: string | null
        }
        Insert: {
          break_duration?: number | null
          cover_url?: string | null
          created_at?: string
          date_mode?: string
          description?: string | null
          enable_assists?: boolean
          enable_fairplay?: boolean
          enable_goalscorers?: boolean
          enable_red_cards?: boolean
          enable_yellow_cards?: boolean
          end_date?: string | null
          fields?: Json | null
          format_display_mode?: string
          full_placement?: boolean
          id?: string
          is_esport?: boolean
          is_multi_category?: boolean
          is_public?: boolean
          logo_url?: string | null
          match_days?: Json
          match_duration?: number | null
          name: string
          nextgen_rounds?: number | null
          nextgen_size?: number | null
          num_fields?: number | null
          owner_id: string
          planner_breaks?: Json | null
          points_draw?: number
          points_loss?: number
          points_win?: number
          referees?: Json | null
          referees_label?: string
          scoring_type?: string
          show_country?: boolean
          show_public_assists?: boolean
          show_public_fairplay?: boolean
          show_public_top_scorers?: boolean
          slideshow_config?: Json
          sport?: string | null
          standings_columns?: Json
          start_date?: string | null
          status?: string
          team_count?: number
          teams_label?: string
          tournament_type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
          view_display_style?: string
          view_link_active?: boolean
          view_link_token?: string | null
          view_theme?: string | null
        }
        Update: {
          break_duration?: number | null
          cover_url?: string | null
          created_at?: string
          date_mode?: string
          description?: string | null
          enable_assists?: boolean
          enable_fairplay?: boolean
          enable_goalscorers?: boolean
          enable_red_cards?: boolean
          enable_yellow_cards?: boolean
          end_date?: string | null
          fields?: Json | null
          format_display_mode?: string
          full_placement?: boolean
          id?: string
          is_esport?: boolean
          is_multi_category?: boolean
          is_public?: boolean
          logo_url?: string | null
          match_days?: Json
          match_duration?: number | null
          name?: string
          nextgen_rounds?: number | null
          nextgen_size?: number | null
          num_fields?: number | null
          owner_id?: string
          planner_breaks?: Json | null
          points_draw?: number
          points_loss?: number
          points_win?: number
          referees?: Json | null
          referees_label?: string
          scoring_type?: string
          show_country?: boolean
          show_public_assists?: boolean
          show_public_fairplay?: boolean
          show_public_top_scorers?: boolean
          slideshow_config?: Json
          sport?: string | null
          standings_columns?: Json
          start_date?: string | null
          status?: string
          team_count?: number
          teams_label?: string
          tournament_type?: Database["public"]["Enums"]["tournament_type"]
          updated_at?: string
          view_display_style?: string
          view_link_active?: boolean
          view_link_token?: string | null
          view_theme?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_orphaned_attachment_paths: {
        Args: never
        Returns: {
          name: string
        }[]
      }
      get_orphaned_storage_paths: {
        Args: never
        Returns: {
          name: string
        }[]
      }
      get_poll_vote_counts: {
        Args: { p_poll_ids: string[] }
        Returns: {
          option_index: number
          poll_id: string
          vote_count: number
        }[]
      }
      get_tournament_by_view_token: {
        Args: { p_token: string }
        Returns: {
          break_duration: number | null
          cover_url: string | null
          created_at: string
          date_mode: string
          description: string | null
          enable_assists: boolean
          enable_fairplay: boolean
          enable_goalscorers: boolean
          enable_red_cards: boolean
          enable_yellow_cards: boolean
          end_date: string | null
          fields: Json | null
          format_display_mode: string
          full_placement: boolean
          id: string
          is_esport: boolean
          is_multi_category: boolean
          is_public: boolean
          logo_url: string | null
          match_days: Json
          match_duration: number | null
          name: string
          nextgen_rounds: number | null
          nextgen_size: number | null
          num_fields: number | null
          owner_id: string
          planner_breaks: Json | null
          points_draw: number
          points_loss: number
          points_win: number
          referees: Json | null
          referees_label: string
          scoring_type: string
          show_country: boolean
          show_public_assists: boolean
          show_public_fairplay: boolean
          show_public_top_scorers: boolean
          slideshow_config: Json
          sport: string | null
          standings_columns: Json
          start_date: string | null
          status: string
          team_count: number
          teams_label: string
          tournament_type: Database["public"]["Enums"]["tournament_type"]
          updated_at: string
          view_display_style: string
          view_link_active: boolean
          view_link_token: string | null
          view_theme: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "tournaments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_tournament_owner: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      set_tournament_match_days: {
        Args: { _match_days: Json; _tournament_id: string }
        Returns: Json
      }
    }
    Enums: {
      phase_type: "group" | "knockout" | "round_robin" | "single_match"
      player_position: "goalkeeper" | "defender" | "midfielder" | "attacker"
      stat_type: "goal" | "assist" | "yellow_card" | "red_card" | "straight_red"
      tournament_type: "classic" | "nextgen"
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
      phase_type: ["group", "knockout", "round_robin", "single_match"],
      player_position: ["goalkeeper", "defender", "midfielder", "attacker"],
      stat_type: ["goal", "assist", "yellow_card", "red_card", "straight_red"],
      tournament_type: ["classic", "nextgen"],
    },
  },
} as const

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Database {
  public: {
    Tables: {
      prompt_versions: {
        Row: {
          id: string;
          prompt_text: string;
          scenario_id: string;
          scenario_name: string;
          version_number: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_text: string;
          scenario_id: string;
          scenario_name: string;
          version_number?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          prompt_text?: string;
          scenario_id?: string;
          scenario_name?: string;
          version_number?: number;
          created_at?: string;
        };
      };
      test_results: {
        Row: {
          id: string;
          prompt_version_id: string | null;
          test_input: string;
          test_output: string;
          accuracy: number;
          relevance: number;
          tone: number;
          consistency: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_version_id?: string | null;
          test_input: string;
          test_output: string;
          accuracy: number;
          relevance: number;
          tone: number;
          consistency: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          prompt_version_id?: string | null;
          test_input?: string;
          test_output?: string;
          accuracy?: number;
          relevance?: number;
          tone?: number;
          consistency?: number;
          created_at?: string;
        };
      };
    };
  };
}

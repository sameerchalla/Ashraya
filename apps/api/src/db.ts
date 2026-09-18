/**
 * Ashraya API — Database Connection Module
 * Connects via postgres.js (for transactional RPCs) and @supabase/supabase-js
 */

import postgres from 'postgres';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment credentials
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

// 1. Transactional SQL client (PostgreSQL connection pool)
export const sql = postgres(DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  transform: {
    undefined: null,
  },
});

// 2. Supabase Admin Client
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

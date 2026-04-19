
const SUPABASE_URL = "https://fqpofzlxixbitybltajx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcG9memx4aXhiaXR5Ymx0YWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjc5MDksImV4cCI6MjA5MTc0MzkwOX0.woDW07ULao_dYlqBaafJmc1Mjt3FAthShm0CBoMmWFY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export { supabaseClient };
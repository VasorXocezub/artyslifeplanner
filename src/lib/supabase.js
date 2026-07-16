import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nxyhzmskjrjcrwiprnzw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eWh6bXNranJqY3J3aXBybnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTg5NDksImV4cCI6MjA5OTY5NDk0OX0.Nfn-FVEgm3_KCYGP2P4XUSKP-5tHZIBakV88Zo4_7c4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://opjbzsmzjkmtuwqqoebu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wamJ6c216amttdHV3cXFvZWJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzMyNTYsImV4cCI6MjA4NjkwOTI1Nn0.GMMLYxtE0w1QHQz01rvM9QX7cl8vtJM8dpDQXd5IqSM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
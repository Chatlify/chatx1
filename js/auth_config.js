import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase Proje Bilgileri
const supabaseUrl = 'https://omyoobepjyyyvemovyim.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teW9vYmVwanl5eXZlbW92eWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxNjIyNDksImV4cCI6MjA1MDczODI0OX0.-aNn51tjlgKLE9GssA0H4WvuCTYS3SMWIsJ4pz-PxqQ'

// Supabase istemcisini oluştur ve dışa aktar
export const supabase = createClient(supabaseUrl, supabaseAnonKey) 
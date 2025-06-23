import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase Proje Bilgileri
const supabaseUrl = 'https://krrfgdoqlsytuspawqse.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtycmZnZG9xbHN5dHVzcGF3cXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgzNjQyOTIsImV4cCI6MjAzMzk0MDI5Mn0.yC02tC7I0kM1s3s2I2J1-2hREmR2O-d4TSt4_z_cU9Q'

// Supabase istemcisini oluştur ve dışa aktar
export const supabase = createClient(supabaseUrl, supabaseAnonKey) 
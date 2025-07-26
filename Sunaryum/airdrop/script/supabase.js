

// Use o caminho completo do ESM CDN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = "https://fhamhyolyolsirfxxhan.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYW1oeW9seW9sc2lyZnh4aGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1NjAyMjIsImV4cCI6MjA2NTEzNjIyMn0.iQIDCKWVZpKlmbKXG60J-nUd5lK-S5Nw5GvDSqE_w1Y";

// Exporte como um objeto global para facilitar o acesso
const supabase = createClient(supabaseUrl, supabaseKey)
export { supabase }
